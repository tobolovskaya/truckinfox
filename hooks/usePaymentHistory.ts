import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { i18n } from '../lib/i18n';

export interface PaymentRecord {
  id: string;
  user_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  description?: string;
  created_at: string;
  updated_at: string;
  invoice_url?: string;
  reference_id?: string;
  order_title?: string;
}

interface PaymentHistoryPage {
  items: PaymentRecord[];
  lastVisible: DocumentSnapshot | null;
  hasMore: boolean;
}

type PaymentHistoryQueryKey = [string, string];

interface UsePaymentHistoryOptions {
  userId: string;
  statusFilter?: PaymentRecord['status'];
}

/**
 * Hook for fetching paginated payment history for authenticated user
 * @param userId - Current user ID
 * @param statusFilter - Optional status filter (pending, completed, failed, refunded)
 */
export const usePaymentHistory = ({ userId, statusFilter }: UsePaymentHistoryOptions) => {
  const queryClient = useQueryClient();

  const buildConstraints = useCallback((): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [where('user_id', '==', userId)];

    if (statusFilter) {
      constraints.push(where('status', '==', statusFilter));
    }

    constraints.push(orderBy('created_at', 'desc'));

    return constraints;
  }, [userId, statusFilter]);

  const queryKey: PaymentHistoryQueryKey = useMemo(
    () => ['paymentHistory', `user:${userId},filter:${statusFilter || 'all'}`],
    [userId, statusFilter]
  );

  const fetchPaymentHistory = useCallback(
    async (pageParam?: DocumentSnapshot): Promise<PaymentHistoryPage> => {
      try {
        const constraints = buildConstraints();

        if (pageParam) {
          constraints.push(startAfter(pageParam));
        }

        constraints.push(limit(20));

        const collectionRef = collection(db, 'payments');
        const q = query(collectionRef, ...constraints);

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as PaymentRecord[];

        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

        return {
          items,
          lastVisible: lastDoc || null,
          hasMore: items.length === 20,
        };
      } catch (error) {
        console.error('Error fetching payment history:', error);
        if (error instanceof FirebaseError) {
          throw new Error(
            error.code === 'permission-denied'
              ? i18n.t('permissionDenied')
              : i18n.t('errorLoadingPayments')
          );
        }
        throw error;
      }
    },
    [buildConstraints]
  );

  const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery<PaymentHistoryPage, Error>({
      queryKey,
      queryFn: ({ pageParam }) => fetchPaymentHistory(pageParam as DocumentSnapshot | undefined),
      initialPageParam: undefined,
      getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.lastVisible : undefined),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  const allPayments = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);

  const stats = useMemo(
    () => ({
      totalAmount: allPayments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0),
      totalCount: allPayments.length,
      completedCount: allPayments.filter(p => p.status === 'completed').length,
      failedCount: allPayments.filter(p => p.status === 'failed').length,
    }),
    [allPayments]
  );

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    return refetch();
  }, [queryClient, queryKey, refetch]);

  return {
    payments: allPayments,
    stats,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch: handleRefresh,
  };
};
