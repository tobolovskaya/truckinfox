import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCargoRequests } from '../../hooks/useCargoRequests';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { RequestCard } from '../../components/home/RequestCard';
import { SkeletonCard } from '../../components/home/SkeletonCard';
import { useTranslation } from 'react-i18next';
import Avatar from '../../components/Avatar';
import { useUnreadCount } from '../../hooks/useNotifications';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentUser } = useCurrentUser(user?.uid);
  const { t } = useTranslation();
  const { unreadCount } = useUnreadCount();
  const [selectedCargoType, setSelectedCargoType] = useState('');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cargoTypes = useMemo(
    () => [
      'automotive',
      'construction',
      'boats',
      'electronics',
      'campingvogn',
      'machinery',
      'furniture',
      'other',
    ],
    []
  );
  const filters = useMemo(
    () => ({
      city: '',
      cargo_type: selectedCargoType,
      price_min: '',
      price_max: '',
      price_type: '',
    }),
    [selectedCargoType]
  );

  const { requests, loading, refreshing, refresh, fetchMoreRequests, hasMore, loadingMore } =
    useCargoRequests({
      activeTab: 'all',
      filters,
      sortBy: 'newest',
      userId: user?.uid,
    });

  const horizontalPadding = width < 360 ? spacing.md : spacing.lg;
  const gridGap = width < 360 ? spacing.sm : spacing.md;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gridGap) / 2);
  const skeletonVariantSeed = useMemo(() => Math.floor(Math.random() * 3), []);
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

  const displayName = currentUser?.full_name || user?.displayName || t('user');
  const welcomeText = `Hei, ${displayName}!`;
  const avatarUrl = currentUser?.avatar_url || user?.photoURL;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingHorizontal: horizontalPadding, paddingTop: insets.top + spacing.md },
        ]}
      >
        <View style={styles.userInfoRow}>
          <Avatar
            photoURL={avatarUrl}
            size={44}
            iconName="person"
            backgroundColor={colors.primaryLight}
            iconColor={colors.primary}
          />
          <View style={styles.userTextWrap}>
            <Text style={styles.welcomeText}>{welcomeText}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('notifications')}
          accessibilityHint={t('viewNotifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
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
        onEndReached={() => {
          if (hasMore && !loadingMore) {
            fetchMoreRequests();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t('activeRequests')}</Text>
                <Text style={styles.summaryValue}>{activeCount}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t('assigned')}</Text>
                <Text style={styles.summaryValue}>{assignedCount}</Text>
              </View>
            </View>
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>{t('cargoType')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChips}
              >
                <TouchableOpacity
                  style={[styles.filterChip, !selectedCargoType && styles.filterChipActive]}
                  onPress={() => setSelectedCargoType('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('allTypes')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      !selectedCargoType && styles.filterChipTextActive,
                    ]}
                  >
                    {t('allTypes')}
                  </Text>
                </TouchableOpacity>
                {cargoTypes.map(type => {
                  const isSelected = selectedCargoType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setSelectedCargoType(type)}
                      accessibilityRole="button"
                      accessibilityLabel={t(type)}
                    >
                      <Text
                        style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
                      >
                        {t(type)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
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
        renderItem={({ item, index }) =>
          loading ? (
            <SkeletonCard
              variantIndex={index + skeletonVariantSeed}
              cardStyle={{ width: cardWidth, marginBottom: gridGap }}
            />
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
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  userTextWrap: {
    flex: 1,
  },
  welcomeText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxs,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  headerSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterSection: {
    marginTop: spacing.md,
  },
  filterTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  filterChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundVeryLight,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border.light,
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
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
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
