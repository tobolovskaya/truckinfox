import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../theme/theme';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../lib/sharedStyles';

const CARGO_TYPES = [
  { id: 'furniture', icon: 'bed-outline' },
  { id: 'electronics', icon: 'phone-portrait-outline' },
  { id: 'construction', icon: 'construct-outline' },
  { id: 'automotive', icon: 'car-outline' },
  { id: 'boats', icon: 'boat-outline' },
  { id: 'campingvogn', icon: 'home-outline' },
  { id: 'machinery', icon: 'build-outline' },
  { id: 'other', icon: 'cube-outline' },
];

const PRICE_TYPES = [
  { id: 'fixed', icon: 'pricetag-outline' },
  { id: 'negotiable', icon: 'chatbubble-outline' },
  { id: 'auction', icon: 'trending-up-outline' },
];

interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions: string;
  from_address: string;
  to_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  price_type: string;
  status: string;
  user_id: string;
  bids: any[];
}

export default function EditRequestScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [request, setRequest] = useState<CargoRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPickupDate, setShowPickupDate] = useState(false);
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cargo_type: '',
    weight: '',
    dimensions: '',
    from_address: '',
    to_address: '',
    pickup_date: new Date(),
    delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    price_type: '',
    price: '',
  });

  useEffect(() => {
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRequest = async () => {
    try {
      const requestRef = doc(db, 'cargo_requests', id as string);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        throw new Error(t('requestNotFound'));
      }

      const data = { id: requestSnap.id, ...requestSnap.data() } as CargoRequest;

      if (data.user_id !== user?.uid) {
        Alert.alert(t('error'), t('editOwnRequestOnly'));
        router.back();
        return;
      }

      const bidsQuery = query(
        collection(db, 'bids'),
        where('request_id', '==', id),
        where('status', '==', 'accepted')
      );
      const bidsSnap = await getDocs(bidsQuery);

      if (!bidsSnap.empty) {
        Alert.alert(t('error'), t('editNotAllowedAcceptedBids'));
        router.back();
        return;
      }

      setRequest(data);
      setFormData({
        title: data.title,
        description: data.description,
        cargo_type: data.cargo_type,
        weight: data.weight.toString(),
        dimensions: data.dimensions || '',
        from_address: data.from_address,
        to_address: data.to_address,
        pickup_date: new Date(data.pickup_date),
        delivery_date: new Date(data.delivery_date),
        price_type: data.price_type,
        price: data.price.toString(),
      });
    } catch (error) {
      console.error('Error fetching request:', error);
      Alert.alert(t('error'), t('failedToLoadRequest'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert(t('error'), t('titleRequired'));
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert(t('error'), t('descriptionRequired'));
      return false;
    }
    if (!formData.cargo_type) {
      Alert.alert(t('error'), t('cargoTypeRequired'));
      return false;
    }
    if (!formData.weight || isNaN(Number(formData.weight))) {
      Alert.alert(t('error'), t('weightRequired'));
      return false;
    }
    if (!formData.from_address.trim()) {
      Alert.alert(t('error'), t('fromAddressRequired'));
      return false;
    }
    if (!formData.to_address.trim()) {
      Alert.alert(t('error'), t('toAddressRequired'));
      return false;
    }
    if (!formData.price_type) {
      Alert.alert(t('error'), t('priceTypeRequired'));
      return false;
    }
    if (formData.price_type === 'fixed' && (!formData.price || isNaN(Number(formData.price)))) {
      Alert.alert(t('error'), t('priceRequired'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const requestRef = doc(db, 'cargo_requests', id as string);
      await updateDoc(requestRef, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        cargo_type: formData.cargo_type,
        weight: Number(formData.weight),
        dimensions: formData.dimensions.trim() || null,
        from_address: formData.from_address.trim(),
        to_address: formData.to_address.trim(),
        pickup_date: formData.pickup_date.toISOString(),
        delivery_date: formData.delivery_date.toISOString(),
        price_type: formData.price_type,
        price: formData.price_type === 'fixed' ? Number(formData.price) : 0,
        updated_at: serverTimestamp(),
      });

      Alert.alert(t('success'), t('requestUpdated'), [
        {
          text: t('ok'),
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.iconColors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.iconColors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('editRequestTitle')}</Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.iconColors.white} />
          ) : (
            <Text style={styles.saveButtonText}>{t('save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('basicInformation')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('title')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('enterTitle')}
              value={formData.title}
              onChangeText={value => updateFormData('title', value)}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('description')} *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('enterDescription')}
              value={formData.description}
              onChangeText={value => updateFormData('description', value)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cargoType')} *</Text>
          <View style={styles.cargoTypeGrid}>
            {CARGO_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.cargoTypeCard,
                  formData.cargo_type === type.id && styles.cargoTypeCardActive,
                ]}
                onPress={() => updateFormData('cargo_type', type.id)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={24}
                  color={formData.cargo_type === type.id ? '#FF7043' : '#616161'}
                />
                <Text
                  style={[
                    styles.cargoTypeText,
                    formData.cargo_type === type.id && styles.cargoTypeTextActive,
                  ]}
                >
                  {t(type.id)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cargoDetails')}</Text>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>{t('weight')} (kg) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={formData.weight}
                onChangeText={value => updateFormData('weight', value)}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>{t('dimensions')}</Text>
              <TextInput
                style={styles.input}
                placeholder="L x W x H"
                value={formData.dimensions}
                onChangeText={value => updateFormData('dimensions', value)}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('route')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('fromAddress')} *</Text>
            <View style={styles.addressInputContainer}>
              <Ionicons
                name="location-outline"
                size={20}
                color={theme.iconColors.success}
                style={styles.addressIcon}
              />
              <TextInput
                style={styles.addressInput}
                placeholder={t('enterFromAddress')}
                value={formData.from_address}
                onChangeText={value => updateFormData('from_address', value)}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('toAddress')} *</Text>
            <View style={styles.addressInputContainer}>
              <Ionicons
                name="location-outline"
                size={20}
                color={theme.iconColors.error}
                style={styles.addressIcon}
              />
              <TextInput
                style={styles.addressInput}
                placeholder={t('enterToAddress')}
                value={formData.to_address}
                onChangeText={value => updateFormData('to_address', value)}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dates')}</Text>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>{t('pickupDate')} *</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowPickupDate(true)}>
                <Ionicons name="calendar-outline" size={20} color={theme.iconColors.gray.primary} />
                <Text style={styles.dateText}>{formData.pickup_date.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>{t('deliveryDate')}</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDeliveryDate(true)}>
                <Ionicons name="calendar-outline" size={20} color={theme.iconColors.gray.primary} />
                <Text style={styles.dateText}>{formData.delivery_date.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pricing')} *</Text>

          <View style={styles.priceTypeContainer}>
            {PRICE_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.priceTypeCard,
                  formData.price_type === type.id && styles.priceTypeCardActive,
                ]}
                onPress={() => updateFormData('price_type', type.id)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={formData.price_type === type.id ? '#FF7043' : '#616161'}
                />
                <Text
                  style={[
                    styles.priceTypeText,
                    formData.price_type === type.id && styles.priceTypeTextActive,
                  ]}
                >
                  {t(type.id)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {formData.price_type === 'fixed' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('price')} (NOK) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={formData.price}
                onChangeText={value => updateFormData('price', value)}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {showPickupDate && (
        <DateTimePicker
          value={formData.pickup_date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
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
          onChange={(event, selectedDate) => {
            setShowDeliveryDate(false);
            if (selectedDate) {
              updateFormData('delivery_date', selectedDate);
            }
          }}
          minimumDate={formData.pickup_date}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
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
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.white,
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
  cargoTypeCard: {
    width: '30%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  cargoTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundPrimary,
  },
  cargoTypeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  cargoTypeTextActive: {
    color: colors.primary,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
  },
  addressIcon: {
    marginLeft: spacing.md,
  },
  addressInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  dateText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  priceTypeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  priceTypeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
  },
  priceTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundPrimary,
  },
  priceTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  priceTypeTextActive: {
    color: colors.primary,
  },
});
