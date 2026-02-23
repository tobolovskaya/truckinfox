import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../hooks/useNotifications';
import { db, storage } from '../../lib/firebase';
import { trackCargoCreated } from '../../utils/analytics';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitization';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import { triggerHapticFeedback } from '../../utils/haptics';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import { useDebouncedCallback } from 'use-debounce';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { calculateDistance } from '../../utils/googlePlaces';
import { geohashForLocation } from 'geofire-common';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { LazyImage } from '../../components/LazyImage';
import { generateCargoSearchTerms } from '../../utils/search';

const CARGO_TYPES = [
  { id: 'automotive', label: 'Bil/Motor' },
  { id: 'construction', label: 'Byggemateriale' },
  { id: 'boats', label: 'Båter' },
  { id: 'electronics', label: 'Elektronikk' },
  { id: 'campingvogn', label: 'Campingvogn' },
  { id: 'machinery', label: 'Maskineri' },
  { id: 'furniture', label: 'Møbler' },
  { id: 'other', label: 'Annet' },
];

const PRICE_TYPES = [
  { id: 'negotiable', label: 'Kan forhandles' },
  { id: 'fixed', label: 'Fast pris' },
];

const CARGO_LIMITS = {
  weight: { min: 1, max: 25000 },
  dimension: { min: 1, max: 1200 },
  volume: { max: 40 },
} as const;

const DRAFT_KEY = 'cargo-request-draft';
const DRAFT_EXPIRY_HOURS = 24;
const AUTOSAVE_DEBOUNCE_MS = 2000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default function CreateRequestScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 360;
  const { unreadCount } = useNotifications();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cargo_type: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    from_address: '',
    to_address: '',
    from_lat: null as number | null,
    from_lng: null as number | null,
    to_lat: null as number | null,
    to_lng: null as number | null,
    distance_km: null as number | null,
    pickup_date: new Date(),
    delivery_date: new Date(Date.now() + MS_PER_DAY),
    price_type: '',
    price: '',
  });
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [liveValidation, setLiveValidation] = useState(false);
  const [showPickupDate, setShowPickupDate] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [showCargoTypeMenu, setShowCargoTypeMenu] = useState(false);
  const [showPriceTypeMenu, setShowPriceTypeMenu] = useState(false);
  const fromAddressTextRef = useRef('');
  const toAddressTextRef = useRef('');
  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(DRAFT_KEY);
        if (draft) {
          const parsed = JSON.parse(draft);

          if (!parsed.savedAt) {
            await AsyncStorage.removeItem(DRAFT_KEY);
            return;
          }

          const savedAt = new Date(parsed.savedAt);
          if (isNaN(savedAt.getTime())) {
            await AsyncStorage.removeItem(DRAFT_KEY);
            return;
          }

          const hoursSince = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);

          if (hoursSince < DRAFT_EXPIRY_HOURS) {
            const hoursText = Math.round(hoursSince) === 1 ? 'time' : 'timer';
            toast.info(`Fant lagret utkast fra ${Math.round(hoursSince)} ${hoursText} siden`);
            setFormData({
              ...parsed,
              pickup_date: parsed.pickup_date ? new Date(parsed.pickup_date) : new Date(),
              delivery_date: parsed.delivery_date
                ? new Date(parsed.delivery_date)
                : new Date(Date.now() + MS_PER_DAY),
            });
            setImages(parsed.images || []);
          } else {
            await AsyncStorage.removeItem(DRAFT_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };

    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            ...formData,
            images,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    };

    const timeoutId = setTimeout(saveDraft, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [formData, images]);

  const clearDistanceIfNeeded = (field: string) => {
    if (field === 'from_address' || field === 'to_address') {
      setFormData(prev => ({ ...prev, distance_km: null }));
    }
  };

  const validateField = (
    field: string,
    value: unknown,
    nextData: typeof formData = formData
  ): string => {
    switch (field) {
      case 'title':
        if (!value || !value.toString().trim()) return t('titleRequired');
        if (value.toString().trim().length < 3) return t('titleMinLength');
        if (value.toString().trim().length > 100) return t('titleMaxLength');
        return '';

      case 'description':
        if (!value || !value.toString().trim()) return t('descriptionRequired');
        if (value.toString().trim().length < 10) return t('descriptionMinLength');
        if (value.toString().trim().length > 500) return t('descriptionMaxLength');
        return '';

      case 'cargo_type':
        if (!value) return t('cargoTypeRequired');
        return '';

      case 'weight': {
        if (!value || value.toString().trim() === '') return t('weightRequired');
        const weight = Number(value);
        if (isNaN(weight)) return t('weightMustBeNumber');
        if (weight < CARGO_LIMITS.weight.min || weight > CARGO_LIMITS.weight.max)
          return `Vekt må være mellom ${CARGO_LIMITS.weight.min} og ${CARGO_LIMITS.weight.max} kg`;
        return '';
      }

      case 'length':
      case 'width':
      case 'height': {
        if (value && value.toString().trim()) {
          const dim = Number(value);
          if (isNaN(dim) || dim < CARGO_LIMITS.dimension.min || dim > CARGO_LIMITS.dimension.max) {
            return `Dimensjon må være mellom ${CARGO_LIMITS.dimension.min} og ${CARGO_LIMITS.dimension.max} cm`;
          }
        }
        return '';
      }

      case 'from_address':
        if (!value || !value.toString().trim()) return t('fromAddressRequired');
        if (value.toString().trim().length < 3) return t('fromAddressMinLength');
        return '';

      case 'to_address':
        if (!value || !value.toString().trim()) return t('toAddressRequired');
        if (value.toString().trim().length < 3) return t('toAddressMinLength');
        return '';

      case 'price_type':
        if (!value) return t('priceTypeRequired');
        return '';

      case 'price':
        if (nextData.price_type === 'fixed') {
          if (!value || value.toString().trim() === '') return t('priceRequired');
          const price = Number(value);
          if (isNaN(price)) return t('priceMustBeNumber');
          if (price <= 0) return t('priceMustBePositive');
          if (price > 1000000) return t('priceMaxExceeded');
        }
        return '';

      default:
        return '';
    }
  };

  const debouncedValidateField = useDebouncedCallback(
    (field: string, value: unknown, nextData: typeof formData) => {
      const error = validateField(field, value, nextData);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    },
    300
  );

  const getValidationState = (field: string, value: unknown) => {
    const showValidation = liveValidation || Boolean(touchedFields[field]);
    const error = fieldErrors[field];
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
    const isValid = showValidation && !error && hasValue;

    return { showValidation, error, isValid };
  };

  const getInputValidationStyles = (field: string, value: unknown) => {
    const { showValidation, error, isValid } = getValidationState(field, value);
    return [showValidation && error && styles.textInputError, isValid && styles.textInputValid];
  };

  const getFieldError = (field: string, value: unknown) => {
    const { showValidation, error } = getValidationState(field, value);
    return showValidation ? error : undefined;
  };

  const renderFieldError = (field: string, value: unknown) => {
    const { showValidation, error } = getValidationState(field, value);
    if (!showValidation || !error) {
      return null;
    }

    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={16} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  };

  const renderValidIcon = (field: string, value: unknown) => {
    const { isValid } = getValidationState(field, value);
    if (!isValid) {
      return null;
    }

    return (
      <Ionicons name="checkmark-circle" size={18} color={colors.success} style={styles.validIcon} />
    );
  };

  const updateFormData = (field: string, value: unknown) => {
    setFormData(prev => {
      const nextData = { ...prev, [field]: value };
      const shouldValidate = liveValidation || Boolean(touchedFields[field]);

      if (shouldValidate) {
        debouncedValidateField(field, value, nextData);
      }

      if (field === 'price_type' && (liveValidation || touchedFields.price)) {
        debouncedValidateField('price', nextData.price, nextData);
      }

      return nextData;
    });
  };

  const handleBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateDimensions = (): boolean => {
    const weight = Number(formData.weight);

    if (weight < CARGO_LIMITS.weight.min || weight > CARGO_LIMITS.weight.max) {
      toast.error(
        `Vekt må være mellom ${CARGO_LIMITS.weight.min} og ${CARGO_LIMITS.weight.max} kg`
      );
      triggerHapticFeedback.error();
      return false;
    }

    if (formData.length && formData.width && formData.height) {
      const length = Number(formData.length);
      const width = Number(formData.width);
      const height = Number(formData.height);

      for (const dim of [length, width, height]) {
        if (isNaN(dim) || dim < CARGO_LIMITS.dimension.min || dim > CARGO_LIMITS.dimension.max) {
          toast.error(
            `Dimensjoner må være mellom ${CARGO_LIMITS.dimension.min} og ${CARGO_LIMITS.dimension.max} cm`
          );
          triggerHapticFeedback.error();
          return false;
        }
      }

      const volume = (length * width * height) / 1000000;
      if (volume > CARGO_LIMITS.volume.max) {
        toast.error(
          `Lastevolum (${volume.toFixed(2)} m³) overstiger maksimum (${CARGO_LIMITS.volume.max} m³)`
        );
        triggerHapticFeedback.error();
        return false;
      }
    }

    return true;
  };

  const validateForm = () => {
    const fieldsToValidate = [
      'title',
      'description',
      'cargo_type',
      'weight',
      'from_address',
      'to_address',
      'price_type',
      'price',
    ];
    const newErrors: { [key: string]: string } = {};
    const newTouched: { [key: string]: boolean } = {};

    fieldsToValidate.forEach(field => {
      newTouched[field] = true;
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) {
        newErrors[field] = error;
      }
    });

    setTouchedFields(newTouched);
    setFieldErrors(newErrors);

    const firstError = Object.values(newErrors).find(error => error);
    if (firstError) {
      toast.error(firstError);
      triggerHapticFeedback.error();
      return false;
    }

    if (!validateDimensions()) {
      return false;
    }

    return true;
  };

  const checkForDuplicates = async (): Promise<boolean> => {
    if (!user?.uid) {
      return true;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const recentRequests = await getDocs(
      query(
        collection(db, 'cargo_requests'),
        where('user_id', '==', user.uid),
        where('created_at', '>', since),
        orderBy('created_at', 'desc')
      )
    );

    const similar = recentRequests.docs.find(docSnapshot => {
      const data = docSnapshot.data();
      return (
        data.from_address === formData.from_address &&
        data.to_address === formData.to_address &&
        Math.abs((data.weight ?? 0) - Number(formData.weight)) < 10
      );
    });

    if (!similar) {
      return true;
    }

    return new Promise(resolve => {
      Alert.alert(t('duplicateRequestTitle'), t('duplicateRequestMessage'), [
        { text: t('no'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('yes'), onPress: () => resolve(true) },
      ]);
    });
  };

  const compressImage = async (uri: string) => {
    try {
      const manipResult = await manipulateAsync(uri, [{ resize: { width: 1200 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
      });
      return manipResult.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  };

  const pickImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        toast.warning('Vi trenger tilgang til bildene dine for å laste opp bilder');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        const remainingSlots = 5 - images.length;
        const imagesToAdd = newImages.slice(0, remainingSlots);

        if (newImages.length > remainingSlots) {
          toast.info('Du kan bare laste opp maksimalt 5 bilder');
        }

        setImages([...images, ...imagesToAdd]);

        try {
          triggerHapticFeedback.light();
        } catch {
          // Haptic feedback not available
        }
      }
    } catch (error) {
      console.error('Error picking images:', error);
      toast.error('Kunne ikke laste bilder');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    try {
      triggerHapticFeedback.light();
    } catch {
      // Haptic feedback not available
    }
  };

  const uploadImages = async (requestId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    setUploadProgress({});

    for (let i = 0; i < images.length; i++) {
      try {
        const uri = images[i];
        const compressedUri = await compressImage(uri);
        const ext = uri.split('.').pop() || 'jpg';
        const fileName = `request-images/${requestId}/${Date.now()}_${i}.${ext}`;
        const imageKey = `image_${i + 1}`;

        try {
          const storageRef = ref(storage, fileName);
          const response = await fetchWithTimeout(
            compressedUri,
            {
              method: 'GET',
            },
            15000
          );
          const blob = await response.blob();
          const uploadTask = uploadBytesResumable(storageRef, blob, {
            contentType: 'image/jpeg',
          });

          await new Promise<void>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              snapshot => {
                const progress = snapshot.totalBytes
                  ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                  : 0;
                setUploadProgress(prev => ({ ...prev, [imageKey]: progress }));
              },
              error => {
                console.error(`Error uploading image ${i}:`, error);
                reject(error);
              },
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedUrls.push(downloadURL);
                setUploadProgress(prev => ({ ...prev, [imageKey]: 100 }));
                resolve();
              }
            );
          });
        } catch (error) {
          console.error(`Error uploading image ${i}:`, error);
          continue;
        }
      } catch (error) {
        console.error(`Error processing image ${i}:`, error);
      }
    }

    setUploadProgress({});

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!liveValidation) {
      setLiveValidation(true);
    }
    if (!validateForm()) {
      triggerHapticFeedback.error();
      return;
    }

    const shouldContinue = await checkForDuplicates();
    if (!shouldContinue) {
      return;
    }

    triggerHapticFeedback.medium();
    setLoading(true);
    try {
      let from_geohash = null;
      let to_geohash = null;

      if (formData.from_lat && formData.from_lng) {
        from_geohash = geohashForLocation([formData.from_lat, formData.from_lng]);
      }

      if (formData.to_lat && formData.to_lng) {
        to_geohash = geohashForLocation([formData.to_lat, formData.to_lng]);
      }

      let dimensions = null;
      if (formData.length && formData.width && formData.height) {
        dimensions = `${formData.length} x ${formData.width} x ${formData.height}`;
      }

      const title = sanitizeInput(formData.title.trim(), 200);
      const description = sanitizeInput(formData.description.trim(), 2000);
      const fromAddress = sanitizeInput(formData.from_address.trim(), 300);
      const toAddress = sanitizeInput(formData.to_address.trim(), 300);
      const searchTerms = generateCargoSearchTerms(
        title,
        formData.cargo_type,
        fromAddress,
        toAddress
      );

      const requestRef = await addDoc(collection(db, 'cargo_requests'), {
        user_id: user?.uid,
        title,
        description,
        cargo_type: formData.cargo_type,
        weight: sanitizeNumber(formData.weight, 0, 100000),
        dimensions: dimensions ? sanitizeInput(dimensions, 100) : null,
        from_address: fromAddress,
        to_address: toAddress,
        search_terms: searchTerms,
        from_lat: formData.from_lat,
        from_lng: formData.from_lng,
        to_lat: formData.to_lat,
        to_lng: formData.to_lng,
        from_geohash,
        to_geohash,
        distance_km: formData.distance_km,
        pickup_date: formData.pickup_date.toISOString(),
        delivery_date: formData.delivery_date.toISOString(),
        price_type: formData.price_type,
        price: formData.price_type === 'fixed' ? sanitizeNumber(formData.price, 0, 1000000) : 0,
        status: 'active',
        created_at: new Date().toISOString(),
      });

      const request = { id: requestRef.id };

      trackCargoCreated({
        cargo_type: formData.cargo_type,
        weight: formData.weight ? Number(formData.weight) : undefined,
        price: formData.price_type === 'fixed' ? Number(formData.price) : undefined,
        pricing_model: formData.price_type,
        from_address: formData.from_address,
        to_address: formData.to_address,
        distance_km: formData.distance_km || undefined,
      });

      if (images.length > 0 && request) {
        const imageUrls = await uploadImages(request.id);

        if (imageUrls.length > 0) {
          await updateDoc(doc(db, 'cargo_requests', request.id), {
            images: imageUrls,
          });
        }
      }

      // Success feedback
      triggerHapticFeedback.success();
      setShowSuccessAnimation(true);

      toast.success(t('requestCreated'));

      await AsyncStorage.removeItem(DRAFT_KEY);

      setTimeout(() => {
        try {
          router.replace('/(tabs)/home');
        } catch (error) {
          console.warn('Navigation error:', error);
          router.push('/(tabs)/home');
        }
      }, 500);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('error');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFromAddressSelect = async (address: string, lat?: number, lng?: number) => {
    clearDistanceIfNeeded('from_address');
    updateFormData('from_address', address);
    setTouchedFields(prev => ({ ...prev, from_address: true }));
    const error = validateField('from_address', address);
    setFieldErrors(prev => ({ ...prev, from_address: error }));

    if (lat !== undefined && lng !== undefined) {
      updateFormData('from_lat', lat);
      updateFormData('from_lng', lng);
      fromAddressTextRef.current = address;

      if (formData.to_lat && formData.to_lng) {
        try {
          const distance = await calculateDistance(
            { lat, lng },
            {
              lat: formData.to_lat,
              lng: formData.to_lng,
            }
          );
          if (distance) {
            const nextDistanceKm = distance.distance.value / 1000;
            updateFormData('distance_km', nextDistanceKm);
          }
        } catch (error) {
          console.error('Distance calculation failed:', error);
        }
      }
    }
  };

  const handleToAddressSelect = async (address: string, lat?: number, lng?: number) => {
    clearDistanceIfNeeded('to_address');
    updateFormData('to_address', address);
    setTouchedFields(prev => ({ ...prev, to_address: true }));
    const error = validateField('to_address', address);
    setFieldErrors(prev => ({ ...prev, to_address: error }));

    if (lat !== undefined && lng !== undefined) {
      updateFormData('to_lat', lat);
      updateFormData('to_lng', lng);
      toAddressTextRef.current = address;

      if (formData.from_lat && formData.from_lng) {
        try {
          const distance = await calculateDistance(
            { lat: formData.from_lat, lng: formData.from_lng },
            { lat, lng }
          );
          if (distance) {
            const nextDistanceKm = distance.distance.value / 1000;
            updateFormData('distance_km', nextDistanceKm);
          }
        } catch (error) {
          console.error('Distance calculation failed:', error);
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          isSmallScreen && styles.headerCompact,
          { paddingTop: insets.top + (isSmallScreen ? 8 : 16) },
        ]}
      >
        <Text style={[styles.headerTitle, isSmallScreen && styles.headerTitleCompact]}>
          {t('createCargoRequest') || 'Opprett lastforespørsel'}
        </Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/(tabs)/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Varsler"
          accessibilityHint="Åpne varsler"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareFlatList
        contentContainerStyle={[styles.scrollContent, isSmallScreen && styles.scrollContentCompact]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={100}
        enableResetScrollToCoords={false}
        data={[{ key: 'form' }]}
        keyExtractor={item => item.key}
        renderItem={() => (
          <View>
            {/* Title */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text
                style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}
                accessibilityRole="header"
              >
                Tittel
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  testID="cargo-title-input"
                  accessibilityLabel="Tittel på lastforespørsel"
                  accessibilityHint="Skriv inn en beskrivende tittel for lasten din"
                  style={[
                    styles.textInput,
                    isSmallScreen && styles.textInputCompact,
                    ...getInputValidationStyles('title', formData.title),
                  ]}
                  value={formData.title}
                  onChangeText={value => {
                    updateFormData('title', value);
                    clearDistanceIfNeeded('title');
                  }}
                  onBlur={() => handleBlur('title')}
                  placeholder=""
                  autoComplete="off"
                  returnKeyType="next"
                />
                {renderValidIcon('title', formData.title)}
              </View>
              {renderFieldError('title', formData.title)}
            </View>

            {/* Description */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text
                style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}
                accessibilityRole="header"
              >
                Beskrivelse
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  testID="cargo-description-input"
                  accessibilityLabel="Beskrivelse av last"
                  accessibilityHint="Skriv inn en detaljert beskrivelse av lasten"
                  style={[
                    styles.textInput,
                    isSmallScreen && styles.textInputCompact,
                    styles.textArea,
                    isSmallScreen && styles.textAreaCompact,
                    ...getInputValidationStyles('description', formData.description),
                  ]}
                  value={formData.description}
                  onChangeText={value => {
                    updateFormData('description', value);
                    clearDistanceIfNeeded('description');
                  }}
                  onBlur={() => handleBlur('description')}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholder=""
                  autoComplete="off"
                  returnKeyType="next"
                />
                {renderValidIcon('description', formData.description)}
              </View>
              {renderFieldError('description', formData.description)}
            </View>

            {/* Cargo Type */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                Lasttype
              </Text>
              <TouchableOpacity
                style={[styles.dropdownButton, isSmallScreen && styles.dropdownButtonCompact]}
                onPress={() => setShowCargoTypeMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Velg lasttype"
                accessibilityHint="Åpner meny for å velge lasttype"
              >
                <Text
                  style={[
                    styles.dropdownText,
                    isSmallScreen && styles.dropdownTextCompact,
                    !formData.cargo_type && styles.dropdownPlaceholder,
                  ]}
                >
                  {formData.cargo_type ? t(formData.cargo_type) : t('selectCargoType')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
              {renderFieldError('cargo_type', formData.cargo_type)}
            </View>

            {/* From Address */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <AddressAutocomplete
                value={formData.from_address}
                label="Fra adresse"
                placeholder="Skriv inn startsted..."
                error={getFieldError('from_address', formData.from_address)}
                onChangeText={text => {
                  fromAddressTextRef.current = text;
                  updateFormData('from_address', text);
                  if (text !== formData.from_address) {
                    clearDistanceIfNeeded('from_address');
                  }
                }}
                onSelect={(address, lat, lng) => handleFromAddressSelect(address, lat, lng)}
              />
            </View>

            {/* To Address */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <AddressAutocomplete
                value={formData.to_address}
                label="Til adresse"
                placeholder="Skriv inn destinasjon..."
                error={getFieldError('to_address', formData.to_address)}
                onChangeText={text => {
                  toAddressTextRef.current = text;
                  updateFormData('to_address', text);
                  if (text !== formData.to_address) {
                    clearDistanceIfNeeded('to_address');
                  }
                }}
                onSelect={(address, lat, lng) => handleToAddressSelect(address, lat, lng)}
              />
            </View>

            {/* Dates */}
            <View style={[styles.dateRow, isSmallScreen && styles.dateRowCompact]}>
              <View
                style={[
                  styles.fieldContainer,
                  isSmallScreen && styles.fieldContainerCompact,
                  { flex: 1, marginRight: isSmallScreen ? 0 : 8 },
                ]}
              >
                <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                  Hentedato
                </Text>
                <TouchableOpacity
                  style={[styles.dateInput, isSmallScreen && styles.dateInputCompact]}
                  onPress={() => setShowPickupDate(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select pickup date"
                  accessibilityHint="Choose when the cargo should be picked up"
                  accessibilityValue={{ text: formData.pickup_date.toLocaleDateString('no-NO') }}
                >
                  <TextInput
                    style={[styles.dateTextInput, isSmallScreen && styles.dateTextInputCompact]}
                    value={formData.pickup_date.toLocaleDateString('no-NO')}
                    editable={false}
                    placeholder="dd.mm.åååå"
                  />
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.fieldContainer,
                  isSmallScreen && styles.fieldContainerCompact,
                  { flex: 1, marginLeft: isSmallScreen ? 0 : 8 },
                ]}
              >
                <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                  Leveringsdato
                </Text>
                <TouchableOpacity
                  style={[styles.dateInput, isSmallScreen && styles.dateInputCompact]}
                  onPress={() => setShowDeliveryDate(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select delivery date"
                  accessibilityHint="Choose when the cargo should be delivered"
                  accessibilityValue={{ text: formData.delivery_date.toLocaleDateString('no-NO') }}
                >
                  <TextInput
                    style={[styles.dateTextInput, isSmallScreen && styles.dateTextInputCompact]}
                    value={formData.delivery_date.toLocaleDateString('no-NO')}
                    editable={false}
                    placeholder="dd.mm.åååå"
                  />
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dimensions */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                Dimensjoner (L × B × H)
              </Text>
              <View style={[styles.dimensionRow, isSmallScreen && styles.dimensionRowCompact]}>
                <View style={[styles.inputWrapper, styles.dimensionInput]}>
                  <TextInput
                    style={[
                      styles.textInput,
                      isSmallScreen && styles.textInputCompact,
                      styles.dimensionInput,
                      ...getInputValidationStyles('length', formData.length),
                    ]}
                    value={formData.length}
                    onChangeText={value => {
                      updateFormData('length', value);
                      clearDistanceIfNeeded('length');
                    }}
                    onBlur={() => handleBlur('length')}
                    placeholder="L (cm)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                  {renderValidIcon('length', formData.length)}
                </View>
                <View style={[styles.inputWrapper, styles.dimensionInput]}>
                  <TextInput
                    style={[
                      styles.textInput,
                      isSmallScreen && styles.textInputCompact,
                      styles.dimensionInput,
                      ...getInputValidationStyles('width', formData.width),
                    ]}
                    value={formData.width}
                    onChangeText={value => {
                      updateFormData('width', value);
                      clearDistanceIfNeeded('width');
                    }}
                    onBlur={() => handleBlur('width')}
                    placeholder="B (cm)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                  {renderValidIcon('width', formData.width)}
                </View>
                <View style={[styles.inputWrapper, styles.dimensionInput]}>
                  <TextInput
                    style={[
                      styles.textInput,
                      isSmallScreen && styles.textInputCompact,
                      styles.dimensionInput,
                      ...getInputValidationStyles('height', formData.height),
                    ]}
                    value={formData.height}
                    onChangeText={value => {
                      updateFormData('height', value);
                      clearDistanceIfNeeded('height');
                    }}
                    onBlur={() => handleBlur('height')}
                    placeholder="H (cm)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                  {renderValidIcon('height', formData.height)}
                </View>
              </View>
              {renderFieldError('length', formData.length)}
              {renderFieldError('width', formData.width)}
              {renderFieldError('height', formData.height)}
            </View>

            {/* Weight */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                Vekt (kg)
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.textInput,
                    isSmallScreen && styles.textInputCompact,
                    ...getInputValidationStyles('weight', formData.weight),
                  ]}
                  value={formData.weight}
                  onChangeText={value => {
                    updateFormData('weight', value);
                    clearDistanceIfNeeded('weight');
                  }}
                  onBlur={() => handleBlur('weight')}
                  placeholder=""
                  keyboardType="numeric"
                />
                {renderValidIcon('weight', formData.weight)}
              </View>
              {renderFieldError('weight', formData.weight)}
            </View>

            {/* Images */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                Bilder (maks 5)
              </Text>
              <TouchableOpacity
                style={[styles.imageUploadArea, isSmallScreen && styles.imageUploadAreaCompact]}
                onPress={pickImages}
                accessibilityRole="button"
                accessibilityLabel={`Add images, ${images.length} of 5 selected`}
                accessibilityHint="Select photos of your cargo"
              >
                <View style={styles.imageUploadContent}>
                  <Ionicons name="image-outline" size={isSmallScreen ? 28 : 32} color="#9CA3AF" />
                  <Text
                    style={[styles.imageUploadText, isSmallScreen && styles.imageUploadTextCompact]}
                  >
                    Legg til bilder ({images.length}/5)
                  </Text>
                </View>
              </TouchableOpacity>

              {images.length > 0 && (
                <View style={[styles.imageGrid, isSmallScreen && styles.imageGridCompact]}>
                  {images.map((uri, index) => (
                    <View
                      key={index}
                      style={[styles.imageGridItem, isSmallScreen && styles.imageGridItemCompact]}
                    >
                      <LazyImage
                        uri={uri}
                        style={styles.imagePreview}
                        containerStyle={
                          isSmallScreen ? styles.imageGridItemCompact : styles.imageGridItem
                        }
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove image ${index + 1}`}
                        accessibilityHint="Delete this photo"
                      >
                        <Ionicons
                          name="close-circle"
                          size={isSmallScreen ? 20 : 24}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {loading && Object.keys(uploadProgress).length > 0 && (
                <View style={styles.uploadProgressContainer}>
                  <Text style={styles.uploadProgressTitle}>Laster opp bilder...</Text>
                  {Object.entries(uploadProgress).map(([key, progress]) => (
                    <View key={key} style={styles.progressRow}>
                      <Text style={styles.progressLabel}>{key.replace('_', ' ')}</Text>
                      <View style={styles.progressBarBackground}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Price Type */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                Prismodell
              </Text>
              <TouchableOpacity
                style={[styles.dropdownButton, isSmallScreen && styles.dropdownButtonCompact]}
                onPress={() => setShowPriceTypeMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Velg prismodell"
                accessibilityHint="Åpner meny for å velge prismodell"
              >
                <Text
                  style={[
                    styles.dropdownText,
                    isSmallScreen && styles.dropdownTextCompact,
                    !formData.price_type && styles.dropdownPlaceholder,
                  ]}
                >
                  {formData.price_type
                    ? PRICE_TYPES.find(t => t.id === formData.price_type)?.label
                    : 'Velg prismodell'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
              {renderFieldError('price_type', formData.price_type)}
            </View>

            {/* Price - ALWAYS VISIBLE */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                Foreslått pris (NOK)
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.textInputNeutral,
                    isSmallScreen && styles.textInputCompact,
                    ...getInputValidationStyles('price', formData.price),
                    formData.price_type === 'negotiable' && styles.textInputDisabled,
                  ]}
                  placeholder="0"
                  value={formData.price}
                  onChangeText={value => updateFormData('price', value)}
                  onBlur={() => handleBlur('price')}
                  keyboardType="numeric"
                  editable={formData.price_type === 'fixed'}
                />
                {formData.price_type === 'fixed' && renderValidIcon('price', formData.price)}
              </View>
              {formData.price_type === 'negotiable' && (
                <Text style={[styles.fieldHint, isSmallScreen && styles.fieldHintCompact]}>
                  Pris kan forhandles med transportør
                </Text>
              )}
              {renderFieldError('price', formData.price)}
            </View>

            {/* Bottom Action Buttons */}
            <View style={[styles.bottomActions, isSmallScreen && styles.bottomActionsCompact]}>
              <TouchableOpacity
                style={[styles.cancelButton, isSmallScreen && styles.cancelButtonCompact]}
                onPress={() => router.push('/(tabs)/home')}
                accessibilityRole="button"
                accessibilityLabel="Avbryt"
              >
                <Text style={[styles.cancelButtonText, isSmallScreen && styles.buttonTextCompact]}>
                  Avbryt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.publishButton,
                  isSmallScreen && styles.publishButtonCompact,
                  loading && styles.publishButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={loading ? 'Publiserer lastforespørsel' : 'Publiser last'}
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} accessibilityLabel="Publiserer" />
                ) : (
                  <Text
                    style={[styles.publishButtonText, isSmallScreen && styles.buttonTextCompact]}
                  >
                    Publiser last
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom spacing for tab bar */}
            <View style={{ height: 80 }} />
          </View>
        )}
      />

      {/* Date Pickers */}
      {showPickupDate && (
        <DateTimePicker
          value={formData.pickup_date}
          mode="date"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowPickupDate(false);
            if (selectedDate) {
              updateFormData('pickup_date', selectedDate);
            }
          }}
        />
      )}

      {showDeliveryDate && (
        <DateTimePicker
          value={formData.delivery_date}
          mode="date"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowDeliveryDate(false);
            if (selectedDate) {
              updateFormData('delivery_date', selectedDate);
            }
          }}
        />
      )}

      {/* Cargo Type Modal Menu */}
      <Modal
        visible={showCargoTypeMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCargoTypeMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowCargoTypeMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Lukk lasttype-meny"
        >
          <View
            style={styles.menuContainer}
            accessible={true}
            accessibilityRole="menu"
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Velg lasttype</Text>
              <TouchableOpacity
                onPress={() => setShowCargoTypeMenu(false)}
                accessibilityRole="button"
                accessibilityLabel="Lukk"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {CARGO_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                testID={`cargo-type-${type.id}`}
                accessibilityRole="menuitem"
                accessibilityLabel={`Velg ${t(type.id)} som lasttype`}
                accessibilityHint="Dobbelttrykk for å velge denne lasttypen"
                accessibilityState={{ selected: formData.cargo_type === type.id }}
                style={[
                  styles.menuItem,
                  formData.cargo_type === type.id && styles.menuItemSelected,
                ]}
                onPress={() => {
                  updateFormData('cargo_type', type.id);
                  handleBlur('cargo_type');
                  setShowCargoTypeMenu(false);
                  triggerHapticFeedback.light();
                }}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    formData.cargo_type === type.id && styles.menuItemTextSelected,
                  ]}
                >
                  {t(type.id)}
                </Text>
                {formData.cargo_type === type.id && (
                  <Ionicons name="checkmark" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Price Type Modal Menu */}
      <Modal
        visible={showPriceTypeMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPriceTypeMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowPriceTypeMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Lukk prismodell-meny"
        >
          <View
            style={styles.menuContainer}
            accessible={true}
            accessibilityRole="menu"
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Velg prismodell</Text>
              <TouchableOpacity
                onPress={() => setShowPriceTypeMenu(false)}
                accessibilityRole="button"
                accessibilityLabel="Lukk"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {PRICE_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.menuItem,
                  formData.price_type === type.id && styles.menuItemSelected,
                ]}
                onPress={() => {
                  updateFormData('price_type', type.id);
                  handleBlur('price_type');
                  setShowPriceTypeMenu(false);
                  triggerHapticFeedback.light();
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={type.label}
                accessibilityState={{ selected: formData.price_type === type.id }}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    formData.price_type === type.id && styles.menuItemTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
                {formData.price_type === type.id && (
                  <Ionicons name="checkmark" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Success Animation Overlay */}
      <SuccessAnimation
        visible={showSuccessAnimation}
        type="confetti"
        onAnimationEnd={() => setShowSuccessAnimation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerCompact: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  headerTitleCompact: {
    fontSize: fontSize.lg,
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxs,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  scrollContentCompact: {
    padding: spacing.md,
  },
  fieldContainer: {
    marginBottom: spacing.xxl,
  },
  fieldContainerCompact: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: spacing.xs,
  },
  fieldLabelCompact: {
    fontSize: fontSize.sm,
  },
  textInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    backgroundColor: colors.white,
    color: '#1F2937',
  },
  textInputCompact: {
    padding: spacing.sm,
    fontSize: fontSize.sm,
  },
  inputWrapper: {
    position: 'relative',
  },
  textInputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  textInputValid: {
    borderColor: colors.success,
    borderWidth: 1,
  },
  textInputNeutral: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    backgroundColor: colors.white,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    borderColor: colors.border.default,
  },
  textAreaCompact: {
    minHeight: 84,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  dateRowCompact: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    backgroundColor: colors.white,
  },
  dateInputCompact: {
    padding: spacing.xs,
  },
  dateTextInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: '#1F2937',
  },
  dateTextInputCompact: {
    fontSize: fontSize.sm,
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionRowCompact: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  dimensionInput: {
    flex: 1,
    borderColor: colors.border.default,
  },
  imageUploadArea: {
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.xxxl,
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  imageUploadAreaCompact: {
    padding: spacing.xl,
  },
  imageUploadContent: {
    alignItems: 'center',
  },
  imageUploadText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  imageUploadTextCompact: {
    fontSize: fontSize.xs,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.sm,
  },
  imageGridCompact: {
    gap: spacing.sm,
  },
  imageGridItem: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  imageGridItemCompact: {
    width: 64,
    height: 64,
  },
  uploadProgressContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  uploadProgressTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  progressLabel: {
    width: 70,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    width: 40,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  bottomActionsCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonCompact: {
    padding: spacing.sm,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#6B7280',
  },
  publishButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  publishButtonCompact: {
    padding: spacing.sm,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextCompact: {
    fontSize: fontSize.sm,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  validIcon: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    backgroundColor: colors.white,
  },
  dropdownButtonCompact: {
    padding: spacing.xs,
  },
  dropdownText: {
    fontSize: fontSize.md,
    color: '#1F2937',
    flex: 1,
  },
  dropdownTextCompact: {
    fontSize: fontSize.sm,
  },
  dropdownPlaceholder: {
    color: colors.text.tertiary,
  },
  textInputDisabled: {
    backgroundColor: colors.backgroundLight,
    color: colors.text.tertiary,
  },
  fieldHint: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginTop: spacing.xxxs,
  },
  fieldHintCompact: {
    fontSize: fontSize.xs,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  menuTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  menuItemText: {
    fontSize: fontSize.md,
    color: '#1F2937',
  },
  menuItemTextSelected: {
    color: colors.success,
    fontWeight: '600',
  },
});
