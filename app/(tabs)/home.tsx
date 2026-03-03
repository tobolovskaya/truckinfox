import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, useAppThemeStyles } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCargoRequests, type SortOption } from '../../hooks/useCargoRequests';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { RequestCard, type CargoRequest } from '../../components/home/RequestCard';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { HomeHeader } from '../../components/home/HomeHeader';
import { HomeTabBar } from '../../components/home/HomeTabBar';
import { HomeSearchBar } from '../../components/home/HomeSearchBar';
import { HomeFilterSheet } from '../../components/home/HomeFilterSheet';
import { HomeActiveFilters } from '../../components/home/HomeActiveFilters';
import { EmptyState } from '../../components/EmptyState';
import { IOSRefreshControl } from '../../components/IOSRefreshControl';
import { Onboarding } from '../../components/Onboarding';
import AddressInput from '../../components/AddressInput';
import EmptyHomeIllustration from '../../assets/empty-home.svg';
import {
  REQUEST_CARD_FORCE_TWO_COLUMNS,
  REQUEST_CARD_SINGLE_COLUMN_BREAKPOINT,
} from '../../constants/cardStyles';
import { useTranslation } from 'react-i18next';
import { useUnreadCount } from '../../hooks/useNotifications';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import { findCargoAlongRoute } from '../../utils/geoSearch';
import { getPlaceDetails, norwegianCities, searchNorwegianPlaces } from '../../utils/googlePlaces';

const HOME_FILTERS_STORAGE_KEY = 'home_filters';
const LEGACY_HOME_FILTERS_STORAGE_KEY = '@home_marketplace_filters';
const HOME_ONBOARDING_SEEN_KEY_PREFIX = 'home_onboarding_seen';

const normalizeRouteCityInput = (value: string): string =>
  value
    .replace(/,\s*(norge|norway)\s*$/i, '')
    .replace(/ø/gim, 'o')
    .replace(/æ/gim, 'ae')
    .replace(/å/gim, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const findOfflineCityCoordinates = (value: string): { lat: number; lng: number } | null => {
  const normalizedValue = normalizeRouteCityInput(value);
  if (!normalizedValue) {
    return null;
  }

  const exactMatch = norwegianCities.find(
    city => normalizeRouteCityInput(city.name) === normalizedValue
  );

  if (exactMatch) {
    return { lat: exactMatch.lat, lng: exactMatch.lng };
  }

  const partialMatch = norwegianCities.find(city =>
    normalizeRouteCityInput(city.name).includes(normalizedValue)
  );

  return partialMatch ? { lat: partialMatch.lat, lng: partialMatch.lng } : null;
};

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
  const [routeModeEnabled, setRouteModeEnabled] = useState(false);
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeFromCoords, setRouteFromCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [routeToCoords, setRouteToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeRadiusKm, setRouteRadiusKm] = useState('25');
  const [routeResults, setRouteResults] = useState<CargoRequest[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeSearched, setRouteSearched] = useState(false);
  const [routeError, setRouteError] = useState('');
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
        .in('status', ['open', 'bidding']);

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

  const resolvePlaceCoordinates = async (
    input: string
  ): Promise<{ lat: number; lng: number } | null> => {
    const normalizedInput = input.trim();
    if (!normalizedInput) {
      return null;
    }

    const offlineDirectMatch = findOfflineCityCoordinates(normalizedInput);
    if (offlineDirectMatch) {
      return offlineDirectMatch;
    }

    const suggestions = await searchNorwegianPlaces(normalizedInput);
    const firstSuggestion = suggestions[0];
    if (!firstSuggestion) {
      return findOfflineCityCoordinates(normalizedInput);
    }

    if (firstSuggestion.geometry?.location) {
      return firstSuggestion.geometry.location;
    }

    const details = await getPlaceDetails(firstSuggestion.place_id);
    if (details?.geometry?.location) {
      return details.geometry.location;
    }

    const fallbackFromSuggestion = findOfflineCityCoordinates(
      firstSuggestion.structured_formatting.main_text || firstSuggestion.description
    );

    return fallbackFromSuggestion ?? findOfflineCityCoordinates(normalizedInput);
  };

  const handleRouteSearch = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) {
      setRouteError(t('routeFillFromTo'));
      setRouteSearched(true);
      setRouteResults([]);
      return;
    }

    const parsedRadius = Number(routeRadiusKm);
    const radius = Number.isFinite(parsedRadius) ? Math.min(80, Math.max(5, parsedRadius)) : 25;

    try {
      setRouteLoading(true);
      setRouteError('');

      const [fromPoint, toPoint] = await Promise.all([
        routeFromCoords ?? resolvePlaceCoordinates(routeFrom),
        routeToCoords ?? resolvePlaceCoordinates(routeTo),
      ]);

      if (!fromPoint || !toPoint) {
        setRouteError(t('routeInvalidLocations'));
        setRouteSearched(true);
        setRouteResults([]);
        return;
      }

      const result = await findCargoAlongRoute(
        fromPoint.lat,
        fromPoint.lng,
        toPoint.lat,
        toPoint.lng,
        radius,
        currentUser?.country_code
      );

      const mappedResults = result.map(item => ({
        ...(item as CargoRequest),
        route_distance_km: (() => {
          const rawDistance = (item as { distance_to_route_km?: unknown }).distance_to_route_km;
          return typeof rawDistance === 'number' && Number.isFinite(rawDistance)
            ? rawDistance
            : undefined;
        })(),
      }));

      const sortedByMinDetour = [...mappedResults].sort((left, right) => {
        const leftDetour =
          typeof left.route_distance_km === 'number'
            ? left.route_distance_km
            : Number.POSITIVE_INFINITY;
        const rightDetour =
          typeof right.route_distance_km === 'number'
            ? right.route_distance_km
            : Number.POSITIVE_INFINITY;

        if (leftDetour !== rightDetour) {
          return leftDetour - rightDetour;
        }

        const leftCreatedAt = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightCreatedAt = right.created_at ? new Date(right.created_at).getTime() : 0;
        return rightCreatedAt - leftCreatedAt;
      });

      setRouteResults(sortedByMinDetour);
      setRouteSearched(true);
    } catch (error) {
      console.warn('Failed to search cargo along route', error);
      setRouteError(t('routeSearchFailed'));
      setRouteSearched(true);
      setRouteResults([]);
    } finally {
      setRouteLoading(false);
    }
  };

  const filteredRouteResults = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();

    const byFilters = routeResults.filter(item => {
      const matchesCargoType =
        !selectedCargoType || (item.cargo_type || '').toLowerCase() === selectedCargoType.toLowerCase();

      if (!query) {
        return matchesCargoType;
      }

      const haystack = [item.title, item.description, item.from_address, item.to_address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesCargoType && haystack.includes(query);
    });

    const parsePrice = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const parseDate = (value?: string): number => {
      if (!value) {
        return 0;
      }
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    return [...byFilters].sort((left, right) => {
      const leftDetour =
        typeof left.route_distance_km === 'number' ? left.route_distance_km : Number.POSITIVE_INFINITY;
      const rightDetour =
        typeof right.route_distance_km === 'number'
          ? right.route_distance_km
          : Number.POSITIVE_INFINITY;

      switch (sortBy) {
        case 'priceLowToHigh':
          return parsePrice(left.price) - parsePrice(right.price);
        case 'priceHighToLow':
          return parsePrice(right.price) - parsePrice(left.price);
        case 'oldest':
          return parseDate(left.created_at) - parseDate(right.created_at);
        case 'newest':
        case 'date':
          return parseDate(right.created_at) - parseDate(left.created_at);
        default:
          if (leftDetour !== rightDetour) {
            return leftDetour - rightDetour;
          }
          return parseDate(right.created_at) - parseDate(left.created_at);
      }
    });
  }, [debouncedSearchQuery, routeResults, selectedCargoType, sortBy]);

  const listRequests = routeModeEnabled ? filteredRouteResults : requests;
  const listLoading = routeModeEnabled ? routeLoading : loading;
  const listRefreshing = routeModeEnabled ? routeLoading : refreshing;

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

        <View style={styles.routeModeSection}>
          <TouchableOpacity
            style={[styles.routeModeToggle, routeModeEnabled && styles.routeModeToggleActive]}
            onPress={() => setRouteModeEnabled(previous => !previous)}
            accessibilityRole="button"
            accessibilityLabel={t('routeMode')}
          >
            <View style={styles.routeModeLabelWrap}>
              <Ionicons
                name="git-compare-outline"
                size={16}
                color={routeModeEnabled ? colors.white : colors.text.secondary}
              />
              <Text style={[styles.routeModeLabel, routeModeEnabled && styles.routeModeLabelActive]}>
                {t('routeMode')}
              </Text>
            </View>
            <Ionicons
              name={routeModeEnabled ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={routeModeEnabled ? colors.white : colors.text.secondary}
            />
          </TouchableOpacity>

          {routeModeEnabled ? (
            <View style={styles.routeControlsWrap}>
              <View style={styles.routeFieldRow}>
                <AddressInput
                  placeholder={t('routeFromPlaceholder')}
                  value={routeFrom}
                  onChangeText={text => {
                    setRouteFrom(text);
                    setRouteFromCoords(null);
                    setRouteError('');
                  }}
                  onAddressSelect={(address, coordinates) => {
                    setRouteFrom(address);
                    setRouteFromCoords(coordinates ?? null);
                    setRouteError('');
                  }}
                  style={styles.routeAddressInput}
                />
                <AddressInput
                  placeholder={t('routeToPlaceholder')}
                  value={routeTo}
                  onChangeText={text => {
                    setRouteTo(text);
                    setRouteToCoords(null);
                    setRouteError('');
                  }}
                  onAddressSelect={(address, coordinates) => {
                    setRouteTo(address);
                    setRouteToCoords(coordinates ?? null);
                    setRouteError('');
                  }}
                  style={styles.routeAddressInput}
                />
              </View>

              <View style={styles.routeActionsRow}>
                <View style={styles.routeRadiusWrap}>
                  <Text style={styles.routeRadiusLabel}>{t('routeRadiusKm')}</Text>
                  <TextInput
                    style={styles.routeRadiusInput}
                    value={routeRadiusKm}
                    onChangeText={setRouteRadiusKm}
                    keyboardType="numeric"
                    placeholder="25"
                    placeholderTextColor={colors.text.secondary}
                  />
                </View>

                <TouchableOpacity
                  style={styles.routeSearchButton}
                  onPress={handleRouteSearch}
                  disabled={routeLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('routeSearch')}
                >
                  {routeLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.routeSearchButtonText}>{t('routeSearch')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {routeError ? <Text style={styles.routeErrorText}>{routeError}</Text> : null}
            </View>
          ) : null}
        </View>

      </View>


      {/* Requests List */}
      <FlatList
        key={isSingleColumnLayout ? 'single-column' : 'two-column'}
        data={listLoading ? skeletonItems : listRequests}
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
            refreshing={listRefreshing}
            onRefresh={routeModeEnabled ? handleRouteSearch : refresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (!routeModeEnabled && hasMore && !loadingMore) {
            fetchMoreRequests();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          !routeModeEnabled && loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.footerLoaderText}>{t('loadingMore')}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !listLoading ? (
            <EmptyState
              icon="cube-outline"
              title={
                routeModeEnabled && routeSearched
                  ? t('routeNoMatches')
                  : t('noRequestsYet') || t('noCargoRequestsYet') || 'No requests yet'
              }
              description={
                routeModeEnabled && routeSearched
                  ? t('routeNoMatchesDescription')
                  : t('createFirstRequest') ||
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
          listLoading ? (
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
    routeModeSection: {
      marginBottom: spacing.xs,
      gap: spacing.xs,
    },
    routeModeToggle: {
      minHeight: 38,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: 10,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    routeModeToggleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    routeModeLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    routeModeLabel: {
      color: colors.text.secondary,
      fontSize: fontSize.sm,
      fontWeight: '600' as const,
    },
    routeModeLabelActive: {
      color: colors.white,
    },
    routeControlsWrap: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: 10,
      backgroundColor: colors.background,
      padding: spacing.sm,
      gap: spacing.sm,
    },
    routeFieldRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    routeAddressInput: {
      flex: 1,
    },
    routeFieldInput: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: 8,
      backgroundColor: colors.white,
      paddingHorizontal: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text.primary,
    },
    routeActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-end',
    },
    routeRadiusWrap: {
      width: 90,
      gap: spacing.xs,
    },
    routeRadiusLabel: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      fontWeight: '600' as const,
    },
    routeRadiusInput: {
      minHeight: 38,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: 8,
      backgroundColor: colors.white,
      paddingHorizontal: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text.primary,
    },
    routeSearchButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    routeSearchButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700' as const,
    },
    routeErrorText: {
      fontSize: fontSize.xs,
      color: colors.error,
      fontWeight: '600' as const,
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
