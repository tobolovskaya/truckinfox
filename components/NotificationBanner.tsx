import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useNotificationBanner } from '../contexts/NotificationBannerContext';
import { colors, spacing } from '../theme';

export const NotificationBanner: React.FC = () => {
  const { banner, hideBanner } = useNotificationBanner();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (banner) {
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [banner]);

  if (!banner) return null;

  return (
    <TouchableOpacity onPress={hideBanner} activeOpacity={0.9}>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY }], opacity },
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default NotificationBanner;
