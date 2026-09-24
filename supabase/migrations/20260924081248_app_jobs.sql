-- Jobs the app runs by itself: the WhatsApp queue every few minutes and the daily run (the hosts' RSVP
-- summaries, the purge the privacy policy promises, the billing checks, the templates sync). A
-- scheduler may call them too (.github/workflows); whoever comes first takes the job, so each runs
-- once. Row 'job:<name>' of app_meta: value = when it last finished, updated_at = when it was taken.

-- Takes the job when it last finished before p_due and nobody took it within the last
-- p_lease_seconds (a run that died is taken again once its lease is over). true = run it now.
create function public.app_job_claim(p_name text, p_due timestamptz, p_lease_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_meta (key, value, updated_at)
  values ('job:' || p_name, '-infinity', now())
  on conflict (key) do update set updated_at = now()
    where public.app_meta.value::timestamptz < p_due
      and public.app_meta.updated_at < now() - make_interval(secs => greatest(p_lease_seconds, 0));
  return found;
end $$;

-- The job finished (taken by app_job_claim, or run on a scheduler's call): due again from its next
-- p_due on.
create function public.app_job_done(p_name text) returns void
language sql security definer set search_path = '' as $$
  insert into public.app_meta (key, value, updated_at) values ('job:' || p_name, now()::text, now())
  on conflict (key) do update set value = excluded.value
$$;

revoke all on function public.app_job_claim(text, timestamptz, int) from public, anon, authenticated;
revoke all on function public.app_job_done(text) from public, anon, authenticated;
grant execute on function public.app_job_claim(text, timestamptz, int) to service_role;
grant execute on function public.app_job_done(text) to service_role;
