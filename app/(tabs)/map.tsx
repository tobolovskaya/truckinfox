import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useCargoRequests } from '../../hooks/useCargoRequests';
import { useAuth } from '../../contexts/AuthContext';

const DEFAULT_REGION = {
  latitude: 59.9139,
  longitude: 10.7522,
  latitudeDelta: 5,
  longitudeDelta: 5,
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

export default function MapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const mapRef = useRef<MapView | null>(null);

  const filters = useMemo(
    () => ({
      city: '',
      cargo_type: '',
      price_min: '',
      price_max: '',
      price_type: '',
    }),
    []
  );

  const { requests, loading } = useCargoRequests({
    activeTab: 'all',
    filters,
    sortBy: 'newest',
    searchQuery: '',
    userId: user?.uid,
  });

  const markerItems = useMemo(() => {
    return requests
      .map(request => {
        const latitude = toFiniteNumber(request.from_lat);
        const longitude = toFiniteNumber(request.from_lng);

        if (latitude === null || longitude === null) {
          return null;
        }

        return {
          id: request.id,
          title: request.title,
          fromAddress: request.from_address,
          toAddress: request.to_address,
          coordinate: { latitude, longitude },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [requests]);

  const initialRegion = markerItems.length
    ? {
        latitude: markerItems[0].coordinate.latitude,
        longitude: markerItems[0].coordinate.longitude,
        latitudeDelta: 5,
        longitudeDelta: 5,
      }
    : DEFAULT_REGION;

  useEffect(() => {
    if (markerItems.length < 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        markerItems.map(item => item.coordinate),
        {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        }
      );
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [markerItems]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Map" />

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : markerItems.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyTitle}>No requests with coordinates</Text>
          <Text style={styles.emptyText}>Open requests will appear here when location data is available.</Text>
        </View>
      ) : (
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
          {markerItems.map(item => (
            <Marker
              key={item.id}
              coordinate={item.coordinate}
              title={item.title}
              description={`${item.fromAddress} → ${item.toAddress}`}
              pinColor={colors.primary}
              onCalloutPress={() => router.push(`/request-details/${item.id}`)}
            />
          ))}
        </MapView>
      )}
    </View>
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
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
