import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../hooks/useNotifications';
import { supabase } from '../../lib/supabase';
import { trackCargoCreated } from '../../utils/analytics';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitization';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { useRouter } from 'expo-router';
import { triggerHapticFeedback } from '../../utils/haptics';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import { StandardBottomSheet } from '../../components/StandardBottomSheet';
import { useDebouncedCallback } from 'use-debounce';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { calculateDistance } from '../../utils/googlePlaces';
import { compressImageForUpload } from '../../utils/imageCompression';
import { LazyImage } from '../../components/LazyImage';
import { ScreenHeader } from '../../components/ScreenHeader';
import { estimateCargoPriceRange } from '../../utils/priceEstimation';
import { validateBeforeCreation } from '../../utils/requestValidation';
import {
  CARGO_TYPE_PRESETS,
  CARGO_TYPES,
  PRICE_TYPES,
  QUICK_REQUEST_TEMPLATES,
} from '../../utils/cargoFormConstants';

const CARGO_LIMITS = {
  weight: { min: 1, max: 25000 },
  dimension: { min: 1, max: 1200 },
  volume: { max: 40 },
} as const;

const DRAFT_KEY = 'cargo-request-draft';
const DRAFT_EXPIRY_HOURS = 24;
const AUTOSAVE_DEBOUNCE_MS = 2000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PHOTO_CHECKLIST_KEYS = [
  'photoChecklistItemOverall',
  'photoChecklistItemCorners',
  'photoChecklistItemDamage',
  'photoChecklistItemAccess',
  'photoChecklistItemSizeReference',
  'photoChecklistItemLooseParts',
] as const;

const base64ToUint8Array = (base64: string): Uint8Array => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = base64.replace(/=+$/, '');

  let buffer = 0;
  let bitsCollected = 0;
  const output: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const value = alphabet.indexOf(char);

    if (value < 0) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return new Uint8Array(output);
};

export default function CreateRequestScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 360;
  const insets = useSafeAreaInsets();
  const formBottomInset = Math.max(insets.bottom, spacing.sm) + spacing.xl;
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
  const [isDriveable, setIsDriveable] = useState(true);
  const fromAddressTextRef = useRef('');
  const toAddressTextRef = useRef('');
  const hasShownNoImageReminderRef = useRef(false);

  const estimatedPriceRange = estimateCargoPriceRange({
    cargoType: formData.cargo_type,
    distanceKm: formData.distance_km,
    weightKg: formData.weight,
  });
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
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        const payload = {
          ...formData,
          images,
          pickup_date: formData.pickup_date?.toISOString?.() || new Date().toISOString(),
          delivery_date: formData.delivery_date?.toISOString?.() || new Date().toISOString(),
          savedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    };

    const timeoutId = setTimeout(saveDraft, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [formData, images]);

  const validateField = (field: string, value: unknown, nextData: typeof formData = formData) => {
    switch (field) {
      case 'title':
        if (!value || value.toString().trim() === '') return t('titleRequired');
        if (value.toString().trim().length < 3) return t('titleMinLength');
        return '';

      case 'description':
        if (!value || value.toString().trim() === '') return t('descriptionRequired');
        if (value.toString().trim().length < 10) return t('descriptionMinLength');
        return '';

      case 'cargo_type':
        if (!value) return t('cargoTypeRequired');
        return '';

      case 'weight': {
        if (!value || value.toString().trim() === '') return t('weightRequired');
        const weight = Number(value);
        if (isNaN(weight)) return t('weightMustBeNumber');
        if (weight <= 0) return t('weightMustBePositive');
        if (weight < CARGO_LIMITS.weight.min || weight > CARGO_LIMITS.weight.max) {
          return `Vekt må være mellom ${CARGO_LIMITS.weight.min} og ${CARGO_LIMITS.weight.max} kg`;
        }
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

  const clearDistanceIfNeeded = (field: keyof typeof formData) => {
    if (field === 'from_address' || field === 'to_address') {
      updateFormData('distance_km', null);
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

  const applyCargoTypePreset = (cargoType: string) => {
    const preset = CARGO_TYPE_PRESETS[cargoType];

    setFormData(prev => {
      const nextData = { ...prev, cargo_type: cargoType };

      if (!preset) {
        return nextData;
      }

      if (!String(prev.weight || '').trim()) {
        nextData.weight = preset.weight;
      }
      if (!String(prev.length || '').trim()) {
        nextData.length = preset.length;
      }
      if (!String(prev.width || '').trim()) {
        nextData.width = preset.width;
      }
      if (!String(prev.height || '').trim()) {
        nextData.height = preset.height;
      }

      return nextData;
    });

    if (liveValidation || touchedFields.cargo_type) {
      debouncedValidateField('cargo_type', cargoType, { ...formData, cargo_type: cargoType });
    }
  };

  const applyQuickTemplate = (template: (typeof QUICK_REQUEST_TEMPLATES)[number]) => {
    const nextData = {
      ...formData,
      title: template.titleKey ? String(t(template.titleKey)) : formData.title,
      cargo_type: template.cargo_type,
      weight: template.weight,
      length: template.length,
      width: template.width,
      height: template.height,
    };

    setFormData(nextData);
    triggerHapticFeedback.light();

    if (liveValidation || touchedFields.cargo_type) {
      debouncedValidateField('cargo_type', nextData.cargo_type, nextData);
    }
    if (liveValidation || touchedFields.weight) {
      debouncedValidateField('weight', nextData.weight, nextData);
    }
    if (liveValidation || touchedFields.length) {
      debouncedValidateField('length', nextData.length, nextData);
    }
    if (liveValidation || touchedFields.width) {
      debouncedValidateField('width', nextData.width, nextData);
    }
    if (liveValidation || touchedFields.height) {
      debouncedValidateField('height', nextData.height, nextData);
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

  const checkForDuplicates = async (): Promise<boolean> => {
    if (!user?.uid) {
      return true;
    }

    // ✅ Use comprehensive validation with offline support
    const validationReport = await validateBeforeCreation(user.uid, {
      title: formData.title,
      description: formData.description,
      from_address: formData.from_address,
      to_address: formData.to_address,
      cargo_type: formData.cargo_type,
      weight: formData.weight,
      price: formData.price,
    });

    // Check for validation errors
    if (validationReport.validationErrors && validationReport.validationErrors.length > 0) {
      Alert.alert(
        t('validationError') || 'Validation Error',
        validationReport.validationErrors.join('\n'),
        [{ text: t('ok') || 'OK', style: 'default' }]
      );
      return false;
    }

    // Check for duplicates
    if (validationReport.isDuplicate) {
      return new Promise(resolve => {
        Alert.alert(
          t('duplicateRequestTitle') || 'Duplicate Request',
          validationReport.error || 'You already have a similar request',
          [
            { text: t('no') || 'No', style: 'cancel', onPress: () => resolve(false) },
            { text: t('yes') || 'Yes', onPress: () => resolve(true) },
          ]
        );
      });
    }

    // Check for rate limiting
    if (validationReport.rateLimited) {
      Alert.alert(
        t('rateLimitTitle') || 'Rate Limited',
        validationReport.error || 'You are creating requests too quickly. Please wait.',
        [{ text: t('ok') || 'OK', style: 'default' }]
      );
      return false;
    }

    // ✅ Show offline warning if checking duplicates offline
    if (validationReport.offlineMode) {
      console.warn('⚠️ Checking duplicates offline. Will verify on sync.');
    }

    return true;
  };

  const compressImage = async (uri: string) => compressImageForUpload(uri);

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

        const compressedImagesToAdd = await Promise.all(
          imagesToAdd.map(async uri => {
            try {
              return await compressImage(uri);
            } catch {
              return uri;
            }
          })
        );

        if (newImages.length > remainingSlots) {
          toast.info('Du kan bare laste opp maksimalt 5 bilder');
        }

        setImages([...images, ...compressedImagesToAdd]);

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
    const ownerId = user?.uid;

    if (!ownerId) {
      throw new Error('User must be authenticated to upload images');
    }

    for (let i = 0; i < images.length; i++) {
      try {
        const uri = images[i];
        const compressedUri = await compressImage(uri);
        const ext = uri.split('.').pop() || 'jpg';
        const filePath = `${ownerId}/${requestId}/${Date.now()}_${i}.${ext}`;
        const imageKey = `image_${i + 1}`;

        try {
          const base64 = await FileSystem.readAsStringAsync(compressedUri, {
            encoding: 'base64',
          });
          const fileBytes = base64ToUint8Array(base64);

          if (!fileBytes || fileBytes.byteLength === 0) {
            throw new Error('Image file is empty after compression');
          }

          const { error: uploadError } = await supabase.storage
            .from('cargo')
            .upload(filePath, fileBytes, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            throw uploadError;
          }

          uploadedUrls.push(filePath);
          setUploadProgress(prev => ({ ...prev, [imageKey]: 100 }));
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

    if (images.length === 0 && !hasShownNoImageReminderRef.current) {
      hasShownNoImageReminderRef.current = true;
      toast.info(t('photoReminderNoImages'));
    }

    const shouldContinue = await checkForDuplicates();
    if (!shouldContinue) {
      return;
    }

    triggerHapticFeedback.medium();
    setLoading(true);
    try {
      let dimensions = null;
      if (formData.length && formData.width && formData.height) {
        dimensions = `${formData.length} x ${formData.width} x ${formData.height}`;
      }

      const title = sanitizeInput(formData.title.trim(), 200);

      let descriptionText = formData.description.trim();
      if (formData.cargo_type === 'automotive') {
        descriptionText = `[${isDriveable ? t('driveable') || 'Kjørbar / Kan rulles' : t('nonDriveable') || 'Trenger vinsj / Ikke kjørbar'}]\n\n${descriptionText}`;
      }

      const description = sanitizeInput(descriptionText, 2000);
      const fromAddress = sanitizeInput(formData.from_address.trim(), 300);
      const toAddress = sanitizeInput(formData.to_address.trim(), 300);
      let insertPayload: Record<string, unknown> = {
        customer_id: user?.uid,
        title,
        description,
        cargo_type: formData.cargo_type,
        weight_kg: sanitizeNumber(formData.weight, 0, 100000),
        dimensions: dimensions ? sanitizeInput(dimensions, 100) : null,
        from_address: fromAddress,
        to_address: toAddress,
        from_lat: formData.from_lat,
        from_lng: formData.from_lng,
        to_lat: formData.to_lat,
        to_lng: formData.to_lng,
        distance_km: formData.distance_km,
        pickup_date: formData.pickup_date.toISOString().split('T')[0],
        delivery_date: formData.delivery_date.toISOString().split('T')[0],
        price_type: formData.price_type,
        price: formData.price_type === 'fixed' ? sanitizeNumber(formData.price, 0, 1000000) : 0,
      };

      let insertedRequest: { id: string } | null = null;
      let insertError: unknown = null;
      const removableColumns = new Set(['distance_km']);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await supabase
          .from('cargo_requests')
          .insert(insertPayload)
          .select('id')
          .single();

        insertedRequest = result.data;
        insertError = result.error;

        if (!insertError && insertedRequest) {
          break;
        }

        const isSchemaColumnError =
          insertError &&
          typeof insertError === 'object' &&
          'code' in insertError &&
          (insertError as { code?: string }).code === 'PGRST204' &&
          'message' in insertError &&
          typeof (insertError as { message?: string }).message === 'string';

        if (!isSchemaColumnError) {
          break;
        }

        const message = (insertError as { message: string }).message;
        const missingColumnMatch = message.match(/'([^']+)' column/);
        const missingColumn = missingColumnMatch?.[1];

        if (
          !missingColumn ||
          !(missingColumn in insertPayload) ||
          !removableColumns.has(missingColumn)
        ) {
          break;
        }

        console.warn(
          `Column '${missingColumn}' is missing in cargo_requests. Retrying insert without this field.`
        );
        insertPayload = Object.fromEntries(
          Object.entries(insertPayload).filter(([key]) => key !== missingColumn)
        );
      }

      if (insertError || !insertedRequest) {
        console.error('Supabase insert error:', insertError);
        throw insertError || new Error('Failed to create request');
      }

      const request = { id: insertedRequest.id };

      trackCargoCreated({
        cargo_type: formData.cargo_type,
        weight: formData.weight ? Number(formData.weight) : undefined,
        price: formData.price_type === 'fixed' ? Number(formData.price) : undefined,
        pricing_model: formData.price_type,
        from_address: formData.from_address,
        to_address: formData.to_address,
        distance_km: formData.distance_km || undefined,
      });

      if (images.length > 0 && request && request.id) {
        const imageUrls = await uploadImages(request.id);

        if (imageUrls.length > 0) {
          const { error: imagesUpdateError } = await supabase
            .from('cargo_requests')
            .update({
              images: imageUrls,
            })
            .eq('id', request.id);

          if (imagesUpdateError) {
            console.error('Supabase images update error:', imagesUpdateError);
            throw imagesUpdateError;
          }
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
      // Log hele error-objektet for dypere feilsøking
      console.error('Create request failed:', error);
      let errorMessage = t('error');
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '42501'
      ) {
        errorMessage =
          'Du har ikke tilgang til å opprette forespørsel nå (RLS policy). Logg inn på nytt og sjekk Supabase policy for cargo_requests.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (error.stack) {
          errorMessage += '\n' + error.stack.split('\n')[0];
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
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
      <ScreenHeader
        title={t('createCargoRequest') || 'Opprett lastforespørsel'}
        showBackButton={false}
        showBrandMark={true}
        rightAction={{
          icon: 'notifications-outline',
          onPress: () => router.push('/(tabs)/notifications'),
          label: t('notifications'),
          badge: unreadCount,
        }}
      />

      <KeyboardAwareFlatList
        contentContainerStyle={[
          styles.scrollContent,
          isSmallScreen && styles.scrollContentCompact,
          { paddingBottom: formBottomInset },
        ]}
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
              {formData.cargo_type && CARGO_TYPE_PRESETS[formData.cargo_type]?.hintKey && (
                <Text style={[styles.fieldHint, isSmallScreen && styles.fieldHintCompact]}>
                  {t(CARGO_TYPE_PRESETS[formData.cargo_type].hintKey)}
                </Text>
              )}
              {renderFieldError('cargo_type', formData.cargo_type)}
            </View>

            {/* Automotive Form Options */}
            {formData.cargo_type === 'automotive' && (
              <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
                <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                  {t('vehicleCondition') || 'Kjøretøyets tilstand'}
                </Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
                  onPress={() => setIsDriveable(!isDriveable)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDriveable }}
                >
                  <Ionicons
                    name={isDriveable ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isDriveable ? colors.primary : '#6B7280'}
                  />
                  <Text style={{ marginLeft: 8, fontSize: 16, color: '#374151' }}>
                    {t('isDriveableRadioText') || 'Bilen er kjørbar / kan rulles'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quick Templates */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
                {t('quickTemplates')}
              </Text>
              <View
                style={[styles.quickTemplateRow, isSmallScreen && styles.quickTemplateRowCompact]}
              >
                {QUICK_REQUEST_TEMPLATES.map(template => {
                  const isSelected =
                    formData.cargo_type === template.cargo_type &&
                    formData.weight === template.weight &&
                    formData.length === template.length &&
                    formData.width === template.width &&
                    formData.height === template.height;

                  return (
                    <TouchableOpacity
                      key={template.id}
                      style={[
                        styles.quickTemplateChip,
                        isSelected && styles.quickTemplateChipSelected,
                      ]}
                      onPress={() => applyQuickTemplate(template)}
                      accessibilityRole="button"
                      accessibilityLabel={t('useQuickTemplate', {
                        template: t(template.labelKey),
                      })}
                      accessibilityHint={t('quickTemplateAccessibilityHint')}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.quickTemplateChipText,
                          isSelected && styles.quickTemplateChipTextSelected,
                        ]}
                      >
                        {t(template.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.fieldHint, isSmallScreen && styles.fieldHintCompact]}>
                {t('quickTemplatesHint')}
              </Text>
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

            {/* Photo Checklist */}
            <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
              <View
                style={[
                  styles.photoChecklistContainer,
                  isSmallScreen && styles.photoChecklistContainerCompact,
                ]}
              >
                <Text
                  style={[
                    styles.photoChecklistTitle,
                    isSmallScreen && styles.photoChecklistTitleCompact,
                  ]}
                >
                  {t('photoChecklistTitle')}
                </Text>
                <Text style={[styles.fieldHint, isSmallScreen && styles.fieldHintCompact]}>
                  {t('photoChecklistHint')}
                </Text>
                {PHOTO_CHECKLIST_KEYS.map(itemKey => (
                  <View key={itemKey} style={styles.photoChecklistItemRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={isSmallScreen ? 16 : 18}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.photoChecklistItemText,
                        isSmallScreen && styles.photoChecklistItemTextCompact,
                      ]}
                    >
                      {t(itemKey)}
                    </Text>
                  </View>
                ))}
              </View>
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
                    ? t(PRICE_TYPES.find(t => t.id === formData.price_type)?.labelKey || 'fixed')
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
              <View style={styles.priceRangeEstimateCard}>
                <View style={styles.priceRangeEstimateHeader}>
                  <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
                  <Text style={styles.priceRangeEstimateTitle}>{t('priceRangeEstimateTitle')}</Text>
                </View>
                {estimatedPriceRange.min !== null && estimatedPriceRange.max !== null ? (
                  <>
                    <Text style={styles.priceRangeEstimateValue}>
                      {`${estimatedPriceRange.min.toLocaleString('no-NO')}–${estimatedPriceRange.max.toLocaleString('no-NO')} NOK`}
                    </Text>
                    <Text style={styles.priceRangeEstimateMeta}>
                      {t('priceRangeEstimateMeta', {
                        cargoType: t(formData.cargo_type),
                        distanceKm: estimatedPriceRange.distanceKm,
                      })}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.priceRangeEstimateMeta}>
                    {t('priceRangeEstimatePending')}
                  </Text>
                )}
              </View>
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
                <LinearGradient
                  colors={[colors.primary, '#E05A10']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.full }]}
                />
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

      {/* Cargo Type Sheet */}
      <StandardBottomSheet
        visible={showCargoTypeMenu}
        onClose={() => setShowCargoTypeMenu(false)}
        title={t('selectCargoType')}
      >
        {CARGO_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            testID={`cargo-type-${type.id}`}
            accessibilityRole="menuitem"
            accessibilityLabel={`Velg ${t(type.labelKey)} som lasttype`}
            accessibilityHint="Dobbelttrykk for å velge denne lasttypen"
            accessibilityState={{ selected: formData.cargo_type === type.id }}
            style={[styles.menuItem, formData.cargo_type === type.id && styles.menuItemSelected]}
            onPress={() => {
              applyCargoTypePreset(type.id);
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
              {t(type.labelKey)}
            </Text>
            {formData.cargo_type === type.id && (
              <Ionicons name="checkmark" size={20} color="#10B981" />
            )}
          </TouchableOpacity>
        ))}
      </StandardBottomSheet>

      {/* Price Type Sheet */}
      <StandardBottomSheet
        visible={showPriceTypeMenu}
        onClose={() => setShowPriceTypeMenu(false)}
        title={t('priceType')}
      >
        {PRICE_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={[styles.menuItem, formData.price_type === type.id && styles.menuItemSelected]}
            onPress={() => {
              updateFormData('price_type', type.id);
              handleBlur('price_type');
              setShowPriceTypeMenu(false);
              triggerHapticFeedback.light();
            }}
            accessibilityRole="menuitem"
            accessibilityLabel={t(type.labelKey)}
            accessibilityState={{ selected: formData.price_type === type.id }}
          >
            <Text
              style={[
                styles.menuItemText,
                formData.price_type === type.id && styles.menuItemTextSelected,
              ]}
            >
              {t(type.labelKey)}
            </Text>
            {formData.price_type === type.id && (
              <Ionicons name="checkmark" size={20} color="#10B981" />
            )}
          </TouchableOpacity>
        ))}
      </StandardBottomSheet>

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
  photoChecklistContainer: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: spacing.xs,
  },
  photoChecklistContainerCompact: {
    padding: spacing.sm,
  },
  photoChecklistTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  photoChecklistTitleCompact: {
    fontSize: fontSize.sm,
  },
  photoChecklistItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  photoChecklistItemText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  photoChecklistItemTextCompact: {
    fontSize: fontSize.xs,
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
    flex: 2,
    backgroundColor: colors.primary, // Fallback
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden', // to keep gradient inside borders
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
  quickTemplateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickTemplateRowCompact: {
    gap: spacing.xxxs,
  },
  quickTemplateChip: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickTemplateChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundLight,
  },
  quickTemplateChipText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  quickTemplateChipTextSelected: {
    color: colors.primary,
  },
  priceRangeEstimateCard: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xxxs,
  },
  priceRangeEstimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceRangeEstimateTitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  priceRangeEstimateValue: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  priceRangeEstimateMeta: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
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
