import { useState, useEffect, useCallback } from 'react';
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [averageRating, setAverageRating] = useState<number>(0);

  const loadReviews = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviewer_id(id, full_name)')
      .eq('reviewed_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      const reviewList = (data || []) as Review[];
      setReviews(reviewList);
      if (reviewList.length > 0) {
        const avg = reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  return { reviews, loading, error, averageRating, refetch: loadReviews };
}

/** Hook: check if current user has reviewed a specific order */
export function useHasReviewed(orderId: string | undefined) {
  const { user } = useAuth();
  const [hasReviewed, setHasReviewed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !user?.uid) {
      setLoading(false);
      return;
    }

    supabase
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('reviewer_id', user.uid)
      .maybeSingle()
      .then(({ data }) => {
        setHasReviewed(Boolean(data));
        setLoading(false);
      });
  }, [orderId, user?.uid]);

  return { hasReviewed, loading };
}
