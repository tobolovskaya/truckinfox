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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/sharedStyles';
import { startTrace, PerformanceTraces } from '../utils/performance';

interface LazyImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  placeholderIcon?: string;
  placeholderSize?: number;
  showErrorText?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  uri,
  style,
  containerStyle,
  resizeMode = 'cover',
  placeholderIcon = 'image-outline',
  placeholderSize = 48,
  showErrorText = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

  return (
    <View style={[styles.container, containerStyle]}>
      {loading && !error && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {error ? (
        <View style={styles.errorPlaceholder}>
          <Ionicons name={placeholderIcon as any} size={placeholderSize} color={colors.text.tertiary} />
          {showErrorText && <Text style={styles.errorText}>Image unavailable</Text>}
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={[style, { opacity: loading ? 0 : 1 }]}
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
  errorPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
  },
});
