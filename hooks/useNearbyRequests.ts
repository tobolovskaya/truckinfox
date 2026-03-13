import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findNearbyCargoRequests } from '../utils/geoSearch';
import { supabase } from '../lib/supabase';

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Hook for finding nearby cargo requests with proper permission handling.
 * GPS/permission state is local; data fetching uses React Query.
 */
export function useNearbyRequests(
  radiusKm: number = 50,
  searchType: 'from' | 'to' = 'from',
  countryCode?: string
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [gpsLoading, setGpsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const normalizedCountryCode = countryCode?.toUpperCase();

  const queryKey = [
    'nearbyRequests', radiusKm, searchType, normalizedCountryCode,
    userLocation?.latitude, userLocation?.longitude,
  ] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => findNearbyCargoRequests(
      userLocation!.latitude,
      userLocation!.longitude,
      radiusKm,
      searchType,
      normalizedCountryCode
    ),
    enabled: Boolean(userLocation),
    staleTime: 60_000,
  });

  const showSettingsAlert = () => {
    Alert.alert(t('permissionRequired'), t('enableLocationInSettings'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('openSettings'),
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ]);
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status: existingStatus, canAskAgain } =
        await Location.getForegroundPermissionsAsync();

      if (existingStatus === Location.PermissionStatus.GRANTED) {
        setPermissionStatus({ granted: true, canAskAgain, status: existingStatus });
        return true;
      }

      if (!canAskAgain) {
        setPermissionDenied(true);
        setPermissionStatus({ granted: false, canAskAgain: false, status: existingStatus });
        showSettingsAlert();
        return false;
      }

      return new Promise(resolve => {
        Alert.alert(
          t('locationRequired'),
          t('locationPermissionMessage'),
          [
            {
              text: t('cancel'),
              style: 'cancel',
              onPress: () => {
                setPermissionDenied(true);
                setPermissionStatus({ granted: false, canAskAgain: true, status: existingStatus });
                setGpsLoading(false);
                resolve(false);
              },
            },
            {
              text: t('allowLocation'),
              onPress: async () => {
                const { status, canAskAgain: canAskAgainAfter } =
                  await Location.requestForegroundPermissionsAsync();
                const granted = status === Location.PermissionStatus.GRANTED;
                setPermissionStatus({ granted, canAskAgain: canAskAgainAfter, status });
                if (!granted) {
                  setPermissionDenied(true);
                  setGpsLoading(false);
                  if (!canAskAgainAfter) showSettingsAlert();
                }
                resolve(granted);
              },
            },
          ],
          { cancelable: false }
        );
      });
    } catch (err) {
      console.error('Error requesting location permission:', err);
      setGpsError('Failed to request location permission');
      setGpsLoading(false);
      return false;
    }
  };

  const getUserLocation = async (): Promise<UserLocation | null> => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 50,
      });
      const userLoc: UserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
      setUserLocation(userLoc);
      return userLoc;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get location';
      setGpsError(message);
      return null;
    }
  };

  const initialize = async () => {
    setGpsLoading(true);
    setGpsError(null);
    setPermissionDenied(false);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) { setGpsLoading(false); return; }

      const location = await getUserLocation();
      if (!location) {
        setGpsError('Could not determine your location');
        setGpsLoading(false);
        return;
      }
      // userLocation is now set — React Query will fire automatically
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setGpsError(message);
    } finally {
      setGpsLoading(false);
    }
  };

  const retry = () => { initialize(); };

  const refresh = async () => {
    if (!userLocation) {
      await initialize();
      return;
    }
    queryClient.invalidateQueries({ queryKey });
  };

  // Initialize on mount / when search params change
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, searchType, normalizedCountryCode]);

  // Realtime: invalidate query when cargo_requests table changes
  useEffect(() => {
    if (!userLocation) return;
    const realtimeFilter = normalizedCountryCode
      ? `country_code=eq.${normalizedCountryCode}`
      : undefined;
    const channel = supabase
      .channel(`nearby:cargo:${searchType}:${normalizedCountryCode || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cargo_requests', filter: realtimeFilter },
        () => { queryClient.invalidateQueries({ queryKey }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [userLocation, searchType, normalizedCountryCode, queryClient, queryKey]);

  return {
    requests: query.data ?? [],
    loading: gpsLoading || query.isLoading,
    userLocation,
    permissionDenied,
    permissionStatus,
    error: gpsError ?? (query.error ? (query.error as Error).message : null),
    retry,
    refresh,
  };
}
