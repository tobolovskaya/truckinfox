import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme/theme';

interface SkeletonLoaderProps {
  variant?: 'card' | 'list' | 'message' | 'stats' | 'text';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'card',
  count = 1,
}) => {
  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return <SkeletonCard />;
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
        <View key={index} style={styles.itemWrapper}>
          {renderSkeleton()}
        </View>
      ))}
    </View>
  );
};

const SkeletonShimmer: React.FC<{ style?: any }> = ({ style }) => {
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
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return <Animated.View style={[styles.shimmer, style, { opacity }]} />;
};

const SkeletonCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <SkeletonShimmer style={styles.cardImage} />
      <View style={styles.cardContent}>
        <SkeletonShimmer style={styles.cardTitle} />
        <SkeletonShimmer style={styles.cardSubtitle} />
        <View style={styles.cardFooter}>
          <SkeletonShimmer style={styles.cardFooterItem} />
          <SkeletonShimmer style={styles.cardFooterItem} />
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
    marginBottom: theme.spacing.md,
  },
  shimmer: {
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },

  // Card skeleton
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.default,
  },
  cardImage: {
    width: '100%',
    height: 120,
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    gap: theme.spacing.sm,
  },
  cardTitle: {
    height: 20,
    width: '70%',
  },
  cardSubtitle: {
    height: 16,
    width: '50%',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  cardFooterItem: {
    height: 32,
    width: 80,
  },

  // List item skeleton
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
  },
  listAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  listContent: {
    flex: 1,
    gap: theme.spacing.xs,
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
    borderRadius: 12,
  },

  // Message skeleton
  messageContainer: {
    gap: theme.spacing.md,
  },
  messageLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  messageRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubbleLeft: {
    height: 60,
    width: '60%',
    borderRadius: theme.borderRadius.lg,
  },
  messageBubbleRight: {
    height: 40,
    width: '50%',
    borderRadius: theme.borderRadius.lg,
  },

  // Stats skeleton
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    minWidth: '45%',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: theme.spacing.sm,
  },
  textLine: {
    height: 16,
    width: '100%',
  },
  textLineShort: {
    width: '75%',
  },
});
