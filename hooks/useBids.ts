import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Bid {
  id: string;
  request_id: string;
  carrier_id: string;
  price: number;
  note: string | null;
  currency: string;
  estimated_days: number | null;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  updated_at: string;
  carrier?: {
    id: string;
    full_name: string;
    rating: number;
    is_verified: boolean;
  };
}

/** Place a new bid on a cargo request */
export async function placeBid(
  cargoRequestId: string,
  carrierId: string,
  amount: number,
  message: string
): Promise<{ data: Bid | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('bids')
    .insert({
      request_id: cargoRequestId,
      carrier_id: carrierId,
      price: amount,
      note: message,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Bid, error: null };
}

/** Withdraw a bid (only carrier's own bid) */
export async function withdrawBid(bidId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('bids')
    .update({ status: 'withdrawn' })
    .eq('id', bidId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Accept a bid atomically via Edge Function.
 * The server-side function rejects all other pending bids, accepts this one,
 * updates the cargo request status, and creates the order — all in one operation.
 * Returns the created orderId on success.
 */
export async function acceptBid(
  bidId: string
): Promise<{ orderId: string | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke('accept-bid', {
    body: { bidId },
  });

  if (error) return { orderId: null, error: new Error(error.message) };

  if (data?.error) return { orderId: null, error: new Error(data.error) };

  return { orderId: (data?.orderId as string) ?? null, error: null };
}

/** Hook: carrier's own bid history */
export function useMyBids() {
  const { user } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('bids')
      .select('*, cargo_requests(title, from_address, to_address)')
      .eq('carrier_id', user.uid)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      setBids((data || []) as Bid[]);
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { bids, loading, error, refetch: fetch };
}

/** Hook: all bids for a specific cargo request, with realtime updates */
export function useBidsForRequest(requestId: string | undefined) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadBids = useCallback(async () => {
    if (!requestId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('bids')
      .select(
        '*, carrier:profiles!carrier_id(id, full_name, rating, is_verified)'
      )
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      setBids((data || []) as Bid[]);
    }
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    loadBids();

    if (!requestId) return;

    const channel = supabase
      .channel(`bids:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids',
          filter: `request_id=eq.${requestId}`,
        },
        () => { loadBids(); }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [requestId, loadBids]);

  return { bids, loading, error, refetch: loadBids };
}
