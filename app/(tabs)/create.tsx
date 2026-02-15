import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, LogBox } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { db, storage } from '../../lib/firebase';
import { trackCargoRequestCreated } from '../../utils/analytics';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitization';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import { triggerHapticFeedback } from '../../utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { calculateDistance } from '../../utils/googlePlaces';
import { geohashForLocation } from 'geofire-common';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { LazyImage } from '../../components/LazyImage';
import { Picker } from '@react-native-picker/picker';

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

  // Suppress VirtualizedList warning for GooglePlacesAutocomplete in ScrollView
  useEffect(() => {
    LogBox.ignoreLogs(['VirtualizedLists should never be nested']);
  }, []);

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
    if (!validateForm()) return;

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

      trackCargoRequestCreated({
        cargo_type: formData.cargo_type,
        pricing_model: formData.price_type,
        price: formData.price_type === 'fixed' ? Number(formData.price) : undefined,
        from_city: formData.from_address,
        to_city: formData.to_address,
      });

      if (images.length > 0 && request) {
        const imageUrls = await uploadImages(request.id);

        if (imageUrls.length > 0) {
          await updateDoc(doc(db, 'cargo_requests', request.id), {
            images: imageUrls,
          });
        }
      }

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

  return (
    <>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={100}
        enableResetScrollToCoords={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>{t('createRequest')}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.submitButton, (hasErrors() || loading) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || hasErrors()}
            >
              {loading ? (
                <Text style={styles.submitButtonText}>{t('creating')}</Text>
              ) : hasErrors() ? (
                <>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={colors.white}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.submitButtonText}>Rett opp feil</Text>
                </>
              ) : (
                <>
                  <Text style={styles.submitButtonText}>{t('create')}</Text>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.white}
                    style={{ marginLeft: 6 }}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${calculateProgress()}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{calculateProgress()}% fullført</Text>
        </View>

        {/* Estimated Price Card */}
        {estimatedPrice && (
          <View style={styles.estimatedPriceCard}>
            <Ionicons name="calculator-outline" size={24} color={colors.primary} />
            <View style={styles.estimatedPriceContent}>
              <Text style={styles.estimatedPriceLabel}>Estimert pris</Text>
              <Text style={styles.estimatedPriceValue}>
                {estimatedPrice.toLocaleString('nb-NO')} NOK
              </Text>
              <Text style={styles.estimatedPriceNote}>
                Basert på vekt, volum og distanse
              </Text>
            </View>
          </View>
        )}
        
        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('basicInformation')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('title')} *</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={
                  getFieldError('title')
                    ? theme.iconColors.error
                    : isFieldValid('title')
                      ? theme.iconColors.success
                      : theme.iconColors.gray.primary
                }
                style={styles.inputIcon}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.inputWithPadding,
                  getFieldError('title')
                    ? styles.inputError
                    : isFieldValid('title')
                      ? styles.inputValid
                      : null,
                ]}
                placeholder={t('enterTitle')}
                value={formData.title}
                onChangeText={value => updateFormData('title', value)}
                onBlur={() => handleFieldBlur('title')}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
            {getFieldError('title') && (
              <Text style={styles.errorText}>{getFieldError('title')}</Text>
            )}
            {isFieldValid('title') && <Text style={styles.successText}>OK</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('description')} *</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="text-outline"
                size={20}
                color={
                  getFieldError('description')
                    ? theme.iconColors.error
                    : isFieldValid('description')
                      ? theme.iconColors.success
                      : theme.iconColors.gray.primary
                }
                style={[styles.inputIcon, styles.textAreaIcon]}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  styles.inputWithPadding,
                  getFieldError('description')
                    ? styles.inputError
                    : isFieldValid('description')
                      ? styles.inputValid
                      : null,
                ]}
                placeholder={t('enterDescription')}
                value={formData.description}
                onChangeText={value => updateFormData('description', value)}
                onBlur={() => handleFieldBlur('description')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
            {getFieldError('description') && (
              <Text style={styles.errorText}>{getFieldError('description')}</Text>
            )}
            {isFieldValid('description') && <Text style={styles.successText}>OK</Text>}
          </View>
        </View>

        {/* Cargo Type */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('cargoType')} *</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Velg type last du skal frakte</Text>
          {getFieldError('cargo_type') && (
            <Text style={styles.errorText}>{getFieldError('cargo_type')}</Text>
          )}
          <View style={styles.cargoTypeList}>
            {CARGO_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.cargoTypeListItem,
                  formData.cargo_type === type.id && styles.cargoTypeListItemSelected,
                ]}
                onPress={() => {
                  updateFormData('cargo_type', type.id);
                  // Mark as touched and clear any error immediately
                  setTouchedFields(prev => ({ ...prev, cargo_type: true }));
                  setFieldErrors(prev => ({ ...prev, cargo_type: '' }));
                  try {
                    triggerHapticFeedback.light();
                  } catch {
                    // Haptic feedback not available
                  }
                }}
              >
                <View style={styles.cargoTypeListItemContent}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={
                      formData.cargo_type === type.id ? colors.white : theme.iconColors.gray.primary
                    }
                  />
                  <Text
                    style={[
                      styles.cargoTypeListLabel,
                      formData.cargo_type === type.id && styles.cargoTypeListLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </View>
                {formData.cargo_type === type.id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.white} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cargo Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('cargoDetails')}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>{t('weight')} (kg) *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons
                  name="barbell-outline"
                  size={20}
                  color={
                    getFieldError('weight')
                      ? theme.iconColors.error
                      : isFieldValid('weight')
                        ? theme.iconColors.success
                        : theme.iconColors.gray.primary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithPadding,
                    getFieldError('weight')
                      ? styles.inputError
                      : isFieldValid('weight')
                        ? styles.inputValid
                        : null,
                  ]}
                  placeholder="0"
                  value={formData.weight}
                  onChangeText={value => updateFormData('weight', value)}
                  onBlur={() => handleFieldBlur('weight')}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.tertiary}
                />
                {isFieldValid('weight') && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.iconColors.success}
                    style={styles.validationIcon}
                  />
                )}
                {getFieldError('weight') && (
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.iconColors.error}
                    style={styles.validationIcon}
                  />
                )}
              </View>
              {getFieldError('weight') && (
                <Text style={styles.errorTextSmall}>{getFieldError('weight')}</Text>
              )}
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>{t('dimensions')}</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons
                  name="resize-outline"
                  size={20}
                  color={
                    getFieldError('dimensions')
                      ? theme.iconColors.error
                      : isFieldValid('dimensions')
                        ? theme.iconColors.success
                        : theme.iconColors.gray.primary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithPadding,
                    getFieldError('dimensions')
                      ? styles.inputError
                      : isFieldValid('dimensions')
                        ? styles.inputValid
                        : null,
                  ]}
                  placeholder="L x W x H"
                  value={formData.dimensions}
                  onChangeText={value => updateFormData('dimensions', value)}
                  onBlur={() => handleFieldBlur('dimensions')}
                  placeholderTextColor={colors.text.tertiary}
                />
                {isFieldValid('dimensions') && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.iconColors.success}
                    style={styles.validationIcon}
                  />
                )}
                {getFieldError('dimensions') && (
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.iconColors.error}
                    style={styles.validationIcon}
                  />
                )}
              </View>
              {getFieldError('dimensions') && (
                <Text style={styles.errorTextSmall}>{getFieldError('dimensions')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Photo Upload Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bilder (valgfritt)</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Legg til bilder av lasten</Text>

          <View style={styles.photoGrid}>
            {images.map((uri, index) => (
              <TouchableOpacity
                key={index}
                style={styles.photoGridItem}
                onPress={() => removeImage(index)}
              >
                <LazyImage
                  uri={uri}
                  style={styles.photoGridImage}
                  containerStyle={styles.photoGridImage}
                  resizeMode="cover"
                  placeholderIcon="image-outline"
                  placeholderSize={32}
                  showErrorText={false}
                />
                <View style={styles.removePhotoButton}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </View>
              </TouchableOpacity>
            ))}

            {images.length < 5 && (
              <TouchableOpacity style={styles.addPhotoGrid} onPress={pickImages}>
                <Ionicons name="camera-outline" size={32} color={theme.iconColors.gray.primary} />
                <Text style={styles.addPhotoTextGrid}>Legg til bilde</Text>
                <Text style={styles.maxPhotosText}>Maks 5 bilder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('route')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithValidation}>
              <Text style={styles.label}>{t('fromAddress')} *</Text>
              {touchedFields.from_address && (
                <Ionicons
                  name={getFieldError('from_address') ? 'close-circle' : 'checkmark-circle'}
                  size={20}
                  color={
                    getFieldError('from_address')
                      ? theme.iconColors.error
                      : theme.iconColors.success
                  }
                />
              )}
            </View>
            <View
              style={[
                styles.googlePlacesContainer,
                touchedFields.from_address && getFieldError('from_address') && styles.inputError,
                touchedFields.from_address && !getFieldError('from_address') && styles.inputValid,
              ]}
            >
              <View style={styles.addressInputWrapper}>
                <Ionicons
                  name="play-outline"
                  size={20}
                  color={theme.iconColors.success}
                  style={styles.addressIcon}
                />
                <GooglePlacesAutocomplete
                  ref={fromAddressRef}
                  placeholder={t('enterFromAddress')}
                  onPress={async (data, details) => {
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
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={100}
        enableResetScrollToCoords={false}
      >
        {/* Title */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Tittel</Text>
          <TextInput
            style={styles.textInput}
            value={formData.title}
            onChangeText={value => {
              updateFormData('title', value);
              clearDistanceIfNeeded('title');
            }}
            onBlur={() => handleBlur('title')}
            placeholder=""
          />
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Beskrivelse</Text>
          <TextInput
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
          />
        </View>

        {/* Cargo Type */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Lasttype</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.cargo_type}
              onValueChange={value => {
                updateFormData('cargo_type', value);
                handleBlur('cargo_type');
              }}
              style={styles.picker}
              accessibilityLabel="Velg lasttype"
            >
              <Picker.Item label="Velg lasttype..." value="" />
              {CARGO_TYPES.map(type => (
                <Picker.Item key={type.id} label={type.label} value={type.id} />
              ))}
            </Picker>
          </View>
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
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowPickupDate(true)}>
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
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowDeliveryDate(true)}>
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
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Weight */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Vekt (kg)</Text>
          <TextInput
            style={[styles.textInput, { borderColor: '#E5E7EB' }]}
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
          <TouchableOpacity style={styles.imageUploadArea} onPress={pickImages}>
            <View style={styles.imageUploadContent}>
              <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              <Text style={styles.imageUploadText}>Legg til bilder ({images.length}/5)</Text>
            </View>
          </TouchableOpacity>

          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageGridItem}>
                  <LazyImage uri={uri} style={styles.imagePreview} containerStyle={styles.imageGridItem} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
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
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.price_type}
              onValueChange={value => {
                updateFormData('price_type', value);
                handleBlur('price_type');
              }}
              style={styles.picker}
              accessibilityLabel="Velg prismodell"
            >
              <Picker.Item label="Velg prismodell..." value="" />
              <Picker.Item label="Kan forhandles" value="negotiable" />
              <Picker.Item label="Fast pris" value="fixed" />
            </Picker>
          </View>
        </View>

          {formData.price_type === 'fixed' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('price')} (NOK) *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color={
                    getFieldError('price')
                      ? theme.iconColors.error
                      : isFieldValid('price')
                        ? theme.iconColors.success
                        : theme.iconColors.gray.primary
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithPadding,
                    getFieldError('price')
                      ? styles.inputError
                      : isFieldValid('price')
                        ? styles.inputValid
                        : null,
                  ]}
                  placeholder="0"
                  value={formData.price}
                  onChangeText={value => updateFormData('price', value)}
                  onBlur={() => handleFieldBlur('price')}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.tertiary}
                />
                {isFieldValid('price') && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.iconColors.success}
                    style={styles.validationIcon}
                  />
                )}
                {getFieldError('price') && (
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.iconColors.error}
                    style={styles.validationIcon}
                  />
                )}
              </View>
              {getFieldError('price') && (
                <Text style={styles.errorText}>{getFieldError('price')}</Text>
              )}
            </View>
          )}
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: insets.bottom + 80 }} />
      </KeyboardAwareScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#FF7043',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    borderColor: '#E5E7EB',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionInput: {
    flex: 1,
    borderColor: '#E5E7EB',
  },
  imageUploadArea: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  imageUploadContent: {
    alignItems: 'center',
  },
  imageUploadText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  imageGridItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
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
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  publishButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FF7043',
    alignItems: 'center',
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placesContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  placesTextInput: {
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
});
