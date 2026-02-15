import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius, shadows } from '../../lib/sharedStyles';

const SkeletonBox = ({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: any;
}) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.ease,
      }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: colors.border.light,
          borderRadius: 8,
        },
        style,
        animatedStyle,
      ]}
    />
  );
};

export const SkeletonCard = () => {
  return (
    <View style={styles.requestCard}>
      {/* Photo skeleton */}
      <View style={styles.photoSection}>
        <SkeletonBox width="100%" height={180} style={{ borderRadius: 0 }} />
      </View>

      {/* Content skeleton */}
      <View style={styles.cardContent}>
        {/* Title */}
        <SkeletonBox width="90%" height={20} style={{ marginBottom: 8 }} />
        <SkeletonBox width="60%" height={20} style={{ marginBottom: 12 }} />

        {/* Category badge */}
        <SkeletonBox width={80} height={20} style={{ borderRadius: 12, marginBottom: 8 }} />

        {/* Route */}
        <View style={styles.routeContainer}>
          <SkeletonBox width={16} height={16} style={{ borderRadius: 8, marginRight: 6 }} />
          <SkeletonBox width="80%" height={16} />
        </View>

        {/* Meta */}
        <SkeletonBox width="50%" height={16} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: spacing.lg,
    ...shadows.md,
    overflow: 'hidden',
  },
  photoSection: {
    width: '100%',
    height: 180,
  },
  cardContent: {
    padding: spacing.lg,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
