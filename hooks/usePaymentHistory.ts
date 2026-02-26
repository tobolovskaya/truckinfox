import { useCallback, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
  nextOffset: number;
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
  const hasLoggedQueryWarning = useRef(false);

  const queryKey: PaymentHistoryQueryKey = useMemo(
    () => ['paymentHistory', `user:${userId},filter:${statusFilter || 'all'}`],
    [userId, statusFilter]
  );

  const fetchPaymentHistory = useCallback(
    async (pageParam = 0): Promise<PaymentHistoryPage> => {
      try {
        const pageSize = 20;
        const from = pageParam;
        const to = pageParam + pageSize - 1;

        let dbQuery = supabase
          .from('payments')
          .select(
            'id,user_id,order_id,amount,currency,status,payment_method,description,invoice_url,reference_id,created_at,updated_at,order:orders(cargo_requests(title))'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (statusFilter) {
          dbQuery = dbQuery.eq('status', statusFilter);
        }

        const { data, error } = await dbQuery;

        if (error) {
          throw error;
        }

        const items = (data || []).map(payment => {
          const paymentRow = payment as any;
          const orderNode = paymentRow.order;
          const orderEntry = Array.isArray(orderNode) ? orderNode[0] : orderNode;
          const cargoNode = orderEntry?.cargo_requests;
          const cargoEntry = Array.isArray(cargoNode) ? cargoNode[0] : cargoNode;

          return {
          id: payment.id,
          user_id: payment.user_id,
          order_id: payment.order_id,
          amount: Number(payment.amount || 0),
          currency: payment.currency,
          status: payment.status,
          payment_method: payment.payment_method,
          description: payment.description || undefined,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
          invoice_url: payment.invoice_url || undefined,
          reference_id: payment.reference_id || undefined,
          order_title: cargoEntry?.title || undefined,
          };
        }) as PaymentRecord[];

        return {
          items,
          nextOffset: pageParam + items.length,
          hasMore: items.length === pageSize,
        };
      } catch (error: unknown) {
        if (!hasLoggedQueryWarning.current) {
          console.warn('Payment history query failed', error);
          hasLoggedQueryWarning.current = true;
        }

        console.error('Error fetching payment history:', error);
        if (error instanceof PostgrestError) {
          throw new Error(
            error.code === '42501'
              ? i18n.t('permissionDenied')
              : i18n.t('errorLoadingPayments')
          );
        }
        throw error;
      }
    },
    [statusFilter, userId]
  );

  const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery<PaymentHistoryPage, Error>({
      queryKey,
      queryFn: ({ pageParam }) => fetchPaymentHistory(pageParam as number),
      enabled: Boolean(userId),
      initialPageParam: 0,
      getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.nextOffset : undefined),
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
