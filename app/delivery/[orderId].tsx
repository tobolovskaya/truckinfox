import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fontSize, spacing } from '../../lib/sharedStyles';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

export default function DeliveryTrackingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);
  const orderIdString = Array.isArray(orderId) ? orderId[0] : orderId;
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<Coordinates | null>(null);
  const [route, setRoute] = useState<Coordinates[]>([]);

  useEffect(() => {
    if (!orderIdString) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadLatestTrackingByRequest = async (requestId: string, countryCode?: string | null) => {
      let query = supabase
        .from('tracking')
        .select('latitude,longitude,recorded_at')
        .eq('request_id', requestId)
        .order('recorded_at', { ascending: false })
        .limit(1);

      if (countryCode) {
        query = query.eq('country_code', countryCode);
      }

      const { data } = await query.maybeSingle();

      const latitude = toFiniteNumber(data?.latitude);
      const longitude = toFiniteNumber(data?.longitude);

      if (!isMounted || latitude === null || longitude === null) {
        return;
      }

      setDriverLocation({ latitude, longitude });
    };

    const loadRequestContext = async (): Promise<{
      requestId: string | null;
      countryCode: string | null;
    }> => {
      const { data } = await supabase
        .from('orders')
        .select('request_id')
        .eq('id', orderIdString)
        .maybeSingle();

      const requestId = typeof data?.request_id === 'string' ? data.request_id : null;

      if (!requestId) {
        return { requestId: null, countryCode: null };
      }

      const { data: requestRow } = await supabase
        .from('cargo_requests')
        .select('country_code')
        .eq('id', requestId)
        .maybeSingle();

      const countryCode =
        typeof requestRow?.country_code === 'string' ? requestRow.country_code : null;

      return { requestId, countryCode };
    };

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
        const normalizedRoute = row.route
          .map(point => {
            if (!point || typeof point !== 'object') {
              return null;
            }

            const raw = point as { latitude?: unknown; longitude?: unknown };
            const latitude = toFiniteNumber(raw.latitude);
            const longitude = toFiniteNumber(raw.longitude);

            if (latitude === null || longitude === null) {
              return null;
            }

            return { latitude, longitude };
          })
          .filter((point): point is Coordinates => point !== null);

        setRoute(normalizedRoute);
      } else {
        setRoute([]);
      }

      setLoading(false);
    };

    let trackingChannel: ReturnType<typeof supabase.channel> | null = null;

    const initialize = async () => {
      const { requestId, countryCode } = await loadRequestContext();
      await loadDelivery();

      if (requestId) {
        await loadLatestTrackingByRequest(requestId, countryCode);

        trackingChannel = supabase
          .channel(`tracking:${requestId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'tracking',
              filter: `request_id=eq.${requestId}`,
            },
            payload => {
              const row = payload.new as Record<string, unknown>;
              const eventCountryCode =
                typeof row.country_code === 'string' ? row.country_code : null;

              if (countryCode && eventCountryCode && eventCountryCode !== countryCode) {
                return;
              }

              const latitude = toFiniteNumber(row.latitude);
              const longitude = toFiniteNumber(row.longitude);

              if (latitude === null || longitude === null) {
                return;
              }

              setDriverLocation({ latitude, longitude });
            }
          )
          .subscribe();
      }
    };

    initialize();

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
      isMounted = false;
      channel.unsubscribe();
      trackingChannel?.unsubscribe();
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

  const fitCoordinates = useMemo(() => {
    const routePoints = route.filter(
      point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    );
    if (driverLocation) {
      return [...routePoints, driverLocation];
    }
    return routePoints;
  }, [driverLocation, route]);

  useEffect(() => {
    if (loading || fitCoordinates.length < 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoordinates, {
        edgePadding: { top: 64, right: 64, bottom: 64, left: 64 },
        animated: true,
      });
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [fitCoordinates, loading]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={t('deliveryTracking')} showBackButton />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.infoText}>{t('loadingDeliveryLocation')}</Text>
        </View>
      ) : (
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
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
