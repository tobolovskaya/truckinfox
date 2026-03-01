-- Health-check view for storage zero-byte audit scheduler.
-- Helps monitor recency of snapshots.

create or replace view public.storage_zero_byte_audit_health_v as
with latest as (
  select
    run_at,
    total_zero_byte_count,
    notes
  from public.storage_zero_byte_audit_runs
  order by run_at desc
  limit 1
),
stats as (
  select count(*)::bigint as total_snapshots
  from public.storage_zero_byte_audit_runs
)
select
  s.total_snapshots,
  (s.total_snapshots > 0) as has_snapshots,
  l.run_at as last_snapshot_at,
  l.total_zero_byte_count as last_total_zero_byte_count,
  l.notes as last_notes,
  case
    when l.run_at is null then null
    else round((extract(epoch from (now() - l.run_at)) / 3600.0)::numeric, 2)
  end as hours_since_last_snapshot,
  case
    when l.run_at is null then true
    else now() - l.run_at > interval '30 hours'
  end as is_stale
from stats s
left join latest l on true;

comment on view public.storage_zero_byte_audit_health_v is
  'Health-check view for zero-byte storage snapshot pipeline; marks stale when latest snapshot is older than 30 hours.';
