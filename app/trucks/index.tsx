import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../lib/sharedStyles';
import type { Database } from '../../types/supabase';

type Truck = Database['public']['Tables']['trucks']['Row'];

const TRUCK_TYPE_ICONS: Record<string, string> = {
  standard: 'car-outline',
  refrigerated: 'snow-outline',
  flatbed: 'remove-outline',
  tanker: 'water-outline',
  other: 'cube-outline',
};

function TruckCard({ truck, onPress }: { truck: Truck; onPress: () => void }) {
  const { t } = useTranslation();

  const statusColor =
    truck.status === 'active'
      ? colors.status.success
      : truck.status === 'maintenance'
        ? colors.status.warning
        : colors.text.tertiary;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardIcon}>
        <Ionicons
          name={(TRUCK_TYPE_ICONS[truck.truck_type ?? 'standard'] ?? 'car-outline') as any}
          size={28}
          color={colors.primary}
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.plateNumber}>{truck.plate_number}</Text>
        {truck.model ? <Text style={styles.model}>{truck.model}</Text> : null}
        <View style={styles.metaRow}>
          {truck.capacity_kg ? (
            <Text style={styles.meta}>{truck.capacity_kg} kg</Text>
          ) : null}
          {truck.home_city ? (
            <Text style={styles.meta}>{truck.home_city}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function TrucksIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrucks = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .eq('carrier_id', user.uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTrucks(data ?? []);
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  }, [user?.uid, t]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('myTrucks')}
        rightAction={{
          icon: 'add',
          onPress: () => router.push('/trucks/new'),
          label: t('addTruck'),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : trucks.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="car-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>{t('noTrucksYet')}</Text>
          <Text style={styles.emptySubtitle}>{t('addYourFirstTruck')}</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/trucks/new')}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.addButtonText}>{t('addTruck')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trucks}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TruckCard truck={item} onPress={() => router.push(`/trucks/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  addButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    gap: spacing.xxxs,
  },
  plateNumber: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  model: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  cardRight: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
