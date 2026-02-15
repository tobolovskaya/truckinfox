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
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
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

  // Start performance trace when component mounts
  useEffect(() => {
    traceRef.current = startTrace(PerformanceTraces.IMAGE_LOAD_TIME);
    return () => {
      // Stop trace on unmount if still running
      if (traceRef.current && loading) {
        traceRef.current.stop();
      }
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
          <Ionicons name={placeholderIcon} size={placeholderSize} color={colors.text.tertiary} />
          {showErrorText && <Text style={styles.errorText}>Image unavailable</Text>}
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={[style, { opacity: loading ? 0 : 1 }]}
          onLoad={() => {
            setLoading(false);
            // Stop performance trace
            traceRef.current?.stop();
          }}
          onError={() => {
            console.log('LazyImage: Failed to load image:', uri);
            setLoading(false);
            setError(true);
            // Stop performance trace
            traceRef.current?.stop();
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
