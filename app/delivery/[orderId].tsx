import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fontSize, spacing } from '../../lib/sharedStyles';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type DeliveryDocument = {
  current_location?: Coordinates;
  route?: Coordinates[];
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

    const deliveryRef = doc(db, 'deliveries', orderIdString);
    const unsubscribe = onSnapshot(
      deliveryRef,
      snapshot => {
        if (!snapshot.exists()) {
          setDriverLocation(null);
          setRoute([]);
          setLoading(false);
          return;
        }

        const data = snapshot.data() as DeliveryDocument;

        setDriverLocation(isValidCoordinate(data.current_location) ? data.current_location : null);

        if (Array.isArray(data.route)) {
          setRoute(data.route.filter(isValidCoordinate));
        } else {
          setRoute([]);
        }

        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return unsubscribe;
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
