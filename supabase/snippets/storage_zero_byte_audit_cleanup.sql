-- Audit & cleanup for 0-byte files in Supabase Storage
--
-- Run in order:
-- 1) Audit queries (safe, read-only)
-- 2) Optional cleanup transaction (write)
--
-- Notes:
-- - Size is read from storage.objects.metadata->>'size'.
-- - This script focuses on buckets used by the app: cargo, avatars, chat, trucks.

-- ======================================================
-- 1) READ-ONLY AUDIT
-- ======================================================

with zero_byte as (
  select
    id,
    bucket_id,
    name,
    created_at,
    updated_at,
    coalesce(nullif(metadata->>'size', '')::bigint, 0) as size_bytes
  from storage.objects
  where bucket_id in ('cargo', 'avatars', 'chat', 'trucks')
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
select bucket_id, count(*) as zero_byte_count
from zero_byte
group by bucket_id
order by zero_byte_count desc;

with zero_byte as (
  select
    id,
    bucket_id,
    name,
    created_at,
    updated_at
  from storage.objects
  where bucket_id in ('cargo', 'avatars', 'chat', 'trucks')
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
select *
from zero_byte
order by created_at desc
limit 200;

-- Cargo request image references that point to 0-byte objects
with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id = 'cargo'
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
),
request_images as (
  select
    cr.id as request_id,
    unnest(coalesce(cr.images, '{}'::text[])) as image_url
  from public.cargo_requests cr
)
select distinct
  ri.request_id,
  ri.image_url
from request_images ri
join zero_byte zb
  on (
    ri.image_url like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or ri.image_url like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
    or ri.image_url like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or ri.image_url like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
    or ri.image_url = zb.bucket_id || '/' || zb.name
    or ri.image_url = zb.name
  )
order by ri.request_id;

-- Delivery photo/signature references that point to 0-byte objects
with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id = 'cargo'
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
),
delivery_photos as (
  select o.id as order_id, unnest(coalesce(o.delivery_photos, '{}'::text[])) as photo_url
  from public.orders o
)
select distinct
  dp.order_id,
  dp.photo_url
from delivery_photos dp
join zero_byte zb
  on (
    dp.photo_url like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or dp.photo_url like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
    or dp.photo_url like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or dp.photo_url like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
    or dp.photo_url = zb.bucket_id || '/' || zb.name
    or dp.photo_url = zb.name
  )
order by dp.order_id;

with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id = 'cargo'
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
select distinct
  o.id as order_id,
  o.delivery_signature_url
from public.orders o
join zero_byte zb
  on (
    coalesce(o.delivery_signature_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(o.delivery_signature_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(o.delivery_signature_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(o.delivery_signature_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(o.delivery_signature_url, '') = zb.bucket_id || '/' || zb.name
    or coalesce(o.delivery_signature_url, '') = zb.name
  )
order by o.id;

-- Avatar references that point to 0-byte objects
with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id in ('avatars', 'cargo')
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
select distinct
  p.id as profile_id,
  p.avatar_url
from public.profiles p
join zero_byte zb
  on (
    coalesce(p.avatar_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(p.avatar_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(p.avatar_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(p.avatar_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(p.avatar_url, '') = zb.bucket_id || '/' || zb.name
    or coalesce(p.avatar_url, '') = zb.name
  )
order by p.id;

-- ======================================================
-- 2) OPTIONAL CLEANUP (WRITE)
-- ======================================================
-- Remove references first (optional but recommended), then delete objects.
-- Run inside a transaction and verify affected row counts before COMMIT.

begin;

with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id = 'cargo'
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
update public.cargo_requests cr
set images = (
  select coalesce(array_agg(img), '{}'::text[])
  from unnest(coalesce(cr.images, '{}'::text[])) as img
  where not exists (
    select 1
    from zero_byte zb
    where (
      img like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
      or img like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
      or img like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
      or img like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
      or img = zb.bucket_id || '/' || zb.name
      or img = zb.name
    )
  )
)
where coalesce(array_length(cr.images, 1), 0) > 0;

with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id = 'cargo'
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
update public.orders o
set delivery_photos = (
  select coalesce(array_agg(img), '{}'::text[])
  from unnest(coalesce(o.delivery_photos, '{}'::text[])) as img
  where not exists (
    select 1
    from zero_byte zb
    where (
      img like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
      or img like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
      or img like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
      or img like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
      or img = zb.bucket_id || '/' || zb.name
      or img = zb.name
    )
  )
)
where coalesce(array_length(o.delivery_photos, 1), 0) > 0;

with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id = 'cargo'
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
update public.orders o
set delivery_signature_url = null
where exists (
  select 1
  from zero_byte zb
  where (
    coalesce(o.delivery_signature_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(o.delivery_signature_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(o.delivery_signature_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(o.delivery_signature_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(o.delivery_signature_url, '') = zb.bucket_id || '/' || zb.name
    or coalesce(o.delivery_signature_url, '') = zb.name
  )
);

with zero_byte as (
  select bucket_id, name
  from storage.objects
  where bucket_id in ('avatars', 'cargo')
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
update public.profiles p
set avatar_url = null
where exists (
  select 1
  from zero_byte zb
  where (
    coalesce(p.avatar_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(p.avatar_url, '') like '%' || '/object/sign/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(p.avatar_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || replace(zb.name, '/', '%2F') || '%'
    or coalesce(p.avatar_url, '') like '%' || '/object/public/' || zb.bucket_id || '/' || zb.name || '%'
    or coalesce(p.avatar_url, '') = zb.bucket_id || '/' || zb.name
    or coalesce(p.avatar_url, '') = zb.name
  )
);

-- Final object delete
with zero_byte as (
  select id
  from storage.objects
  where bucket_id in ('cargo', 'avatars', 'chat', 'trucks')
    and coalesce(nullif(metadata->>'size', '')::bigint, 0) = 0
)
delete from storage.objects so
using zero_byte zb
where so.id = zb.id;

-- Review impacted rows in your SQL editor first, then commit.
-- rollback;
commit;
