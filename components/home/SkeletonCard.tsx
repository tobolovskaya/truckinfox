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
import { REQUEST_CARD_IMAGE_HEIGHT } from '../../constants/cardStyles';

const SKELETON_VARIANTS = [
  {
    titleWidth: '68%' as const,
    priceWidth: 48,
    badgeWidth: 66,
    metaWidth: 46,
    routePrimaryWidth: '86%' as const,
    routeSecondaryWidth: '78%' as const,
    footerWidth: 64,
  },
  {
    titleWidth: '60%' as const,
    priceWidth: 52,
    badgeWidth: 72,
    metaWidth: 50,
    routePrimaryWidth: '80%' as const,
    routeSecondaryWidth: '72%' as const,
    footerWidth: 70,
  },
  {
    titleWidth: '74%' as const,
    priceWidth: 44,
    badgeWidth: 62,
    metaWidth: 42,
    routePrimaryWidth: '88%' as const,
    routeSecondaryWidth: '82%' as const,
    footerWidth: 58,
  },
];

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

export const SkeletonCard = ({
  cardStyle,
  variantIndex = 0,
}: {
  cardStyle?: StyleProp<ViewStyle>;
  variantIndex?: number;
}) => {
  const variant = SKELETON_VARIANTS[variantIndex % SKELETON_VARIANTS.length];

  return (
    <View style={[styles.requestCard, cardStyle]}>
      {/* Photo skeleton */}
      <SkeletonBox width="100%" height={REQUEST_CARD_IMAGE_HEIGHT} style={styles.photoSkeleton} />

      {/* Content skeleton */}
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <SkeletonBox width={variant.titleWidth} height={34} />
          <SkeletonBox width={variant.priceWidth} height={14} />
        </View>

        <View style={styles.badgeRow}>
          <SkeletonBox
            width={variant.badgeWidth}
            height={18}
            style={{ borderRadius: borderRadius.md }}
          />
          <SkeletonBox width={variant.metaWidth} height={12} />
        </View>

        <View style={styles.routeBlock}>
          <View style={styles.routeLine}>
            <SkeletonBox
              width={12}
              height={12}
              style={{ borderRadius: borderRadius.sm, marginTop: 1 }}
            />
            <SkeletonBox width={variant.routePrimaryWidth} height={14} />
          </View>
          <View style={styles.routeLine}>
            <SkeletonBox
              width={12}
              height={12}
              style={{ borderRadius: borderRadius.sm, marginTop: 1 }}
            />
            <SkeletonBox width={variant.routeSecondaryWidth} height={14} />
          </View>
        </View>

        <View style={styles.footerRow}>
          <SkeletonBox width={variant.footerWidth} height={12} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardContent: {
    padding: 0,
  },
  photoSkeleton: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  routeBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  footerRow: {
    marginTop: spacing.md,
  },
});
