-- Audit-only helpers for detecting zero-byte objects in Supabase Storage.
-- Safe migration: no deletes, no data mutation.

-- Dedicated view with normalized size extraction from storage metadata.
create or replace view public.storage_zero_byte_objects_v as
select
  so.id,
  so.bucket_id,
  so.name,
  so.created_at,
  so.updated_at,
  coalesce(nullif(so.metadata->>'size', '')::bigint, 0) as size_bytes,
  so.metadata
from storage.objects so
where so.bucket_id in ('cargo', 'avatars', 'chat', 'trucks')
  and coalesce(nullif(so.metadata->>'size', '')::bigint, 0) = 0;

comment on view public.storage_zero_byte_objects_v is
  'Audit view for storage objects with metadata size = 0 in app buckets (cargo, avatars, chat, trucks).';

-- Quick summary function for dashboards/ops checks.
create or replace function public.storage_zero_byte_summary()
returns table (
  bucket_id text,
  zero_byte_count bigint,
  oldest_created_at timestamptz,
  newest_created_at timestamptz
)
language sql
stable
as $$
  select
    v.bucket_id,
    count(*)::bigint as zero_byte_count,
    min(v.created_at) as oldest_created_at,
    max(v.created_at) as newest_created_at
  from public.storage_zero_byte_objects_v v
  group by v.bucket_id
  order by zero_byte_count desc;
$$;

comment on function public.storage_zero_byte_summary() is
  'Returns per-bucket zero-byte object counts and age range from public.storage_zero_byte_objects_v.';

-- Optional helper function to find references in cargo request images.
create or replace function public.storage_zero_byte_request_image_refs()
returns table (
  request_id uuid,
  image_url text,
  bucket_id text,
  object_name text
)
language sql
stable
as $$
  with request_images as (
    select
      cr.id as request_id,
      unnest(coalesce(cr.images, '{}'::text[])) as image_url
    from public.cargo_requests cr
  )
  select distinct
    ri.request_id,
    ri.image_url,
    v.bucket_id,
    v.name as object_name
  from request_images ri
  join public.storage_zero_byte_objects_v v
    on (
      ri.image_url like '%' || '/object/sign/' || v.bucket_id || '/' || replace(v.name, '/', '%2F') || '%'
      or ri.image_url like '%' || '/object/sign/' || v.bucket_id || '/' || v.name || '%'
      or ri.image_url like '%' || '/object/public/' || v.bucket_id || '/' || replace(v.name, '/', '%2F') || '%'
      or ri.image_url like '%' || '/object/public/' || v.bucket_id || '/' || v.name || '%'
      or ri.image_url = v.bucket_id || '/' || v.name
      or ri.image_url = v.name
    )
  where v.bucket_id = 'cargo'
  order by ri.request_id;
$$;

comment on function public.storage_zero_byte_request_image_refs() is
  'Finds cargo_requests.images URLs that resolve to zero-byte cargo objects from the audit view.';
