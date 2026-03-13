import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Order {
  id: string;
  request_id: string | null;
  customer_id: string;
  carrier_id: string;
  bid_id: string | null;
  status: 'pending_payment' | 'paid' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'refunded' | 'cancelled';
  payment_status: string;
  total_amount: number;
  carrier_amount: number;
  platform_fee: number;
  currency: string;
  created_at: string;
  updated_at: string;
  cargo_request?: {
    title: string;
    from_address: string;
    to_address: string;
    pickup_date: string;
    delivery_date: string;
  };
  customer?: { id: string; full_name: string; rating: number };
  carrier?: { id: string; full_name: string; rating: number };
}

const ORDER_SELECT = `
  *,
  cargo_request:cargo_requests(title, from_address, to_address, pickup_date, delivery_date),
  customer:profiles!customer_id(id, full_name, rating),
  carrier:profiles!carrier_id(id, full_name, rating)
`.trim();

/** Hook: all orders for the current user (as customer or carrier) */
export function useMyOrders(role: 'customer' | 'carrier') {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const column = role === 'customer' ? 'customer_id' : 'carrier_id';

  const query = useQuery({
    queryKey: ['orders', 'my', role, uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq(column, uid!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as unknown as Order[];
    },
    enabled: Boolean(uid),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`orders:${role}:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `${column}=eq.${uid}` },
        () => { queryClient.invalidateQueries({ queryKey: ['orders', 'my', role, uid] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [uid, role, column, queryClient]);

  return {
    orders: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Hook: a single order with realtime status updates */
export function useOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('id', orderId!)
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as Order;
    },
    enabled: Boolean(orderId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['orders', orderId] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [orderId, queryClient]);

  return {
    order: query.data ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Update an order's status via Edge Function (enforces role-based transition rules). */
export async function updateOrderStatus(
  orderId: string,
  newStatus: Order['status']
): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.functions.invoke('update-order-status', {
    body: { orderId, newStatus },
  });

  if (error) return { error: new Error(error.message) };
  if (data?.error) return { error: new Error(data.error) };
  return { error: null };
}
