import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export interface TrackingPoint {
  id: string;
  truck_id: string;
  request_id: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  heading_deg: number | null;
  speed_kmh: number | null;
  country_code: string;
  recorded_at: string;
  created_at: string;
}

const ACTIVE_INTERVAL_MS = 5000;  // 5 s when moving
const IDLE_INTERVAL_MS = 30000;   // 30 s when stationary
const BATCH_SIZE = 10;
const STATIONARY_THRESHOLD_KMH = 2; // below this speed → stationary
const STATIONARY_SAMPLES = 3;       // consecutive slow samples before switching to idle

/** Hook for carrier: start/stop GPS tracking and batch-insert location points */
export function useCarrierTracking(orderId: string | undefined, truckId: string | undefined) {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const pendingPoints = useRef<Omit<TrackingPoint, 'id' | 'created_at'>[]>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stationaryCount = useRef(0);
  const currentIntervalMs = useRef(ACTIVE_INTERVAL_MS);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    if (!granted) setError(new Error('Location permission denied'));
    return granted;
  }, []);

  const flushPoints = useCallback(async () => {
    if (pendingPoints.current.length === 0 || !orderId) return;

    const batch = pendingPoints.current.splice(0, BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('tracking')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(batch as any);

    if (insertError) {
      console.error('Failed to flush tracking points:', insertError.message);
      // Re-queue failed points
      pendingPoints.current = [...batch, ...pendingPoints.current];
    }
  }, [orderId]);

  /** Restart watchPositionAsync with the given interval (called on mode change). */
  const startWatching = useCallback(async (intervalMs: number) => {
    if (!orderId || !truckId) return;
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: intervalMs,
        distanceInterval: intervalMs === ACTIVE_INTERVAL_MS ? 10 : 50,
      },
      location => {
        const speedKmh = location.coords.speed != null ? location.coords.speed * 3.6 : null;

        // Adaptive interval: count consecutive stationary samples
        if (speedKmh !== null && speedKmh < STATIONARY_THRESHOLD_KMH) {
          stationaryCount.current += 1;
        } else {
          stationaryCount.current = 0;
        }

        const shouldBeIdle = stationaryCount.current >= STATIONARY_SAMPLES;
        const targetInterval = shouldBeIdle ? IDLE_INTERVAL_MS : ACTIVE_INTERVAL_MS;

        if (targetInterval !== currentIntervalMs.current) {
          currentIntervalMs.current = targetInterval;
          // Restart subscription with new interval asynchronously
          startWatching(targetInterval).catch(() => {});
        }

        const point: Omit<TrackingPoint, 'id' | 'created_at'> = {
          truck_id: truckId,
          request_id: orderId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy_m: location.coords.accuracy,
          altitude_m: location.coords.altitude,
          heading_deg: location.coords.heading,
          speed_kmh: speedKmh,
          country_code: '',
          recorded_at: new Date(location.timestamp).toISOString(),
        };
        pendingPoints.current.push(point);
      }
    );
  }, [orderId, truckId, flushPoints]);

  const startTracking = useCallback(async () => {
    if (!orderId || !truckId) return;

    const permitted = hasPermission ?? await requestPermission();
    if (!permitted) return;

    stationaryCount.current = 0;
    currentIntervalMs.current = ACTIVE_INTERVAL_MS;
    await startWatching(ACTIVE_INTERVAL_MS);

    flushTimer.current = setInterval(flushPoints, ACTIVE_INTERVAL_MS * 2);
    setIsTracking(true);
    setError(null);
  }, [orderId, truckId, hasPermission, requestPermission, flushPoints, startWatching]);

  const stopTracking = useCallback(async () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (flushTimer.current) {
      clearInterval(flushTimer.current);
      flushTimer.current = null;
    }
    await flushPoints(); // Flush remaining
    setIsTracking(false);
  }, [flushPoints]);

  useEffect(() => {
    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, []);

  return { isTracking, hasPermission, error, startTracking, stopTracking, requestPermission };
}

/** Hook for customer: subscribe to realtime tracking updates from carrier */
export function useCustomerTracking(orderId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tracking', orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tracking')
        .select('*')
        .eq('request_id', orderId!)
        .order('recorded_at', { ascending: false })
        .limit(50);
      return ((data || []) as unknown as TrackingPoint[]).reverse();
    },
    enabled: Boolean(orderId),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`tracking:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tracking', filter: `request_id=eq.${orderId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['tracking', orderId] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [orderId, queryClient]);

  const trackingPoints = query.data ?? [];
  const latestPoint = trackingPoints.length > 0 ? trackingPoints[trackingPoints.length - 1] : null;

  return { trackingPoints, latestPoint, loading: query.isLoading };
}
