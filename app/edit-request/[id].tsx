import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db, storage } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { triggerHapticFeedback } from '../../utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { calculateDistance } from '../../utils/googlePlaces';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
  gradients,
} from '../../lib/sharedStyles';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const CARGO_TYPES = [
  { id: 'furniture', icon: 'bed-outline', label: 'Møbler' },
  { id: 'electronics', icon: 'phone-portrait-outline', label: 'Elektronikk' },
  { id: 'construction', icon: 'construct-outline', label: 'Byggemateriell' },
  { id: 'automotive', icon: 'car-outline', label: 'Bil/Motor' },
  { id: 'boats', icon: 'boat-outline', label: 'Båter' },
  { id: 'campingvogn', icon: 'home-outline', label: 'Campingvogn' },
  { id: 'machinery', icon: 'build-outline', label: 'Maskiner' },
  { id: 'other', icon: 'cube-outline', label: 'Annet' },
];

const PRICE_TYPES = [
  { id: 'fixed', icon: 'pricetag-outline', label: 'Fast pris' },
  { id: 'negotiable', icon: 'chatbubble-outline', label: 'Kan forhandles' },
];

export default function EditRequestScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cargo_type: '',
    weight: '',
    dimensions: '',
    from_address: '',
    to_address: '',
    from_lat: null as number | null,
    from_lng: null as number | null,
    to_lat: null as number | null,
    to_lng: null as number | null,
    pickup_date: new Date(),
    delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    price_type: '',
    price: '',
  });

  const [showPickupDate, setShowPickupDate] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [touchedFields, setTouchedFields] = useState<{ [key: string]: boolean }>({});
  const [distanceInfo, setDistanceInfo] = useState<{ distance: string; duration: string } | null>(
    null
  );
  const [images, setImages] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const clearDistanceIfNeeded = (field: string) => {
    if (field === 'from_address' || field === 'to_address') {
      setDistanceInfo(null);
    }
  };

  const validateField = (field: string, value: any): string => {
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

      case 'weight':
        if (!value || value.toString().trim() === '') return 'Vekt er påkrevd';
        const weight = Number(value);
        if (isNaN(weight)) return 'Vekt må være et tall';
        if (weight <= 0) return 'Vekt må være større enn 0';
        if (weight > 50000) return 'Vekt kan ikke være større enn 50000 kg';
        return '';

      case 'dimensions':
        if (value && value.toString().trim().length > 50)
          return 'Dimensjoner kan ikke være lengre enn 50 tegn';
        return '';

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

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate field if it has been touched
    if (touchedFields[field]) {
      const error = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const getFieldError = (field: string): string => {
    return touchedFields[field] ? fieldErrors[field] || '' : '';
  };

  const isFieldValid = (field: string): boolean => {
    return !getFieldError(field) && touchedFields[field];
  };

  const hasErrors = (): boolean => {
    return Object.values(fieldErrors).some(error => error !== '');
  };

  // Quick date selection functions
  const setDateToday = (field: 'pickup' | 'delivery') => {
    const today = new Date();
    today.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    if (field === 'pickup') {
      updateFormData('pickup_date', today);
    } else {
      updateFormData('delivery_date', today);
    }
  };

  const setDateTomorrow = (field: 'pickup' | 'delivery') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    if (field === 'pickup') {
      updateFormData('pickup_date', tomorrow);
    } else {
      updateFormData('delivery_date', tomorrow);
    }
  };

  const setDateNextWeek = (field: 'pickup' | 'delivery') => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(12, 0, 0, 0);
    if (field === 'pickup') {
      updateFormData('pickup_date', nextWeek);
    } else {
      updateFormData('delivery_date', nextWeek);
    }
  };

  const setDateIn3Days = (field: 'pickup' | 'delivery') => {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    in3Days.setHours(12, 0, 0, 0);
    if (field === 'pickup') {
      updateFormData('pickup_date', in3Days);
    } else {
      updateFormData('delivery_date', in3Days);
    }
  };

  // Load existing request data
  useEffect(() => {
    const loadRequest = async () => {
      if (!id) return;

      try {
        const requestRef = doc(db, 'cargo_requests', id as string);
        const requestSnap = await getDoc(requestRef);

        if (!requestSnap.exists()) {
          throw new Error('Request not found');
        }

        const data = requestSnap.data();

        if (data) {
          // Pre-fill form with existing data
          setFormData({
            title: data.title || '',
            description: data.description || '',
            cargo_type: data.cargo_type || '',
            weight: data.weight?.toString() || '',
            dimensions: data.dimensions || '',
            from_address: data.from_address || '',
            to_address: data.to_address || '',
            from_lat: data.from_lat || null,
            from_lng: data.from_lng || null,
            to_lat: data.to_lat || null,
            to_lng: data.to_lng || null,
            pickup_date: data.pickup_date ? new Date(data.pickup_date) : new Date(),
            delivery_date: data.delivery_date ? new Date(data.delivery_date) : new Date(),
            price_type: data.price_type || '',
            price: data.price?.toString() || '',
          });

          // Load existing images
          if (data.images && Array.isArray(data.images)) {
            setExistingImages(data.images);
          }

          // Calculate distance if coordinates exist
          if (data.from_lat && data.from_lng && data.to_lat && data.to_lng) {
            const distance = await calculateDistance(
              { lat: data.from_lat, lng: data.from_lng },
              { lat: data.to_lat, lng: data.to_lng }
            );
            if (distance) {
              setDistanceInfo({
                distance: distance.distance.text,
                duration: distance.duration.text,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading request:', error);
        Alert.alert('Feil', 'Kunne ikke laste forespørsel');
        router.back();
      } finally {
        setLoadingRequest(false);
      }
    };

    loadRequest();
  }, [id]);

  const validateForm = () => {
    // Validate all fields and mark them as touched
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

    // Show first error if any
    const firstError = Object.values(newErrors).find(error => error);
    if (firstError) {
      Alert.alert('Valideringsfeil', firstError);
      return false;
    }

    return true;
  };

  // Image compression function
  const compressImage = async (uri: string) => {
    try {
      const manipResult = await manipulateAsync(uri, [{ resize: { width: 1200 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
      });
      return manipResult.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri; // Return original if compression fails
    }
  };

  // Pick images from gallery
  const pickImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Tillatelse nødvendig',
          'Vi trenger tilgang til bildene dine for å laste opp bilder'
        );
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
        const existingCount = existingImages.filter(img => !imagesToDelete.includes(img)).length;
        const totalCurrent = existingCount + images.length;
        const remainingSlots = 5 - totalCurrent;
        const imagesToAdd = newImages.slice(0, remainingSlots);

        if (newImages.length > remainingSlots) {
          Alert.alert('Maks bilder', 'Du kan bare laste opp maksimalt 5 bilder totalt');
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
      Alert.alert('Feil', 'Kunne ikke laste bilder');
    }
  };

  // Remove image from list
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    try {
      triggerHapticFeedback.light();
    } catch {
      // Haptic feedback not available
    }
  };

  // Upload images to Firebase Storage
  const uploadImages = async (requestId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const uri = images[i];

        // Compress image
        const compressedUri = await compressImage(uri);

        // Convert to blob for upload with timeout
        const response = await fetchWithTimeout(
          compressedUri,
          {
            method: 'GET',
          },
          15000
        ); // 15 second timeout for image download
        const blob = await response.blob();

        // Generate filename
        const ext = uri.split('.').pop() || 'jpg';
        const fileName = `request-images/${requestId}_${i}_${Date.now()}.${ext}`;

        // Upload to Firebase Storage
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, blob, {
          contentType: 'image/jpeg',
        });

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadURL);
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
      // Update the cargo request
      const requestRef = doc(db, 'cargo_requests', id as string);
      await updateDoc(requestRef, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        cargo_type: formData.cargo_type,
        weight: Number(formData.weight),
        dimensions: formData.dimensions.trim() || null,
        from_address: formData.from_address.trim(),
        to_address: formData.to_address.trim(),
        from_lat: formData.from_lat,
        from_lng: formData.from_lng,
        to_lat: formData.to_lat,
        to_lng: formData.to_lng,
        pickup_date: formData.pickup_date.toISOString(),
        delivery_date: formData.delivery_date.toISOString(),
        price_type: formData.price_type,
        price: formData.price_type === 'fixed' ? Number(formData.price) : 0,
        updated_at: serverTimestamp(),
      });

      // Handle image updates
      let finalImages = [...existingImages];

      // Upload new images if any
      if (images.length > 0) {
        const newImageUrls = await uploadImages(id as string);
        finalImages = [...finalImages, ...newImageUrls];
      }

      // Remove images marked for deletion
      if (imagesToDelete.length > 0) {
        finalImages = finalImages.filter(img => !imagesToDelete.includes(img));

        // Delete from storage
        for (const imageUrl of imagesToDelete) {
          try {
            const fileName = imageUrl.split('/').pop();
            if (fileName) {
              const storageRef = ref(storage, `request-images/${fileName}`);
              await deleteObject(storageRef);
            }
          } catch (err) {
            console.error('Error deleting image:', err);
          }
        }
      }

      // Update request with final image list
      await updateDoc(requestRef, { images: finalImages });

      Alert.alert(t('success'), 'Forespørselen er oppdatert', [
        {
          text: t('ok'),
          onPress: () => {
            try {
              router.back();
            } catch (error) {
              console.warn('Navigation error:', error);
              setTimeout(() => {
                router.push(`/request-details/${id}`);
              }, 100);
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingRequest) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Laster forespørsel...</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Rediger forespørsel</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.submitButton, (hasErrors() || loading) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || hasErrors()}
            >
              {loading ? (
                <Text style={styles.submitButtonText}>Oppdaterer...</Text>
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
                  <Text style={styles.submitButtonText}>Oppdater</Text>
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
            {/* Existing images */}
            {existingImages
              .filter(img => !imagesToDelete.includes(img))
              .map((uri, index) => (
                <TouchableOpacity
                  key={`existing-${index}`}
                  style={styles.photoGridItem}
                  onPress={() => {
                    setImagesToDelete(prev => [...prev, uri]);
                  }}
                >
                  <Image source={{ uri }} style={styles.photoGridImage} />
                  <View style={styles.removePhotoButton}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </View>
                </TouchableOpacity>
              ))}

            {/* New images */}
            {images.map((uri, index) => (
              <TouchableOpacity
                key={`new-${index}`}
                style={styles.photoGridItem}
                onPress={() => removeImage(index)}
              >
                <Image source={{ uri }} style={styles.photoGridImage} />
                <View style={styles.removePhotoButton}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </View>
              </TouchableOpacity>
            ))}

            {existingImages.filter(img => !imagesToDelete.includes(img)).length + images.length <
              5 && (
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
                  placeholder={t('enterFromAddress')}
                  onPress={async (data, details) => {
                    clearDistanceIfNeeded('from_address');
                    updateFormData('from_address', data.description);
                    handleFieldBlur('from_address');
                    if (details?.geometry?.location) {
                      const coordinates = details.geometry.location;
                      updateFormData('from_lat', coordinates.lat);
                      updateFormData('from_lng', coordinates.lng);

                      // Calculate distance if to_address has coordinates
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
                          }
                        } catch (error) {
                          console.error('Distance calculation failed:', error);
                        }
                      }
                    }
                  }}
                  query={{
                    key: 'AIzaSyAD2MlcgKJs5BBeU1eMgtNZnqhy70ffWo0',
                    language: 'no',
                    components: 'country:no',
                  }}
                  styles={{
                    container: styles.googlePlacesInputContainer,
                    textInputContainer: styles.googlePlacesTextInputContainer,
                    textInput: styles.googlePlacesTextInput,
                    listView: styles.googlePlacesListView,
                    row: styles.googlePlacesRow,
                    separator: styles.googlePlacesSeparator,
                    description: styles.googlePlacesDescription,
                  }}
                  textInputProps={{
                    onFocus: () => {},
                    onBlur: () => handleFieldBlur('from_address'),
                    placeholderTextColor: colors.text.tertiary,
                  }}
                  fetchDetails
                  enablePoweredByContainer={false}
                  debounce={300}
                  minLength={2}
                  nearbyPlacesAPI="GooglePlacesSearch"
                  keyboardShouldPersistTaps="handled"
                  listViewDisplayed="auto"
                  predefinedPlaces={[
                    {
                      description: 'Oslo, Norge',
                      geometry: {
                        location: {
                          lat: 59.9139,
                          lng: 10.7522,
                          latitude: 59.9139,
                          longitude: 10.7522,
                        },
                      },
                    },
                    {
                      description: 'Bergen, Norge',
                      geometry: {
                        location: {
                          lat: 60.3913,
                          lng: 5.3221,
                          latitude: 60.3913,
                          longitude: 5.3221,
                        },
                      },
                    },
                    {
                      description: 'Trondheim, Norge',
                      geometry: {
                        location: {
                          lat: 63.4305,
                          lng: 10.3951,
                          latitude: 63.4305,
                          longitude: 10.3951,
                        },
                      },
                    },
                  ]}
                />
              </View>
            </View>
            {getFieldError('from_address') && (
              <Text style={styles.errorText}>{getFieldError('from_address')}</Text>
            )}
          </View>

          {/* Swap Button */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity
              style={styles.swapButton}
              onPress={() => {
                const fromAddress = formData.from_address;
                const toAddress = formData.to_address;
                const fromLat = formData.from_lat;
                const fromLng = formData.from_lng;
                const toLat = formData.to_lat;
                const toLng = formData.to_lng;

                // Swap addresses and coordinates
                updateFormData('from_address', toAddress);
                updateFormData('to_address', fromAddress);
                updateFormData('from_lat', toLat);
                updateFormData('from_lng', toLng);
                updateFormData('to_lat', fromLat);
                updateFormData('to_lng', fromLng);

                // Recalculate distance if both addresses exist
                if (fromAddress && toAddress && toLat && toLng && fromLat && fromLng) {
                  try {
                    calculateDistance({ lat: toLat, lng: toLng }, { lat: fromLat, lng: fromLng })
                      .then(distance => {
                        if (distance) {
                          setDistanceInfo({
                            distance: distance.distance.text,
                            duration: distance.duration.text,
                          });
                        }
                      })
                      .catch(error => {
                        console.error('Distance calculation failed:', error);
                      });
                  } catch (error) {
                    console.error('Distance calculation failed:', error);
                  }
                }

                // Add haptic feedback
                try {
                  triggerHapticFeedback.medium();
                } catch (error) {
                  console.log('Haptic feedback not available');
                }
              }}
              disabled={!formData.from_address || !formData.to_address}
            >
              <Ionicons name="swap-vertical-outline" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithValidation}>
              <Text style={styles.label}>{t('toAddress')} *</Text>
              {touchedFields.to_address && (
                <Ionicons
                  name={getFieldError('to_address') ? 'close-circle' : 'checkmark-circle'}
                  size={20}
                  color={
                    getFieldError('to_address') ? theme.iconColors.error : theme.iconColors.success
                  }
                />
              )}
            </View>
            <View
              style={[
                styles.googlePlacesContainer,
                touchedFields.to_address && getFieldError('to_address') && styles.inputError,
                touchedFields.to_address && !getFieldError('to_address') && styles.inputValid,
              ]}
            >
              <View style={styles.addressInputWrapper}>
                <Ionicons
                  name="flag-outline"
                  size={20}
                  color={theme.iconColors.error}
                  style={styles.addressIcon}
                />
                <GooglePlacesAutocomplete
                  placeholder={t('enterToAddress')}
                  onPress={async (data, details) => {
                    clearDistanceIfNeeded('to_address');
                    updateFormData('to_address', data.description);
                    handleFieldBlur('to_address');
                    if (details?.geometry?.location) {
                      const coordinates = details.geometry.location;
                      updateFormData('to_lat', coordinates.lat);
                      updateFormData('to_lng', coordinates.lng);

                      // Calculate distance if both addresses have coordinates
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
                          }
                        } catch (error) {
                          console.error('Distance calculation failed:', error);
                        }
                      }
                    }
                  }}
                  query={{
                    key: 'AIzaSyAD2MlcgKJs5BBeU1eMgtNZnqhy70ffWo0',
                    language: 'no',
                    components: 'country:no',
                  }}
                  styles={{
                    container: styles.googlePlacesInputContainer,
                    textInputContainer: styles.googlePlacesTextInputContainer,
                    textInput: styles.googlePlacesTextInput,
                    listView: styles.googlePlacesListView,
                    row: styles.googlePlacesRow,
                    separator: styles.googlePlacesSeparator,
                    description: styles.googlePlacesDescription,
                  }}
                  textInputProps={{
                    onFocus: () => {},
                    onBlur: () => handleFieldBlur('to_address'),
                    placeholderTextColor: colors.text.tertiary,
                  }}
                  fetchDetails
                  enablePoweredByContainer={false}
                  debounce={300}
                  minLength={2}
                  nearbyPlacesAPI="GooglePlacesSearch"
                  keyboardShouldPersistTaps="handled"
                  listViewDisplayed="auto"
                  predefinedPlaces={[
                    {
                      description: 'Oslo, Norge',
                      geometry: {
                        location: {
                          lat: 59.9139,
                          lng: 10.7522,
                          latitude: 59.9139,
                          longitude: 10.7522,
                        },
                      },
                    },
                    {
                      description: 'Bergen, Norge',
                      geometry: {
                        location: {
                          lat: 60.3913,
                          lng: 5.3221,
                          latitude: 60.3913,
                          longitude: 5.3221,
                        },
                      },
                    },
                    {
                      description: 'Trondheim, Norge',
                      geometry: {
                        location: {
                          lat: 63.4305,
                          lng: 10.3951,
                          latitude: 63.4305,
                          longitude: 10.3951,
                        },
                      },
                    },
                  ]}
                />
              </View>
            </View>
            {getFieldError('to_address') && (
              <Text style={styles.errorText}>{getFieldError('to_address')}</Text>
            )}
          </View>

          {/* Distance Information */}
          {distanceInfo && (
            <View style={styles.distanceChipsContainer}>
              <View style={styles.distanceChip}>
                <Ionicons name="location-outline" size={16} color={theme.iconColors.primary} />
                <Text style={styles.distanceChipText}>{distanceInfo.distance}</Text>
              </View>
              <View style={styles.distanceChip}>
                <Ionicons name="time-outline" size={16} color={theme.iconColors.primary} />
                <Text style={styles.distanceChipText}>{distanceInfo.duration}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dates')}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Velg hentedato og leveringsdato</Text>

          {/* Pickup Date */}
          <View style={styles.dateInputSection}>
            <Text style={styles.dateFieldLabel}>Hentedato *</Text>

            {/* Quick Date Chips for Pickup */}
            <View style={styles.quickDateChips}>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => {
                  setDateToday('pickup');
                  try {
                    triggerHapticFeedback.light();
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickDateChipText}>I dag</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => {
                  setDateTomorrow('pickup');
                  try {
                    triggerHapticFeedback.light();
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickDateChipText}>I morgen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => {
                  setDateIn3Days('pickup');
                  try {
                    triggerHapticFeedback.light();
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickDateChipText}>Om 3 dager</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.enhancedDateButton, styles.pickupDateButton]}
              onPress={() => setShowPickupDate(true)}
            >
              <View style={styles.enhancedDateButtonContent}>
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateLabel}>Hentedato</Text>
                  <Text style={[styles.dateValue, styles.pickupDateValue]}>
                    {formData.pickup_date.toLocaleDateString('no-NO', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.iconColors.success} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Date Arrow Separator */}
          <View style={styles.dateArrowContainer}>
            <View style={styles.dateArrowLine} />
            <View style={styles.dateArrowIconContainer}>
              <Ionicons name="arrow-down" size={16} color={theme.iconColors.gray.primary} />
            </View>
            <View style={styles.dateArrowLine} />
          </View>

          {/* Delivery Date */}
          <View style={styles.dateInputSection}>
            <Text style={styles.dateFieldLabel}>Leveringsdato</Text>

            {/* Quick Date Chips for Delivery */}
            <View style={styles.quickDateChips}>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => {
                  setDateTomorrow('delivery');
                  try {
                    triggerHapticFeedback.light();
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickDateChipText}>I morgen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => {
                  setDateIn3Days('delivery');
                  try {
                    triggerHapticFeedback.light();
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickDateChipText}>Om 3 dager</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => {
                  setDateNextWeek('delivery');
                  try {
                    triggerHapticFeedback.light();
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickDateChipText}>Neste uke</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.enhancedDateButton, styles.deliveryDateButton]}
              onPress={() => setShowDeliveryDate(true)}
            >
              <View style={styles.enhancedDateButtonContent}>
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateLabel}>Leveringsdato</Text>
                  <Text style={[styles.dateValue, styles.deliveryDateValue]}>
                    {formData.delivery_date.toLocaleDateString('no-NO', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.iconColors.error} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('pricing')} *</Text>
          </View>

          {getFieldError('price_type') && (
            <Text style={styles.errorText}>{getFieldError('price_type')}</Text>
          )}
          <View style={styles.priceTypeList}>
            {PRICE_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.priceTypeItem,
                  formData.price_type === type.id && styles.priceTypeItemActive,
                ]}
                onPress={() => {
                  updateFormData('price_type', type.id);
                  handleFieldBlur('price_type');
                  if (type.id === 'fixed' && formData.price) {
                    handleFieldBlur('price');
                  }
                }}
              >
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={theme.iconColors.gray.primary}
                  style={styles.priceTypeIcon}
                />
                <Text
                  style={[
                    styles.priceTypeLabel,
                    formData.price_type === type.id && styles.priceTypeLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
                {formData.price_type === type.id && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.iconColors.success} />
                )}
              </TouchableOpacity>
            ))}
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
          minimumDate={new Date()}
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
          minimumDate={formData.pickup_date}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flexGrow: 1,
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#FF3B30',
    opacity: 1,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.badge.background,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    fontWeight: fontWeight.regular,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm + 1,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginLeft: 6,
  },
  labelWithValidation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text.primary,
    backgroundColor: colors.white,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: spacing.md,
    top: 14,
    zIndex: 1,
  },
  textAreaIcon: {
    top: spacing.lg,
  },
  inputWithPadding: {
    paddingLeft: 44,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  cargoTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cargoTypeTile: {
    width: '48%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    position: 'relative',
  },
  cargoTypeTileSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  cargoTileLabel: {
    fontSize: fontSize.sm + 1,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  cargoTileLabelActive: {
    color: colors.primary,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cargoTypeList: {
    gap: spacing.sm,
  },
  cargoTypeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cargoTypeListItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  cargoTypeListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cargoTypeListLabel: {
    fontSize: fontSize.sm + 2,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  cargoTypeListLabelActive: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  inputError: {
    borderColor: colors.status.error,
    borderWidth: 2,
    backgroundColor: colors.status.errorBackground,
  },
  inputValid: {
    borderColor: colors.status.success,
    borderWidth: 2,
    backgroundColor: colors.status.successBackground,
  },
  validationIcon: {
    position: 'absolute',
    right: spacing.md,
    top: 14,
  },
  textAreaValidationIcon: {
    top: spacing.lg,
  },
  errorText: {
    color: colors.status.error,
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorTextSmall: {
    color: colors.status.error,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: 2,
    marginLeft: spacing.xs,
  },
  successText: {
    color: colors.status.success,
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
    marginLeft: 6,
  },
  dateInputSection: {
    marginBottom: spacing.xl,
  },
  dateFieldLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  quickDateChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  quickDateChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: 6,
  },
  enhancedDateButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  enhancedDateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  dateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: fontSize.xs + 1,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  pickupDateValue: {
    color: colors.status.success,
  },
  deliveryDateValue: {
    color: colors.status.error,
  },
  dateArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dateArrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dateArrowIconContainer: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pickupDateButton: {
    borderColor: colors.status.success,
  },
  deliveryDateButton: {
    borderColor: colors.status.error,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: fontSize.lg,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.medium,
  },
  pickupDateText: {
    color: colors.status.success,
  },
  deliveryDateText: {
    color: colors.status.error,
  },
  dateArrow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  priceTypeList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  priceTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  priceTypeItemActive: {
    backgroundColor: colors.status.successBackground,
    borderColor: colors.status.success,
  },
  priceTypeIcon: {
    marginRight: spacing.md,
    width: spacing.xl,
    textAlign: 'center',
  },
  priceTypeLabel: {
    fontSize: fontSize.sm + 1,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    flex: 1,
  },
  priceTypeLabelActive: {
    color: colors.status.success,
    fontWeight: fontWeight.semibold,
  },
  googlePlacesContainer: {
    flex: 1,
    zIndex: 1000,
  },
  addressInputWrapper: {
    position: 'relative',
    flex: 1,
  },
  addressIcon: {
    position: 'absolute',
    left: spacing.md,
    top: 14,
    zIndex: 10,
  },
  googlePlacesInputContainer: {
    flex: 1,
  },
  googlePlacesTextInputContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  googlePlacesTextInputContainerError: {
    borderColor: colors.status.error,
    borderWidth: 2,
    backgroundColor: colors.status.errorBackground,
  },
  googlePlacesTextInputContainerValid: {
    borderColor: colors.status.success,
    borderWidth: 2,
    backgroundColor: colors.status.successBackground,
  },
  googlePlacesTextInput: {
    height: 48,
    paddingLeft: 44,
    paddingRight: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.text.primary,
    backgroundColor: 'transparent',
    borderRadius: borderRadius.sm,
  },
  googlePlacesListView: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 200,
  },
  googlePlacesRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  googlePlacesSeparator: {
    height: 1,
    backgroundColor: colors.badge.background,
    marginHorizontal: spacing.lg,
  },
  googlePlacesDescription: {
    fontSize: fontSize.lg,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  distanceChipsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    gap: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  distanceChipText: {
    fontSize: fontSize.sm + 1,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  swapButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  helper: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  photoGridItem: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  photoGridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  addPhotoGrid: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  addPhotoTextGrid: {
    fontSize: 13,
    color: '#616161',
    marginTop: 8,
    fontWeight: '600',
  },
  maxPhotosText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '400',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
});
