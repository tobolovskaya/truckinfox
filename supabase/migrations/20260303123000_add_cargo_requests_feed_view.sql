CREATE OR REPLACE VIEW public.cargo_requests_feed AS
SELECT
  cr.*,
  p.full_name AS owner_full_name,
  p.user_type AS owner_user_type,
  p.rating AS owner_rating,
  p.avatar_url AS owner_avatar_url,
  COALESCE(b.bid_count, 0)::int AS bid_count
FROM public.cargo_requests cr
LEFT JOIN public.profiles p
  ON p.id = cr.customer_id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS bid_count
  FROM public.bids b
  WHERE b.request_id = cr.id
) b ON TRUE;

GRANT SELECT ON public.cargo_requests_feed TO authenticated;