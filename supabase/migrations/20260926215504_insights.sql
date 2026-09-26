-- The gallery keeps giving (Phase 5B), part 3: how guests use the invitation (feature analytics).
--
-- A tiny beacon on the invitation's page (no cookies, nothing kept on the device; nothing at all under
-- Global Privacy Control or Do Not Track) sends each page load's state now and then: a random id for
-- that page load (kept in the page's memory only), its language, device class and source (a personal
-- link, a shared link, a QR code, another site), whether the cover was opened, how far down the page
-- the guest read, the time the page was visible (capped), and whether they started and sent an RSVP,
-- added the event to a calendar, opened a map, went to the gallery or switched language. The server
-- checks it, never keeps addresses or browsers (only a salted hash of the address, for rate limits,
-- for a day), and counts each page load once into daily numbers per invitation — what the host's
-- "Insights" screen shows. The page loads themselves (needed to count each once) go after 7 days.
--
-- Same rules as the rest of the app: row level security on and no policies, SECURITY DEFINER functions
-- with an empty search_path that check the owner, service_role only. Additive only.

-- ─── tables ─────────────────────────────────────────────────────────────────────────────────────

-- One page load of an invitation: its first state and what happened since (each flag once). The id is
-- the page's own random id (it lives in the page's memory only: a reload is a new visit).
create table public.insight_visits (
  id uuid primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  -- the visit's day in the event's time zone (the daily numbers it counts in)
  day date not null,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  source text not null check (source in ('personal', 'shared', 'qr', 'other')),
  -- the cover was opened (a page without a cover: at once)
  opened boolean not null default false,
  -- the deepest scroll milestone reached, % of the page
  depth smallint not null default 0 check (depth in (0, 25, 50, 75, 100)),
  -- how long the page was on screen, capped at 30 minutes
  visible_ms int not null default 0 check (visible_ms between 0 and 1800000),
  rsvp_started boolean not null default false,
  rsvp_sent boolean not null default false,
  calendar boolean not null default false,
  map boolean not null default false,
  gallery boolean not null default false,
  lang_switch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index insight_visits_age on public.insight_visits (created_at);
create index insight_visits_invitation on public.insight_visits (invitation_id);
create trigger insight_visits_touch before update on public.insight_visits
  for each row execute function public.touch_updated_at();

-- The daily numbers of an invitation: page loads, and how many of them opened the cover, read to the
-- end, started and sent an RSVP, added the event to a calendar, opened a map, went to the gallery or
-- switched language — each page load once. depth: page loads that reached each milestone
-- ({"25": n, "50": n, "75": n, "100": n}); by_lang / by_source / by_device: page loads and RSVPs sent
-- ({"he": {"visits": n, "sent": n}}); time_hist: page loads by visible time (the lower bound of their
-- bucket in seconds → n), for the median without keeping any page load.
create table public.insight_daily (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  day date not null,
  visits int not null default 0,
  opened int not null default 0,
  read_end int not null default 0,
  rsvp_started int not null default 0,
  rsvp_sent int not null default 0,
  calendar int not null default 0,
  map int not null default 0,
  gallery int not null default 0,
  lang_switch int not null default 0,
  depth jsonb not null default '{}'::jsonb check (jsonb_typeof(depth) = 'object'),
  by_lang jsonb not null default '{}'::jsonb check (jsonb_typeof(by_lang) = 'object'),
  by_source jsonb not null default '{}'::jsonb check (jsonb_typeof(by_source) = 'object'),
  by_device jsonb not null default '{}'::jsonb check (jsonb_typeof(by_device) = 'object'),
  time_hist jsonb not null default '{}'::jsonb check (jsonb_typeof(time_hist) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (invitation_id, day)
);
create trigger insight_daily_touch before update on public.insight_daily
  for each row execute function public.touch_updated_at();

alter table public.insight_visits enable row level security;
alter table public.insight_daily enable row level security;
revoke all on public.insight_visits, public.insight_daily from anon, authenticated;

-- ─── helpers (internal) ─────────────────────────────────────────────────────────────────────────

-- p_obj[p_key][p_field] + p_by (both levels created when missing).
create function public.insight_inc(p_obj jsonb, p_key text, p_field text, p_by int) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_set(
    p_obj, array[p_key],
    coalesce(p_obj->p_key, '{}'::jsonb)
      || jsonb_build_object(p_field, coalesce((p_obj->p_key->>p_field)::int, 0) + p_by),
    true)
$$;

-- p_obj[p_key] + p_by.
create function public.insight_add(p_obj jsonb, p_key text, p_by int) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_set(p_obj, array[p_key], to_jsonb(coalesce((p_obj->>p_key)::int, 0) + p_by), true)
$$;

-- A visible time's bucket: the lower bound in seconds (0, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300,
-- 600, 900, 1200, 1800).
create function public.insight_bucket(p_ms int) returns int
language sql immutable set search_path = '' as $$
  select max(b) from unnest(array[0, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800]) b
  where b * 1000 <= greatest(p_ms, 0)
$$;

-- ─── the beacon (through the server, after it checked the request and the event's feature) ─────

-- The published invitation behind a slug, for the beacon: its id and time zone; null for anything
-- else (a draft, an archived invitation, the site's sample invitations).
create function public.insight_invitation(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'timezone', i.published->>'timezone')
  from public.invitations i
  where i.slug = p_slug and i.status = 'published' and i.published is not null
    and i.owner_id <> '00000000-0000-4000-8000-00000000d3e0'::uuid
$$;

-- One beacon: the page load's state as the server checked it (p_state: lang, device, source, opened,
-- depth, visibleMs, rsvpStarted, rsvpSent, calendar, map, gallery, langSwitch). Rate-limited by the
-- address's salted hash (p_rate_key) and per invitation. The page load's row keeps the most it ever
-- said (flags only go on, depth and time only grow); the day's numbers count what is new.
-- { ok: true } | { ok: false, code: 'rate' | 'mismatch' } | null (no such published invitation).
create function public.insight_hit(p_invitation_id uuid, p_visit uuid, p_day date, p_state jsonb, p_rate_key text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.insight_visits;
  n public.insight_visits;
  v_new boolean := false;
  v_depth jsonb;
  m int;
  v_old_bucket int;
  v_new_bucket int;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 600, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  if not public.gallery_rate_hit(
    encode(sha256(convert_to('insight-invitation:' || p_invitation_id::text, 'UTF8')), 'hex'), 20000, 3600
  ) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  if not exists (select 1 from public.invitations where id = p_invitation_id and status = 'published') then
    return null;
  end if;
  -- a day near today's (the server's clock in the event's zone): nothing else
  if p_day is null or p_day < current_date - 2 or p_day > current_date + 2 then
    return jsonb_build_object('ok', false, 'code', 'mismatch');
  end if;

  insert into public.insight_visits (id, invitation_id, day, lang, device, source)
  values (p_visit, p_invitation_id, p_day, p_state->>'lang', p_state->>'device', p_state->>'source')
  on conflict (id) do nothing;
  v_new := found;
  select * into o from public.insight_visits where id = p_visit for update;
  if o.invitation_id <> p_invitation_id then
    return jsonb_build_object('ok', false, 'code', 'mismatch');
  end if;
  update public.insight_visits v set
    opened = v.opened or coalesce((p_state->>'opened')::boolean, false),
    depth = greatest(v.depth, coalesce((p_state->>'depth')::smallint, 0)),
    visible_ms = least(greatest(v.visible_ms, coalesce((p_state->>'visibleMs')::int, 0)), 1800000),
    rsvp_started = v.rsvp_started or coalesce((p_state->>'rsvpStarted')::boolean, false),
    rsvp_sent = v.rsvp_sent or coalesce((p_state->>'rsvpSent')::boolean, false),
    calendar = v.calendar or coalesce((p_state->>'calendar')::boolean, false),
    map = v.map or coalesce((p_state->>'map')::boolean, false),
    gallery = v.gallery or coalesce((p_state->>'gallery')::boolean, false),
    lang_switch = v.lang_switch or coalesce((p_state->>'langSwitch')::boolean, false)
  where v.id = p_visit
  returning * into n;

  -- the scroll milestones this beacon crossed
  v_depth := '{}'::jsonb;
  foreach m in array array[25, 50, 75, 100] loop
    if o.depth < m and n.depth >= m then
      v_depth := v_depth || jsonb_build_object(m::text, 1);
    end if;
  end loop;
  v_old_bucket := public.insight_bucket(o.visible_ms);
  v_new_bucket := public.insight_bucket(n.visible_ms);

  insert into public.insight_daily (invitation_id, day) values (p_invitation_id, o.day)
  on conflict (invitation_id, day) do nothing;
  update public.insight_daily d set
    visits = d.visits + v_new::int,
    opened = d.opened + (not o.opened and n.opened)::int,
    read_end = d.read_end + (o.depth < 100 and n.depth = 100)::int,
    rsvp_started = d.rsvp_started + (not o.rsvp_started and n.rsvp_started)::int,
    rsvp_sent = d.rsvp_sent + (not o.rsvp_sent and n.rsvp_sent)::int,
    calendar = d.calendar + (not o.calendar and n.calendar)::int,
    map = d.map + (not o.map and n.map)::int,
    gallery = d.gallery + (not o.gallery and n.gallery)::int,
    lang_switch = d.lang_switch + (not o.lang_switch and n.lang_switch)::int,
    depth = (
      select coalesce(d.depth || jsonb_object_agg(k, coalesce((d.depth->>k)::int, 0) + 1), d.depth)
      from jsonb_object_keys(v_depth) k
    ),
    by_lang = case when not o.rsvp_sent and n.rsvp_sent
      then public.insight_inc(
        case when v_new then public.insight_inc(d.by_lang, n.lang, 'visits', 1) else d.by_lang end,
        n.lang, 'sent', 1)
      else case when v_new then public.insight_inc(d.by_lang, n.lang, 'visits', 1) else d.by_lang end end,
    by_source = case when not o.rsvp_sent and n.rsvp_sent
      then public.insight_inc(
        case when v_new then public.insight_inc(d.by_source, n.source, 'visits', 1) else d.by_source end,
        n.source, 'sent', 1)
      else case when v_new then public.insight_inc(d.by_source, n.source, 'visits', 1) else d.by_source end end,
    by_device = case when not o.rsvp_sent and n.rsvp_sent
      then public.insight_inc(
        case when v_new then public.insight_inc(d.by_device, n.device, 'visits', 1) else d.by_device end,
        n.device, 'sent', 1)
      else case when v_new then public.insight_inc(d.by_device, n.device, 'visits', 1) else d.by_device end end,
    time_hist = case
      when v_new then public.insight_add(d.time_hist, v_new_bucket::text, 1)
      when v_new_bucket <> v_old_bucket then public.insight_add(
        public.insight_add(d.time_hist, v_old_bucket::text, -1), v_new_bucket::text, 1)
      else d.time_hist end
  where d.invitation_id = p_invitation_id and d.day = o.day;
  return jsonb_build_object('ok', true);
end $$;

-- ─── the host's Insights screen (the server passes the signed-in user's id; null when not theirs) ─

-- The last p_days days (0: since the invitation was published) in the event's time zone — today
-- included — with the daily numbers and what the screen shows beside them: the personal links (guests,
-- sent, opened, and the first opens per day), the RSVPs, the gallery's uploads (null without a
-- gallery), the event's date.
create function public.insight_owner_report(p_id uuid, p_owner uuid, p_days int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
  v_tz text;
  v_to date;
  v_from date;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  v_tz := coalesce(i.published, i.draft)->>'timezone';
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  v_to := (now() at time zone v_tz)::date;
  if coalesce(p_days, 0) > 0 then
    v_from := v_to - (least(p_days, 366) - 1);
  else
    v_from := least(
      coalesce((i.published_at at time zone v_tz)::date, v_to),
      coalesce((select min(d.day) from public.insight_daily d where d.invitation_id = p_id), v_to)
    );
    v_from := greatest(v_from, v_to - 365);
  end if;
  return jsonb_build_object(
    'status', i.status,
    'timezone', v_tz,
    'from', v_from,
    'to', v_to,
    'eventDate', coalesce(i.published, i.draft)#>>'{event,date}',
    'publishedAt', i.published_at,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
          'day', d.day, 'visits', d.visits, 'opened', d.opened, 'readEnd', d.read_end,
          'rsvpStarted', d.rsvp_started, 'rsvpSent', d.rsvp_sent, 'calendar', d.calendar, 'map', d.map,
          'gallery', d.gallery, 'langSwitch', d.lang_switch, 'depth', d.depth, 'byLang', d.by_lang,
          'bySource', d.by_source, 'byDevice', d.by_device, 'timeHist', d.time_hist
        ) order by d.day)
      from public.insight_daily d
      where d.invitation_id = p_id and d.day between v_from and v_to
    ), '[]'::jsonb),
    'personal', (
      select jsonb_build_object(
        'guests', count(*),
        'sent', count(*) filter (where g.send_status in ('sent', 'delivered', 'read') or g.opened_at is not null),
        'opened', count(*) filter (where g.opened_at is not null),
        'opens', coalesce(sum(g.open_count), 0),
        'firstOpens', coalesce((
          select jsonb_agg(jsonb_build_object('day', x.day, 'n', x.n) order by x.day)
          from (
            select (g2.opened_at at time zone v_tz)::date as day, count(*) as n
            from public.invitation_guests g2
            where g2.invitation_id = p_id and g2.opened_at is not null
              and (g2.opened_at at time zone v_tz)::date between v_from and v_to
            group by 1
          ) x
        ), '[]'::jsonb)
      )
      from public.invitation_guests g
      where g.invitation_id = p_id
    ),
    'responses', (
      select jsonb_build_object(
        'total', count(*),
        'attending', count(*) filter (where r.attending)
      )
      from public.rsvp_responses r
      where r.invitation_id = p_id
    ),
    'gallery', case when exists (select 1 from public.galleries where invitation_id = p_id)
      then public.gallery_counts(p_id) end
  );
end $$;

-- ─── housekeeping (the daily run) ───────────────────────────────────────────────────────────────

-- What the privacy policy promises: page loads go after p_days (the daily numbers stay with the
-- invitation, until it or the account is deleted).
create function public.insight_maintenance(p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.insight_visits where created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return jsonb_build_object('visits', n);
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.insight_inc(jsonb, text, text, int)',
    'public.insight_add(jsonb, text, int)',
    'public.insight_bucket(int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.insight_invitation(text)',
    'public.insight_hit(uuid, uuid, date, jsonb, text)',
    'public.insight_owner_report(uuid, uuid, int)',
    'public.insight_maintenance(int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
