-- Scheduler-ready daily audit storage for zero-byte object monitoring.
-- Safe migration: audit metadata only, no object or business data mutation.

create table if not exists public.storage_zero_byte_audit_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  total_zero_byte_count bigint not null,
  bucket_summary jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_storage_zero_byte_audit_runs_run_at
  on public.storage_zero_byte_audit_runs (run_at desc);

alter table public.storage_zero_byte_audit_runs enable row level security;

comment on table public.storage_zero_byte_audit_runs is
  'Historical snapshots for zero-byte storage objects by bucket.';

comment on column public.storage_zero_byte_audit_runs.bucket_summary is
  'JSON array of {bucket_id, zero_byte_count, oldest_created_at, newest_created_at} from storage_zero_byte_summary().';

create or replace function public.capture_storage_zero_byte_snapshot(_notes text default null)
returns public.storage_zero_byte_audit_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  summary_json jsonb;
  total_count bigint;
  inserted_row public.storage_zero_byte_audit_runs;
begin
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', s.bucket_id,
          'zero_byte_count', s.zero_byte_count,
          'oldest_created_at', s.oldest_created_at,
          'newest_created_at', s.newest_created_at
        )
        order by s.zero_byte_count desc, s.bucket_id
      ),
      '[]'::jsonb
    ),
    coalesce(sum(s.zero_byte_count), 0)
  into summary_json, total_count
  from public.storage_zero_byte_summary() s;

  insert into public.storage_zero_byte_audit_runs (
    total_zero_byte_count,
    bucket_summary,
    notes
  )
  values (
    total_count,
    summary_json,
    _notes
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;

revoke all on function public.capture_storage_zero_byte_snapshot(text) from public;
grant execute on function public.capture_storage_zero_byte_snapshot(text) to service_role;

comment on function public.capture_storage_zero_byte_snapshot(text) is
  'Captures and stores one point-in-time snapshot of zero-byte objects summary.';

create or replace view public.storage_zero_byte_audit_latest_v as
select
  r.id,
  r.run_at,
  r.total_zero_byte_count,
  r.bucket_summary,
  r.notes,
  r.created_at
from public.storage_zero_byte_audit_runs r
order by r.run_at desc
limit 1;

comment on view public.storage_zero_byte_audit_latest_v is
  'Most recent zero-byte storage audit snapshot from storage_zero_byte_audit_runs.';
