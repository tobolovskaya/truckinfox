import React, { useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCargoRequests } from '../../hooks/useCargoRequests';
import { RequestCard } from '../../components/home/RequestCard';
import { SkeletonCard } from '../../components/home/SkeletonCard';
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const filters = useMemo(
    () => ({
      city: '',
      cargo_type: '',
      price_min: '',
      price_max: '',
      price_type: '',
    }),
    []
  );

  const { requests, loading, refreshing, refresh } = useCargoRequests({
    activeTab: 'all',
    filters,
    sortBy: 'newest',
    userId: user?.uid,
  });

  const horizontalPadding = width < 360 ? spacing.md : spacing.lg;
  const gridGap = width < 360 ? spacing.sm : spacing.md;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gridGap) / 2);
  const skeletonItems = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({ id: `skeleton-${index}` })),
    []
  );

  const activeCount = useMemo(
    () => requests.filter(request => request.status === 'active').length,
    [requests]
  );

  const assignedCount = useMemo(
    () => requests.filter(request => request.status === 'assigned').length,
    [requests]
  );

  const handleOpenRequest = (requestId: string) => {
    router.push(`/request-details/${requestId}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <View>
          <Text style={styles.welcomeText}>{t('welcomeBack')}</Text>
          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('notifications')}
          accessibilityHint={t('viewNotifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? skeletonItems : requests}
        keyExtractor={(item, index) => ('id' in item ? item.id : `request-${index}`)}
        numColumns={2}
        columnWrapperStyle={{ gap: gridGap }}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: spacing.xl,
          rowGap: gridGap,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.sectionTitle}>{t('overview')}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="document-text-outline" size={32} color={colors.primary} />
                <Text style={styles.statValue}>{activeCount}</Text>
                <Text style={styles.statLabel}>{t('activeRequests')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#4CAF50" />
                <Text style={styles.statValue}>{assignedCount}</Text>
                <Text style={styles.statLabel}>{t('assigned')}</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>{t('latestRequests')}</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={colors.text.tertiary} />
              <Text style={styles.emptyTitle}>{t('noCargoRequestsYet')}</Text>
              <Text style={styles.emptyText}>{t('createFirstCargoRequest')}</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/(tabs)/create')}
                accessibilityRole="button"
                accessibilityLabel={t('createRequest')}
                accessibilityHint={t('createRequestHint')}
              >
                <Ionicons name="add" size={20} color={colors.white} />
                <Text style={styles.createButtonText}>{t('createRequest')}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          loading ? (
            <SkeletonCard cardStyle={{ width: cardWidth, marginBottom: gridGap }} />
          ) : (
            <RequestCard
              request={item}
              onPress={() => handleOpenRequest(item.id)}
              showFavorite={false}
              compact
              cardStyle={{ width: cardWidth, marginBottom: gridGap }}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  welcomeText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xxxs,
  },
  notificationButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xxxs,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  createButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
