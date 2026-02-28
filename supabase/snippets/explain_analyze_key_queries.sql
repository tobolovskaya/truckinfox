-- TruckInfoX: key query performance checks
-- Run in Supabase SQL Editor (staging first), replacing placeholder UUIDs.
-- Use with realistic data volumes and repeated runs (cold + warm cache).

-- 1) Cargo feed list (open requests, newest first)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, customer_id, title, status, pickup_date, created_at
FROM public.cargo_requests
WHERE status = 'open'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- 2) Cargo request detail by id
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, customer_id, title, description, status, accepted_bid_id, created_at
FROM public.cargo_requests
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

-- 3) Bids for request (used in request-details screen)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, request_id, carrier_id, amount, status, created_at
FROM public.bids
WHERE request_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC;

-- 4) Orders list by customer (tabs/orders)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, customer_id, carrier_id, status, payment_status, created_at
FROM public.orders
WHERE customer_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC
LIMIT 30;

-- 5) Orders list by carrier
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, customer_id, carrier_id, status, payment_status, created_at
FROM public.orders
WHERE carrier_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC
LIMIT 30;

-- 6) Chat messages by chat_id (chat screen pagination)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, chat_id, sender_id, receiver_id, content, created_at
FROM public.messages
WHERE chat_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at ASC
LIMIT 50;

-- 7) Unread messages for receiver in request context
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, receiver_id, request_id, read_at, created_at
FROM public.messages
WHERE receiver_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND request_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND read_at IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 8) Latest tracking points for request
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, request_id, truck_id, latitude, longitude, recorded_at
FROM public.tracking
WHERE request_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY recorded_at DESC
LIMIT 100;

-- 9) Latest tracking points for truck
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, truck_id, latitude, longitude, speed_kmh, heading, recorded_at
FROM public.tracking
WHERE truck_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY recorded_at DESC
LIMIT 100;
