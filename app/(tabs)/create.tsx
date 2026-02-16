import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
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
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import { triggerHapticFeedback } from '../../utils/haptics';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from '../../lib/GooglePlacesAutocomplete';
import { calculateDistance } from '../../utils/googlePlaces';
import { geohashForLocation } from 'geofire-common';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { LazyImage } from '../../components/LazyImage';

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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [distanceInfo, setDistanceInfo] = useState<{ distance: string; duration: string } | null>(
    null
  );
  const [showPickupDate, setShowPickupDate] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [showCargoTypeMenu, setShowCargoTypeMenu] = useState(false);
  const [showPriceTypeMenu, setShowPriceTypeMenu] = useState(false);
  const fromAddressRef = useRef<any>(null);
  const toAddressRef = useRef<any>(null);
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
      setDistanceInfo(null);
      setFormData(prev => ({ ...prev, distance_km: null }));
    }
  };

  const validateField = (field: string, value: unknown): string => {
    switch (field) {
      case 'title':
        if (!value || !value.toString().trim()) return 'Tittel er påkrevd';
        if (value.toString().trim().length < 3) return 'Tittel må være minst 3 tegn';
        if (value.toString().trim().length > 100) return 'Tittel kan ikke være lengre enn 100 tegn';
        return '';

      case 'description':
        if (!value || !value.toString().trim()) return 'Beskrivelse er påkrevd';
        if (value.toString().trim().length < 10) return 'Beskrivelse må være minst 10 tegn';
        if (value.toString().trim().length > 500)
          return 'Beskrivelse kan ikke være lengre enn 500 tegn';
        return '';

      case 'cargo_type':
        if (!value) return 'Lasttype er påkrevd';
        return '';

      case 'weight': {
        if (!value || value.toString().trim() === '') return 'Vekt er påkrevd';
        const weight = Number(value);
        if (isNaN(weight)) return 'Vekt må være et tall';
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
        if (!value || !value.toString().trim()) return 'Fra-adresse er påkrevd';
        if (value.toString().trim().length < 3) return 'Fra-adresse må være minst 3 tegn';
        return '';

      case 'to_address':
        if (!value || !value.toString().trim()) return 'Til-adresse er påkrevd';
        if (value.toString().trim().length < 3) return 'Til-adresse må være minst 3 tegn';
        return '';

      case 'price_type':
        if (!value) return 'Pristype er påkrevd';
        return '';

      case 'price':
        if (formData.price_type === 'fixed') {
          if (!value || value.toString().trim() === '') return 'Pris er påkrevd for fast pris';
          const price = Number(value);
          if (isNaN(price)) return 'Pris må være et tall';
          if (price <= 0) return 'Pris må være større enn 0';
          if (price > 1000000) return 'Pris kan ikke være større enn 1 000 000 NOK';
        }
        return '';

      default:
        return '';
    }
  };

  const updateFormData = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (touchedFields[field]) {
      const error = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
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

    for (let i = 0; i < images.length; i++) {
      try {
        const uri = images[i];
        const compressedUri = await compressImage(uri);
        const ext = uri.split('.').pop() || 'jpg';
        const fileName = `request-images/${requestId}_${i}_${Date.now()}.${ext}`;

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
          await uploadBytes(storageRef, blob, {
            contentType: 'image/jpeg',
          });

          const downloadURL = await getDownloadURL(storageRef);
          uploadedUrls.push(downloadURL);
        } catch (error) {
          console.error(`Error uploading image ${i}:`, error);
          continue;
        }
      } catch (error) {
        console.error(`Error processing image ${i}:`, error);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      triggerHapticFeedback.error();
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

      const requestRef = await addDoc(collection(db, 'cargo_requests'), {
        user_id: user?.uid,
        title: sanitizeInput(formData.title.trim(), 200),
        description: sanitizeInput(formData.description.trim(), 2000),
        cargo_type: formData.cargo_type,
        weight: sanitizeNumber(formData.weight, 0, 100000),
        dimensions: dimensions ? sanitizeInput(dimensions, 100) : null,
        from_address: sanitizeInput(formData.from_address.trim(), 300),
        to_address: sanitizeInput(formData.to_address.trim(), 300),
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

  const handleFromAddressSelect = async (data: any, details: any) => {
    clearDistanceIfNeeded('from_address');
    updateFormData('from_address', data.description);
    setTouchedFields(prev => ({ ...prev, from_address: true }));
    const error = validateField('from_address', data.description);
    setFieldErrors(prev => ({ ...prev, from_address: error }));

    if (details?.geometry?.location) {
      const coordinates = details.geometry.location;
      updateFormData('from_lat', coordinates.lat);
      updateFormData('from_lng', coordinates.lng);
      fromAddressTextRef.current = data.description;

      if (formData.to_lat && formData.to_lng) {
        try {
          const distance = await calculateDistance(coordinates, {
            lat: formData.to_lat,
            lng: formData.to_lng,
          });
          if (distance) {
            setDistanceInfo({
              distance: distance.distance.text,
              duration: distance.duration.text,
            });
            const distanceKm = distance.distance.value / 1000;
            updateFormData('distance_km', distanceKm);
          }
        } catch (error) {
          console.error('Distance calculation failed:', error);
        }
      }
    }
  };

  const handleToAddressSelect = async (data: any, details: any) => {
    clearDistanceIfNeeded('to_address');
    updateFormData('to_address', data.description);
    setTouchedFields(prev => ({ ...prev, to_address: true }));
    const error = validateField('to_address', data.description);
    setFieldErrors(prev => ({ ...prev, to_address: error }));

    if (details?.geometry?.location) {
      const coordinates = details.geometry.location;
      updateFormData('to_lat', coordinates.lat);
      updateFormData('to_lng', coordinates.lng);
      toAddressTextRef.current = data.description;

      if (formData.from_lat && formData.from_lng) {
        try {
          const distance = await calculateDistance(
            { lat: formData.from_lat, lng: formData.from_lng },
            coordinates
          );
          if (distance) {
            setDistanceInfo({
              distance: distance.distance.text,
              duration: distance.duration.text,
            });
            const distanceKm = distance.distance.value / 1000;
            updateFormData('distance_km', distanceKm);
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>
          {t('createCargoRequest') || 'Opprett lastforespørsel'}
        </Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/(tabs)/notifications')}
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={100}
        enableResetScrollToCoords={false}
        data={[{ key: 'form' }]}
        keyExtractor={item => item.key}
        renderItem={() => (
          <View>
            {/* Title */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel} accessibilityRole="header">
                Tittel
              </Text>
              <TextInput
                testID="cargo-title-input"
                accessibilityLabel="Tittel på lastforespørsel"
                accessibilityHint="Skriv inn en beskrivende tittel for lasten din"
                style={styles.textInput}
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
            </View>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel} accessibilityRole="header">
                Beskrivelse
              </Text>
              <TextInput
                testID="cargo-description-input"
                accessibilityLabel="Beskrivelse av last"
                accessibilityHint="Skriv inn en detaljert beskrivelse av lasten"
                style={[styles.textInput, styles.textArea]}
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
            </View>

            {/* Cargo Type */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Lasttype</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCargoTypeMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Velg lasttype"
                accessibilityHint="Åpner meny for å velge lasttype"
              >
                <Text
                  style={[styles.dropdownText, !formData.cargo_type && styles.dropdownPlaceholder]}
                >
                  {formData.cargo_type
                    ? CARGO_TYPES.find(t => t.id === formData.cargo_type)?.label
                    : 'Velg lasttype'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* From Address */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Fra</Text>
              <GooglePlacesAutocomplete
                ref={fromAddressRef}
                placeholder="Søk etter adresse..."
                onPress={handleFromAddressSelect}
                query={{
                  key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
                  language: 'no',
                  components: 'country:no',
                }}
                fetchDetails={true}
                enablePoweredByContainer={false}
                styles={{
                  container: styles.placesContainer,
                  textInput: styles.placesTextInput,
                }}
                textInputProps={{
                  onChangeText: (text: string) => {
                    fromAddressTextRef.current = text;
                    if (text !== formData.from_address) {
                      clearDistanceIfNeeded('from_address');
                    }
                  },
                  onBlur: () => handleBlur('from_address'),
                }}
              />
            </View>

            {/* To Address */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Til</Text>
              <GooglePlacesAutocomplete
                ref={toAddressRef}
                placeholder="Søk etter adresse..."
                onPress={handleToAddressSelect}
                query={{
                  key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
                  language: 'no',
                  components: 'country:no',
                }}
                fetchDetails={true}
                enablePoweredByContainer={false}
                styles={{
                  container: styles.placesContainer,
                  textInput: styles.placesTextInput,
                }}
                textInputProps={{
                  onChangeText: (text: string) => {
                    toAddressTextRef.current = text;
                    if (text !== formData.to_address) {
                      clearDistanceIfNeeded('to_address');
                    }
                  },
                  onBlur: () => handleBlur('to_address'),
                }}
              />
            </View>

            {/* Dates */}
            <View style={styles.dateRow}>
              <View style={[styles.fieldContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Hentedato</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowPickupDate(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select pickup date"
                  accessibilityHint="Choose when the cargo should be picked up"
                  accessibilityValue={{ text: formData.pickup_date.toLocaleDateString('no-NO') }}
                >
                  <TextInput
                    style={styles.dateTextInput}
                    value={formData.pickup_date.toLocaleDateString('no-NO')}
                    editable={false}
                    placeholder="dd.mm.åååå"
                  />
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={[styles.fieldContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Leveringsdato</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDeliveryDate(true)}
                >
                  <TextInput
                    style={styles.dateTextInput}
                    value={formData.delivery_date.toLocaleDateString('no-NO')}
                    editable={false}
                    placeholder="dd.mm.åååå"
                  />
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dimensions */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Dimensjoner (L × B × H)</Text>
              <View style={styles.dimensionRow}>
                <TextInput
                  style={[styles.textInput, styles.dimensionInput]}
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
                <TextInput
                  style={[styles.textInput, styles.dimensionInput]}
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
                <TextInput
                  style={[styles.textInput, styles.dimensionInput]}
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
              </View>
            </View>

            {/* Weight */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Vekt (kg)</Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border.default }]}
                value={formData.weight}
                onChangeText={value => {
                  updateFormData('weight', value);
                  clearDistanceIfNeeded('weight');
                }}
                onBlur={() => handleBlur('weight')}
                placeholder=""
                keyboardType="numeric"
              />
            </View>

            {/* Images */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Bilder (maks 5)</Text>
              <TouchableOpacity
                style={styles.imageUploadArea}
                onPress={pickImages}
                accessibilityRole="button"
                accessibilityLabel={`Add images, ${images.length} of 5 selected`}
                accessibilityHint="Select photos of your cargo"
              >
                <View style={styles.imageUploadContent}>
                  <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.imageUploadText}>Legg til bilder ({images.length}/5)</Text>
                </View>
              </TouchableOpacity>

              {images.length > 0 && (
                <View style={styles.imageGrid}>
                  {images.map((uri, index) => (
                    <View key={index} style={styles.imageGridItem}>
                      <LazyImage
                        uri={uri}
                        style={styles.imagePreview}
                        containerStyle={styles.imageGridItem}
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove image ${index + 1}`}
                        accessibilityHint="Delete this photo"
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Price Type */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Prismodell</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowPriceTypeMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Velg prismodell"
                accessibilityHint="Åpner meny for å velge prismodell"
              >
                <Text
                  style={[styles.dropdownText, !formData.price_type && styles.dropdownPlaceholder]}
                >
                  {formData.price_type
                    ? PRICE_TYPES.find(t => t.id === formData.price_type)?.label
                    : 'Velg prismodell'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Price - ALWAYS VISIBLE */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Foreslått pris (NOK)</Text>
              <TextInput
                style={[
                  styles.textInputNeutral,
                  formData.price_type === 'negotiable' && styles.textInputDisabled,
                ]}
                placeholder="0"
                value={formData.price}
                onChangeText={value => updateFormData('price', value)}
                onBlur={() => handleBlur('price')}
                keyboardType="numeric"
                editable={formData.price_type === 'fixed'}
              />
              {formData.price_type === 'negotiable' && (
                <Text style={styles.fieldHint}>Pris kan forhandles med transportør</Text>
              )}
              {fieldErrors.price ? <Text style={styles.errorText}>{fieldErrors.price}</Text> : null}
            </View>

            {/* Bottom Action Buttons */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => router.push('/(tabs)/home')}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.publishButton, loading && styles.publishButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                accessibilityLabel={loading ? 'Publiserer lastforespørsel' : 'Publiser last'}
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} accessibilityLabel="Publiserer" />
                ) : (
                  <Text style={styles.publishButtonText}>Publiser last</Text>
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
        >
          <View
            style={styles.menuContainer}
            accessible={true}
            accessibilityRole="menu"
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Velg lasttype</Text>
              <TouchableOpacity onPress={() => setShowCargoTypeMenu(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {CARGO_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                testID={`cargo-type-${type.id}`}
                accessibilityRole="menuitem"
                accessibilityLabel={`Velg ${type.label} som lasttype`}
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
                  {type.label}
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
        >
          <View
            style={styles.menuContainer}
            accessible={true}
            accessibilityRole="menu"
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Velg prismodell</Text>
              <TouchableOpacity onPress={() => setShowPriceTypeMenu(false)}>
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
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
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
  fieldContainer: {
    marginBottom: spacing.xxl,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: spacing.xs,
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
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    backgroundColor: colors.white,
  },
  dateTextInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: '#1F2937',
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: 12,
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
  imageUploadContent: {
    alignItems: 'center',
  },
  imageUploadText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.sm,
  },
  imageGridItem: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
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
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
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
    backgroundcolor: colors.primary,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placesContainer: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
  },
  placesTextInput: {
    height: 48,
    fontSize: fontSize.md,
    color: '#1F2937',
  },
  errorText: {
    marginTop: spacing.xxxs,
    fontSize: fontSize.sm,
    color: colors.error,
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
  dropdownText: {
    fontSize: fontSize.md,
    color: '#1F2937',
    flex: 1,
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

