import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired' | 'countered';
  expires_at: string;
  counter_price: number | null;
  counter_note: string | null;
  countered_at: string | null;
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
  return { data: data as unknown as Bid, error: null };
}

/**
 * Customer sends a counter-offer on a pending bid.
 * Sets status → 'countered', stores counter_price and optional note.
 */
export async function counterBid(
  bidId: string,
  counterPrice: number,
  counterNote?: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('bids')
    .update({
      status: 'countered',
      counter_price: counterPrice,
      counter_note: counterNote ?? null,
      countered_at: new Date().toISOString(),
    })
    .eq('id', bidId)
    .eq('status', 'pending');

  return { error: error ? new Error(error.message) : null };
}

/**
 * Carrier accepts the customer's counter-offer.
 * Applies counter_price → price, resets status back to 'pending' so the customer can accept.
 */
export async function acceptCounter(
  bidId: string,
  counterPrice: number
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('bids')
    .update({
      status: 'pending',
      price: counterPrice,
      counter_price: null,
      counter_note: null,
      countered_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bidId)
    .eq('status', 'countered');

  return { error: error ? new Error(error.message) : null };
}

/**
 * Carrier declines the counter-offer.
 * Reverts status to 'pending' — original price stands.
 */
export async function declineCounter(
  bidId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('bids')
    .update({
      status: 'pending',
      counter_price: null,
      counter_note: null,
      countered_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bidId)
    .eq('status', 'countered');

  return { error: error ? new Error(error.message) : null };
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
  const uid = user?.uid;

  const query = useQuery({
    queryKey: ['bids', 'my', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*, cargo_requests(title, from_address, to_address)')
        .eq('carrier_id', uid!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as unknown as Bid[];
    },
    enabled: Boolean(uid),
    staleTime: 30_000,
  });

  return {
    bids: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Hook: all bids for a specific cargo request, with realtime updates */
export function useBidsForRequest(requestId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['bids', 'request', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*, carrier:profiles!carrier_id(id, full_name, rating, is_verified)')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as unknown as Bid[];
    },
    enabled: Boolean(requestId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`bids:${requestId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids', filter: `request_id=eq.${requestId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['bids', 'request', requestId] }); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [requestId, queryClient]);

  return {
    bids: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
