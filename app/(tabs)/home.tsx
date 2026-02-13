import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import {
  useCargoRequests,
  type CargoRequest as ImportedCargoRequest,
  type FilterState as ImportedFilterState,
  type SortOption as ImportedSortOption,
} from '../../hooks/useCargoRequests';
import { useCities } from '../../hooks/useCities';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useFavorites } from '../../hooks/useFavorites';
import { useFilterState } from '../../hooks/useFilterState';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { SwipeableRequestCard } from '../../components/home/SwipeableRequestCard';
import { SkeletonCard } from '../../components/home/SkeletonCard';

// Use imported types from hooks
type CargoRequest = ImportedCargoRequest;
type FilterState = ImportedFilterState;
type SortOption = ImportedSortOption;

const EmptyStateAnimation = ({ activeTab }: { activeTab: 'all' | 'my' }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleCreateRequest = () => {
    router.push('/(tabs)/create');
  };

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyContent}>
        {/* Interactive Create Button */}
        <TouchableOpacity
          style={styles.emptyCreateButton}
          onPress={handleCreateRequest}
          activeOpacity={0.8}
        >
          <View style={styles.emptyIconContainer}>
            <Ionicons name="add-circle" size={84} color="white" />
          </View>
          <Text style={styles.emptyCreateButtonText}>
            {t('createRequest') || 'Opprett forespørsel'}
          </Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.emptyTitle}>
          {activeTab === 'all'
            ? t('noActiveRequests') || 'Ingen aktive forespørsler'
            : t('noMyRequests') || 'Du har ingen forespørsler'}
        </Text>

        {/* Subtitle */}
        <Text style={styles.emptySubtitle}>
          {activeTab === 'all'
            ? t('checkBackLater') || 'Sjekk tilbake senere for nye forespørsler'
            : t('createFirstRequest') || 'Opprett din første forespørsel for å komme i gang'}
        </Text>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // Filter modal state
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // Tab and sort state (keep local)
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Filter state management with useReducer
  const {
    filterState,
    setCity,
    setCargoType,
    setPriceRange,
    setWeightRange,
    setPickupDate,
    setCitySearch,
    closeModal,
    resetFilters,
  } = useFilterState();

  // Convert filterState to the format expected by useCargoRequests (memoized to prevent re-renders)
  const filters: FilterState = useMemo(
    () => ({
      city: filterState.city,
      cargo_type: filterState.cargo_type,
      price_min: filterState.price_min,
      price_max: filterState.price_max,
      price_type: filterState.price_type,
    }),
    [
      filterState.city,
      filterState.cargo_type,
      filterState.price_min,
      filterState.price_max,
      filterState.price_type,
    ]
  );

  // Data fetching hooks
  const {
    requests,
    setRequests,
    loading,
    refreshing,
    refresh,
    fetchMoreRequests,
    loadingMore,
    hasMore,
  } = useCargoRequests({
    activeTab,
    filters,
    sortBy,
    userId: user?.uid,
  });

  const { cities } = useCities();
  const { currentUser } = useCurrentUser(user?.uid);
  const { toggleFavorite: toggleFavoriteHook } = useFavorites(user?.uid);

  // Bottom Sheet snap points
  const snapPoints = useMemo(() => ['25%', '50%', '92%'], []);

  // Open/close filter modal functions
  const openFilterSheet = useCallback(() => {
    setIsFilterModalVisible(true);
  }, []);

  const closeFilterSheet = useCallback(() => {
    setIsFilterModalVisible(false);
  }, []);

  // Wrapper for toggleFavorite with optimistic updates
  const toggleFavorite = React.useCallback(
    (requestId: string) => {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const originalFavoriteState = request.is_favorite ?? false;

      // ✅ Optimistic update - instant UI feedback
      setRequests(prev =>
        prev.map(req => (req.id === requestId ? { ...req, is_favorite: !req.is_favorite } : req))
      );

      // Call hook with callback to handle success or rollback on error
      toggleFavoriteHook(requestId, originalFavoriteState, newStatus => {
        // Update to actual status from Firebase
        // If error occurred, this will revert to original state (rollback)
        setRequests(prev =>
          prev.map(req => (req.id === requestId ? { ...req, is_favorite: newStatus } : req))
        );
      });
    },
    [requests, setRequests, toggleFavoriteHook]
  );

  // Handle delete request (for swipe action)
  const handleDeleteRequest = React.useCallback(
    async (requestId: string) => {
      try {
        // Optimistically remove from UI
        setRequests(prev => prev.filter(req => req.id !== requestId));

        // TODO: Add actual delete API call here
        // await deleteDoc(doc(db, 'cargo_requests', requestId));

        console.log('Delete request:', requestId);
      } catch (error: any) {
        console.error('Error deleting request:', error);
        // Refresh on error
        refresh();
      }
    },
    [setRequests, refresh]
  );

  // Refresh wrapper
  const onRefresh = React.useCallback(() => {
    refresh();
  }, [refresh]);

  // Animation values for segmented control
  const segmentedValue = useSharedValue(0);
  const containerWidth = useSharedValue(0);

  // Animated style for the underline indicator
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const totalWidth = containerWidth.value;
    const tabWidth = totalWidth / 2;
    const translateX = segmentedValue.value * tabWidth;

    return {
      transform: [{ translateX }],
      width: tabWidth,
    };
  });

  const handleTabChange = (tab: 'all' | 'my') => {
    const newValue = tab === 'all' ? 0 : 1;

    // Animate the indicator (or instant transition for accessibility)
    if (reduceMotion) {
      // Instant transition for users who prefer reduced motion
      segmentedValue.value = newValue;
    } else {
      // Smooth spring animation
      segmentedValue.value = withSpring(newValue, {
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      });
    }

    // Update state immediately for UI responsiveness
    setActiveTab(tab);
  };

  const handleRequestPress = React.useCallback(
    (request: CargoRequest) => {
      router.push(`/request-details/${request.id}` as any);
    },
    [router]
  );

  const getGreeting = () => {
    return t('greeting') || 'Hei';
  };

  const getUserInitials = () => {
    const name = currentUser?.full_name || user?.displayName || user?.email || 'User';
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={styles.container}>
      {/* Header with Greeting */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.userInfoContainer}>
          {currentUser?.avatar_url ? (
            <Image source={{ uri: currentUser.avatar_url }} style={styles.greetingAvatar} />
          ) : (
            <View style={styles.greetingAvatarFallback}>
              <Text style={styles.greetingInitials}>{getUserInitials()}</Text>
            </View>
          )}
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>
              {getGreeting()},{' '}
              {currentUser?.full_name || user?.displayName || user?.email || 'User'}
              <Text style={styles.waveEmoji}> 👋</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Sticky Header with Search */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.stickyHeaderContent}>
          {/* Compact Greeting - Less Prominent */}
          <TouchableOpacity
            style={styles.compactGreetingContainer}
            onPress={() => router.push('/profile')}
          >
            {currentUser?.avatar_url ? (
              <Image source={{ uri: currentUser.avatar_url }} style={styles.compactAvatar} />
            ) : (
              <View style={styles.compactAvatarFallback}>
                <Text style={styles.compactInitials}>{getUserInitials()}</Text>
              </View>
            )}
            <Text style={styles.compactGreetingSubtle}>
              {getGreeting()},{' '}
              {(currentUser?.full_name || user?.displayName || user?.email || 'User').split(' ')[0]}
            </Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.filterButtonHeader} onPress={openFilterSheet}>
              <View style={styles.iconButtonCircle}>
                <Ionicons name="filter-outline" size={22} color="#FF7043" />
                {(filters.city ||
                  filters.cargo_type ||
                  filterState.priceRange.min ||
                  filterState.priceRange.max ||
                  filterState.weightRange.min ||
                  filterState.weightRange.max ||
                  filterState.pickupDate) && (
                  <View style={styles.filterCountBadge}>
                    <Text style={styles.filterCountText}>
                      {
                        [
                          filters.city,
                          filters.cargo_type,
                          filterState.priceRange.min || filterState.priceRange.max,
                          filterState.weightRange.min || filterState.weightRange.max,
                          filterState.pickupDate,
                        ].filter(Boolean).length
                      }
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.filterButtonLabel}>Filtrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Prominent Search Bar */}
      <View style={styles.searchBarContainer}>
        <TouchableOpacity
          style={styles.prominentSearchButton}
          onPress={() => {
            Alert.alert(t('searchPlaceholder') || 'Search', 'Search functionality coming soon');
          }}
        >
          <Ionicons name="search" size={20} color="#616161" />
          <Text style={styles.searchPlaceholderText}>
            {t('searchPlaceholder') || 'Søk etter transport...'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* iOS Style Tab Navigation */}
      <View style={styles.tabNavigationContainer}>
        <View
          style={styles.tabNavigation}
          onLayout={event => {
            const { width } = event.nativeEvent.layout;
            containerWidth.value = width;
          }}
        >
          <TouchableOpacity style={styles.tabButton} onPress={() => handleTabChange('all')}>
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              {t('allRequests')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabButton} onPress={() => handleTabChange('my')}>
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
              {t('myRequests')}
            </Text>
          </TouchableOpacity>

          {/* Animated underline indicator */}
          <Reanimated.View style={[styles.tabUnderline, animatedIndicatorStyle]} />
        </View>
      </View>

      {/* Active Filter Chips */}
      {activeTab === 'all' &&
        (filters.city ||
          filters.cargo_type ||
          filterState.priceRange.min ||
          filterState.priceRange.max ||
          filterState.weightRange.min ||
          filterState.weightRange.max ||
          filterState.pickupDate) && (
          <View style={styles.filterChipsWrapper}>
            {(filters.city ||
              filters.cargo_type ||
              filterState.priceRange.min ||
              filterState.priceRange.max ||
              filterState.weightRange.min ||
              filterState.weightRange.max ||
              filterState.pickupDate) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsContainer}
                style={styles.filterChipsScroll}
              >
                {/* City Chip */}
                {filters.city && (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>By:</Text>
                    <Text style={styles.filterChipValue}>{filters.city}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setCity('');
                        setCitySearch('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Cargo Type Chip */}
                {filters.cargo_type && (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>Type:</Text>
                    <Text style={styles.filterChipValue}>{t(filters.cargo_type)}</Text>
                    <TouchableOpacity
                      onPress={() => setCargoType('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Price Range Chip */}
                {(filterState.priceRange.min || filterState.priceRange.max) && (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>Pris:</Text>
                    <Text style={styles.filterChipValue}>
                      {filterState.priceRange.min || '0'}–{filterState.priceRange.max || '∞'} NOK
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPriceRange({ min: '', max: '' })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Weight Range Chip */}
                {(filterState.weightRange.min || filterState.weightRange.max) && (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>Vekt:</Text>
                    <Text style={styles.filterChipValue}>
                      {filterState.weightRange.min || '0'}–{filterState.weightRange.max || '∞'} kg
                    </Text>
                    <TouchableOpacity
                      onPress={() => setWeightRange({ min: '', max: '' })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Pickup Date Chip */}
                {filterState.pickupDate && (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipLabel}>Dato:</Text>
                    <Text style={styles.filterChipValue}>{filterState.pickupDate}</Text>
                    <TouchableOpacity
                      onPress={() => setPickupDate('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        )}

      <View style={styles.contentContainer}>
        {loading ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor="white"
                title={t('pullToRefresh') || 'Drar for å oppdatere...'}
                titleColor={colors.text.secondary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.requestsList}>
              {[1, 2, 3].map(index => (
                <SkeletonCard key={index} />
              ))}
            </View>
            <View style={{ height: insets.bottom + 80 }} />
          </ScrollView>
        ) : requests.length === 0 ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, styles.emptyContainer]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor="white"
                title={t('pullToRefresh') || 'Drar for å oppdatere...'}
                titleColor={colors.text.secondary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <EmptyStateAnimation activeTab={activeTab} />
          </ScrollView>
        ) : (
          <FlatList
            data={requests}
            renderItem={({ item }) => (
              <SwipeableRequestCard
                request={item}
                onPress={handleRequestPress}
                onToggleFavorite={toggleFavorite}
                onDelete={activeTab === 'my' ? handleDeleteRequest : undefined}
                showDeleteAction={activeTab === 'my'}
                isOwner={activeTab === 'my'}
              />
            )}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={[
              styles.requestsList,
              {
                paddingBottom: 120, // Space for FAB button
                paddingTop: 16,
                paddingHorizontal: spacing.sm,
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor="white"
                title={t('pullToRefresh') || 'Drar for å oppdatere...'}
                titleColor={colors.text.secondary}
              />
            }
            showsVerticalScrollIndicator={false}
            // Infinite scroll
            onEndReached={fetchMoreRequests}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.footerText}>{t('loadingMore') || 'Laster flere...'}</Text>
                </View>
              ) : !hasMore && requests.length > 0 ? (
                <View style={styles.footerLoader}>
                  <Text style={styles.footerEndText}>
                    {t('noMoreRequests') || 'Ingen flere forespørsler'}
                  </Text>
                </View>
              ) : null
            }
            // Performance optimizations
            removeClippedSubviews={true} // Enable native optimization
            maxToRenderPerBatch={10} // Reduced from 20 for better performance
            updateCellsBatchingPeriod={50} // Batch updates every 50ms
            initialNumToRender={10} // Initial render (5 rows for 2 columns)
            windowSize={5} // Reduced window size for better memory usage
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/create')}
        activeOpacity={0.8}
      >
        <LinearGradient colors={[colors.primary, colors.primary]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color={theme.iconColors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeFilterSheet}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrer & Sorter transport</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeFilterSheet}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
          {/* Sorting Section */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Sorter etter</Text>
            <View style={styles.filterOptionsGrid}>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'newest' && styles.sortOptionActive]}
                onPress={() => setSortBy('newest')}
              >
                <View style={[styles.radioCircle, sortBy === 'newest' && styles.radioCircleActive]}>
                  {sortBy === 'newest' && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === 'newest' && styles.sortOptionTextActive,
                  ]}
                >
                  Nyeste
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'oldest' && styles.sortOptionActive]}
                onPress={() => setSortBy('oldest')}
              >
                <View style={[styles.radioCircle, sortBy === 'oldest' && styles.radioCircleActive]}>
                  {sortBy === 'oldest' && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === 'oldest' && styles.sortOptionTextActive,
                  ]}
                >
                  Eldste
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'priceLowToHigh' && styles.sortOptionActive]}
                onPress={() => setSortBy('priceLowToHigh')}
              >
                <View
                  style={[
                    styles.radioCircle,
                    sortBy === 'priceLowToHigh' && styles.radioCircleActive,
                  ]}
                >
                  {sortBy === 'priceLowToHigh' && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === 'priceLowToHigh' && styles.sortOptionTextActive,
                  ]}
                >
                  Pris: Lav → Høy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'priceHighToLow' && styles.sortOptionActive]}
                onPress={() => setSortBy('priceHighToLow')}
              >
                <View
                  style={[
                    styles.radioCircle,
                    sortBy === 'priceHighToLow' && styles.radioCircleActive,
                  ]}
                >
                  {sortBy === 'priceHighToLow' && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === 'priceHighToLow' && styles.sortOptionTextActive,
                  ]}
                >
                  Pris: Høy → Lav
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'date' && styles.sortOptionActive]}
                onPress={() => setSortBy('date')}
              >
                <View style={[styles.radioCircle, sortBy === 'date' && styles.radioCircleActive]}>
                  {sortBy === 'date' && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[styles.sortOptionText, sortBy === 'date' && styles.sortOptionTextActive]}
                >
                  Hentingsdato
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* City Search with Autocomplete */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>By</Text>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color={colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Søk etter by..."
                value={filterState.citySearch}
                onChangeText={setCitySearch}
                placeholderTextColor={colors.text.secondary}
              />
              {filterState.citySearch && (
                <TouchableOpacity onPress={() => setCitySearch('')}>
                  <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.filterOptionsGrid}>
              <TouchableOpacity
                style={[styles.filterOption, !filterState.city && styles.filterOptionActive]}
                onPress={() => {
                  setCity('');
                  setCitySearch('');
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    !filterState.city && styles.filterOptionTextActive,
                  ]}
                >
                  Alle byer
                </Text>
              </TouchableOpacity>
              {cities
                .filter(city => city.toLowerCase().includes(filterState.citySearch.toLowerCase()))
                .map(city => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.filterOption,
                      filterState.city === city && styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      setCity(city);
                      setCitySearch(city);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterState.city === city && styles.filterOptionTextActive,
                      ]}
                    >
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>

          {/* Cargo Type Tags */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Type</Text>
            <View style={styles.filterOptionsGrid}>
              <TouchableOpacity
                style={[styles.filterOption, !filterState.cargo_type && styles.filterOptionActive]}
                onPress={() => setCargoType('')}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    !filterState.cargo_type && styles.filterOptionTextActive,
                  ]}
                >
                  Alle typer
                </Text>
              </TouchableOpacity>
              {[
                'construction',
                'automotive',
                'furniture',
                'electronics',
                'food',
                'clothing',
                'other',
              ].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterOption,
                    filterState.cargo_type === type && styles.filterOptionActive,
                  ]}
                  onPress={() => setCargoType(type)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterState.cargo_type === type && styles.filterOptionTextActive,
                    ]}
                  >
                    {t(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price Range */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Pris (NOK)</Text>
            <View style={styles.rangeInputContainer}>
              <View style={styles.rangeInputWrapper}>
                <Text style={styles.rangeLabel}>Fra</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="0"
                  value={filterState.priceRange.min}
                  onChangeText={text => setPriceRange({ ...filterState.priceRange, min: text })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.secondary}
                />
              </View>
              <View style={styles.rangeSeparator} />
              <View style={styles.rangeInputWrapper}>
                <Text style={styles.rangeLabel}>Til</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="50000"
                  value={filterState.priceRange.max}
                  onChangeText={text => setPriceRange({ ...filterState.priceRange, max: text })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.secondary}
                />
              </View>
            </View>
          </View>

          {/* Date Picker */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Dato (hentingsdato)</Text>
            <TouchableOpacity style={styles.datePickerButton}>
              <Ionicons name="calendar-outline" size={20} color={colors.text.primary} />
              <Text style={styles.datePickerText}>{filterState.pickupDate || 'Velg dato'}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Weight Range */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Vekt (kg)</Text>
            <View style={styles.rangeInputContainer}>
              <View style={styles.rangeInputWrapper}>
                <Text style={styles.rangeLabel}>Min</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="0"
                  value={filterState.weightRange.min}
                  onChangeText={text => setWeightRange({ ...filterState.weightRange, min: text })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.secondary}
                />
              </View>
              <View style={styles.rangeSeparator} />
              <View style={styles.rangeInputWrapper}>
                <Text style={styles.rangeLabel}>Maks</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="1000"
                  value={filterState.weightRange.max}
                  onChangeText={text => setWeightRange({ ...filterState.weightRange, max: text })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.secondary}
                />
              </View>
            </View>
          </View>

          {/* Extra padding at bottom for sticky bar */}
          <View style={{ height: 120 }} />
        </BottomSheetScrollView>

        {/* Sticky Action Bar at Bottom */}
        <View style={styles.stickyActionBar}>
          <TouchableOpacity
            onPress={() => {
              resetFilters();
            }}
          >
            <Text style={styles.resetButtonText}>Tilbakestill</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ctaButton} onPress={closeFilterSheet}>
            <Text style={styles.ctaButtonText}>Vis treff ({requests.length})</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.badge.background,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.sm,
    elevation: 5,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  greetingAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  greetingAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingInitials: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 36,
  },
  waveEmoji: {
    fontSize: fontSize.xxxl,
    color: colors.primary,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  compactGreetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: spacing.xs,
  },
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  compactAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactInitials: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  compactGreeting: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  compactGreetingSubtle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    flex: 1,
  },
  searchBarContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: 40,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  prominentSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchPlaceholderText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    flex: 1,
  },
  iconButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionButtonContainer: {
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    elevation: 3,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  profileButtonContainer: {
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    elevation: 3,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  initialsText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    height: 80,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
    elevation: 4,
    minWidth: 0,
  },
  statCardModern: {
    flex: 1,
    height: 100,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardCompact: {
    flex: 1,
    height: 64,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardEqual: {
    flex: 1,
    height: 64,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 0.5,
  },
  statCardFlat: {
    flex: 1,
    height: 75,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    gap: 4,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 1,
    textAlign: 'center',
  },
  statText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 1,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: fontWeight.medium,
    lineHeight: 12,
  },
  statNumberModern: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statTextModern: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statLabelModern: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  statNumberCompact: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.white,
    lineHeight: 18,
  },
  statTextCompact: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.white,
    lineHeight: 20,
    textAlign: 'center',
  },
  statLabelCompact: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: fontWeight.medium,
  },
  statNumberEqual: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.white,
    lineHeight: 18,
    marginTop: 2,
  },
  statLabelEqual: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  statLabelEqualLarge: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    fontWeight: fontWeight.semibold,
    marginTop: 4,
  },
  statNumberFlat: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.white,
    lineHeight: 24,
  },
  statLabelFlat: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: fontWeight.medium,
  },
  statLabelFlatLarge: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    fontWeight: fontWeight.semibold,
  },
  tabNavigationContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
  },
  tabNavigation: {
    flexDirection: 'row',
    position: 'relative',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.badge.background,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tabText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  filtersContainer: {
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filtersContainerModern: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersScrollContent: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  resetFiltersButton: {
    paddingLeft: spacing.md,
  },
  resetFiltersText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  filterItem: {
    minWidth: 120,
  },
  filterLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
  },
  picker: {
    height: 40,
    width: '100%',
  },
  clearFiltersButton: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.badge.background,
    borderRadius: borderRadius.lg,
  },
  clearFiltersText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxxl,
    marginTop: -200,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCreateButton: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    ...shadows.primary,
    elevation: 8,
  },
  emptyIconContainer: {
    marginBottom: spacing.md,
  },
  emptyCreateButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginTop: spacing.sm,
  },
  emptyIconBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.3,
    transform: [{ scale: 1.2 }],
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 28,
  },
  emptySubtitle: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxxl,
    maxWidth: 280,
  },
  emptyButton: {
    borderRadius: 25,
    ...shadows.primary,
    elevation: 8,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: 25,
    gap: spacing.sm,
  },
  emptyButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.3,
  },
  requestsList: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    gap: 12,
  },
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginVertical: 10,
    marginHorizontal: spacing.xs,
    ...shadows.sm,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.badge.background,
    position: 'relative',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  categoryBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
    elevation: 3,
    zIndex: 2,
    borderWidth: 1.5,
    borderColor: colors.badge.background,
  },
  favoriteButtonActive: {
    backgroundColor: colors.white,
    borderColor: colors.status.error,
  },
  requestInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  requestTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 6,
    lineHeight: 26,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cargoType: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
  },
  activeStatusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.badge.background,
  },
  activeStatusText: {
    fontSize: fontSize.xs,
    color: colors.status.success,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
  },
  statusText: {
    fontSize: fontSize.xs,
    color: colors.white,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.status.success,
  },
  bidsCount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
    minHeight: 40,
  },
  routeTimeline: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  routeTimelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  routeTimelineText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: fontWeight.medium,
  },
  routeTimelineConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    paddingVertical: 2,
  },
  routeTimelineLine: {
    width: 2,
    height: spacing.lg,
    backgroundColor: colors.border.light,
    marginRight: 6,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.lg,
    marginHorizontal: -4,
  },
  routeSeparator: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.lg,
    marginHorizontal: -4,
    opacity: 0.8,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  ratingText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  requestMeta: {
    alignItems: 'flex-end',
  },
  weight: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  date: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontSize: fontSize.xs,
    color: colors.white,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    gap: 3,
    alignSelf: 'flex-start',
  },
  categoryChipText: {
    fontSize: fontSize.xs,
    color: colors.white,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  topPriceContainer: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  topPrice: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.status.success,
    textAlign: 'right',
  },
  topBidsCount: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 1,
    textAlign: 'right',
  },
  infoBlock: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  priceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaInfo: {
    alignItems: 'flex-start',
  },
  userInfoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.badge.background,
    paddingTop: spacing.md,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
    marginRight: 10,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  userAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
    marginRight: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitials: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  userDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // FINN.no style vertical cards
  finnStyleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.sm,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.badge.background,
    flex: 1,
  },
  photoSection: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: colors.background,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIconContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heartButtonOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  imageCountText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  priceBadgeOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...shadows.sm,
    elevation: 3,
  },
  priceBadgeText: {
    color: '#212121',
    fontSize: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  cardContentBelow: {
    padding: spacing.sm,
  },
  finnTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  categoryBadgeFinn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.badge.background,
    marginBottom: spacing.xs,
  },
  categoryTextFinn: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusBadgeFinn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusTextFinn: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    textTransform: 'uppercase',
  },
  routeFinn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  routeTextFinn: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginHorizontal: spacing.xs,
    flex: 1,
  },
  distanceTextFinn: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
  },
  metaFinn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaTextFinn: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
  },
  compactRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    marginHorizontal: spacing.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    // iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Android
    elevation: 3,
  },
  cardImageContainer: {
    width: 160,
    height: '100%',
    padding: spacing.sm,
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  cardImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
    backgroundColor: colors.white,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    padding: spacing.lg,
    position: 'relative',
    justifyContent: 'space-between',
  },
  cardTopRightFavorite: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  cardStatusCapsule: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    minWidth: 50,
  },
  cardCategoryCapsule: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    minWidth: 50,
  },
  cardCapsuleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardPrice: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.status.success,
    marginLeft: spacing.sm,
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
    lineHeight: 20,
  },
  cardRoute: {
    flexDirection: 'column',
    marginBottom: spacing.sm,
    paddingRight: 40,
  },
  cardRoutePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1,
  },
  cardRouteArrow: {
    alignSelf: 'flex-start',
    marginLeft: 6,
    marginVertical: 2,
  },
  cardRouteText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: 6,
    flex: 1,
    fontWeight: fontWeight.medium,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: colors.badge.background,
  },
  cardWeight: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  cardPriceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  cardPriceBadgeIcon: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  cardPriceBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  cardMetaText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  compactCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaWithIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTextCompact: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '400',
  },
  statusChipInline: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTextInline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardImageSmall: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 8,
  },
  cardImageThumb: {
    width: '100%',
    height: '100%',
  },
  imageBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  imageCount: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '600',
  },
  cardMainContent: {
    flexDirection: 'row',
    gap: 16,
  },
  cardLeftSection: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cardImageLarge: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.background,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  cardImageLargeFull: {
    width: '100%',
    height: '100%',
  },
  imageBadgeLarge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 2,
  },
  imageCountLarge: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  cardIconPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  categoryEmojiLarge: {
    fontSize: 44,
  },
  categoryBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardRightSection: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routeInlineCompact: {
    flexDirection: 'column',
    marginTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  routePointCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeLocationTextCompact: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  routeArrowWithDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 18,
    marginVertical: 2,
  },
  priceCompactLarge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: -0.5,
  },
  titleRowWithHeart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heartButtonInline: {
    padding: 2,
  },
  categoryBadgeNeutral: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryBadgeTextNeutral: {
    fontSize: 9,
    fontWeight: '600',
    color: '#616161',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  metaSeparatorDot: {
    fontSize: 13,
    color: '#D1D5DB',
    marginHorizontal: 4,
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceCurrencyIcon: {
    fontSize: 16,
  },
  priceTextLarge: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1d1f1eff',
    letterSpacing: -0.4,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusTextLarge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 1000,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Filter Button in Header
  filterButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButtonLabel: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: '#FF7043',
  },
  filterCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF7043',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  // Filter Button Styles (Old - can be removed if not used elsewhere)
  filterButtonContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  filterBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  // Filter Chips
  filterChipsWrapper: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChipsScroll: {
    marginTop: spacing.xs,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  filterChipLabel: {
    fontSize: fontSize.sm,
    color: '#1565C0',
    fontWeight: fontWeight.semibold,
  },
  filterChipValue: {
    fontSize: fontSize.sm,
    color: '#1976D2',
    fontWeight: fontWeight.medium,
  },
  // Bottom Sheet Styles
  bottomSheetBackground: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    padding: spacing.xs,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetScrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  // Sticky Action Bar
  stickyActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  ctaButton: {
    backgroundColor: '#FF7043',
    paddingVertical: 16,
    borderRadius: 12,
    flex: 1,
    marginLeft: spacing.md,
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  filterSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
    marginHorizontal: -spacing.xl,
  },
  // Sorting Options
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 120,
  },
  sortOptionActive: {
    backgroundColor: '#FF7043',
    borderColor: '#FF7043',
    borderWidth: 2,
  },
  sortOptionText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#FFFFFF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  filterSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterOptionActive: {
    backgroundColor: '#FF7043',
    borderColor: '#FF7043',
    borderWidth: 2,
  },
  filterOptionText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
  },
  // Filter List (for cargo type)
  filterListContainer: {
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  filterListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterListItemActive: {
    backgroundColor: 'rgba(255, 152, 0, 0.08)',
  },
  filterListItemText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  filterListItemTextActive: {
    color: '#FF7043',
    fontWeight: fontWeight.semibold,
  },
  // Search Input
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    paddingVertical: 0,
  },
  // Range Inputs
  rangeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rangeInputWrapper: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  rangeInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rangeSeparator: {
    width: 20,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginTop: 20,
  },
  // Date Picker
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  datePickerText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.medium,
  },
  // Footer loader styles for infinite scroll
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  footerEndText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
});
