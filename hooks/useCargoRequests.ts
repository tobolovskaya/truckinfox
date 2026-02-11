import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { db } from '../lib/firebase';
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
import { cacheGet, cacheSet } from '../lib/redis';

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

export function useCargoRequests({ activeTab, filters, sortBy, userId }: UseCargoRequestsOptions) {
  const [requests, setRequests] = useState<CargoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query constraints
      const constraints: QueryConstraint[] = [];

      if (activeTab === 'my') {
        if (!userId) {
          setRequests([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        constraints.push(where('user_id', '==', userId));
      } else {
        // Apply filters
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

      // Apply sorting
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

      // Add limit for pagination
      const INITIAL_LIMIT = 20;
      constraints.push(limit(INITIAL_LIMIT));

      const requestsQuery = query(collection(db, 'cargo_requests'), ...constraints);
      const querySnapshot = await getDocs(requestsQuery);

      // Track last document for pagination
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(querySnapshot.docs.length === INITIAL_LIMIT);

      const data = await Promise.all(
        querySnapshot.docs.map(async docSnapshot => {
          const requestData = docSnapshot.data();

          // Fetch user data
          let userData = { full_name: 'Unknown User', user_type: 'customer', rating: 0 };
          if (requestData.user_id) {
            const userDoc = await getDoc(doc(db, 'users', requestData.user_id));
            if (userDoc.exists()) {
              userData = userDoc.data() as any;
            }
          }

          // Fetch bids
          const bidsQuery = query(
            collection(db, 'bids'),
            where('cargo_request_id', '==', docSnapshot.id)
          );
          const bidsSnapshot = await getDocs(bidsQuery);
          const bids = bidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Check favorites
          let isFavorite = false;
          if (userId) {
            const favoritesQuery = query(
              collection(db, 'user_favorites'),
              where('cargo_request_id', '==', docSnapshot.id),
              where('user_id', '==', userId)
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
          };
        })
      );

      // Apply city filter (post-fetch since Firestore doesn't support OR on different fields easily)
      let filteredData = data;
      if (filters.city && activeTab !== 'my') {
        const cityLower = filters.city.toLowerCase();
        filteredData = data.filter(
          (request: any) =>
            request.from_address?.toLowerCase().includes(cityLower) ||
            request.to_address?.toLowerCase().includes(cityLower)
        );
      }

      console.log(`Successfully loaded ${filteredData.length} requests`);
      setRequests(filteredData as CargoRequest[]);
    } catch (error: any) {
      console.error('Error fetching requests:', error);

      // Set empty requests to show EmptyState instead of error
      setRequests([]);
      setError(error.message);

      // Only show alert if user is actively interacting
      if (error?.message && !error.message.toLowerCase().includes('no rows')) {
        const errorMessage = error.message.includes('fetch')
          ? 'Connection error. Please check your internet connection.'
          : 'Unable to load requests. Please try again.';
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, filters, sortBy, userId]);

  const fetchMoreRequests = useCallback(async () => {
    if (loadingMore || !hasMore || !lastVisible) return;

    setLoadingMore(true);

    try {
      // Build same query constraints as initial fetch
      const constraints: QueryConstraint[] = [];

      if (activeTab === 'my') {
        if (!userId) return;
        constraints.push(where('user_id', '==', userId));
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

      // Apply same sorting
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

      const PAGE_SIZE = 20;
      const nextQuery = query(
        collection(db, 'cargo_requests'),
        ...constraints,
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(nextQuery);

      if (snapshot.empty) {
        setHasMore(false);
        return;
      }

      const newData = await Promise.all(
        snapshot.docs.map(async docSnapshot => {
          const requestData = docSnapshot.data();

          // Fetch user data
          let userData = { full_name: 'Unknown User', user_type: 'customer', rating: 0 };
          if (requestData.user_id) {
            const userDoc = await getDoc(doc(db, 'users', requestData.user_id));
            if (userDoc.exists()) {
              userData = userDoc.data() as any;
            }
          }

          // Fetch bids
          const bidsQuery = query(
            collection(db, 'bids'),
            where('cargo_request_id', '==', docSnapshot.id)
          );
          const bidsSnapshot = await getDocs(bidsQuery);
          const bids = bidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Check favorites
          let isFavorite = false;
          if (userId) {
            const favoritesQuery = query(
              collection(db, 'user_favorites'),
              where('cargo_request_id', '==', docSnapshot.id),
              where('user_id', '==', userId)
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
          };
        })
      );

      // Apply city filter if needed
      let filteredData = newData;
      if (filters.city && activeTab !== 'my') {
        const cityLower = filters.city.toLowerCase();
        filteredData = newData.filter(
          (request: any) =>
            request.from_address?.toLowerCase().includes(cityLower) ||
            request.to_address?.toLowerCase().includes(cityLower)
        );
      }

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setRequests(prev => [...prev, ...(filteredData as CargoRequest[])]);

      console.log(`Loaded ${filteredData.length} more requests`);
    } catch (error: any) {
      console.error('Error fetching more requests:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastVisible, activeTab, filters, sortBy, userId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    setLastVisible(null);
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters, sortBy, userId]);

  return {
    requests,
    setRequests,
    loading,
    refreshing,
    error,
    refresh,
    fetchRequests,
    fetchMoreRequests,
    loadingMore,
    hasMore,
  };
}
