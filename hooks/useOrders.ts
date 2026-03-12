import { useState, useEffect, useCallback } from 'react';
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

/** Hook: all orders for the current user (as customer or carrier) */
export function useMyOrders(role: 'customer' | 'carrier') {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const column = role === 'customer' ? 'customer_id' : 'carrier_id';

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(
        `*, cargo_request:cargo_requests(title, from_address, to_address, pickup_date, delivery_date),
         customer:profiles!customer_id(id, full_name, rating),
         carrier:profiles!carrier_id(id, full_name, rating)`
      )
      .eq(column, user.uid)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      setOrders((data || []) as Order[]);
    }
    setLoading(false);
  }, [user?.uid, role]);

  useEffect(() => {
    loadOrders();

    if (!user?.uid) return;

    const column = role === 'customer' ? 'customer_id' : 'carrier_id';
    const channel = supabase
      .channel(`orders:${role}:${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `${column}=eq.${user.uid}`,
        },
        () => { loadOrders(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user?.uid, role, loadOrders]);

  return { orders, loading, error, refetch: loadOrders };
}

/** Hook: a single order with realtime status updates */
export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(
        `*, cargo_request:cargo_requests(title, from_address, to_address, pickup_date, delivery_date),
         customer:profiles!customer_id(id, full_name, rating),
         carrier:profiles!carrier_id(id, full_name, rating)`
      )
      .eq('id', orderId)
      .single();

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      setOrder(data as Order);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    loadOrder();

    if (!orderId) return;

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => { loadOrder(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [orderId, loadOrder]);

  return { order, loading, error, refetch: loadOrder };
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
