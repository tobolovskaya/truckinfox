import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
  };
}

/** Submit a review for a completed order */
export async function submitReview(
  orderId: string,
  reviewerId: string,
  revieweeId: string,
  rating: number,
  comment: string
): Promise<{ error: Error | null }> {
  const { error: insertError } = await supabase.from('reviews').insert({
    order_id: orderId,
    reviewer_id: reviewerId,
    reviewed_id: revieweeId,
    rating,
    comment,
  });

  if (insertError) return { error: new Error(insertError.message) };

  // profiles.rating and rating_count are maintained by the DB trigger
  // trg_sync_profile_rating — no client-side computation needed.

  return { error: null };
}

/** Hook: all reviews for a specific user */
export function useReviewsForUser(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['reviews', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviewer_id(id, full_name)')
        .eq('reviewed_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as unknown as Review[];
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const reviews = query.data ?? [];
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return Math.round(avg * 10) / 10;
  }, [reviews]);

  return {
    reviews,
    loading: query.isLoading,
    error: query.error as Error | null,
    averageRating,
    refetch: query.refetch,
  };
}

/** Hook: check if current user has reviewed a specific order */
export function useHasReviewed(orderId: string | undefined) {
  const { user } = useAuth();
  const uid = user?.uid;

  const query = useQuery({
    queryKey: ['reviews', 'hasReviewed', orderId, uid],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', orderId!)
        .eq('reviewer_id', uid!)
        .maybeSingle();
      return Boolean(data);
    },
    enabled: Boolean(orderId) && Boolean(uid),
    staleTime: 60_000,
  });

  return {
    hasReviewed: query.data ?? false,
    loading: query.isLoading,
  };
}
