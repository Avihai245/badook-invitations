-- The clock (features/scheduler): what a host sets for a date and a time happens then — in the time
-- zone they chose. A send the host schedules (the gallery link to the guests, the album's thank-you)
-- keeps what they picked as they picked it — the date, the time on the clock, the IANA time zone
-- ("America/New_York": 15:00 there, not in Israel) — and the moment it means, which Postgres works
-- out once from those three (daylight saving included): run_at. A scheduler calls the app every
-- minute (*_cron_schedule.sql, pg_cron); the app runs what is due then.
--
-- Also here: the RSVP daily summary at the host's morning in the invitation's own time zone (it used
-- to go out at one moment for everyone), and the scheduler's secret read from the Vault.
--
-- Same rules as the rest of the app: row level security on and no policies, SECURITY DEFINER functions
-- with an empty search_path that check the owner, service_role only. Additive only.

-- ─── a time zone Postgres knows ─────────────────────────────────────────────────────────────────

create function public.time_zone_ok(p_tz text) returns boolean
language sql stable set search_path = '' as $$
  select p_tz is not null and char_length(p_tz) between 1 and 64
    and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz)
$$;

-- ─── scheduled sends ────────────────────────────────────────────────────────────────────────────

-- One send a host scheduled for an invitation: what (the gallery link, the album's thank-you), to
-- whom (the guests who haven't got it yet, or everyone the system's number reaches), when — the date
-- and the time on the clock in the time zone they chose, and run_at, the moment that means — and how
-- it went. One waiting send of each kind per invitation (setting it again moves it).
create table public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('gallery_link', 'album_thanks')),
  local_date date not null,
  local_time time(0) not null,
  time_zone text not null check (char_length(time_zone) between 1 and 64),
  run_at timestamptz not null,
  audience text not null default 'unsent' check (audience in ('unsent', 'all')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'running', 'done', 'failed', 'canceled')),
  attempts int not null default 0,
  claimed_at timestamptz,
  result jsonb,
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index scheduled_sends_waiting on public.scheduled_sends (invitation_id, kind)
  where status in ('scheduled', 'running');
create index scheduled_sends_due on public.scheduled_sends (run_at) where status = 'scheduled';
create index scheduled_sends_invitation on public.scheduled_sends (invitation_id, created_at desc);
create index scheduled_sends_owner_id_idx on public.scheduled_sends (owner_id);
create trigger scheduled_sends_touch before update on public.scheduled_sends
  for each row execute function public.touch_updated_at();

alter table public.scheduled_sends enable row level security;
revoke all on public.scheduled_sends from anon, authenticated;

create function public.scheduled_send_json(s public.scheduled_sends) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'invitationId', s.invitation_id,
    'ownerId', s.owner_id,
    'kind', s.kind,
    'date', to_char(s.local_date, 'YYYY-MM-DD'),
    'time', to_char(s.local_time, 'HH24:MI'),
    'timeZone', s.time_zone,
    'runAt', s.run_at,
    'audience', s.audience,
    'status', s.status,
    'attempts', s.attempts,
    'result', s.result,
    'error', s.error,
    'createdAt', s.created_at,
    'finishedAt', s.finished_at
  )
$$;

-- The moment a date and a time on the clock mean in a time zone (null: not a time zone Postgres knows).
create function public.local_moment(p_date date, p_time time, p_tz text) returns timestamptz
language sql stable set search_path = '' as $$
  select case when public.time_zone_ok(p_tz) then (p_date + p_time) at time zone p_tz end
$$;

-- Schedules a send (or moves the one waiting): { ok: true, send } | { ok: false, code: 'time_zone' |
-- 'past' | 'too_far' | 'running' } | null (not the owner's). The moment must be at least a minute ahead
-- and within 400 days.
create function public.scheduled_send_set(
  p_id uuid, p_owner uuid, p_kind text, p_date date, p_time time, p_tz text, p_audience text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_run timestamptz;
  s public.scheduled_sends;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  v_run := public.local_moment(p_date, date_trunc('minute', p_time::interval)::time, p_tz);
  if v_run is null then
    return jsonb_build_object('ok', false, 'code', 'time_zone');
  end if;
  if v_run < now() + interval '1 minute' then
    return jsonb_build_object('ok', false, 'code', 'past');
  end if;
  if v_run > now() + interval '400 days' then
    return jsonb_build_object('ok', false, 'code', 'too_far');
  end if;
  perform 1 from public.invitations where id = p_id for update;
  if exists (
    select 1 from public.scheduled_sends
    where invitation_id = p_id and kind = p_kind and status = 'running'
  ) then
    return jsonb_build_object('ok', false, 'code', 'running');
  end if;
  update public.scheduled_sends set
    local_date = p_date,
    local_time = date_trunc('minute', p_time::interval)::time,
    time_zone = p_tz,
    run_at = v_run,
    audience = coalesce(p_audience, 'unsent'),
    attempts = 0,
    error = null
  where invitation_id = p_id and kind = p_kind and status = 'scheduled'
  returning * into s;
  if not found then
    insert into public.scheduled_sends (
      invitation_id, owner_id, kind, local_date, local_time, time_zone, run_at, audience
    ) values (
      p_id, p_owner, p_kind, p_date, date_trunc('minute', p_time::interval)::time, p_tz, v_run,
      coalesce(p_audience, 'unsent')
    )
    returning * into s;
  end if;
  return jsonb_build_object('ok', true, 'send', public.scheduled_send_json(s));
end $$;

-- The host takes back the send waiting (false: none). null when it isn't the owner's.
create function public.scheduled_send_cancel(p_id uuid, p_owner uuid, p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  update public.scheduled_sends set status = 'canceled', finished_at = now()
  where invitation_id = p_id and kind = p_kind and status = 'scheduled';
  return found;
end $$;

-- The invitation's sends, newest first (the waiting ones and how the last ones went) — and the
-- invitation's own time zone (the form starts in it). null when it isn't the owner's.
create function public.scheduled_send_list(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'timeZone', coalesce(i.published, i.draft)->>'timezone',
    'sends', coalesce((
      select jsonb_agg(public.scheduled_send_json(x.s) order by (x.s).created_at desc)
      from (
        select s from public.scheduled_sends s
        where s.invitation_id = p_id and s.status <> 'canceled'
        order by s.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  );
end $$;

-- The scheduler's turn: up to p_limit sends that are due (run_at has come), and ones a run took
-- without finishing (running for p_stale_seconds) while they have tries left — at most 3, then
-- failed ('timeout').
create function public.scheduled_send_claim(p_limit int, p_stale_seconds int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  update public.scheduled_sends set status = 'failed', error = 'timeout', finished_at = now()
  where status = 'running' and claimed_at < now() - make_interval(secs => p_stale_seconds) and attempts >= 3;
  with picked as (
    select s.id from public.scheduled_sends s
    where (s.status = 'scheduled' and s.run_at <= now())
       or (s.status = 'running' and s.claimed_at < now() - make_interval(secs => p_stale_seconds))
    order by s.run_at
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  ), claimed as (
    update public.scheduled_sends s set status = 'running', claimed_at = now(), attempts = s.attempts + 1
    from picked where s.id = picked.id
    returning s.*
  )
  select coalesce(jsonb_agg(public.scheduled_send_json(c) order by c.run_at), '[]'::jsonb) into v
  from claimed c;
  return v;
end $$;

-- How a send went: 'done' (with what happened) or 'failed' (why). false when it wasn't running.
create function public.scheduled_send_finish(p_send uuid, p_status text, p_result jsonb, p_error text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.scheduled_sends set
    status = case when p_status = 'done' then 'done' else 'failed' end,
    result = p_result,
    error = left(p_error, 300),
    finished_at = now()
  where id = p_send and status = 'running';
  return found;
end $$;

-- ─── the RSVP daily summary at the host's morning ───────────────────────────────────────────────

-- As rsvp_digest_due, at the host's morning: an invitation is due once its own time zone (the
-- invitation's; Israel's when it has none Postgres knows) has reached p_hour today and its summary
-- hasn't gone out since then. 15:00 in New York is 15:00 in New York.
create function public.rsvp_digest_due_local(p_now timestamptz, p_hour int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'email', u.email,
      'document', coalesce(i.published, i.draft),
      'since', s.since,
      'responses', (
        select jsonb_agg(jsonb_build_object(
            'name', r.primary_name,
            'attending', r.attending,
            'adults', r.adults_count,
            'children', r.children_count,
            'createdAt', r.created_at
          ) order by r.created_at)
        from public.rsvp_responses r
        where r.invitation_id = i.id and r.updated_at > s.since and r.updated_at <= p_now
      )
    )), '[]'::jsonb)
  from public.invitation_notifications n
  join public.invitations i on i.id = n.invitation_id
  join auth.users u on u.id = i.owner_id
  cross join lateral (
    select case when public.time_zone_ok(coalesce(i.published, i.draft)->>'timezone')
      then coalesce(i.published, i.draft)->>'timezone' else 'Asia/Jerusalem' end as tz
  ) z
  -- this morning's p_hour in the invitation's time zone, as a moment
  cross join lateral (
    select (date_trunc('day', p_now at time zone z.tz) + make_interval(hours => p_hour)) at time zone z.tz
      as morning
  ) m
  cross join lateral (select coalesce(n.digest_sent_at, p_now - interval '1 day') as since) s
  where n.mode = 'digest'
    and p_now >= m.morning
    and (n.digest_sent_at is null or n.digest_sent_at < m.morning)
    and exists (
      select 1 from public.rsvp_responses r
      where r.invitation_id = i.id and r.updated_at > s.since and r.updated_at <= p_now
    )
$$;

-- ─── the scheduler's secret ─────────────────────────────────────────────────────────────────────

-- The secret the scheduler (pg_cron, *_cron_schedule.sql) sends, kept in the Vault as
-- INVITES_CRON_SECRET: the app takes it there too when its own variable is unset (null: none).
create function public.cron_secret() returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = ''INVITES_CRON_SECRET'' limit 1'
    into v;
  return v;
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.scheduled_send_json(public.scheduled_sends)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.time_zone_ok(text)',
    'public.local_moment(date, time, text)',
    'public.scheduled_send_set(uuid, uuid, text, date, time, text, text)',
    'public.scheduled_send_cancel(uuid, uuid, text)',
    'public.scheduled_send_list(uuid, uuid)',
    'public.scheduled_send_claim(int, int)',
    'public.scheduled_send_finish(uuid, text, jsonb, text)',
    'public.rsvp_digest_due_local(timestamptz, int)',
    'public.cron_secret()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
