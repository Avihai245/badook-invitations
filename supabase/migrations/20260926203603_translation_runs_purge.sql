-- The machine translation's run records (translation_runs: who ran it, for which invitation and
-- language, when — kept only for the per-owner limit) are erased two days after the run, as the
-- privacy policy says: by the daily run (src/features/jobs), for every owner.
-- translation_run_begin still drops an owner's own old runs when they translate again.
-- Additive: one new function, service_role only.

create function public.translation_runs_purge() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.translation_runs where created_at < now() - interval '2 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.translation_runs_purge() from public, anon, authenticated;
grant execute on function public.translation_runs_purge() to service_role;
