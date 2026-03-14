import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useUnreadCount } from '../../hooks/useNotifications';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../lib/sharedStyles';
import type { Database } from '../../types/supabase';

type TruckInsert = Database['public']['Tables']['trucks']['Insert'];
type TruckUpdate = Database['public']['Tables']['trucks']['Update'];

type TruckType = 'standard' | 'refrigerated' | 'flatbed' | 'tanker' | 'other';
type TruckStatus = 'active' | 'inactive' | 'maintenance';

const TRUCK_TYPES: TruckType[] = ['standard', 'refrigerated', 'flatbed', 'tanker', 'other'];
const TRUCK_STATUSES: TruckStatus[] = ['active', 'inactive', 'maintenance'];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelFn,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labelFn: (v: T) => string;
}) {
  return (
    <View style={segStyles.container}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[segStyles.option, value === opt && segStyles.optionActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[segStyles.optionText, value === opt && segStyles.optionTextActive]}>
            {labelFn(opt)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  optionTextActive: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
});

export default function TruckFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { unreadCount } = useUnreadCount();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [capacityKg, setCapacityKg] = useState('');
  const [volumeM3, setVolumeM3] = useState('');
  const [truckType, setTruckType] = useState<TruckType>('standard');
  const [status, setStatus] = useState<TruckStatus>('active');
  const [homeCity, setHomeCity] = useState('');

  const fetchTruck = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('trucks').select('*').eq('id', id).single();
      if (error) throw error;
      setPlateNumber(data.plate_number);
      setModel(data.model ?? '');
      setYear(data.year?.toString() ?? '');
      setCapacityKg(data.capacity_kg?.toString() ?? '');
      setVolumeM3(data.volume_m3?.toString() ?? '');
      setTruckType((data.truck_type as TruckType) ?? 'standard');
      setStatus((data.status as TruckStatus) ?? 'active');
      setHomeCity(data.home_city ?? '');
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : t('somethingWentWrong'));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, isNew, t, router]);

  useEffect(() => {
    fetchTruck();
  }, [fetchTruck]);

  const handleSave = async () => {
    if (!plateNumber.trim()) {
      Alert.alert(t('error'), t('plateNumberRequired'));
      return;
    }
    if (!user?.uid) return;

    setSaving(true);
    try {
      if (isNew) {
        const insert: TruckInsert = {
          carrier_id: user.uid,
          plate_number: plateNumber.trim().toUpperCase(),
          model: model.trim() || null,
          year: year ? parseInt(year, 10) : null,
          capacity_kg: capacityKg ? parseInt(capacityKg, 10) : null,
          volume_m3: volumeM3 ? parseFloat(volumeM3) : null,
          truck_type: truckType,
          status,
          home_city: homeCity.trim() || null,
        };
        const { error } = await supabase.from('trucks').insert(insert);
        if (error) throw error;
      } else {
        const update: TruckUpdate = {
          plate_number: plateNumber.trim().toUpperCase(),
          model: model.trim() || null,
          year: year ? parseInt(year, 10) : null,
          capacity_kg: capacityKg ? parseInt(capacityKg, 10) : null,
          volume_m3: volumeM3 ? parseFloat(volumeM3) : null,
          truck_type: truckType,
          status,
          home_city: homeCity.trim() || null,
        };
        const { error } = await supabase.from('trucks').update(update).eq('id', id as string);
        if (error) throw error;
      }
      Alert.alert(t('success'), t('truckSaved'));
      router.back();
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (isNew) return;
    Alert.alert(t('deleteTruck'), t('confirmDeleteTruck'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('trucks')
              .delete()
              .eq('id', id as string);
            if (error) throw error;
            Alert.alert(t('success'), t('truckDeleted'));
            router.back();
          } catch (err) {
            Alert.alert(t('error'), err instanceof Error ? err.message : t('somethingWentWrong'));
          }
        },
      },
    ]);
  };

  const truckTypeLabel = (v: TruckType) => t(`truckType_${v}`);
  const statusLabel = (v: TruckStatus) => t(`truckStatus_${v}`);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('truckDetails')} notificationAction={{ onPress: () => router.push('/(tabs)/notifications'), unreadCount }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isNew ? t('newTruck') : t('editTruck')}
        notificationAction={{ onPress: () => router.push('/(tabs)/notifications'), unreadCount }}
        rightAction={
          !isNew
            ? {
                icon: 'trash-outline',
                onPress: handleDelete,
                label: t('deleteTruck'),
              }
            : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('truckDetails')}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t('plateNumber')} *</Text>
            <TextInput
              style={styles.input}
              value={plateNumber}
              onChangeText={setPlateNumber}
              placeholder={t('enterPlateNumber')}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('truckModel')}</Text>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={setModel}
              placeholder={t('enterModel')}
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t('truckYear')}</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                placeholder="2020"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t('homeCity')}</Text>
              <TextInput
                style={styles.input}
                value={homeCity}
                onChangeText={setHomeCity}
                placeholder={t('enterHomeCity')}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t('capacityKg')}</Text>
              <TextInput
                style={styles.input}
                value={capacityKg}
                onChangeText={setCapacityKg}
                placeholder="10000"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t('volumeM3')}</Text>
              <TextInput
                style={styles.input}
                value={volumeM3}
                onChangeText={setVolumeM3}
                placeholder="50"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('truckType')}</Text>
          <SegmentedControl
            options={TRUCK_TYPES}
            value={truckType}
            onChange={setTruckType}
            labelFn={truckTypeLabel}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('truckStatus')}</Text>
          <SegmentedControl
            options={TRUCK_STATUSES}
            value={status}
            onChange={setStatus}
            labelFn={statusLabel}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.saveButtonText}>{t('saveTruck')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  field: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    backgroundColor: colors.white,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
