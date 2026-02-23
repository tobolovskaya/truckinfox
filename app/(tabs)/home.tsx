import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCargoRequests, type SortOption } from '../../hooks/useCargoRequests';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { RequestCard } from '../../components/home/RequestCard';
import { SkeletonCard } from '../../components/home/SkeletonCard';
import { useTranslation } from 'react-i18next';
import Avatar from '../../components/Avatar';
import { useUnreadCount } from '../../hooks/useNotifications';
import { useDebounce } from '../../hooks/useDebounce';

const HOME_FILTERS_STORAGE_KEY = '@home_marketplace_filters';

type PersistedHomeState = {
  activeTab: 'all' | 'my';
  searchQuery: string;
  sortBy: SortOption;
  selectedCargoType: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentUser } = useCurrentUser(user?.uid);
  const { t } = useTranslation();
  const { unreadCount } = useUnreadCount();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [selectedCargoType, setSelectedCargoType] = useState('');
  const insets = useSafeAreaInsets();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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
      cargo_type: activeTab === 'all' ? selectedCargoType : '',
      price_min: '',
      price_max: '',
      price_type: '',
    }),
    [activeTab, selectedCargoType]
  );

  const { requests, loading, refreshing, refresh, fetchMoreRequests, hasMore, loadingMore } =
    useCargoRequests({
      activeTab,
      filters,
      sortBy,
      searchQuery: debouncedSearchQuery,
      userId: user?.uid,
    });
  const displayedRequests = requests;

  const horizontalPadding = width < 360 ? spacing.md : spacing.lg;
  const gridGap = width < 360 ? spacing.sm : spacing.md;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gridGap) / 2);
  const skeletonVariantSeed = useMemo(() => Math.floor(Math.random() * 3), []);
  const skeletonItems = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({ id: `skeleton-${index}` })),
    []
  );

  const hasActiveFilters = sortBy !== 'newest' || !!selectedCargoType;

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const rawState = await AsyncStorage.getItem(HOME_FILTERS_STORAGE_KEY);
        if (!rawState) {
          return;
        }

        const state = JSON.parse(rawState) as Partial<PersistedHomeState>;

        if (state.activeTab === 'all' || state.activeTab === 'my') {
          setActiveTab(state.activeTab);
        }

        if (typeof state.searchQuery === 'string') {
          setSearchQuery(state.searchQuery);
        }

        if (
          state.sortBy === 'newest' ||
          state.sortBy === 'oldest' ||
          state.sortBy === 'priceLowToHigh' ||
          state.sortBy === 'priceHighToLow' ||
          state.sortBy === 'date'
        ) {
          setSortBy(state.sortBy);
        }

        if (typeof state.selectedCargoType === 'string') {
          setSelectedCargoType(state.selectedCargoType);
        }
      } catch (error) {
        console.warn('Failed to load home filters state', error);
      }
    };

    loadPersistedState();
  }, []);

  useEffect(() => {
    const saveState = async () => {
      try {
        const state: PersistedHomeState = {
          activeTab,
          searchQuery,
          sortBy,
          selectedCargoType,
        };

        await AsyncStorage.setItem(HOME_FILTERS_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save home filters state', error);
      }
    };

    saveState();
  }, [activeTab, searchQuery, sortBy, selectedCargoType]);

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

      <View style={[styles.stickyControls, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
            onPress={() => setActiveTab('all')}
            accessibilityRole="button"
            accessibilityLabel={t('allRequests')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'all' && styles.tabButtonTextActive]}>
              {t('allRequests')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'my' && styles.tabButtonActive]}
            onPress={() => setActiveTab('my')}
            accessibilityRole="button"
            accessibilityLabel={t('myRequests')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'my' && styles.tabButtonTextActive]}>
              {t('myRequests')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={() => setIsFilterSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('filterAndSort')}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={hasActiveFilters ? colors.white : colors.text.primary}
            />
          </TouchableOpacity>
        </View>

        {hasActiveFilters && (
          <View style={styles.activeFilterRow}>
            {selectedCargoType ? (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>{t(selectedCargoType)}</Text>
              </View>
            ) : null}
            {sortBy !== 'newest' ? (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>{t(sortBy)}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setSelectedCargoType('');
                setSortBy('newest');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('resetFilters')}
            >
              <Text style={styles.clearFiltersText}>{t('resetFilters')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={loading ? skeletonItems : displayedRequests}
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
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={colors.text.tertiary} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'my' ? t('noMyRequests') : t('noCargoRequestsYet')}
              </Text>
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

      <Modal
        visible={isFilterSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterSheetVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('filterAndSort')}</Text>
              <TouchableOpacity
                onPress={() => setIsFilterSheetVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSectionTitle}>{t('sortBy')}</Text>
            <View style={styles.sheetOptionsRow}>
              {(['newest', 'priceLowToHigh', 'priceHighToLow'] as SortOption[]).map(option => {
                const selected = sortBy === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                    onPress={() => setSortBy(option)}
                  >
                    <Text
                      style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}
                    >
                      {t(option)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {activeTab === 'all' && (
              <>
                <Text style={styles.sheetSectionTitle}>{t('cargoType')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sheetOptionsRow}
                >
                  <TouchableOpacity
                    style={[styles.sheetOption, !selectedCargoType && styles.sheetOptionActive]}
                    onPress={() => setSelectedCargoType('')}
                  >
                    <Text
                      style={[
                        styles.sheetOptionText,
                        !selectedCargoType && styles.sheetOptionTextActive,
                      ]}
                    >
                      {t('allTypes')}
                    </Text>
                  </TouchableOpacity>
                  {cargoTypes.map(type => {
                    const selected = selectedCargoType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                        onPress={() => setSelectedCargoType(type)}
                      >
                        <Text
                          style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}
                        >
                          {t(type)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.sheetSecondaryButton}
                onPress={() => {
                  setSortBy('newest');
                  setSelectedCargoType('');
                }}
              >
                <Text style={styles.sheetSecondaryButtonText}>{t('resetFilters')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetPrimaryButton}
                onPress={() => setIsFilterSheetVisible(false)}
              >
                <Text style={styles.sheetPrimaryButtonText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  stickyControls: {
    backgroundColor: colors.white,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundVeryLight,
    borderRadius: borderRadius.full,
    padding: spacing.xxxs,
    gap: spacing.xxxs,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tabButtonActive: {
    backgroundColor: colors.white,
  },
  tabButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  tabButtonTextActive: {
    color: colors.text.primary,
  },
  searchRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.primary,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  activeFilterRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  activeFilterChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxxs,
  },
  activeFilterChipText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  clearFiltersText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border.light,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  sheetSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sheetOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.backgroundVeryLight,
  },
  sheetOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetOptionText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  sheetOptionTextActive: {
    color: colors.white,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sheetSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing.sm,
  },
  sheetSecondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  sheetPrimaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
  },
  sheetPrimaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
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
