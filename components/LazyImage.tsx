import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  ImageStyle,
  StyleProp,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../lib/sharedStyles';
import { startTrace, PerformanceTraces } from '../utils/performance';
import { supabase } from '../lib/supabase';

interface LazyImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  placeholderIcon?: string;
  placeholderSize?: number;
  showErrorText?: boolean;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * LazyImage Component
 *
 * Optimized image loading with:
 * - Fade-in animation
 * - Loading placeholder (shimmer effect)
 * - Error handling with fallback
 * - Performance monitoring
 *
 * @example
 * // Basic usage
 * <LazyImage uri={imageUrl} style={styles.image} />
 *
 * @example
 * // With custom fallback
 * <LazyImage
 *   uri={request.images?.[0]}
 *   style={styles.cargoImage}
 *   fallback={
 *     <View style={styles.fallback}>
 *       <Ionicons name="cube-outline" size={40} />
 *     </View>
 *   }
 * />
 *
 * @example
 * // With custom placeholder
 * <LazyImage
 *   uri={imageUrl}
 *   placeholder={<CustomShimmer />}
 * />
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  uri,
  style,
  containerStyle,
  resizeMode = 'cover',
  placeholderIcon = 'image-outline',
  placeholderSize = 48,
  showErrorText = true,
  placeholder,
  fallback,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState(uri);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const traceRef = useRef<ReturnType<typeof startTrace>>(null);
  const traceStoppedRef = useRef(false);
  const signedUrlRetryAttemptedRef = useRef(false);
  const loggedFailureUrlsRef = useRef<Set<string>>(new Set());

  const extractStorageLocation = (value: string): { bucket: string; path: string } | null => {
    const signedOrPublicMarkers = ['/object/sign/', '/object/public/'];

    for (const marker of signedOrPublicMarkers) {
      const markerIndex = value.indexOf(marker);
      if (markerIndex < 0) {
        continue;
      }

      const afterMarker = value.slice(markerIndex + marker.length);
      const withoutQuery = afterMarker.split('?')[0];
      const segments = withoutQuery.split('/').filter(Boolean);

      if (segments.length < 2) {
        return null;
      }

      const [bucket, ...pathSegments] = segments;
      const path = decodeURIComponent(pathSegments.join('/'));

      if (!bucket || !path) {
        return null;
      }

      return { bucket, path };
    }

    const normalized = value.trim().replace(/^\/+/, '');
    if (!normalized) {
      return null;
    }

    const segments = normalized.split('/').filter(Boolean);
    if (segments.length > 1 && ['cargo', 'avatars'].includes(segments[0])) {
      return {
        bucket: segments[0],
        path: segments.slice(1).join('/'),
      };
    }

    if (!value.startsWith('http') && normalized.includes('/')) {
      return { bucket: 'cargo', path: normalized };
    }

    return null;
  };

  const tryRefreshSignedUrl = async (): Promise<string | null> => {
    const storageLocation = extractStorageLocation(resolvedUri || uri);
    if (!storageLocation) {
      return null;
    }

    const { data, error: signedUrlError } = await supabase
      .storage
      .from(storageLocation.bucket)
      .createSignedUrl(storageLocation.path, 60 * 60);

    if (signedUrlError || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  };

  // Helper function to safely stop trace only once
  const stopTrace = () => {
    if (traceRef.current && !traceStoppedRef.current) {
      try {
        traceRef.current.stop();
        traceStoppedRef.current = true;
      } catch {
        // Silently handle if trace is already stopped
        console.debug('Trace already stopped or unavailable');
      }
    }
  };

  // Stop trace on unmount if still running
  useEffect(() => {
    return () => {
      stopTrace();
    };
  }, []);

  useEffect(() => {
    setResolvedUri(uri);
    setLoading(true);
    setError(false);
    signedUrlRetryAttemptedRef.current = false;
    traceStoppedRef.current = false;
    traceRef.current = startTrace(PerformanceTraces.IMAGE_LOAD_TIME);
  }, [uri]);

  // Fade-in animation when image loads
  useEffect(() => {
    if (!loading && !error) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, error, fadeAnim]);

  // Shimmer animation for loading placeholder
  useEffect(() => {
    if (loading && !error) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading, error, shimmerAnim]);

  // Use custom fallback if error and fallback provided
  if (error && fallback) {
    return <View style={[styles.container, containerStyle]}>{fallback}</View>;
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {loading && !error && (
        <View style={styles.placeholder}>
          {placeholder ? (
            placeholder
          ) : (
            <>
              <Animated.View
                style={[
                  styles.shimmer,
                  {
                    opacity: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.7],
                    }),
                  },
                ]}
              />
              <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
            </>
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorPlaceholder}>
          <Ionicons name={placeholderIcon} size={placeholderSize} color={colors.text.tertiary} />
          {showErrorText && <Text style={styles.errorText}>Image unavailable</Text>}
        </View>
      ) : (
        <Animated.Image
          source={{ uri: resolvedUri }}
          style={[style, { opacity: fadeAnim }]}
          onLoadStart={() => {
            setLoading(true);
            fadeAnim.setValue(0);
          }}
          onLoad={() => {
            setLoading(false);
            stopTrace();
          }}
          onError={() => {
            const handleError = async () => {
              if (!signedUrlRetryAttemptedRef.current) {
                signedUrlRetryAttemptedRef.current = true;
                const refreshedUrl = await tryRefreshSignedUrl();

                if (refreshedUrl && refreshedUrl !== resolvedUri) {
                  setResolvedUri(refreshedUrl);
                  setError(false);
                  setLoading(true);
                  return;
                }
              }

              const failedUri = resolvedUri || uri;
              if (__DEV__ && !loggedFailureUrlsRef.current.has(failedUri)) {
                loggedFailureUrlsRef.current.add(failedUri);
                console.debug('LazyImage: Failed to load image:', failedUri);
              }
              setLoading(false);
              setError(true);
              stopTrace();
            };

            handleError().catch(() => {
              const failedUri = resolvedUri || uri;
              if (__DEV__ && !loggedFailureUrlsRef.current.has(failedUri)) {
                loggedFailureUrlsRef.current.add(failedUri);
                console.debug('LazyImage: Failed to load image:', failedUri);
              }
              setLoading(false);
              setError(true);
              stopTrace();
            });
          }}
          resizeMode={resizeMode}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border.light,
  },
  spinner: {
    position: 'absolute',
    zIndex: 1,
  },
  errorPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
