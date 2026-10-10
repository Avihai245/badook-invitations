-- The scheduler (features/scheduler): Supabase's pg_cron calls the app every minute —
-- POST <INVITES_CRON_URL>/api/cron/tick with "Authorization: Bearer <INVITES_CRON_SECRET>", both kept in
-- the Vault (Supabase → Vault → Secrets; never in this file) — through pg_net. The app then runs
-- whatever is due: a send a host scheduled (at their date and time in their time zone), the WhatsApp
-- queue, the album's "it's ready" emails and the RSVP summaries at each event's own local time, the
-- daily housekeeping. Without the two secrets the call does nothing; without pg_cron and pg_net (a
-- local database) nothing is scheduled and the app keeps its own clock on its traffic (features/jobs).

-- One call of the app's clock (null: not set up). Asynchronous: pg_net sends it and keeps the answer
-- (net._http_response) for a few hours.
create function public.app_cron_call(p_path text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
  v_id bigint;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return null;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'INVITES_CRON_URL'),
           max(decrypted_secret) filter (where name = 'INVITES_CRON_SECRET')
    from vault.decrypted_secrets where name in ('INVITES_CRON_URL', 'INVITES_CRON_SECRET')
  $q$ into v_url, v_secret;
  if v_url is null or v_secret is null then
    return null;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 55000)'
    into v_id
    using rtrim(v_url, '/') || p_path,
      '{}'::jsonb,
      jsonb_build_object('authorization', 'Bearer ' || v_secret, 'content-type', 'application/json');
  return v_id;
end $$;

revoke all on function public.app_cron_call(text) from public, anon, authenticated;
grant execute on function public.app_cron_call(text) to service_role;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron / pg_net are not available here: the app keeps its own clock';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  -- every minute: the app's clock
  perform cron.schedule('badook-clock', '* * * * *', 'select public.app_cron_call(''/api/cron/tick'')');
  -- pg_cron's own record of runs, kept a week
  perform cron.schedule(
    'badook-cron-history',
    '23 4 * * *',
    'delete from cron.job_run_details where end_time < now() - interval ''7 days'''
  );
end $$;
