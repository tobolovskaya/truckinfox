import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCargoRequests, type SortOption } from '../../hooks/useCargoRequests';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { RequestCard } from '../../components/home/RequestCard';
import { SkeletonCard } from '../../components/home/SkeletonCard';
import { HomeHeader } from '../../components/home/HomeHeader';
import { HomeTabBar } from '../../components/home/HomeTabBar';
import { HomeSearchBar } from '../../components/home/HomeSearchBar';
import { HomeFilterSheet } from '../../components/home/HomeFilterSheet';
import { HomeActiveFilters } from '../../components/home/HomeActiveFilters';
import { useTranslation } from 'react-i18next';
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
  const [hasPersistedState, setHasPersistedState] = useState<boolean | null>(null);
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

  const horizontalPadding = width < 360 ? spacing.md : spacing.lg;
  const gridGap = width < 360 ? spacing.sm : spacing.md;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gridGap) / 2);
  const skeletonVariantSeed = useMemo(() => Math.floor(Math.random() * 3), []);
  const skeletonItems = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({ id: `skeleton-${index}` })),
    []
  );

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const rawState = await AsyncStorage.getItem(HOME_FILTERS_STORAGE_KEY);
        if (!rawState) {
          setHasPersistedState(false);
          return;
        }

        const state = JSON.parse(rawState) as Partial<PersistedHomeState>;
        setHasPersistedState(true);

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
    if (hasPersistedState === false && user?.uid && activeTab === 'all') {
      setActiveTab('my');
    }
  }, [activeTab, hasPersistedState, user?.uid]);

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

  const handleResetFilters = () => {
    setSortBy('newest');
    setSelectedCargoType('');
  };

  const displayName = currentUser?.full_name || user?.displayName || t('user') || '';
  const avatarUrl = currentUser?.avatar_url || user?.photoURL || undefined;

  return (
    <View style={styles.container}>
      {/* Header: Avatar + Notifications */}
      <HomeHeader avatarUrl={avatarUrl} displayName={displayName} unreadCount={unreadCount} />

      {/* Sticky Controls: Tabs + Search + Filters */}
      <View style={[styles.stickyControls, { paddingHorizontal: horizontalPadding }]}>
        {/* Tabs */}
        <HomeTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Search Bar + Filter Button */}
        <HomeSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hasActiveFilters={sortBy !== 'newest' || !!selectedCargoType}
          onFilterPress={() => setIsFilterSheetVisible(true)}
        />

        {/* Active Filters Display */}
        <HomeActiveFilters
          sortBy={sortBy}
          selectedCargoType={selectedCargoType}
          onReset={handleResetFilters}
        />
      </View>

      {/* Requests List */}
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

      {/* Filter Sheet Modal */}
      <HomeFilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        activeTab={activeTab}
        sortBy={sortBy}
        selectedCargoType={selectedCargoType}
        onSortChange={setSortBy}
        onCargoTypeChange={setSelectedCargoType}
        onReset={handleResetFilters}
        cargoTypes={cargoTypes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stickyControls: {
    backgroundColor: colors.white,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
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
    borderRadius: 8,
    gap: spacing.xs,
  },
  createButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
