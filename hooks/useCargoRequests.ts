import { useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { i18n } from '../lib/i18n';
import { normalizeSearchQuery } from '../utils/search';
import { normalizeCargoImageInputs, resolveCargoImageUrls } from '../utils/cargoImages';

export interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions?: string;
  from_address: string;
  to_address: string;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  price_type: string;
  status: string;
  created_at: string;
  user_id: string;
  customer_id?: string;
  weight_kg?: number;
  distance?: number;
  users: {
    full_name: string;
    user_type: string;
    rating: number;
    avatar_url?: string;
  };
  bids: Bid[];
  is_favorite?: boolean;
  user_favorites?: { id: string; user_id: string }[];
  images?: string[];
}

export interface Bid {
  id: string;
  [key: string]: unknown;
}

export interface FilterState {
  city: string;
  cargo_type: string;
  price_min: string;
  price_max: string;
  price_type: string;
}

export type SortOption = 'newest' | 'oldest' | 'priceLowToHigh' | 'priceHighToLow' | 'date';

interface UseCargoRequestsOptions {
  activeTab: 'all' | 'my';
  filters: FilterState;
  sortBy: SortOption;
  searchQuery?: string;
  userId?: string;
  countryCode?: string;
}

interface CargoRequestsPage {
  items: CargoRequest[];
  nextOffset: number | null;
  hasMore: boolean;
}

type CargoRequestsQueryKey = [
  'cargoRequests',
  UseCargoRequestsOptions['activeTab'],
  FilterState,
  SortOption,
  string,
  string | undefined,
  string | undefined,
];

const PAGE_SIZE = 20;
const ACTIVE_REQUEST_STATUSES = ['open', 'bidding'] as const;

type HydratedProfile = {
  full_name?: string | null;
  user_type?: string | null;
  rating?: number | null;
  avatar_url?: string | null;
};

type CargoRequestHydrationData = {
  profilesById: Map<string, HydratedProfile>;
  bidsByRequestId: Map<string, Bid[]>;
  favoriteRequestIds: Set<string>;
};

const toTimestamp = (value?: string): number => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toNumber = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value;
};

const sortRequestsClientSide = (requests: CargoRequest[], sortBy: SortOption): CargoRequest[] => {
  const sorted = [...requests];

  switch (sortBy) {
    case 'oldest':
      sorted.sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at));
      break;
    case 'priceLowToHigh':
      sorted.sort((a, b) => toNumber(a.price) - toNumber(b.price));
      break;
    case 'priceHighToLow':
      sorted.sort((a, b) => toNumber(b.price) - toNumber(a.price));
      break;
    case 'date':
      sorted.sort((a, b) => toTimestamp(a.pickup_date) - toTimestamp(b.pickup_date));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
      break;
  }

  return sorted;
};

const applyClientSideFilters = (
  requests: CargoRequest[],
  options: UseCargoRequestsOptions
): CargoRequest[] => {
  const { activeTab, filters, searchQuery, sortBy, userId } = options;
  const normalizedSearchQuery = searchQuery?.trim() ? normalizeSearchQuery(searchQuery) : '';

  let filtered = [...requests];

  if (activeTab === 'my') {
    filtered = filtered.filter(request => {
      const ownerId = request.customer_id || request.user_id;
      return ownerId === userId && ACTIVE_REQUEST_STATUSES.includes(request.status as (typeof ACTIVE_REQUEST_STATUSES)[number]);
    });
  } else {
    if (filters.cargo_type) {
      filtered = filtered.filter(request => request.cargo_type === filters.cargo_type);
    }
    if (filters.price_type) {
      filtered = filtered.filter(request => request.price_type === filters.price_type);
    }
    if (filters.price_min && !Number.isNaN(parseFloat(filters.price_min))) {
      const min = parseFloat(filters.price_min);
      filtered = filtered.filter(request => toNumber(request.price) >= min);
    }
    if (filters.price_max && !Number.isNaN(parseFloat(filters.price_max))) {
      const max = parseFloat(filters.price_max);
      filtered = filtered.filter(request => toNumber(request.price) <= max);
    }
  }

  if (filters.city && activeTab !== 'my') {
    const cityLower = filters.city.toLowerCase();
    filtered = filtered.filter(
      request =>
        request.from_address?.toLowerCase().includes(cityLower) ||
        request.to_address?.toLowerCase().includes(cityLower)
    );
  }

  if (normalizedSearchQuery) {
    filtered = filtered.filter(request => {
      const haystack = [
        request.title,
        request.description,
        request.cargo_type,
        request.from_address,
        request.to_address,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearchQuery.toLowerCase());
    });
  }

  return sortRequestsClientSide(filtered, sortBy);
};

const fetchCargoRequestHydrationData = async (
  requestRows: Record<string, unknown>[],
  userId?: string
): Promise<CargoRequestHydrationData> => {
  const profilesById = new Map<string, HydratedProfile>();
  const bidsByRequestId = new Map<string, Bid[]>();
  const favoriteRequestIds = new Set<string>();

  if (requestRows.length === 0) {
    return { profilesById, bidsByRequestId, favoriteRequestIds };
  }

  const requestIds = Array.from(
    new Set(
      requestRows
        .map(row => row.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );

  const ownerIds = Array.from(
    new Set(
      requestRows
        .map(row => {
          if (typeof row.customer_id === 'string' && row.customer_id.length > 0) {
            return row.customer_id;
          }
          if (typeof row.user_id === 'string' && row.user_id.length > 0) {
            return row.user_id;
          }
          return null;
        })
        .filter((value): value is string => typeof value === 'string')
    )
  );

  if (ownerIds.length > 0) {
    try {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, rating, avatar_url')
        .in('id', ownerIds);

      (profileRows || []).forEach(profile => {
        if (typeof profile.id === 'string') {
          profilesById.set(profile.id, {
            full_name: profile.full_name,
            user_type: profile.user_type,
            rating: profile.rating,
            avatar_url: profile.avatar_url,
          });
        }
      });
    } catch (error) {
      console.warn('Failed to batch hydrate request owner profiles', error);
    }
  }

  if (requestIds.length > 0) {
    try {
      const { data: bidRows } = await supabase.from('bids').select('*').in('request_id', requestIds);
      (bidRows || []).forEach(row => {
        if (typeof row.request_id !== 'string' || typeof row.id !== 'string') {
          return;
        }
        const existing = bidsByRequestId.get(row.request_id) || [];
        existing.push({ id: row.id, ...row });
        bidsByRequestId.set(row.request_id, existing);
      });
    } catch (error) {
      console.warn('Failed to batch hydrate request bids', error);
    }
  }

  if (userId && requestIds.length > 0) {
    try {
      const { data: favoriteRows } = await supabase
        .from('user_favorites')
        .select('request_id')
        .eq('user_id', userId)
        .in('request_id', requestIds);

      (favoriteRows || []).forEach(row => {
        if (typeof row.request_id === 'string') {
          favoriteRequestIds.add(row.request_id);
        }
      });
    } catch (error) {
      console.warn('Failed to batch hydrate request favorite status', error);
    }
  }

  return { profilesById, bidsByRequestId, favoriteRequestIds };
};

const hydrateCargoRequest = async (
  requestData: Record<string, unknown>,
  hydrationData: CargoRequestHydrationData
): Promise<CargoRequest | null> => {
  const requestId = typeof requestData.id === 'string' ? requestData.id : undefined;
  if (!requestId) {
    return null;
  }

  const requestUserId =
    typeof requestData.customer_id === 'string'
      ? requestData.customer_id
      : typeof requestData.user_id === 'string'
        ? requestData.user_id
        : undefined;

  let userData: CargoRequest['users'] = {
    full_name: 'Unknown User',
    user_type: 'customer',
    rating: 0,
  };

  if (requestUserId) {
    const userRow = hydrationData.profilesById.get(requestUserId);
    if (userRow) {
      userData = {
        full_name: userRow.full_name || 'Unknown User',
        user_type: userRow.user_type || 'customer',
        rating: typeof userRow.rating === 'number' ? userRow.rating : 0,
        avatar_url: userRow.avatar_url || undefined,
      };
    }
  }

  const bids = hydrationData.bidsByRequestId.get(requestId) || [];
  const isFavorite = hydrationData.favoriteRequestIds.has(requestId);

  const normalizedImages = normalizeCargoImageInputs(requestData.images, requestData.image_url);
  const resolvedPreviewImages = await resolveCargoImageUrls(normalizedImages, 1);

  return {
    ...(requestData as unknown as CargoRequest),
    id: requestId,
    weight: (() => {
      const normalizedWeight =
        typeof requestData.weight_kg === 'number'
          ? requestData.weight_kg
          : typeof requestData.weight_kg === 'string'
            ? Number(requestData.weight_kg)
            : typeof requestData.weight === 'number'
              ? requestData.weight
              : typeof requestData.weight === 'string'
                ? Number(requestData.weight)
                : 0;
      return Number.isFinite(normalizedWeight) ? normalizedWeight : 0;
    })(),
    user_id: requestUserId || '',
    customer_id: typeof requestData.customer_id === 'string' ? requestData.customer_id : undefined,
    weight_kg:
      typeof requestData.weight_kg === 'number'
        ? requestData.weight_kg
        : typeof requestData.weight_kg === 'string'
          ? Number(requestData.weight_kg)
          : undefined,
    users: userData,
    bids,
    is_favorite: isFavorite,
    images: resolvedPreviewImages.length > 0 ? resolvedPreviewImages : normalizedImages,
  } as CargoRequest;
};

const fetchCargoRequestsPage = async (
  options: UseCargoRequestsOptions,
  offset: number
): Promise<CargoRequestsPage> => {
  if (options.activeTab === 'my' && !options.userId) {
    return { items: [], nextOffset: null, hasMore: false };
  }

  let requestQuery = supabase
    .from('cargo_requests')
    .select('*')
    .range(offset, offset + PAGE_SIZE - 1);

  if (options.activeTab === 'my' && options.userId) {
    requestQuery = requestQuery
      .eq('customer_id', options.userId)
      .in('status', [...ACTIVE_REQUEST_STATUSES]);
  } else {
    if (options.countryCode) {
      requestQuery = requestQuery.eq('country_code', options.countryCode);
    }
    if (options.filters.cargo_type) {
      requestQuery = requestQuery.eq('cargo_type', options.filters.cargo_type);
    }
    if (options.filters.price_type) {
      requestQuery = requestQuery.eq('price_type', options.filters.price_type);
    }
    if (options.filters.price_min && !Number.isNaN(parseFloat(options.filters.price_min))) {
      requestQuery = requestQuery.gte('price', parseFloat(options.filters.price_min));
    }
    if (options.filters.price_max && !Number.isNaN(parseFloat(options.filters.price_max))) {
      requestQuery = requestQuery.lte('price', parseFloat(options.filters.price_max));
    }
  }

  switch (options.sortBy) {
    case 'oldest':
      requestQuery = requestQuery.order('created_at', { ascending: true });
      break;
    case 'priceLowToHigh':
      requestQuery = requestQuery.order('price', { ascending: true });
      break;
    case 'priceHighToLow':
      requestQuery = requestQuery.order('price', { ascending: false });
      break;
    case 'date':
      requestQuery = requestQuery.order('pickup_date', { ascending: true });
      break;
    case 'newest':
    default:
      requestQuery = requestQuery.order('created_at', { ascending: false });
      break;
  }

  const { data: requestRows, error } = await requestQuery;
  if (error) {
    throw error;
  }

  const rows = (requestRows || []) as Record<string, unknown>[];
  const hydrationData = await fetchCargoRequestHydrationData(rows, options.userId);

  const hydrated = await Promise.all(
    rows.map(row => hydrateCargoRequest(row, hydrationData))
  );

  const data = hydrated.filter((request): request is CargoRequest => request !== null);
  const filteredData = applyClientSideFilters(data, options);

  const hasMore = rows.length === PAGE_SIZE;
  const nextOffset = hasMore ? offset + PAGE_SIZE : null;

  return { items: filteredData, nextOffset, hasMore };
};

export function useCargoRequests({
  activeTab,
  filters,
  sortBy,
  searchQuery = '',
  userId,
  countryCode,
}: UseCargoRequestsOptions) {
  const queryClient = useQueryClient();
  const normalizedCountryCode = countryCode?.toUpperCase() || undefined;

  const queryKey = useMemo<CargoRequestsQueryKey>(
    () => ['cargoRequests', activeTab, filters, sortBy, searchQuery, userId, normalizedCountryCode],
    [activeTab, filters, sortBy, searchQuery, userId, normalizedCountryCode]
  );

  const {
    data,
    error,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<
    CargoRequestsPage,
    Error,
    InfiniteData<CargoRequestsPage, number>,
    CargoRequestsQueryKey,
    number
  >({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchCargoRequestsPage(
        {
          activeTab,
          filters,
          sortBy,
          searchQuery,
          userId,
          countryCode: normalizedCountryCode,
        },
        pageParam
      ),
    initialPageParam: 0,
    getNextPageParam: lastPage =>
      lastPage.hasMore && lastPage.nextOffset !== null ? lastPage.nextOffset : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const requests = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);

  const setRequests = useCallback(
    (updater: CargoRequest[] | ((_prev: CargoRequest[]) => CargoRequest[])) => {
      queryClient.setQueryData<InfiniteData<CargoRequestsPage, number>>(queryKey, oldData => {
        if (!oldData?.pages) {
          return oldData;
        }

        const currentItems = oldData.pages.flatMap((page: CargoRequestsPage) => page.items);
        const nextItems = typeof updater === 'function' ? updater(currentItems) : updater;
        const lastPage = oldData.pages[oldData.pages.length - 1] as CargoRequestsPage | undefined;

        const nextPage: CargoRequestsPage = {
          items: nextItems,
          nextOffset: lastPage?.nextOffset ?? null,
          hasMore: lastPage?.hasMore ?? false,
        };

        return {
          ...oldData,
          pages: [nextPage],
          pageParams: oldData.pageParams.slice(0, 1),
        };
      });
    },
    [queryClient, queryKey]
  );

  const fetchMoreRequests = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    await fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const message = error instanceof Error ? error.message : i18n.t('unableToLoadRequests');
    const errorMessage = message.toLowerCase().includes('fetch')
      ? i18n.t('connectionErrorCheckInternet')
      : i18n.t('unableToLoadRequestsTryAgain');

    Alert.alert(i18n.t('error'), errorMessage);
  }, [error]);

  useEffect(() => {
    const realtimeFilter =
      activeTab === 'all'
        ? normalizedCountryCode
          ? `country_code=eq.${normalizedCountryCode}`
          : undefined
        : activeTab === 'my' && userId
          ? `customer_id=eq.${userId}`
          : undefined;

    const channel = supabase
      .channel(`cargo_requests:home:${activeTab}:${normalizedCountryCode || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cargo_requests',
          filter: realtimeFilter,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [activeTab, normalizedCountryCode, queryClient, queryKey, userId]);

  return {
    requests,
    setRequests,
    loading: isLoading,
    refreshing: isRefetching,
    error: error instanceof Error ? error.message : null,
    refresh,
    fetchRequests: refetch,
    fetchMoreRequests,
    loadingMore: isFetchingNextPage,
    hasMore: Boolean(hasNextPage),
  };
}
