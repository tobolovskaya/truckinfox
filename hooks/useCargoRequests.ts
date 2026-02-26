import { useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
  doc,
  getDoc,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { i18n } from '../lib/i18n';
import { normalizeSearchQuery } from '../utils/search';

export interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions?: string;
  from_address: string;
  to_address: string;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  price_type: string;
  status: string;
  created_at: string;
  user_id: string;
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
}

interface CargoRequestsPage {
  items: CargoRequest[];
  lastVisible: DocumentSnapshot | null;
  hasMore: boolean;
}

type CargoRequestsQueryKey = [
  'cargoRequests',
  UseCargoRequestsOptions['activeTab'],
  FilterState,
  SortOption,
  string,
  string | undefined
];

const PAGE_SIZE = 20;

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
    filtered = filtered.filter(request => request.user_id === userId && request.status === 'active');
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
      const terms = Array.isArray((request as { search_terms?: unknown }).search_terms)
        ? ((request as { search_terms?: string[] }).search_terms ?? [])
        : [];
      return terms.includes(normalizedSearchQuery);
    });
  }

  return sortRequestsClientSide(filtered, sortBy);
};

const buildConstraints = (options: UseCargoRequestsOptions) => {
  const { activeTab, filters, sortBy, searchQuery, userId } = options;
  const constraints: QueryConstraint[] = [];

  const normalizedSearchQuery = searchQuery?.trim() ? normalizeSearchQuery(searchQuery) : '';
  if (normalizedSearchQuery) {
    constraints.push(where('search_terms', 'array-contains', normalizedSearchQuery));
  }

  // Tab-specific constraints
  if (activeTab === 'my') {
    // My tab: only show current user's requests that are active
    if (userId) {
      constraints.push(where('user_id', '==', userId));
      constraints.push(where('status', '==', 'active')); // Only active requests for "My" tab
    }
    // Note: City filter is ignored for "My" tab since it shows user's own requests only
  } else {
    // All tab: apply cargo type and price filters
    if (filters.cargo_type) {
      constraints.push(where('cargo_type', '==', filters.cargo_type));
    }
    if (filters.price_type) {
      constraints.push(where('price_type', '==', filters.price_type));
    }
    if (filters.price_min && !isNaN(parseFloat(filters.price_min))) {
      constraints.push(where('price', '>=', parseFloat(filters.price_min)));
    }
    if (filters.price_max && !isNaN(parseFloat(filters.price_max))) {
      constraints.push(where('price', '<=', parseFloat(filters.price_max)));
    }
  }

  switch (sortBy) {
    case 'newest':
      constraints.push(orderBy('created_at', 'desc'));
      break;
    case 'oldest':
      constraints.push(orderBy('created_at', 'asc'));
      break;
    case 'priceLowToHigh':
      constraints.push(orderBy('price', 'asc'));
      break;
    case 'priceHighToLow':
      constraints.push(orderBy('price', 'desc'));
      break;
    case 'date':
      constraints.push(orderBy('pickup_date', 'asc'));
      break;
    default:
      constraints.push(orderBy('created_at', 'desc'));
  }

  return constraints;
};

const hydrateCargoRequest = async (
  docSnapshot: DocumentSnapshot,
  userId?: string
): Promise<CargoRequest | null> => {
  if (!docSnapshot.exists()) {
    return null;
  }

  const requestData = docSnapshot.data();
  const requestUserId = typeof requestData.user_id === 'string' ? requestData.user_id : undefined;

  let userData: CargoRequest['users'] = {
    full_name: 'Unknown User',
    user_type: 'customer',
    rating: 0,
  };

  if (requestUserId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', requestUserId));
      if (userDoc.exists()) {
        const userDocData = userDoc.data() as Partial<CargoRequest['users']>;
        userData = {
          full_name: userDocData.full_name ?? 'Unknown User',
          user_type: userDocData.user_type ?? 'customer',
          rating: typeof userDocData.rating === 'number' ? userDocData.rating : 0,
          avatar_url: userDocData.avatar_url,
        };
      }
    } catch (error) {
      console.warn('Failed to hydrate request owner profile', error);
    }
  }

  let bids: Bid[] = [];
  try {
    const bidsQuery = query(collection(db, 'bids'), where('cargo_request_id', '==', docSnapshot.id));
    const bidsSnapshot = await getDocs(bidsQuery);
    bids = bidsSnapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
  } catch (error) {
    console.warn('Failed to hydrate request bids', error);
  }

  let isFavorite = false;
  if (userId) {
    try {
      const favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('cargo_request_id', '==', docSnapshot.id),
        where('user_id', '==', userId)
      );
      const favoritesSnapshot = await getDocs(favoritesQuery);
      isFavorite = !favoritesSnapshot.empty;
    } catch (error) {
      console.warn('Failed to hydrate request favorite status', error);
    }
  }

  return {
    id: docSnapshot.id,
    ...requestData,
    users: userData,
    bids,
    is_favorite: isFavorite,
  } as CargoRequest;
};

const fetchCargoRequestsPage = async (
  options: UseCargoRequestsOptions,
  lastVisible: DocumentSnapshot | null
): Promise<CargoRequestsPage> => {
  if (options.activeTab === 'my' && !options.userId) {
    return { items: [], lastVisible: null, hasMore: false };
  }

  const constraints = buildConstraints(options);
  const pagingConstraints = lastVisible ? [startAfter(lastVisible)] : [];

  let querySnapshot;
  let usedFallback = false;

  try {
    const requestsQuery = query(
      collection(db, 'cargo_requests'),
      ...constraints,
      ...pagingConstraints,
      limit(PAGE_SIZE)
    );
    querySnapshot = await getDocs(requestsQuery);
  } catch (error: unknown) {
    const canUseFallback =
      error instanceof FirebaseError &&
      (error.code === 'failed-precondition' ||
        (options.activeTab === 'my' && options.userId && error.code === 'permission-denied'));

    if (!canUseFallback) {
      throw error;
    }

    usedFallback = true;
    const fallbackConstraints: QueryConstraint[] = [];

    if (options.activeTab === 'my' && options.userId) {
      fallbackConstraints.push(where('user_id', '==', options.userId));
    }

    fallbackConstraints.push(orderBy('created_at', 'desc'));
    if (lastVisible) {
      fallbackConstraints.push(startAfter(lastVisible));
    }

    const fallbackQuery = query(
      collection(db, 'cargo_requests'),
      ...fallbackConstraints,
      limit(PAGE_SIZE)
    );

    querySnapshot = await getDocs(fallbackQuery);
  }

  const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] ?? null;
  const hasMore = querySnapshot.docs.length === PAGE_SIZE;

  const hydrated = await Promise.all(
    querySnapshot.docs.map(docSnapshot => hydrateCargoRequest(docSnapshot, options.userId))
  );
  const data = hydrated.filter((request): request is CargoRequest => request !== null);

  let filteredData = data;
  if (usedFallback || (options.filters.city && options.activeTab !== 'my')) {
    filteredData = applyClientSideFilters(data, options);
  }

  return { items: filteredData, lastVisible: lastDoc, hasMore };
};

export function useCargoRequests({
  activeTab,
  filters,
  sortBy,
  searchQuery = '',
  userId,
}: UseCargoRequestsOptions) {
  const queryClient = useQueryClient();

  // Query key includes activeTab to ensure All/My tabs have separate cache
  // This allows seamless switching without data reflow
  const queryKey = useMemo<CargoRequestsQueryKey>(
    () => ['cargoRequests', activeTab, filters, sortBy, searchQuery, userId],
    [activeTab, filters, sortBy, searchQuery, userId]
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
    InfiniteData<CargoRequestsPage, DocumentSnapshot | null>,
    CargoRequestsQueryKey,
    DocumentSnapshot | null
  >({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchCargoRequestsPage({ activeTab, filters, sortBy, searchQuery, userId }, pageParam),
    initialPageParam: null,
    getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.lastVisible : undefined),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const requests = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);

  const setRequests = useCallback(
    (updater: CargoRequest[] | ((_prev: CargoRequest[]) => CargoRequest[])) => {
      queryClient.setQueryData<InfiniteData<CargoRequestsPage, DocumentSnapshot | null>>(
        queryKey,
        oldData => {
          if (!oldData?.pages) {
            return oldData;
          }

          const currentItems = oldData.pages.flatMap((page: CargoRequestsPage) => page.items);
          const nextItems = typeof updater === 'function' ? updater(currentItems) : updater;
          const lastPage = oldData.pages[oldData.pages.length - 1] as CargoRequestsPage | undefined;

          const nextPage: CargoRequestsPage = {
            items: nextItems,
            lastVisible: lastPage?.lastVisible ?? null,
            hasMore: lastPage?.hasMore ?? false,
          };

          return {
            ...oldData,
            pages: [nextPage],
            pageParams: oldData.pageParams.slice(0, 1),
          };
        }
      );
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
