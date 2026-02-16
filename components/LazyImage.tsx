import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  ImageStyle,
  StyleProp,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../lib/sharedStyles';
import { startTrace, PerformanceTraces } from '../utils/performance';

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const traceRef = useRef<ReturnType<typeof startTrace>>(null);
  const traceStoppedRef = useRef(false);

  // Helper function to safely stop trace only once
  const stopTrace = () => {
    if (traceRef.current && !traceStoppedRef.current) {
      try {
        traceRef.current.stop();
        traceStoppedRef.current = true;
      } catch (err) {
        // Silently handle if trace is already stopped
        console.debug('Trace already stopped or unavailable');
      }
    }
  };

  // Start performance trace when component mounts
  useEffect(() => {
    traceRef.current = startTrace(PerformanceTraces.IMAGE_LOAD_TIME);
    return () => {
      // Stop trace on unmount if still running
      stopTrace();
    };
  }, []);

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
          <Ionicons name={placeholderIcon as any} size={placeholderSize} color={colors.text.tertiary} />
          {showErrorText && <Text style={styles.errorText}>Image unavailable</Text>}
        </View>
      ) : (
        <Animated.Image
          source={{ uri }}
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
            console.log('LazyImage: Failed to load image:', uri);
            setLoading(false);
            setError(true);
            stopTrace();
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
    backgroundColor: colors.primary,
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
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
