import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, fontSize, useAppThemeStyles } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCargoRequests, type SortOption } from '../../hooks/useCargoRequests';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { RequestCard } from '../../components/home/RequestCard';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { HomeHeader } from '../../components/home/HomeHeader';
import { HomeTabBar } from '../../components/home/HomeTabBar';
import { HomeSearchBar } from '../../components/home/HomeSearchBar';
import { HomeFilterSheet } from '../../components/home/HomeFilterSheet';
import { HomeActiveFilters } from '../../components/home/HomeActiveFilters';
import { EmptyState } from '../../components/EmptyState';
import { IOSRefreshControl } from '../../components/IOSRefreshControl';
import { Onboarding } from '../../components/Onboarding';
import EmptyHomeIllustration from '../../assets/empty-home.svg';
import {
  REQUEST_CARD_FORCE_TWO_COLUMNS,
  REQUEST_CARD_SINGLE_COLUMN_BREAKPOINT,
} from '../../constants/cardStyles';
import { useTranslation } from 'react-i18next';
import { useUnreadCount } from '../../hooks/useNotifications';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';

const HOME_FILTERS_STORAGE_KEY = 'home_filters';
const LEGACY_HOME_FILTERS_STORAGE_KEY = '@home_marketplace_filters';
const HOME_ONBOARDING_SEEN_KEY_PREFIX = 'home_onboarding_seen';

type PersistedHomeState = {
  activeTab: 'all' | 'my';
  searchQuery: string;
  sortBy: SortOption;
  selectedCargoType: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { currentUser } = useCurrentUser(user?.uid);
  const { t } = useTranslation();
  const { unreadCount } = useUnreadCount();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [selectedCargoType, setSelectedCargoType] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [myActiveRequestsCount, setMyActiveRequestsCount] = useState(0);
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
      countryCode: currentUser?.country_code,
    });

  const horizontalPadding = width < 360 ? spacing.sm : spacing.md;
  const gridGap = width < 360 ? spacing.xs : spacing.sm;
  const isSingleColumnLayout =
    !REQUEST_CARD_FORCE_TWO_COLUMNS && width < REQUEST_CARD_SINGLE_COLUMN_BREAKPOINT;
  const cardWidth = isSingleColumnLayout
    ? Math.floor(width - horizontalPadding * 2)
    : Math.floor((width - horizontalPadding * 2 - gridGap) / 2);
  const skeletonVariantSeed = useMemo(() => Math.floor(Math.random() * 3), []);
  const skeletonItems = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({ id: `skeleton-${index}` })),
    []
  );

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const rawCurrentState = await AsyncStorage.getItem(HOME_FILTERS_STORAGE_KEY);
        const rawLegacyState = rawCurrentState
          ? null
          : await AsyncStorage.getItem(LEGACY_HOME_FILTERS_STORAGE_KEY);
        const rawState = rawCurrentState ?? rawLegacyState;
        if (!rawState) {
          setHasPersistedState(false);
          return;
        }

        if (!rawCurrentState && rawLegacyState) {
          await AsyncStorage.setItem(HOME_FILTERS_STORAGE_KEY, rawLegacyState);
          await AsyncStorage.removeItem(LEGACY_HOME_FILTERS_STORAGE_KEY);
          if (__DEV__) {
            console.info('Migrated home filters storage key to home_filters');
          }
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

  useEffect(() => {
    let isMounted = true;

    const checkOnboarding = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setShowOnboarding(false);
        }
        return;
      }

      try {
        const onboardingKey = `${HOME_ONBOARDING_SEEN_KEY_PREFIX}:${user.uid}`;
        const seen = await AsyncStorage.getItem(onboardingKey);
        if (isMounted) {
          setShowOnboarding(seen !== '1');
        }
      } catch (error) {
        console.warn('Failed to load onboarding state', error);
        if (isMounted) {
          setShowOnboarding(true);
        }
      }
    };

    checkOnboarding();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    const hasQuery = searchQuery.trim().length > 0;

    if (!hasQuery) {
      setIsSearching(false);
      return;
    }

    if (searchQuery !== debouncedSearchQuery) {
      setIsSearching(true);
    }
  }, [debouncedSearchQuery, searchQuery]);

  useEffect(() => {
    if (!loading) {
      setIsSearching(false);
    }
  }, [loading]);

  useEffect(() => {
    if (!user?.uid) {
      setMyActiveRequestsCount(0);
      return;
    }

    let isMounted = true;

    const fetchMyActiveRequestsCount = async () => {
      const { count, error } = await supabase
        .from('cargo_requests')
        .select('id', { head: true, count: 'exact' })
        .eq('customer_id', user.uid)
        .in('status', ['active', 'open']);

      if (error) {
        console.warn('Failed to fetch active request count', error);
        return;
      }

      if (isMounted) {
        setMyActiveRequestsCount(count ?? 0);
      }
    };

    fetchMyActiveRequestsCount();

    const channel = supabase
      .channel(`home:my-active-count:${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cargo_requests',
          filter: `customer_id=eq.${user.uid}`,
        },
        () => {
          fetchMyActiveRequestsCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user?.uid]);

  const handleOpenRequest = (requestId: string) => {
    router.push(`/request-details/${requestId}`);
  };

  const handleResetFilters = () => {
    setSortBy('newest');
    setSelectedCargoType('');
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);

    if (!user?.uid) {
      return;
    }

    try {
      const onboardingKey = `${HOME_ONBOARDING_SEEN_KEY_PREFIX}:${user.uid}`;
      await AsyncStorage.setItem(onboardingKey, '1');
    } catch (error) {
      console.warn('Failed to persist onboarding state', error);
    }
  };

  const displayName = currentUser?.full_name || user?.displayName || t('user') || '';
  const avatarUrl = currentUser?.avatar_url || user?.photoURL || undefined;
  const onboardingUserType = currentUser?.user_type === 'carrier' ? 'carrier' : 'customer';

  return (
    <View style={styles.container}>
      {/* Header: Avatar + Notifications */}
      <HomeHeader avatarUrl={avatarUrl} displayName={displayName} unreadCount={unreadCount} />

      {/* Sticky Controls: Tabs + Search + Filters */}
      <View style={[styles.stickyControls, { paddingHorizontal: horizontalPadding }]}>
        {/* Tabs */}
        <HomeTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          myRequestsCount={myActiveRequestsCount}
        />

        {/* Search Bar + Filter Button */}
        <HomeSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSearching={isSearching}
          hasActiveFilters={sortBy !== 'newest' || !!selectedCargoType}
          onFilterPress={() => setIsFilterSheetVisible(true)}
        />

      </View>


      {/* Requests List */}
      <FlatList
        key={isSingleColumnLayout ? 'single-column' : 'two-column'}
        data={loading ? skeletonItems : requests}
        keyExtractor={(item, index) => ('id' in item ? item.id : `request-${index}`)}
        numColumns={isSingleColumnLayout ? 1 : 2}
        columnWrapperStyle={isSingleColumnLayout ? undefined : { gap: gridGap }}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: spacing.xl,
          rowGap: gridGap,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <IOSRefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (hasMore && !loadingMore) {
            fetchMoreRequests();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.footerLoaderText}>{t('loadingMore')}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title={t('noRequestsYet') || t('noCargoRequestsYet') || 'No requests yet'}
              description={
                t('createFirstRequest') ||
                t('createFirstCargoRequest') ||
                'Create your first request'
              }
              illustration={EmptyHomeIllustration}
              actions={[
                {
                  label: t('createRequest') || 'Create request',
                  icon: 'add-outline',
                  variant: 'primary',
                  onPress: () => router.push('/(tabs)/create'),
                },
              ]}
            />
          ) : null
        }
        renderItem={({ item, index }) =>
          loading ? (
            <SkeletonLoader
              variant="card"
              count={1}
              layout="grid"
              cardWidth={cardWidth}
              cardGap={gridGap}
              variantSeed={index + skeletonVariantSeed}
              compact={true}
            />
          ) : (
            <RequestCard
              request={item}
              onPress={() => handleOpenRequest(item.id)}
              currentUserId={user?.uid}
              showFavorite={false}
              compact
              cardStyle={{ width: cardWidth }}
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

      <Onboarding
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        userType={onboardingUserType}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppThemeStyles>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    stickyControls: {
      backgroundColor: colors.white,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    footerLoader: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
    },
    footerLoaderText: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    quickFilterScroll: {
      marginTop: spacing.sm,
      marginHorizontal: -spacing.lg,
    },
    quickFilterRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xs,
    },
    quickFilterChip: {
      borderWidth: 1.5,
      borderColor: colors.border.default,
      borderRadius: 20,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.white,
    },
    quickFilterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    quickFilterChipText: {
      fontSize: fontSize.sm,
      fontWeight: '500' as const,
      color: colors.text.secondary,
    },
    quickFilterChipTextActive: {
      color: colors.primary,
      fontWeight: '700' as const,
    },
  });
