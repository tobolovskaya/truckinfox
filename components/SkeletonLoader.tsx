import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../theme/theme';
import { shadows, colors, spacing, borderRadius } from '../lib/sharedStyles';
import { REQUEST_CARD_IMAGE_HEIGHT } from '../constants/cardStyles';

interface SkeletonLoaderProps {
  variant?: 'card' | 'list' | 'message' | 'stats' | 'text';
  count?: number;
  layout?: 'stack' | 'grid';
  cardWidth?: number;
  cardGap?: number;
  cardStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
  variantSeed?: number;
}

const SKELETON_CARD_VARIANTS = [
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

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'card',
  count = 1,
  layout = 'stack',
  cardWidth,
  cardGap = spacing.md,
  cardStyle,
  compact = true,
  variantSeed = 0,
}) => {
  const renderSkeleton = (index: number) => {
    switch (variant) {
      case 'card':
        return (
          <SkeletonCard
            cardStyle={cardStyle}
            compact={compact}
            variantSeed={variantSeed + index}
            width={layout === 'grid' ? cardWidth : undefined}
            marginBottom={layout === 'grid' ? cardGap : undefined}
          />
        );
      case 'list':
        return <SkeletonListItem />;
      case 'message':
        return <SkeletonMessage />;
      case 'stats':
        return <SkeletonStats />;
      case 'text':
        return <SkeletonText />;
      default:
        return <SkeletonCard />;
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.itemWrapper,
            variant === 'card' && (cardStyle || layout === 'grid') ? styles.itemWrapperCard : null,
          ]}
        >
          {renderSkeleton(index)}
        </View>
      ))}
    </View>
  );
};

const SkeletonShimmer: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return <Animated.View style={[styles.shimmer, style, { opacity }]} />;
};

const SkeletonCard: React.FC<{
  cardStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
  variantSeed?: number;
  width?: number;
  marginBottom?: number;
}> = ({ cardStyle, compact = true, variantSeed = 0, width, marginBottom }) => {
  const variant = SKELETON_CARD_VARIANTS[variantSeed % SKELETON_CARD_VARIANTS.length];

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        typeof width === 'number' ? { width } : null,
        typeof marginBottom === 'number' ? { marginBottom } : null,
        cardStyle,
      ]}
    >
      <SkeletonShimmer style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <SkeletonShimmer style={[styles.cardTitle, { width: variant.titleWidth, height: 34 }]} />
          <SkeletonShimmer style={[styles.cardPrice, { width: variant.priceWidth }]} />
        </View>

        <View style={styles.cardBadgeRow}>
          <SkeletonShimmer
            style={[
              styles.cardBadge,
              {
                width: variant.badgeWidth,
              },
            ]}
          />
          <SkeletonShimmer style={[styles.cardMeta, { width: variant.metaWidth }]} />
        </View>

        <View style={styles.cardRouteBlock}>
          <View style={styles.cardRouteLine}>
            <SkeletonShimmer style={styles.cardRouteIcon} />
            <SkeletonShimmer
              style={[styles.cardRoutePrimary, { width: variant.routePrimaryWidth }]}
            />
          </View>
          <View style={styles.cardRouteLine}>
            <SkeletonShimmer style={styles.cardRouteIcon} />
            <SkeletonShimmer
              style={[styles.cardRouteSecondary, { width: variant.routeSecondaryWidth }]}
            />
          </View>
        </View>

        <View style={styles.cardFooter}>
          <SkeletonShimmer style={[styles.cardFooterItem, { width: variant.footerWidth }]} />
        </View>
      </View>
    </View>
  );
};

const SkeletonListItem: React.FC = () => {
  return (
    <View style={styles.listItem}>
      <SkeletonShimmer style={styles.listAvatar} />
      <View style={styles.listContent}>
        <SkeletonShimmer style={styles.listTitle} />
        <SkeletonShimmer style={styles.listSubtitle} />
      </View>
      <SkeletonShimmer style={styles.listBadge} />
    </View>
  );
};

const SkeletonMessage: React.FC = () => {
  return (
    <View style={styles.messageContainer}>
      <View style={styles.messageLeft}>
        <SkeletonShimmer style={styles.messageAvatar} />
        <SkeletonShimmer style={styles.messageBubbleLeft} />
      </View>
      <View style={styles.messageRight}>
        <SkeletonShimmer style={styles.messageBubbleRight} />
        <SkeletonShimmer style={styles.messageAvatar} />
      </View>
    </View>
  );
};

const SkeletonStats: React.FC = () => {
  return (
    <View style={styles.statsGrid}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.statCard}>
          <SkeletonShimmer style={styles.statIcon} />
          <SkeletonShimmer style={styles.statValue} />
          <SkeletonShimmer style={styles.statLabel} />
        </View>
      ))}
    </View>
  );
};

const SkeletonText: React.FC = () => {
  return (
    <View style={styles.textContainer}>
      <SkeletonShimmer style={styles.textLine} />
      <SkeletonShimmer style={[styles.textLine, styles.textLineShort]} />
      <SkeletonShimmer style={styles.textLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  itemWrapper: {
    marginBottom: spacing.md,
  },
  itemWrapperCard: {
    marginBottom: 0,
  },
  shimmer: {
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.sm,
  },

  // Card skeleton
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...(shadows.md as object),
  },
  cardCompact: {
    padding: spacing.md,
  },
  cardImage: {
    width: '100%',
    height: REQUEST_CARD_IMAGE_HEIGHT,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  cardContent: {
    gap: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardPrice: {
    height: 14,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cardBadge: {
    height: 18,
    borderRadius: borderRadius.md,
  },
  cardMeta: {
    height: 12,
  },
  cardRouteBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  cardRouteLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  cardRouteIcon: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.sm,
    marginTop: 1,
  },
  cardRoutePrimary: {
    height: 14,
  },
  cardRouteSecondary: {
    height: 14,
  },
  cardTitle: {
    height: 20,
  },
  cardSubtitle: {
    height: 16,
    width: '50%',
  },
  cardFooter: {
    marginTop: spacing.md,
  },
  cardFooterItem: {
    height: 12,
  },

  // List item skeleton
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  listAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
  },
  listContent: {
    flex: 1,
    gap: spacing.xs,
  },
  listTitle: {
    height: 16,
    width: '60%',
  },
  listSubtitle: {
    height: 14,
    width: '40%',
  },
  listBadge: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.md,
  },

  // Message skeleton
  messageContainer: {
    gap: spacing.md,
  },
  messageLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  messageRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
  },
  messageBubbleLeft: {
    height: 60,
    width: '60%',
    borderRadius: borderRadius.lg,
  },
  messageBubbleRight: {
    height: 40,
    width: '50%',
    borderRadius: borderRadius.lg,
  },

  // Stats skeleton
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    minWidth: '45%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
  },
  statValue: {
    height: 24,
    width: 60,
  },
  statLabel: {
    height: 14,
    width: 80,
  },

  // Text skeleton
  textContainer: {
    gap: spacing.sm,
  },
  textLine: {
    height: 16,
    width: '100%',
  },
  textLineShort: {
    width: '75%',
  },
});
