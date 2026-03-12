import { useState, useEffect, useRef, useCallback } from 'react';
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

const TRACKING_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 10;

/** Hook for carrier: start/stop GPS tracking and batch-insert location points */
export function useCarrierTracking(orderId: string | undefined, truckId: string | undefined) {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const pendingPoints = useRef<Omit<TrackingPoint, 'id' | 'created_at'>[]>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const startTracking = useCallback(async () => {
    if (!orderId || !truckId) return;

    const permitted = hasPermission ?? await requestPermission();
    if (!permitted) return;

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: TRACKING_INTERVAL_MS,
        distanceInterval: 10,
      },
      location => {
        const point: Omit<TrackingPoint, 'id' | 'created_at'> = {
          truck_id: truckId,
          request_id: orderId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy_m: location.coords.accuracy,
          altitude_m: location.coords.altitude,
          heading_deg: location.coords.heading,
          speed_kmh: location.coords.speed != null ? location.coords.speed * 3.6 : null,
          country_code: '',
          recorded_at: new Date(location.timestamp).toISOString(),
        };
        pendingPoints.current.push(point);
      }
    );

    flushTimer.current = setInterval(flushPoints, TRACKING_INTERVAL_MS * 2);
    setIsTracking(true);
    setError(null);
  }, [orderId, truckId, hasPermission, requestPermission, flushPoints]);

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
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [latestPoint, setLatestPoint] = useState<TrackingPoint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    // Load recent points
    supabase
      .from('tracking')
      .select('*')
      .eq('request_id', orderId)
      .order('recorded_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const points = ((data || []) as unknown as TrackingPoint[]).reverse();
        setTrackingPoints(points);
        if (points.length > 0) setLatestPoint(points[points.length - 1]);
        setLoading(false);
      });

    // Subscribe to new points
    const channel = supabase
      .channel(`tracking:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking',
          filter: `request_id=eq.${orderId}`,
        },
        payload => {
          const point = payload.new as TrackingPoint;
          setTrackingPoints(prev => [...prev, point]);
          setLatestPoint(point);
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [orderId]);

  return { trackingPoints, latestPoint, loading };
}
