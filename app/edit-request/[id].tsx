import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitization';
import { triggerHapticFeedback } from '../../utils/haptics';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AddressInput from '../../components/AddressInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { calculateDistance } from '../../utils/googlePlaces';
import { compressImageForUpload } from '../../utils/imageCompression';
import { normalizeCargoImageInputs, resolveCargoImageUrls } from '../../utils/cargoImages';
import { estimateCargoPriceRange } from '../../utils/priceEstimation';
import {
  CARGO_TYPE_PRESETS,
  CARGO_TYPES,
  PRICE_TYPES,
  QUICK_REQUEST_TEMPLATES,
} from '../../utils/cargoFormConstants';
import { LazyImage } from '../../components/LazyImage';
import { colors, spacing, fontSize, borderRadius } from '../../lib/sharedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CARGO_LIMITS = {
  weight: { min: 1, max: 25000 },
  dimension: { min: 1, max: 1200 },
  volume: { max: 40 },
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions?: string;
  length?: number;
  width?: number;
  height?: number;
  from_address: string;
  to_address: string;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  distance_km?: number | null;
  pickup_date: string;
  delivery_date: string;
  price: number;
  price_type: string;
  status: string;
  user_id?: string;
  customer_id?: string;
  weight_kg?: number;
  images?: string[];
  bids: unknown[];
}

export default function EditRequestScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = i18n?.language || 'en';
  const locale = language.startsWith('no') ? 'nb-NO' : 'en-US';
  const formBottomInset = Math.max(insets.bottom, spacing.sm) + spacing.xl;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPickupDate, setShowPickupDate] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [showCargoTypeMenu, setShowCargoTypeMenu] = useState(false);
  const [showPriceTypeMenu, setShowPriceTypeMenu] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]);

  const fromAddressTextRef = useRef('');
  const toAddressTextRef = useRef('');

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

  const estimatedPriceRange = estimateCargoPriceRange({
    cargoType: formData.cargo_type,
    distanceKm: formData.distance_km,
    weightKg: formData.weight,
  });

  useEffect(() => {
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearDistanceIfNeeded = (field: string) => {
    if (field === 'from_address' || field === 'to_address') {
      setFormData(prev => ({ ...prev, distance_km: null }));
    }
  };

  const validateField = (field: string, value: unknown): string => {
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
        if (formData.price_type === 'fixed') {
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

  const updateFormData = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (touchedFields[field]) {
      const error = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
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

    if (touchedFields.cargo_type) {
      const error = validateField('cargo_type', cargoType);
      setFieldErrors(prev => ({ ...prev, cargo_type: error }));
    }
  };

  const applyQuickTemplate = (template: (typeof QUICK_REQUEST_TEMPLATES)[number]) => {
    const nextData = {
      ...formData,
      cargo_type: template.cargo_type,
      weight: template.weight,
      length: template.length,
      width: template.width,
      height: template.height,
    };

    setFormData(nextData);
    triggerHapticFeedback.light();

    if (touchedFields.cargo_type) {
      setFieldErrors(prev => ({
        ...prev,
        cargo_type: validateField('cargo_type', nextData.cargo_type),
      }));
    }
    if (touchedFields.weight) {
      setFieldErrors(prev => ({ ...prev, weight: validateField('weight', nextData.weight) }));
    }
    if (touchedFields.length) {
      setFieldErrors(prev => ({ ...prev, length: validateField('length', nextData.length) }));
    }
    if (touchedFields.width) {
      setFieldErrors(prev => ({ ...prev, width: validateField('width', nextData.width) }));
    }
    if (touchedFields.height) {
      setFieldErrors(prev => ({ ...prev, height: validateField('height', nextData.height) }));
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

  const fetchRequest = async () => {
    try {
      const { data: requestData, error: requestError } = await supabase
        .from('cargo_requests')
        .select('*')
        .eq('id', id as string)
        .maybeSingle();

      if (requestError || !requestData) {
        toast.error(t('requestNotFound'));
        router.back();
        return;
      }

      const data = { id: requestData.id, ...requestData } as CargoRequest;
      const ownerId = data.customer_id || data.user_id;

      if (ownerId !== user?.uid) {
        toast.error(t('editOwnRequestOnly'));
        router.back();
        return;
      }

      const { data: acceptedBids, error: acceptedBidsError } = await supabase
        .from('bids')
        .select('id')
        .eq('request_id', id as string)
        .eq('status', 'accepted')
        .limit(1);

      if (acceptedBidsError) {
        throw acceptedBidsError;
      }

      if (acceptedBids && acceptedBids.length > 0) {
        toast.error(t('editNotAllowedAcceptedBids'));
        router.back();
        return;
      }

      // Parse dimensions if available
      let length = '',
        width = '',
        height = '';
      if (data.dimensions && data.dimensions.includes('x')) {
        const parts = data.dimensions.split('x').map(p => p.trim());
        if (parts.length === 3) {
          [length, width, height] = parts;
        }
      }

      setFormData({
        title: data.title,
        description: data.description,
        cargo_type: data.cargo_type,
        weight: (data.weight_kg ?? data.weight ?? '').toString(),
        length,
        width,
        height,
        from_address: data.from_address,
        to_address: data.to_address,
        from_lat: data.from_lat ?? null,
        from_lng: data.from_lng ?? null,
        to_lat: data.to_lat ?? null,
        to_lng: data.to_lng ?? null,
        distance_km: data.distance_km ?? null,
        pickup_date: new Date(data.pickup_date),
        delivery_date: new Date(data.delivery_date),
        price_type: data.price_type,
        price: data.price.toString(),
      });

      const normalizedImages = normalizeCargoImageInputs(requestData.images, requestData.image_url);
      const resolvedImages = await resolveCargoImageUrls(normalizedImages);
      const imagesForUi = resolvedImages.length > 0 ? resolvedImages : normalizedImages;

      if (imagesForUi.length > 0) {
        setImages(imagesForUi);
        setOriginalImages(imagesForUi);
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      toast.error(t('failedToLoadRequest'));
      router.back();
    } finally {
      setLoading(false);
    }
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
    const ownerId = user?.uid;

    if (!ownerId) {
      throw new Error('User must be authenticated to upload images');
    }

    for (let i = 0; i < images.length; i++) {
      const uri = images[i];

      const isLikelyLocalUri =
        uri.startsWith('file://') ||
        uri.startsWith('content://') ||
        uri.startsWith('ph://') ||
        uri.startsWith('asset://');

      // If already remote URL or existing storage path, keep as-is
      if (!isLikelyLocalUri) {
        uploadedUrls.push(uri);
        continue;
      }

      try {
        const compressedUri = await compressImage(uri);
        const ext = uri.split('.').pop() || 'jpg';
        const filePath = `${ownerId}/${requestId}/${Date.now()}_${i}.${ext}`;

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

  const handleSave = async () => {
    if (!validateForm()) {
      triggerHapticFeedback.error();
      return;
    }

    triggerHapticFeedback.medium();
    setSaving(true);
    try {
      let dimensions = null;
      if (formData.length && formData.width && formData.height) {
        dimensions = `${formData.length} x ${formData.width} x ${formData.height}`;
      }

      const title = sanitizeInput(formData.title.trim(), 200);
      const description = sanitizeInput(formData.description.trim(), 2000);
      const fromAddress = sanitizeInput(formData.from_address.trim(), 300);
      const toAddress = sanitizeInput(formData.to_address.trim(), 300);
      let updateData: Record<string, unknown> = {
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
        updated_at: new Date().toISOString(),
      };

      // Handle images if changed
      if (images.length > 0) {
        const imageUrls = await uploadImages(id as string);
        if (imageUrls.length > 0) {
          updateData.images = imageUrls;
        }
      } else if (originalImages.length > 0) {
        // Remove images if all were deleted
        updateData.images = [];
      }

      let updateError: unknown = null;
      const removableColumns = new Set(['distance_km']);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await supabase
          .from('cargo_requests')
          .update(updateData)
          .eq('id', id as string)
          .eq('customer_id', user?.uid || '');

        updateError = result.error;

        if (!updateError) {
          break;
        }

        const isSchemaColumnError =
          updateError &&
          typeof updateError === 'object' &&
          'code' in updateError &&
          (updateError as { code?: string }).code === 'PGRST204' &&
          'message' in updateError &&
          typeof (updateError as { message?: string }).message === 'string';

        if (!isSchemaColumnError) {
          break;
        }

        const message = (updateError as { message: string }).message;
        const missingColumnMatch = message.match(/'([^']+)' column/);
        const missingColumn = missingColumnMatch?.[1];

        if (
          !missingColumn ||
          !(missingColumn in updateData) ||
          !removableColumns.has(missingColumn)
        ) {
          break;
        }

        console.warn(
          `Column '${missingColumn}' is missing in cargo_requests. Retrying update without this field.`
        );
        updateData = Object.fromEntries(
          Object.entries(updateData).filter(([key]) => key !== missingColumn)
        );
      }

      if (updateError) {
        throw updateError;
      }

      // Success feedback
      triggerHapticFeedback.success();
      setShowSuccessAnimation(true);

      toast.success(t('requestUpdated'));

      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error: unknown) {
      console.error('Error updating request:', error);
      const message =
        error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code?: string }).code === '42501'
          ? 'Du har ikke tilgang til å redigere forespørselen nå (RLS policy). Logg inn på nytt og sjekk Supabase policy for cargo_requests.'
          : error instanceof Error
            ? error.message
            : t('error');
      toast.error(message);
      triggerHapticFeedback.error();
    } finally {
      setSaving(false);
    }
  };

  const handleFromAddressSelect = async (
    address: string,
    coordinates?: { lat: number; lng: number }
  ) => {
    clearDistanceIfNeeded('from_address');
    updateFormData('from_address', address);
    setTouchedFields(prev => ({ ...prev, from_address: true }));
    const error = validateField('from_address', address);
    setFieldErrors(prev => ({ ...prev, from_address: error }));

    if (coordinates) {
      updateFormData('from_lat', coordinates.lat);
      updateFormData('from_lng', coordinates.lng);
      fromAddressTextRef.current = address;

      if (formData.to_lat && formData.to_lng) {
        try {
          const distance = await calculateDistance(coordinates, {
            lat: formData.to_lat,
            lng: formData.to_lng,
          });
          if (distance) {
            const distanceKm = distance.distance.value / 1000;
            updateFormData('distance_km', distanceKm);
          }
        } catch (error) {
          console.error('Distance calculation failed:', error);
        }
      }
    }
  };

  const handleToAddressSelect = async (
    address: string,
    coordinates?: { lat: number; lng: number }
  ) => {
    clearDistanceIfNeeded('to_address');
    updateFormData('to_address', address);
    setTouchedFields(prev => ({ ...prev, to_address: true }));
    const error = validateField('to_address', address);
    setFieldErrors(prev => ({ ...prev, to_address: error }));

    if (coordinates) {
      updateFormData('to_lat', coordinates.lat);
      updateFormData('to_lng', coordinates.lng);
      toAddressTextRef.current = address;

      if (formData.from_lat && formData.from_lng) {
        try {
          const distance = await calculateDistance(
            { lat: formData.from_lat, lng: formData.from_lng },
            coordinates
          );
          if (distance) {
            const distanceKm = distance.distance.value / 1000;
            updateFormData('distance_km', distanceKm);
          }
        } catch (error) {
          console.error('Distance calculation failed:', error);
        }
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('editRequestTitle')}
        onBackPress={() => router.back()}
        rightAction={{
          icon: 'checkmark',
          onPress: () => {
            if (!saving) {
              handleSave();
            }
          },
          label: saving ? 'Saving request' : t('save'),
        }}
      />

      <KeyboardAwareFlatList
        contentContainerStyle={[styles.scrollContent, { paddingBottom: formBottomInset }]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={100}
        enableResetScrollToCoords={false}
        data={[{ key: 'form' }]}
        keyExtractor={item => item.key}
        renderItem={() => (
          <View>
            {/* Cargo Type */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Lasttype</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCargoTypeMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Velg lasttype"
              >
                <Text
                  style={[styles.dropdownText, !formData.cargo_type && styles.dropdownPlaceholder]}
                >
                  {formData.cargo_type ? t(formData.cargo_type) : t('selectCargoType')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
              {formData.cargo_type && CARGO_TYPE_PRESETS[formData.cargo_type]?.hintKey ? (
                <Text style={styles.fieldHint}>
                  {t(CARGO_TYPE_PRESETS[formData.cargo_type].hintKey)}
                </Text>
              ) : null}
            </View>

            {/* Quick Templates */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{t('quickTemplates')}</Text>
              <View style={styles.quickTemplateRow}>
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
              <Text style={styles.fieldHint}>{t('quickTemplatesHint')}</Text>
            </View>

            {/* From Address */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Fra</Text>
              <AddressInput
                placeholder="Søk etter adresse..."
                value={formData.from_address}
                onAddressSelect={handleFromAddressSelect}
                onChangeText={(text: string) => {
                  fromAddressTextRef.current = text;
                  updateFormData('from_address', text);
                  if (text !== formData.from_address) {
                    clearDistanceIfNeeded('from_address');
                  }
                }}
              />
              {fieldErrors.from_address && touchedFields.from_address && (
                <Text style={styles.errorText}>{fieldErrors.from_address}</Text>
              )}
            </View>

            {/* To Address */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Til</Text>
              <AddressInput
                placeholder="Søk etter adresse..."
                value={formData.to_address}
                onAddressSelect={handleToAddressSelect}
                onChangeText={(text: string) => {
                  toAddressTextRef.current = text;
                  updateFormData('to_address', text);
                  if (text !== formData.to_address) {
                    clearDistanceIfNeeded('to_address');
                  }
                }}
              />
              {fieldErrors.to_address && touchedFields.to_address && (
                <Text style={styles.errorText}>{fieldErrors.to_address}</Text>
              )}
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
                >
                  <TextInput
                    style={styles.dateTextInput}
                    value={formData.pickup_date.toLocaleDateString(locale)}
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
                  accessibilityRole="button"
                  accessibilityLabel="Select delivery date"
                >
                  <TextInput
                    style={styles.dateTextInput}
                    value={formData.delivery_date.toLocaleDateString(locale)}
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
              >
                <Text
                  style={[styles.dropdownText, !formData.price_type && styles.dropdownPlaceholder]}
                >
                  {formData.price_type
                    ? t(PRICE_TYPES.find(t => t.id === formData.price_type)?.labelKey || 'fixed')
                    : 'Velg prismodell'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Price - ALWAYS VISIBLE */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Foreslått pris (kr)</Text>
              <View style={styles.priceRangeEstimateCard}>
                <View style={styles.priceRangeEstimateHeader}>
                  <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
                  <Text style={styles.priceRangeEstimateTitle}>{t('priceRangeEstimateTitle')}</Text>
                </View>
                {estimatedPriceRange.min !== null && estimatedPriceRange.max !== null ? (
                  <>
                    <Text style={styles.priceRangeEstimateValue}>
                      {`${estimatedPriceRange.min.toLocaleString(locale)}–${estimatedPriceRange.max.toLocaleString(locale)} kr`}
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
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Avbryt"
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.publishButton, saving && styles.publishButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={saving ? 'Saving changes' : 'Lagre endringer'}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.publishButtonText}>Lagre endringer</Text>
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
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
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
                style={[
                  styles.menuItem,
                  formData.cargo_type === type.id && styles.menuItemSelected,
                ]}
                onPress={() => {
                  applyCargoTypePreset(type.id);
                  handleBlur('cargo_type');
                  setShowCargoTypeMenu(false);
                  triggerHapticFeedback.light();
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={`Velg ${t(type.labelKey)} som lasttype`}
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
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
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
                accessibilityLabel={t(type.labelKey)}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.lg,
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
    backgroundColor: colors.primary,
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
  quickTemplateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
    fontWeight: '500',
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
    fontWeight: '500',
  },
  priceRangeEstimateValue: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: '600',
  },
  priceRangeEstimateMeta: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
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
