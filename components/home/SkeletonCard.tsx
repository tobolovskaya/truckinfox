import React, { useEffect } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  type AnimatedStyleProp,
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
  style?: AnimatedStyleProp<ViewStyle>;
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

  const baseStyle: ViewStyle = {
    width,
    height,
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.sm,
  };

  const combinedStyle: AnimatedStyleProp<ViewStyle> = [baseStyle, style, animatedStyle];

  return <Animated.View style={combinedStyle} />;
};

export const SkeletonCard = ({ cardStyle }: { cardStyle?: StyleProp<ViewStyle> }) => {
  return (
    <View style={[styles.requestCard, cardStyle]}>
      {/* Photo skeleton */}
      <View style={styles.photoSection}>
        <SkeletonBox width="100%" height={120} style={{ borderRadius: 0 }} />
      </View>

      {/* Content skeleton */}
      <View style={styles.cardContent}>
        {/* Title */}
        <SkeletonBox width="90%" height={20} style={{ marginBottom: 8 }} />
        <SkeletonBox width="60%" height={20} style={{ marginBottom: 12 }} />

        {/* Category badge */}
        <SkeletonBox
          width={80}
          height={20}
          style={{ borderRadius: borderRadius.md, marginBottom: 8 }}
        />

        {/* Route */}
        <View style={styles.routeContainer}>
          <SkeletonBox
            width={16}
            height={16}
            style={{ borderRadius: borderRadius.sm, marginRight: 6 }}
          />
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
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    ...shadows.md,
    overflow: 'hidden',
  },
  photoSection: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: spacing.lg,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
