-- Retention helpers for storage zero-byte audit snapshots.
-- Default retention window: 180 days.

create or replace function public.prune_storage_zero_byte_audit_runs(_retention_days integer default 180)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint := 0;
  effective_days integer := greatest(coalesce(_retention_days, 180), 1);
begin
  with deleted as (
    delete from public.storage_zero_byte_audit_runs
    where run_at < now() - make_interval(days => effective_days)
    returning 1
  )
  select count(*)::bigint into deleted_count
  from deleted;

  return deleted_count;
end;
$$;

revoke all on function public.prune_storage_zero_byte_audit_runs(integer) from public;
grant execute on function public.prune_storage_zero_byte_audit_runs(integer) to service_role;

comment on function public.prune_storage_zero_byte_audit_runs(integer) is
  'Deletes storage_zero_byte_audit_runs older than retention window (default 180 days) and returns deleted row count.';
