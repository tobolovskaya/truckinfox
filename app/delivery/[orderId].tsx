import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fontSize, spacing } from '../../lib/sharedStyles';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type DeliveryRow = {
  current_latitude: number | null;
  current_longitude: number | null;
  route?: unknown;
};

const DEFAULT_REGION = {
  latitude: 59.9139,
  longitude: 10.7522,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const isValidCoordinate = (value: unknown): value is Coordinates => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const coordinate = value as Partial<Coordinates>;
  return (
    typeof coordinate.latitude === 'number' &&
    Number.isFinite(coordinate.latitude) &&
    typeof coordinate.longitude === 'number' &&
    Number.isFinite(coordinate.longitude)
  );
};

export default function DeliveryTrackingScreen() {
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderIdString = Array.isArray(orderId) ? orderId[0] : orderId;

  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<Coordinates | null>(null);
  const [route, setRoute] = useState<Coordinates[]>([]);

  useEffect(() => {
    if (!orderIdString) {
      setLoading(false);
      return;
    }

    const loadDelivery = async () => {
      const { data } = await supabase
        .from('deliveries')
        .select('current_latitude,current_longitude,route')
        .eq('order_id', orderIdString)
        .maybeSingle();

      if (!data) {
        setDriverLocation(null);
        setRoute([]);
        setLoading(false);
        return;
      }

      const row = data as DeliveryRow;

      if (
        typeof row.current_latitude === 'number' &&
        Number.isFinite(row.current_latitude) &&
        typeof row.current_longitude === 'number' &&
        Number.isFinite(row.current_longitude)
      ) {
        setDriverLocation({
          latitude: row.current_latitude,
          longitude: row.current_longitude,
        });
      } else {
        setDriverLocation(null);
      }

      if (Array.isArray(row.route)) {
        setRoute(row.route.filter(isValidCoordinate));
      } else {
        setRoute([]);
      }

      setLoading(false);
    };

    loadDelivery();

    const channel = supabase
      .channel(`delivery:${orderIdString}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `order_id=eq.${orderIdString}`,
        },
        () => {
          loadDelivery();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [orderIdString]);

  const initialRegion = useMemo(() => {
    const focus = driverLocation || route[0];

    if (!focus) {
      return DEFAULT_REGION;
    }

    return {
      latitude: focus.latitude,
      longitude: focus.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [driverLocation, route]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={t('deliveryTracking')} showBackButton />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.infoText}>{t('loadingDeliveryLocation')}</Text>
        </View>
      ) : (
        <MapView style={styles.map} initialRegion={initialRegion}>
          {driverLocation && <Marker coordinate={driverLocation} title={t('driver')} />}
          {route.length > 1 && (
            <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={4} />
          )}
        </MapView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
});
