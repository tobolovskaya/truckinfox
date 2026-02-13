import { useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
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
  bids: any[];
  is_favorite?: boolean;
  user_favorites?: { id: string; user_id: string }[];
  images?: string[];
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
  userId?: string;
}

interface CargoRequestsPage {
  items: CargoRequest[];
  lastVisible: DocumentSnapshot | null;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const buildConstraints = (options: UseCargoRequestsOptions) => {
  const { activeTab, filters, sortBy, userId } = options;
  const constraints: QueryConstraint[] = [];

  if (activeTab === 'my') {
    if (userId) {
      constraints.push(where('user_id', '==', userId));
    }
  } else {
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

const fetchCargoRequestsPage = async (
  options: UseCargoRequestsOptions,
  lastVisible: DocumentSnapshot | null
): Promise<CargoRequestsPage> => {
  if (options.activeTab === 'my' && !options.userId) {
    return { items: [], lastVisible: null, hasMore: false };
  }

  const constraints = buildConstraints(options);
  const pagingConstraints = lastVisible ? [startAfter(lastVisible)] : [];

  const requestsQuery = query(
    collection(db, 'cargo_requests'),
    ...constraints,
    ...pagingConstraints,
    limit(PAGE_SIZE)
  );

  const querySnapshot = await getDocs(requestsQuery);
  const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] ?? null;
  const hasMore = querySnapshot.docs.length === PAGE_SIZE;

  const data = await Promise.all(
    querySnapshot.docs.map(async docSnapshot => {
      const requestData = docSnapshot.data();

      let userData = { full_name: 'Unknown User', user_type: 'customer', rating: 0 };
      if (requestData.user_id) {
        const userDoc = await getDoc(doc(db, 'users', requestData.user_id));
        if (userDoc.exists()) {
          userData = userDoc.data() as any;
        }
      }

      const bidsQuery = query(
        collection(db, 'bids'),
        where('cargo_request_id', '==', docSnapshot.id)
      );
      const bidsSnapshot = await getDocs(bidsQuery);
      const bids = bidsSnapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));

      let isFavorite = false;
      if (options.userId) {
        const favoritesQuery = query(
          collection(db, 'user_favorites'),
          where('cargo_request_id', '==', docSnapshot.id),
          where('user_id', '==', options.userId)
        );
        const favoritesSnapshot = await getDocs(favoritesQuery);
        isFavorite = !favoritesSnapshot.empty;
      }

      return {
        id: docSnapshot.id,
        ...requestData,
        users: userData,
        bids,
        is_favorite: isFavorite,
      } as CargoRequest;
    })
  );

  let filteredData = data;
  if (options.filters.city && options.activeTab !== 'my') {
    const cityLower = options.filters.city.toLowerCase();
    filteredData = data.filter(
      request =>
        request.from_address?.toLowerCase().includes(cityLower) ||
        request.to_address?.toLowerCase().includes(cityLower)
    );
  }

  return { items: filteredData, lastVisible: lastDoc, hasMore };
};

export function useCargoRequests({ activeTab, filters, sortBy, userId }: UseCargoRequestsOptions) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['cargoRequests', activeTab, filters, sortBy, userId],
    [activeTab, filters, sortBy, userId]
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
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchCargoRequestsPage({ activeTab, filters, sortBy, userId }, pageParam ?? null),
    initialPageParam: null,
    getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.lastVisible : undefined),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const requests = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);

  const setRequests = useCallback(
    (updater: CargoRequest[] | ((prev: CargoRequest[]) => CargoRequest[])) => {
      queryClient.setQueryData(queryKey, (oldData: any) => {
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

    const message = error instanceof Error ? error.message : 'Unable to load requests.';
    const errorMessage = message.toLowerCase().includes('fetch')
      ? 'Connection error. Please check your internet connection.'
      : 'Unable to load requests. Please try again.';

    Alert.alert('Error', errorMessage);
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
