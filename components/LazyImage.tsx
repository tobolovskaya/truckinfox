import React, { useState } from 'react';
import { Image, View, StyleSheet, ActivityIndicator, ImageStyle } from 'react-native';
import { colors } from '../theme';

interface LazyImageProps {
  uri: string;
  style?: ImageStyle;
  placeholder?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({ uri, style, placeholder }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorPlaceholder} />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, style]}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        resizeMode="cover"
      />
      {loading && (
        <View style={styles.loadingContainer}>
          {placeholder || <ActivityIndicator size="large" color={colors.primary} />}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  errorPlaceholder: {
    flex: 1,
    backgroundColor: colors.divider,
  },
});

export default LazyImage;
