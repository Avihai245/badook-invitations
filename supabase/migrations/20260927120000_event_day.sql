-- The event day (Phase 5A): the seating plan comes alive on the day itself. Every guest gets their
-- table number and a map to it (feature seating_guide), the entrance checks guests in from the QR code
-- on that map or by a search (feature checkin), the host watches the hall fill up and re-seats families
-- live; every re-seat, and every change to what guests were already told, is kept in an audit trail
-- with undo.
--
-- Same rules as the rest of the app: row level security is on and there are no policies, so nothing
-- here is reachable from the browser. Every function is SECURITY DEFINER with an empty search_path,
-- checks the owner (the server passes the signed-in user's id) or a token's hash itself, and only
-- service_role may run it. The entrance stations' link is a token the server derives with its own key;
-- only its SHA-256 hash is stored. Additive only: nothing that exists is changed.

-- ─── tables ─────────────────────────────────────────────────────────────────────────────────────

-- One per event, created when the host first opens the event day: the entrance stations' link (the
-- server derives it from the nonce; the database keeps only its hash, so a copy of the database opens
-- no station) and the Realtime channel that tells open pages "something changed" (random, carries no
-- data). A new link retires the old one and changes the channel.
create table public.event_days (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  station_token_hash text not null unique check (station_token_hash ~ '^[0-9a-f]{64}$'),
  station_token_nonce text not null check (station_token_nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  channel text not null unique check (channel ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger event_days_touch before update on public.event_days
  for each row execute function public.touch_updated_at();

-- Arrivals at the entrance: one row each time a family (a seating unit) is checked in, with how many of
-- them came then (a family may arrive in parts), when, and where — the station's name as its staff
-- typed it, or 'host' from the host's own screen. The id comes from the station (a retried request
-- never counts twice). Undo marks the row (deleted_at); rows go 30 days after the event
-- (event_day_maintenance, the daily run — the privacy policy says so).
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  unit_id uuid not null references public.seating_units(id) on delete cascade,
  guest_id uuid references public.invitation_guests(id) on delete set null,
  count int not null check (count between 1 and 99),
  arrived_at timestamptz not null default now(),
  station text not null check (char_length(station) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index checkins_live on public.checkins (invitation_id, arrived_at) where deleted_at is null;
create index checkins_unit_id_idx on public.checkins (unit_id);
create index checkins_guest_id_idx on public.checkins (guest_id) where guest_id is not null;
create index checkins_undone on public.checkins (deleted_at) where deleted_at is not null;
create trigger checkins_touch before update on public.checkins
  for each row execute function public.touch_updated_at();

-- What each family was told about its table: one row per message from the system's WhatsApp number
-- (queued and sent like the invitations, with their own template — docs/whatsapp-setup.md) or per time
-- the host told them themselves (their own WhatsApp, a printed card, in person: channel 'manual'). The
-- table's number and name are kept as they were said. A family's latest row that didn't fail is what
-- it knows — from then on its table is "frozen": moving it, or renumbering its table, asks the host
-- first and is recorded in seating_changes.
create table public.seating_notices (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  unit_id uuid not null references public.seating_units(id) on delete cascade,
  guest_id uuid references public.invitation_guests(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid references public.seating_tables(id) on delete set null,
  table_number int not null check (table_number between 1 and 999),
  table_label text check (table_label is null or char_length(table_label) <= 40),
  channel text not null check (channel in ('whatsapp', 'manual')),
  -- whatsapp: the queue's states (like whatsapp_messages); manual: 'sent'
  status text not null default 'sent'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
  to_phone text check (to_phone is null or to_phone ~ '^\+[1-9][0-9]{6,14}$'),
  wa_message_id text unique,
  error text check (error is null or char_length(error) <= 300),
  price_usd numeric(10, 4) not null default 0,
  attempts int not null default 0,
  claimed_at timestamptz,
  -- a message waiting for another try (Meta asked us to slow down) goes again from this time on
  next_attempt_at timestamptz,
  -- its credit went back to the host (once, whichever reports the failure first)
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel = 'whatsapp') = (to_phone is not null))
);
create index seating_notices_unit on public.seating_notices (unit_id, created_at desc);
create index seating_notices_invitation on public.seating_notices (invitation_id, created_at desc);
create index seating_notices_pending on public.seating_notices (created_at) where status in ('queued', 'sending');
create index seating_notices_guest_id_idx on public.seating_notices (guest_id) where guest_id is not null;
create index seating_notices_owner_id_idx on public.seating_notices (owner_id);
create index seating_notices_table_id_idx on public.seating_notices (table_id) where table_id is not null;
create trigger seating_notices_touch before update on public.seating_notices
  for each row execute function public.touch_updated_at();

-- The seating's audit trail: every live re-seat from the event-day screen (a family moved, a table
-- merged into another) and every saved change to what guests were already told (a told family moved,
-- its table renumbered) — before and after, who, when, why. Undoing one records the undo as a change
-- of its own (undo_of) and marks the original (undone_at).
--   before / after: { "seats": { "<unit id>": "<table id>" | null }, "numbers": { "<table id>": n } }
--   (the numbers of every table involved, as they were then); units: [{ id, name, seats }] as they were.
create table public.seating_changes (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  -- move: families moved; merge: a table's families moved to another; renumber: tables renumbered
  kind text not null check (kind in ('move', 'merge', 'renumber')),
  -- live: the event-day screen; seating: a save of the seating screen
  source text not null check (source in ('live', 'seating')),
  before jsonb not null check (jsonb_typeof(before) = 'object'),
  after jsonb not null check (jsonb_typeof(after) = 'object'),
  units jsonb not null default '[]'::jsonb check (jsonb_typeof(units) = 'array'),
  reason text check (reason is null or char_length(reason) <= 200),
  actor_id uuid references auth.users(id) on delete set null,
  undo_of uuid references public.seating_changes(id) on delete set null,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index seating_changes_invitation on public.seating_changes (invitation_id, created_at desc);
create index seating_changes_actor_id_idx on public.seating_changes (actor_id) where actor_id is not null;
create index seating_changes_undo_of_idx on public.seating_changes (undo_of) where undo_of is not null;

-- ─── row level security: on, no policies (service role only) ────────────────────────────────────

alter table public.event_days enable row level security;
alter table public.checkins enable row level security;
alter table public.seating_notices enable row level security;
alter table public.seating_changes enable row level security;
revoke all on public.event_days, public.checkins, public.seating_notices, public.seating_changes
  from anon, authenticated;

-- ─── helpers ────────────────────────────────────────────────────────────────────────────────────

-- A guest's entrance code: derived from their personal link's token — the QR on their table guide and
-- on a printed card. One-way: the code never reveals the link (whoever photographs a QR at the door
-- can't answer the RSVP for the guest). The server derives the same code
-- (src/features/event-day/server/codes.ts).
create function public.checkin_code(p_token text) returns text
language sql stable set search_path = '' as $$
  select left(translate(encode(sha256(convert_to('badook-checkin:' || p_token, 'UTF8')), 'base64'), '+/', '-_'), 22)
$$;

-- What the event's pages show about it (the stations', the guide's and the host's).
create function public.event_day_invitation_json(i public.invitations) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id,
    'slug', i.slug,
    'status', i.status,
    'eventType', i.event_type,
    'templateId', i.template_id,
    'hosts', d.doc->'hosts',
    'date', d.doc#>>'{event,date}',
    'startTime', d.doc#>>'{event,startTime}',
    'timezone', d.doc->>'timezone',
    'locales', d.doc->'locales',
    'defaultLocale', d.doc->>'defaultLocale',
    'palette', d.doc#>'{theme,palette}'
  )
  from (select coalesce(i.published, i.draft) as doc) d
$$;

-- The families (units) of an event as the entrance and the host's live screen see them — all of them
-- (p_units null) or those listed: who, how many are expected, their table, how many arrived and when.
-- phoneTail: the last digits of their phone, to tell two "Cohen" families apart at the door.
create function public.checkin_parties(p_id uuid, p_units uuid[]) returns jsonb
language sql stable set search_path = '' as $$
  with u as (
    select x.* from public.seating_unit_rows(p_id) x where p_units is null or x.id = any(p_units)
  ), arr as (
    select c.unit_id,
           sum(c.count)::int as arrived,
           jsonb_agg(jsonb_build_object('id', c.id, 'count', c.count, 'at', c.arrived_at, 'station', c.station)
                     order by c.arrived_at, c.id) as rows
    from public.checkins c
    where c.invitation_id = p_id and c.deleted_at is null and (p_units is null or c.unit_id = any(p_units))
    group by c.unit_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'unitId', u.id,
      'guestId', u.guest_id,
      'name', u.name,
      'status', u.status,
      'seats', u.seats,
      'people', coalesce((
        select jsonb_agg(coalesce(
            nullif(btrim(a.full_name), ''),
            nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''),
            ''
          ) order by a.kind, a.position)
        from public.rsvp_attendees a
        where a.response_id = u.response_id and u.status = 'confirmed'
      ), '[]'::jsonb),
      'phoneTail', nullif(right(regexp_replace(coalesce(g.phone, r.phone, ''), '\D', '', 'g'), 4), ''),
      'table', case when t.id is null then null
                    else jsonb_build_object('id', t.id, 'number', t.number, 'label', t.label) end,
      'arrived', coalesce(arr.arrived, 0),
      'checkins', coalesce(arr.rows, '[]'::jsonb)
    ) order by u.name, u.id), '[]'::jsonb)
  from u
  left join arr on arr.unit_id = u.id
  left join public.seat_assignments sa on sa.unit_id = u.id
  left join public.seating_tables t on t.id = sa.table_id and t.deleted_at is null
  left join public.invitation_guests g on g.id = u.guest_id
  left join public.rsvp_responses r on r.id = u.response_id
$$;

-- The hall's numbers: people and families expected (those coming, and those who haven't replied but
-- were seated), and how many of them arrived.
create function public.checkin_totals(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  with u as (
    select x.id, x.seats, x.status,
           exists (select 1 from public.seat_assignments a where a.unit_id = x.id) as seated
    from public.seating_unit_rows(p_id) x
  ), arr as (
    select c.unit_id, sum(c.count)::int as arrived
    from public.checkins c where c.invitation_id = p_id and c.deleted_at is null
    group by c.unit_id
  )
  select jsonb_build_object(
    'expected', coalesce(sum(u.seats) filter (where u.status = 'confirmed' or (u.status = 'pending' and u.seated)), 0),
    'parties', count(*) filter (where u.seats > 0 and (u.status = 'confirmed' or (u.status = 'pending' and u.seated))),
    'arrived', coalesce(sum(arr.arrived), 0),
    'arrivedParties', count(arr.unit_id)
  )
  from u left join arr on arr.unit_id = u.id
$$;

-- The latest check-ins of the event (every station and the host), newest first.
create function public.checkin_recent(p_id uuid, p_limit int) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.arrived_at desc, x.id desc), '[]'::jsonb)
  from (
    select c.id, c.arrived_at,
           jsonb_build_object('id', c.id, 'unitId', c.unit_id, 'count', c.count, 'at', c.arrived_at,
                              'station', c.station, 'name', coalesce(g.name, r.primary_name, '')) as j
    from public.checkins c
    join public.seating_units u on u.id = c.unit_id
    left join public.invitation_guests g on g.id = u.guest_id
    left join public.rsvp_responses r on r.id = u.response_id
    where c.invitation_id = p_id and c.deleted_at is null
    order by c.arrived_at desc, c.id desc
    limit least(greatest(p_limit, 1), 100)
  ) x
$$;

-- Checks a family in: p_count people now (a retried request with the same id changes nothing).
-- { ok, checkinId, party, totals } | { ok: false, code: 'not_found' | 'invalid' }.
create function public.checkin_add(p_id uuid, p_checkin_id uuid, p_unit_id uuid, p_count int, p_station text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_guest uuid;
  v_station text := left(coalesce(nullif(btrim(p_station), ''), 'station'), 40);
begin
  if p_checkin_id is null or p_count is null or p_count not between 1 and 99 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  select guest_id into v_guest from public.seating_units where id = p_unit_id and invitation_id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into public.checkins (id, invitation_id, unit_id, guest_id, count, station)
  values (p_checkin_id, p_id, p_unit_id, v_guest, p_count, v_station)
  on conflict (id) do nothing;
  return jsonb_build_object(
    'ok', true,
    'checkinId', p_checkin_id,
    'party', public.checkin_parties(p_id, array[p_unit_id])->0,
    'totals', public.checkin_totals(p_id)
  );
end $$;

-- Undoes a check-in of the event (again: nothing changes). { ok, party, totals } | { ok: false, code:
-- 'not_found' }.
create function public.checkin_remove(p_id uuid, p_checkin_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_unit uuid;
begin
  select unit_id into v_unit from public.checkins where id = p_checkin_id and invitation_id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  update public.checkins set deleted_at = now()
  where id = p_checkin_id and invitation_id = p_id and deleted_at is null;
  return jsonb_build_object(
    'ok', true,
    'party', public.checkin_parties(p_id, array[v_unit])->0,
    'totals', public.checkin_totals(p_id)
  );
end $$;

-- The event whose entrance stations this link opens (null: unknown, or the invitation is archived).
create function public.event_day_by_station(p_token_hash text) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.invitation_id
  from public.event_days d
  join public.invitations i on i.id = d.invitation_id
  where d.station_token_hash = p_token_hash and i.status <> 'archived'
$$;

-- ─── the entrance stations (by the station link's hash; rate-limited per address) ───────────────

-- A station opens: the event, its Realtime channel, the hall's numbers and the latest arrivals (the
-- units are brought in step with the guest list first). null for an unknown link; { ok: false, code:
-- 'rate' } past the limit (p_rate_key: the server's salted hash of the address).
create function public.checkin_station_open(p_token_hash text, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  i public.invitations;
  d public.event_days;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 3000, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  v_id := public.event_day_by_station(p_token_hash);
  if v_id is null then
    return null;
  end if;
  perform public.seating_sync_units(v_id);
  select * into i from public.invitations where id = v_id;
  select * into d from public.event_days where invitation_id = v_id;
  return jsonb_build_object(
    'ok', true,
    'invitation', public.event_day_invitation_json(i),
    'channel', d.channel,
    'totals', public.checkin_totals(v_id),
    'recent', public.checkin_recent(v_id, 20)
  );
end $$;

-- The family of an entrance code (a guest's QR). { ok, party } | { ok: false, code: 'unknown_code' |
-- 'rate' } | null for an unknown link.
create function public.checkin_station_find(p_token_hash text, p_code text, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_guest uuid;
  v_unit uuid;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 3000, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  v_id := public.event_day_by_station(p_token_hash);
  if v_id is null then
    return null;
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('ok', false, 'code', 'unknown_code');
  end if;
  select g.id into v_guest from public.invitation_guests g
  where g.invitation_id = v_id and public.checkin_code(g.token) = p_code;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'unknown_code');
  end if;
  select id into v_unit from public.seating_units where guest_id = v_guest;
  if not found then
    -- a guest added since the units were last brought in step
    perform public.seating_sync_units(v_id);
    select id into v_unit from public.seating_units where guest_id = v_guest;
  end if;
  if v_unit is null then
    return jsonb_build_object('ok', false, 'code', 'unknown_code');
  end if;
  return jsonb_build_object('ok', true, 'party', public.checkin_parties(v_id, array[v_unit])->0);
end $$;

-- Families by name (the guest list's, the reply's, the people in the reply) or phone digits — at most
-- 20, names that start with the words first. { ok, parties } | { ok: false, code: 'rate' } | null.
create function public.checkin_station_search(p_token_hash text, p_query text, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_like text;
  v_prefix text;
  v_digits text;
  v_ids uuid[];
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 3000, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  v_id := public.event_day_by_station(p_token_hash);
  if v_id is null then
    return null;
  end if;
  v_q := left(regexp_replace(v_q, '\s+', ' ', 'g'), 60);
  if char_length(v_q) < 2 then
    return jsonb_build_object('ok', true, 'parties', '[]'::jsonb);
  end if;
  perform public.seating_sync_units(v_id);
  -- the query as a LIKE pattern (its own % and _ taken literally)
  v_prefix := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_like := '%' || v_prefix;
  -- phone digits: 052-1234567, 0521234567 and +972521234567 all end in 521234567
  v_digits := ltrim(regexp_replace(v_q, '\D', '', 'g'), '0');
  select array_agg(x.id order by x.starts desc, x.name, x.id) into v_ids
  from (
    select u.id, coalesce(g.name, r.primary_name, '') as name,
           lower(coalesce(g.name, r.primary_name, '')) like v_prefix as starts
    from public.seating_units u
    left join public.invitation_guests g on g.id = u.guest_id
    left join public.rsvp_responses r on r.id = u.response_id
    where u.invitation_id = v_id
      and (
        lower(coalesce(g.name, '')) like v_like
        or lower(coalesce(r.primary_name, '')) like v_like
        or exists (
          select 1 from public.rsvp_attendees a
          where a.response_id = u.response_id
            and lower(concat_ws(' ', a.full_name, a.first_name, a.last_name)) like v_like
        )
        or (char_length(v_digits) >= 3 and (
          regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
          or regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
        ))
      )
    order by 3 desc, 2, 1
    limit 20
  ) x;
  return jsonb_build_object(
    'ok', true,
    'parties', case when v_ids is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(p order by array_position(v_ids, (p->>'unitId')::uuid)), '[]'::jsonb)
      from jsonb_array_elements(public.checkin_parties(v_id, v_ids)) p
    ) end
  );
end $$;

-- A station checks a family in (p_checkin_id: the station's own id for this arrival).
create function public.checkin_station_arrive(
  p_token_hash text, p_checkin_id uuid, p_unit_id uuid, p_count int, p_station text, p_rate_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 3000, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  v_id := public.event_day_by_station(p_token_hash);
  if v_id is null then
    return null;
  end if;
  return public.checkin_add(v_id, p_checkin_id, p_unit_id, p_count, p_station);
end $$;

-- A station undoes a check-in of the event.
create function public.checkin_station_undo(p_token_hash text, p_checkin_id uuid, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 3000, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  v_id := public.event_day_by_station(p_token_hash);
  if v_id is null then
    return null;
  end if;
  return public.checkin_remove(v_id, p_checkin_id);
end $$;

-- ─── the guest's table guide (by their personal link's hash; rate-limited) ──────────────────────

-- What a guest's table guide shows (/e/<slug>/table?g=<their personal link's token>): the event, their
-- name, their family's table — or none yet — and the hall: the floor plan, the landmarks and every
-- table's place and number. Never anyone else's name, nor other tables' names. Only for a published
-- invitation. p_rate_key: the server's salted hash of the address; the link itself is limited too.
-- { ok: true, … } | { ok: false, code: 'rate' } | null (no such guest link).
create function public.seating_guide(p_slug text, p_token_hash text, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  g public.invitation_guests;
  l public.venue_layouts;
  v_unit public.seating_units;
  v_status text := null;
  v_seats int := null;
  v_table public.seating_tables;
  v_arrived int := 0;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 600, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into i from public.invitations where slug = p_slug and status = 'published';
  if not found then
    return null;
  end if;
  select * into g from public.invitation_guests
  where invitation_id = i.id and encode(sha256(convert_to(token, 'UTF8')), 'hex') = p_token_hash;
  if not found then
    return null;
  end if;
  -- one link: a guest reloading their map, not a machine
  if not public.gallery_rate_hit(encode(sha256(convert_to('guide-link:' || p_token_hash, 'UTF8')), 'hex'), 120, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;

  select * into v_unit from public.seating_units where guest_id = g.id;
  if found then
    select case when r.id is null then 'pending' when r.attending then 'confirmed' else 'declined' end,
           case when r.id is null then coalesce(g.party_size, 1)
                when r.attending then r.adults_count + r.children_count else 0 end
    into v_status, v_seats
    from (select 1) one
    left join public.rsvp_responses r on r.id = v_unit.response_id;
    select t.* into v_table
    from public.seat_assignments a
    join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
    where a.unit_id = v_unit.id;
    select coalesce(sum(c.count), 0)::int into v_arrived
    from public.checkins c where c.unit_id = v_unit.id and c.deleted_at is null;
  end if;
  select * into l from public.venue_layouts where invitation_id = i.id;

  return jsonb_build_object(
    'ok', true,
    'invitation', public.event_day_invitation_json(i),
    'guest', jsonb_build_object('id', g.id, 'name', g.name),
    'unit', case when v_unit.id is null then null
                 else jsonb_build_object('id', v_unit.id, 'status', v_status, 'seats', v_seats) end,
    'table', case when v_table.id is null then null else jsonb_build_object(
      'id', v_table.id, 'number', v_table.number, 'label', v_table.label, 'shape', v_table.shape,
      'capacity', v_table.capacity, 'x', v_table.x, 'y', v_table.y, 'w', v_table.w, 'h', v_table.h,
      'rotation', v_table.rotation) end,
    'arrived', v_arrived,
    'layout', jsonb_build_object(
      -- a PDF plan isn't drawn on phones (the host's screen turns it into an image when they open it)
      'background', case when l.background_path is null or l.background_type = 'application/pdf' then null
        else jsonb_build_object('path', l.background_path, 'type', l.background_type,
                                'width', l.background_width, 'height', l.background_height) end,
      'metersPerPixel', l.meters_per_pixel,
      'landmarks', coalesce(l.landmarks, '[]'::jsonb)
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'number', t.number, 'shape', t.shape, 'capacity', t.capacity,
          'x', t.x, 'y', t.y, 'w', t.w, 'h', t.h, 'rotation', t.rotation
        ) order by t.number)
      from public.seating_tables t
      where t.invitation_id = i.id and t.deleted_at is null
    ), '[]'::jsonb)
  );
end $$;

-- ─── what guests were told (the freeze) ─────────────────────────────────────────────────────────

-- Each family's latest notice that didn't fail: what it knows about its table.
create function public.seating_told(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(x.unit_id, jsonb_build_object(
      'tableId', x.table_id, 'number', x.table_number, 'label', x.table_label, 'channel', x.channel,
      'status', x.status, 'at', x.created_at)), '{}'::jsonb)
  from (
    select distinct on (n.unit_id) n.*
    from public.seating_notices n
    where n.invitation_id = p_id and n.status <> 'failed'
    order by n.unit_id, n.created_at desc
  ) x
$$;

-- Where the told families sit now: { "<unit id>": { "table": id | null, "number": n | null } }.
create function public.seating_told_positions(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(u.id, jsonb_build_object('table', t.id, 'number', t.number)), '{}'::jsonb)
  from public.seating_units u
  left join public.seat_assignments a on a.unit_id = u.id
  left join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
  where u.invitation_id = p_id
    and exists (select 1 from public.seating_notices n where n.unit_id = u.id and n.status <> 'failed')
$$;

-- The notices dialog: every family with a seat to tell (coming, or seated before replying), whether it
-- can get a WhatsApp from the system's number, its personal link, its table now and what it was told.
-- null when the event isn't the owner's.
create function public.seating_notices_state(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_told jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  v_told := public.seating_told(p_id);
  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'unitId', u.id,
          'guestId', u.guest_id,
          'name', u.name,
          'seats', u.seats,
          'status', u.status,
          'phone', g.phone,
          'token', g.token,
          'reach', case
            when g.id is null or g.phone is null then 'none'
            when not public.whatsapp_capable(g.phone) then 'landline'
            when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'opted_out'
            else 'ok' end,
          'table', case when t.id is null then null
                        else jsonb_build_object('id', t.id, 'number', t.number, 'label', t.label) end,
          'told', v_told->(u.id::text),
          'queued', exists (
            select 1 from public.seating_notices n where n.unit_id = u.id and n.status in ('queued', 'sending'))
        ) order by u.name, u.id)
      from public.seating_unit_rows(p_id) u
      left join public.invitation_guests g on g.id = u.guest_id
      left join public.seat_assignments a on a.unit_id = u.id
      left join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
      where (u.status = 'confirmed' and u.seats > 0) or t.id is not null or v_told ? u.id::text
    ), '[]'::jsonb)
  );
end $$;

-- The chosen families as a notice would find them: guest, phone, table now — and why one can't get a
-- WhatsApp now (null: it can): 'noPhone' (no guest-list phone), 'landline', 'optedOut' (asked us to
-- stop), 'noTable', 'queued' (a message with the same number is already on its way).
create function public.seating_notice_candidates(p_id uuid, p_unit_ids uuid[])
returns table (unit_id uuid, guest_id uuid, phone text, table_id uuid, number int, label text, reason text)
language sql stable set search_path = '' as $$
  select u.id, g.id, g.phone, t.id, t.number, t.label,
    case
      when g.id is null or g.phone is null then 'noPhone'
      when not public.whatsapp_capable(g.phone) then 'landline'
      when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'optedOut'
      when t.id is null then 'noTable'
      when exists (
        select 1 from public.seating_notices n
        where n.unit_id = u.id and n.status in ('queued', 'sending') and n.table_number = t.number
      ) then 'queued'
    end
  from public.seating_units u
  left join public.invitation_guests g on g.id = u.guest_id
  left join public.seat_assignments a on a.unit_id = u.id
  left join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
  where u.invitation_id = p_id and u.id = any(p_unit_ids)
$$;

-- Queues a WhatsApp from the system's number to each chosen family that sits at a table, paying one
-- credit each: its table's number and a link to its guide. Never queued, never charged: the families
-- seating_notice_candidates leaves out. { ok: true, queued, balance } | { ok: false, code: 'credits',
-- needed, balance } | { ok: false, code: 'nobody' | 'not_published' } — each with skipped: { noPhone,
-- landline, optedOut, noTable, queued } when any family was left out — or null.
create function public.seating_notice_queue(p_id uuid, p_owner uuid, p_unit_ids uuid[], p_price_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  n int;
  v_balance int;
  v_skipped jsonb := '{}'::jsonb;
begin
  select status into v_status from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  if v_status <> 'published' then
    return jsonb_build_object('ok', false, 'code', 'not_published');
  end if;
  perform public.account_get(p_owner);
  -- one queue at a time for these families (two clicks never queue twice)
  perform 1 from public.seating_units where invitation_id = p_id and id = any(p_unit_ids) for update;
  select count(*) filter (where c.reason is null),
         case when count(*) filter (where c.reason is not null) = 0 then '{}'::jsonb
              else jsonb_build_object('skipped', jsonb_build_object(
                'noPhone', count(*) filter (where c.reason = 'noPhone'),
                'landline', count(*) filter (where c.reason = 'landline'),
                'optedOut', count(*) filter (where c.reason = 'optedOut'),
                'noTable', count(*) filter (where c.reason = 'noTable'),
                'queued', count(*) filter (where c.reason = 'queued'))) end
  into n, v_skipped
  from public.seating_notice_candidates(p_id, p_unit_ids) c;
  if n = 0 then
    return jsonb_build_object('ok', false, 'code', 'nobody') || v_skipped;
  end if;
  update public.accounts set message_credits = message_credits - n
  where user_id = p_owner and message_credits >= n
  returning message_credits into v_balance;
  if not found then
    select message_credits into v_balance from public.accounts where user_id = p_owner;
    return jsonb_build_object('ok', false, 'code', 'credits', 'needed', n, 'balance', coalesce(v_balance, 0))
      || v_skipped;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_owner, -n, 'whatsapp_send', p_id::text);
  insert into public.seating_notices (
    invitation_id, unit_id, guest_id, owner_id, table_id, table_number, table_label, channel, status,
    to_phone, price_usd
  )
  select p_id, c.unit_id, c.guest_id, p_owner, c.table_id, c.number, c.label, 'whatsapp', 'queued',
         c.phone, p_price_usd
  from public.seating_notice_candidates(p_id, p_unit_ids) c
  where c.reason is null;
  return jsonb_build_object('ok', true, 'queued', n, 'balance', v_balance) || v_skipped;
end $$;

-- The host told these families their table themselves (their own WhatsApp, a card, in person):
-- recorded with each one's table now. Families without a table are skipped. Returns how many, or null.
create function public.seating_notice_mark(p_id uuid, p_owner uuid, p_unit_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.seating_notices (
    invitation_id, unit_id, guest_id, owner_id, table_id, table_number, table_label, channel, status
  )
  select p_id, u.id, u.guest_id, p_owner, t.id, t.number, t.label, 'manual', 'sent'
  from public.seating_units u
  join public.seat_assignments a on a.unit_id = u.id
  join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
  where u.invitation_id = p_id and u.id = any(p_unit_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── sending the notices (the server's queue, like the invitations' — *_guests_whatsapp_fixes.sql) ─

-- Gives a notice's credit back to its host — once, whatever reports the failure first.
create function public.seating_notice_refund(p_notice_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  update public.seating_notices set refunded_at = now()
  where id = p_notice_id and channel = 'whatsapp' and refunded_at is null
  returning owner_id into v_owner;
  if not found then
    return false;
  end if;
  update public.accounts set message_credits = message_credits + 1 where user_id = v_owner;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (v_owner, 1, 'whatsapp_refund', p_notice_id::text);
  return true;
end $$;

-- The API's answer for a notice being sent: its WhatsApp id (sent) or the error (failed — the credit
-- goes back; a phone that turned off our messages, 131050, goes on the do-not-send list).
create function public.seating_notice_result(p_notice_id uuid, p_wa_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.seating_notices;
begin
  update public.seating_notices set
    wa_message_id = p_wa_id,
    status = case when p_wa_id is null then 'failed' else 'sent' end,
    error = left(p_error, 300),
    next_attempt_at = null
  where id = p_notice_id and status = 'sending'
  returning * into m;
  if not found then
    return;
  end if;
  if p_wa_id is null then
    perform public.seating_notice_refund(m.id);
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
end $$;

-- Claims up to p_limit notices that are due (queued, past their next try's time) — of one invitation,
-- or any when p_id is null — with what the template needs. A notice to a phone that asked us to stop
-- after it was queued fails instead (refunded); one left in 'sending' for 10 minutes is never sent again
-- (Meta may already have it): it fails as 'timeout' and its credit goes back.
create function public.seating_notice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select n.id from public.seating_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.seating_notice_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select n.id from public.seating_notices n
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = n.to_phone)
    for update skip locked
  loop
    update public.seating_notices set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.seating_notice_result(v_msg, null, 'opted_out');
  end loop;
  with picked as (
    select n.id from public.seating_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'queued' and (n.next_attempt_at is null or n.next_attempt_at <= now())
    order by coalesce(n.next_attempt_at, n.created_at), n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.seating_notices n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'invitationId', c.invitation_id,
      'toPhone', c.to_phone,
      'attempts', c.attempts,
      'guestName', g.name,
      'guestToken', g.token,
      'slug', i.slug,
      'tableNumber', c.table_number,
      'tableLabel', c.table_label,
      'document', i.published
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id;
  return v;
end $$;

-- A temporary failure (Meta's rate limits, a connection that never got through): back in the queue,
-- due again p_wait_seconds later — at most 3 tries, then it fails and its credit goes back. false when
-- it won't be tried again.
create function public.seating_notice_requeue(p_notice_id uuid, p_error text, p_wait_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.seating_notices where id = p_notice_id and status = 'sending' for update;
  if not found then
    return false;
  end if;
  if n >= 3 then
    perform public.seating_notice_result(p_notice_id, null, p_error);
    return false;
  end if;
  update public.seating_notices set
    status = 'queued', claimed_at = null, error = left(p_error, 300),
    next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_wait_seconds, 0), 0))
  where id = p_notice_id;
  return true;
end $$;

-- A status from Meta's webhook for a notice (false: not a notice's id, or out of order). Statuses only
-- move forward; 'failed' before delivery refunds the credit, once; 131050 → the do-not-send list.
create function public.seating_notice_status(p_wa_id text, p_status text, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m public.seating_notices;
  rank_of constant jsonb := '{"queued":0,"sending":1,"sent":2,"delivered":3,"read":4,"failed":1}';
begin
  select * into m from public.seating_notices where wa_message_id = p_wa_id for update;
  if not found or p_status not in ('sent', 'delivered', 'read', 'failed') then
    return false;
  end if;
  if p_status = 'failed' then
    if m.status = 'read' then
      return false;
    end if;
  elsif (rank_of->>p_status)::int <= (rank_of->>m.status)::int and m.status <> 'failed' then
    return false;
  end if;
  update public.seating_notices set status = p_status, error = left(p_error, 300) where id = m.id;
  if p_status = 'failed' then
    if m.status not in ('delivered', 'read') then
      perform public.seating_notice_refund(m.id);
    end if;
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
  return true;
end $$;

-- How many of an invitation's notices the page can still send now (due, or being sent).
create function public.seating_notice_pending(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.seating_notices
  where invitation_id = p_id
    and (status = 'sending' or (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())))
$$;

-- ─── the audit trail and live re-seating ────────────────────────────────────────────────────────

-- Records a change that already happened. p_before / p_after: { seats, numbers } (the numbers of every
-- table involved, filled in here from the tables as they are now when missing).
create function public.seating_record_change(
  p_id uuid, p_actor uuid, p_kind text, p_source text, p_reason text, p_before jsonb, p_after jsonb,
  p_undo_of uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.seating_changes;
  v_tables uuid[];
  v_numbers jsonb;
begin
  -- every table a family left or joined, and every renumbered one
  select array_agg(distinct x::uuid) into v_tables
  from (
    select value as x from jsonb_each_text(coalesce(p_before->'seats', '{}')) where value is not null
    union select value from jsonb_each_text(coalesce(p_after->'seats', '{}')) where value is not null
    union select key from jsonb_each_text(coalesce(p_before->'numbers', '{}'))
    union select key from jsonb_each_text(coalesce(p_after->'numbers', '{}'))
  ) s;
  select coalesce(jsonb_object_agg(t.id, t.number), '{}'::jsonb) into v_numbers
  from public.seating_tables t where t.id = any(coalesce(v_tables, '{}'));
  insert into public.seating_changes (invitation_id, kind, source, before, after, units, reason, actor_id, undo_of)
  values (
    p_id, p_kind, p_source,
    jsonb_build_object('seats', coalesce(p_before->'seats', '{}'),
                       'numbers', v_numbers || coalesce(p_before->'numbers', '{}')),
    jsonb_build_object('seats', coalesce(p_after->'seats', '{}'),
                       'numbers', v_numbers || coalesce(p_after->'numbers', '{}')),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'seats', u.seats) order by u.name, u.id)
      from public.seating_unit_rows(p_id) u
      where (coalesce(p_before->'seats', '{}') ? u.id::text) or (coalesce(p_after->'seats', '{}') ? u.id::text)
    ), '[]'::jsonb),
    nullif(btrim(left(p_reason, 200)), ''),
    p_actor, p_undo_of
  )
  returning * into v;
  return public.seating_change_json(v);
end $$;

-- A change as the screens show it: each family from where to where (table ids and numbers as they were
-- then), each renumbered table, and whether it was undone (or undoes another).
create function public.seating_change_json(c public.seating_changes) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'kind', c.kind,
    'source', c.source,
    'reason', c.reason,
    'at', c.created_at,
    'actorId', c.actor_id,
    'undoOf', c.undo_of,
    'undoneAt', c.undone_at,
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', u->>'id', 'name', u->>'name', 'seats', (u->>'seats')::int,
          'from', case when c.before->'seats'->>(u->>'id') is null then null else jsonb_build_object(
            'id', c.before->'seats'->>(u->>'id'),
            'number', (c.before->'numbers'->>(c.before->'seats'->>(u->>'id')))::int) end,
          'to', case when c.after->'seats'->>(u->>'id') is null then null else jsonb_build_object(
            'id', c.after->'seats'->>(u->>'id'),
            'number', (c.after->'numbers'->>(c.after->'seats'->>(u->>'id')))::int) end
        ) order by u->>'name', u->>'id')
      from jsonb_array_elements(c.units) u
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.key, 'from', (b.value)::int, 'to', (c.after->'numbers'->>b.key)::int)
                       order by (b.value)::int)
      from jsonb_each_text(c.before->'numbers') b
      where c.after->'numbers'->>b.key is distinct from b.value
    ), '[]'::jsonb)
  )
$$;

-- Moves families (p_seats: { "<unit id>": "<table id>" | null }) and renumbers tables (p_numbers:
-- { "<table id>": n }) — checked by the caller — and records it. The layout's version moves on, so an
-- open seating screen picks the change up (and merges its own on top of it).
create function public.seating_apply_change(
  p_id uuid, p_actor uuid, p_kind text, p_source text, p_reason text, p_seats jsonb, p_numbers jsonb,
  p_undo_of uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_numbers_before jsonb;
begin
  select coalesce(jsonb_object_agg(s.key, a.table_id), '{}'::jsonb) into v_before
  from jsonb_each_text(coalesce(p_seats, '{}')) s
  left join public.seat_assignments a on a.unit_id = s.key::uuid;
  select coalesce(jsonb_object_agg(t.id, t.number), '{}'::jsonb) into v_numbers_before
  from jsonb_each_text(coalesce(p_numbers, '{}')) n
  join public.seating_tables t on t.id = n.key::uuid;

  -- seats
  delete from public.seat_assignments a
  using jsonb_each_text(coalesce(p_seats, '{}')) s
  where a.unit_id = s.key::uuid and a.invitation_id = p_id;
  insert into public.seat_assignments (unit_id, invitation_id, table_id, source)
  select s.key::uuid, p_id, s.value::uuid, 'host'
  from jsonb_each_text(coalesce(p_seats, '{}')) s
  where s.value is not null;

  -- numbers: the tables step aside first (their numbers free), so two may swap
  if p_numbers is not null and p_numbers <> '{}'::jsonb then
    update public.seating_tables t set deleted_at = now()
    from jsonb_each_text(p_numbers) n
    where t.id = n.key::uuid and t.invitation_id = p_id and t.deleted_at is null;
    update public.seating_tables t set number = n.value::int, deleted_at = null, updated_at = now()
    from jsonb_each_text(p_numbers) n
    where t.id = n.key::uuid and t.invitation_id = p_id;
  end if;

  update public.venue_layouts set version = version + 1 where invitation_id = p_id;
  return public.seating_record_change(
    p_id, p_actor, p_kind, p_source, p_reason,
    jsonb_build_object('seats', v_before, 'numbers', v_numbers_before),
    jsonb_build_object('seats', coalesce(p_seats, '{}'), 'numbers', coalesce(p_numbers, '{}')),
    p_undo_of
  );
end $$;

-- The seats one family takes, live: the people who came once it arrived (with the rest of its seats
-- still held for the others, until p_released); the seats it was given while it hasn't arrived — none
-- once p_released (45 minutes after the start the host's screen counts it as not coming).
create function public.seating_live_seats(p_seats int, p_arrived int, p_released boolean) returns int
language sql immutable set search_path = '' as $$
  select case when p_arrived > 0 then case when p_released then p_arrived else greatest(p_arrived, p_seats) end
              when p_released then 0 else p_seats end
$$;

-- How many seats families take at each of the event's tables, live: a family that arrived takes the
-- people who came; one that hasn't takes the seats it was given — unless p_released (45 minutes after
-- the start the host's screen counts them as not coming, and their seats as free).
create function public.seating_live_load(p_id uuid, p_released boolean, p_except uuid[]) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(x.table_id, x.load), '{}'::jsonb)
  from (
    select a.table_id, sum(public.seating_live_seats(u.seats, coalesce(arr.arrived, 0), p_released))::int as load
    from public.seat_assignments a
    join public.seating_unit_rows(p_id) u on u.id = a.unit_id
    left join (
      select c.unit_id, sum(c.count)::int as arrived from public.checkins c
      where c.invitation_id = p_id and c.deleted_at is null group by c.unit_id
    ) arr on arr.unit_id = u.id
    where a.invitation_id = p_id and not (a.unit_id = any(coalesce(p_except, '{}')))
    group by a.table_id
  ) x
$$;

-- Live seats the given families need.
create function public.seating_live_need(p_id uuid, p_units uuid[], p_released boolean) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(public.seating_live_seats(u.seats, coalesce((
    select sum(c.count)::int from public.checkins c where c.unit_id = u.id and c.deleted_at is null), 0),
    p_released)), 0)::int
  from public.seating_unit_rows(p_id) u
  where u.id = any(p_units)
$$;

-- The host moves a family to another table during the event (p_reason: why, optional). Refused when the
-- table's live seats (seating_live_load) can't take them — { ok: false, code: 'full', table, capacity,
-- load, need } — unless p_force (the host adds chairs). { ok: true, change } | { ok: false, code:
-- 'not_found' | 'same_table' } | null when the event isn't the owner's.
create function public.seating_live_move(
  p_id uuid, p_owner uuid, p_unit_id uuid, p_table_id uuid, p_reason text, p_released boolean, p_force boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.seating_tables;
  v_load int;
  v_need int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  -- one change at a time per event
  perform 1 from public.venue_layouts where invitation_id = p_id for update;
  select * into t from public.seating_tables where id = p_table_id and invitation_id = p_id and deleted_at is null;
  if not found or not exists (select 1 from public.seating_units where id = p_unit_id and invitation_id = p_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from public.seat_assignments where unit_id = p_unit_id and table_id = p_table_id) then
    return jsonb_build_object('ok', false, 'code', 'same_table');
  end if;
  v_load := coalesce((public.seating_live_load(p_id, p_released, array[p_unit_id])->>t.id::text)::int, 0);
  v_need := public.seating_live_need(p_id, array[p_unit_id], p_released);
  if not coalesce(p_force, false) and v_load + v_need > t.capacity then
    return jsonb_build_object('ok', false, 'code', 'full', 'table', t.number, 'capacity', t.capacity,
                              'load', v_load, 'need', v_need);
  end if;
  return jsonb_build_object('ok', true, 'change', public.seating_apply_change(
    p_id, p_owner, 'move', 'live', p_reason, jsonb_build_object(p_unit_id::text, p_table_id), '{}'::jsonb, null));
end $$;

-- The host merges one table into another during the event: every family at p_from moves to p_into.
-- Same check and answers as seating_live_move ('empty': nobody sits at p_from).
create function public.seating_live_merge(
  p_id uuid, p_owner uuid, p_from uuid, p_into uuid, p_reason text, p_released boolean, p_force boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.seating_tables;
  v_units uuid[];
  v_load int;
  v_need int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  perform 1 from public.venue_layouts where invitation_id = p_id for update;
  select * into t from public.seating_tables where id = p_into and invitation_id = p_id and deleted_at is null;
  if not found or p_from = p_into or not exists (
    select 1 from public.seating_tables where id = p_from and invitation_id = p_id and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select array_agg(unit_id order by unit_id) into v_units from public.seat_assignments where table_id = p_from;
  if v_units is null then
    return jsonb_build_object('ok', false, 'code', 'empty');
  end if;
  v_load := coalesce((public.seating_live_load(p_id, p_released, v_units)->>t.id::text)::int, 0);
  v_need := public.seating_live_need(p_id, v_units, p_released);
  if not coalesce(p_force, false) and v_load + v_need > t.capacity then
    return jsonb_build_object('ok', false, 'code', 'full', 'table', t.number, 'capacity', t.capacity,
                              'load', v_load, 'need', v_need);
  end if;
  return jsonb_build_object('ok', true, 'change', public.seating_apply_change(
    p_id, p_owner, 'merge', 'live', p_reason,
    (select jsonb_object_agg(u, p_into) from unnest(v_units) u), '{}'::jsonb, null));
end $$;

-- Undoes a change: families go back where it found them, renumbered tables get their numbers back —
-- only while things are still as it left them ({ ok: false, code: 'stale' }), a number it gives back
-- isn't another table's by now ('number_taken'), and the tables can take the families back ('full',
-- unless p_force). The undo is recorded as a change of its own. An undo can't be undone ('already'
-- for a change undone before). { ok: true, change } | { ok: false, code } | null when not the owner's.
create function public.seating_change_undo(
  p_id uuid, p_owner uuid, p_change_id uuid, p_released boolean, p_force boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.seating_changes;
  v_numbers jsonb;
  v_bad int;
  r record;
  v_change jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  perform 1 from public.venue_layouts where invitation_id = p_id for update;
  select * into c from public.seating_changes where id = p_change_id and invitation_id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if c.undone_at is not null or c.undo_of is not null then
    return jsonb_build_object('ok', false, 'code', 'already');
  end if;
  -- every family still where the change put it, every table it seated at still there
  if exists (
    select 1 from jsonb_each_text(c.after->'seats') s
    left join public.seat_assignments a on a.unit_id = s.key::uuid
    where a.table_id is distinct from s.value::uuid
  ) or exists (
    select 1 from jsonb_each_text(c.before->'seats') s
    where s.value is not null and not exists (
      select 1 from public.seating_tables t where t.id = s.value::uuid and t.deleted_at is null)
  ) or exists (
    select 1 from jsonb_each_text(c.before->'seats') s
    where not exists (select 1 from public.seating_units u where u.id = s.key::uuid)
  ) then
    return jsonb_build_object('ok', false, 'code', 'stale');
  end if;
  -- the renumbered tables still carry the numbers it gave them
  select coalesce(jsonb_object_agg(b.key, b.value::int), '{}'::jsonb) into v_numbers
  from jsonb_each_text(c.before->'numbers') b
  where c.after->'numbers'->>b.key is distinct from b.value;
  if exists (
    select 1 from jsonb_each_text(v_numbers) n
    left join public.seating_tables t on t.id = n.key::uuid and t.deleted_at is null
    where t.number is distinct from (c.after->'numbers'->>n.key)::int
  ) then
    return jsonb_build_object('ok', false, 'code', 'stale');
  end if;
  select count(*) into v_bad
  from jsonb_each_text(v_numbers) n
  join public.seating_tables t on t.invitation_id = p_id and t.deleted_at is null and t.number = n.value::int
  where not (v_numbers ? t.id::text);
  if v_bad > 0 then
    return jsonb_build_object('ok', false, 'code', 'number_taken');
  end if;
  -- the tables can take the families back
  if not coalesce(p_force, false) then
    for r in
      select s.value::uuid as table_id, array_agg(s.key::uuid) as units
      from jsonb_each_text(c.before->'seats') s
      where s.value is not null and s.value::uuid is distinct from (c.after->'seats'->>s.key)::uuid
      group by s.value
    loop
      if coalesce((public.seating_live_load(p_id, p_released, r.units)->>r.table_id::text)::int, 0)
         + public.seating_live_need(p_id, r.units, p_released)
         > (select capacity from public.seating_tables where id = r.table_id) then
        return jsonb_build_object('ok', false, 'code', 'full',
          'table', (select number from public.seating_tables where id = r.table_id));
      end if;
    end loop;
  end if;
  v_change := public.seating_apply_change(
    p_id, p_owner, c.kind, c.source, null, c.before->'seats', v_numbers, c.id);
  update public.seating_changes set undone_at = now() where id = c.id;
  return jsonb_build_object('ok', true, 'change', v_change);
end $$;

-- The event's changes, newest first (null when not the owner's).
create function public.seating_changes_list(p_id uuid, p_owner uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.seating_change_json(x) order by x.created_at desc, x.id desc)
    from (
      select * from public.seating_changes where invitation_id = p_id
      order by created_at desc, id desc
      limit least(greatest(p_limit, 1), 200)
    ) x
  ), '[]'::jsonb);
end $$;

-- The seating screen's save (seating_save, unchanged) that also keeps the freeze's audit trail: a
-- family that was told its table and now sits elsewhere, or at a table with another number, is
-- recorded in seating_changes (source 'seating'). The answer is seating_save's, with `changed`: the
-- told families whose table or number this save changed.
create function public.seating_save_tracked(p_id uuid, p_owner uuid, p_version int, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_answer jsonb;
  v_changed jsonb;
  v_moved boolean;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  v_before := public.seating_told_positions(p_id);
  v_answer := public.seating_save(p_id, p_owner, p_version, p_plan);
  if v_answer is null or not coalesce((v_answer->>'ok')::boolean, false) then
    return v_answer;
  end if;
  v_after := public.seating_told_positions(p_id);
  select coalesce(jsonb_agg(b.key order by b.key), '[]'::jsonb),
         coalesce(bool_or(b.value->>'table' is distinct from v_after->b.key->>'table'), false)
  into v_changed, v_moved
  from jsonb_each(v_before) b
  where b.value is distinct from v_after->b.key;
  if jsonb_array_length(v_changed) > 0 then
    perform public.seating_record_change(
      p_id, p_owner, case when v_moved then 'move' else 'renumber' end, 'seating', null,
      jsonb_build_object(
        'seats', (select jsonb_object_agg(k, v_before->k->>'table') from jsonb_array_elements_text(v_changed) k),
        'numbers', (select coalesce(jsonb_object_agg(v_before->k->>'table', (v_before->k->>'number')::int), '{}')
                    from jsonb_array_elements_text(v_changed) k where v_before->k->>'table' is not null)),
      jsonb_build_object(
        'seats', (select jsonb_object_agg(k, v_after->k->>'table') from jsonb_array_elements_text(v_changed) k),
        'numbers', (select coalesce(jsonb_object_agg(v_after->k->>'table', (v_after->k->>'number')::int), '{}')
                    from jsonb_array_elements_text(v_changed) k where v_after->k->>'table' is not null)),
      null
    );
  end if;
  return v_answer || jsonb_build_object('changed', v_changed);
end $$;

-- ─── the host's event day (the server passes the signed-in user's id; null when not theirs) ─────

-- The event day's settings — the station link's hash and nonce (the server derives the link from
-- them) and the channel — with what the screen shows about the event. day: null before it was set up.
create function public.event_day_owner_get(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
  d public.event_days;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  select * into d from public.event_days where invitation_id = p_id;
  return jsonb_build_object(
    'invitation', public.event_day_invitation_json(i),
    'day', case when d.invitation_id is null then null else jsonb_build_object(
      'stationTokenHash', d.station_token_hash,
      'stationTokenNonce', d.station_token_nonce,
      'channel', d.channel,
      'createdAt', d.created_at,
      'updatedAt', d.updated_at) end
  );
end $$;

-- Sets the event day up (its station link and channel) — or leaves an existing one as it is.
create function public.event_day_owner_setup(p_id uuid, p_owner uuid, p_hash text, p_nonce text, p_channel text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.event_days (invitation_id, station_token_hash, station_token_nonce, channel)
  values (p_id, p_hash, p_nonce, p_channel)
  on conflict (invitation_id) do nothing;
  return public.event_day_owner_get(p_id, p_owner);
end $$;

-- A new station link (the old one stops working at once) and a new channel.
create function public.event_day_owner_rotate(p_id uuid, p_owner uuid, p_hash text, p_nonce text, p_channel text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.event_days d set station_token_hash = p_hash, station_token_nonce = p_nonce, channel = p_channel
  from public.invitations i
  where d.invitation_id = p_id and i.id = d.invitation_id and i.owner_id = p_owner;
  if not found then
    return null;
  end if;
  return public.event_day_owner_get(p_id, p_owner);
end $$;

-- Everything the host's live screen shows: the hall (plan, landmarks, tables), every family with its
-- table and arrivals, the hall's numbers, the latest changes and what families were told. The units are
-- brought in step with the guest list first.
create function public.event_day_live(p_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  l public.venue_layouts;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  perform public.seating_sync_units(p_id);
  insert into public.venue_layouts (invitation_id) values (p_id) on conflict (invitation_id) do nothing;
  select * into l from public.venue_layouts where invitation_id = p_id;
  return jsonb_build_object(
    'invitation', public.event_day_invitation_json(i),
    'layout', jsonb_build_object(
      'version', l.version,
      'background', case when l.background_path is null then null else jsonb_build_object(
        'path', l.background_path, 'type', l.background_type,
        'width', l.background_width, 'height', l.background_height) end,
      'metersPerPixel', l.meters_per_pixel,
      'landmarks', l.landmarks
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'number', t.number, 'label', t.label, 'shape', t.shape, 'capacity', t.capacity,
          'x', t.x, 'y', t.y, 'w', t.w, 'h', t.h, 'rotation', t.rotation
        ) order by t.number)
      from public.seating_tables t
      where t.invitation_id = p_id and t.deleted_at is null
    ), '[]'::jsonb),
    'parties', public.checkin_parties(p_id, null),
    'totals', public.checkin_totals(p_id),
    'changes', coalesce((
      select jsonb_agg(public.seating_change_json(x) order by x.created_at desc, x.id desc)
      from (select * from public.seating_changes where invitation_id = p_id order by created_at desc, id desc limit 30) x
    ), '[]'::jsonb),
    'told', public.seating_told(p_id)
  );
end $$;

-- The host checks a family in from their own screen (station 'host'), or undoes a check-in.
create function public.checkin_owner_arrive(p_id uuid, p_owner uuid, p_checkin_id uuid, p_unit_id uuid, p_count int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return public.checkin_add(p_id, p_checkin_id, p_unit_id, p_count, 'host');
end $$;

create function public.checkin_owner_undo(p_id uuid, p_owner uuid, p_checkin_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return public.checkin_remove(p_id, p_checkin_id);
end $$;

-- ─── housekeeping (the daily run) ───────────────────────────────────────────────────────────────

-- What the privacy policy promises: arrivals are erased p_days after the event's date, and undone ones
-- after a day.
create function public.event_day_maintenance(p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
begin
  delete from public.checkins c
  using public.invitations i
  where c.invitation_id = i.id
    and coalesce(i.published, i.draft)#>>'{event,date}' ~ '^\d{4}-\d{2}-\d{2}$'
    and (coalesce(i.published, i.draft)#>>'{event,date}')::date < current_date - p_days;
  get diagnostics a = row_count;
  delete from public.checkins where deleted_at is not null and deleted_at < now() - interval '1 day';
  get diagnostics b = row_count;
  return jsonb_build_object('checkins', a, 'undone', b);
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  -- helpers: only the functions above run them
  foreach f in array array[
    'public.checkin_code(text)',
    'public.event_day_invitation_json(public.invitations)',
    'public.checkin_parties(uuid, uuid[])',
    'public.checkin_totals(uuid)',
    'public.checkin_recent(uuid, int)',
    'public.checkin_add(uuid, uuid, uuid, int, text)',
    'public.checkin_remove(uuid, uuid)',
    'public.event_day_by_station(text)',
    'public.seating_told(uuid)',
    'public.seating_told_positions(uuid)',
    'public.seating_notice_refund(uuid)',
    'public.seating_notice_candidates(uuid, uuid[])',
    'public.seating_record_change(uuid, uuid, text, text, text, jsonb, jsonb, uuid)',
    'public.seating_change_json(public.seating_changes)',
    'public.seating_apply_change(uuid, uuid, text, text, text, jsonb, jsonb, uuid)',
    'public.seating_live_load(uuid, boolean, uuid[])',
    'public.seating_live_seats(int, int, boolean)',
    'public.seating_live_need(uuid, uuid[], boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- what the server calls
  foreach f in array array[
    'public.checkin_station_open(text, text)',
    'public.checkin_station_find(text, text, text)',
    'public.checkin_station_search(text, text, text)',
    'public.checkin_station_arrive(text, uuid, uuid, int, text, text)',
    'public.checkin_station_undo(text, uuid, text)',
    'public.seating_guide(text, text, text)',
    'public.seating_notices_state(uuid, uuid)',
    'public.seating_notice_queue(uuid, uuid, uuid[], numeric)',
    'public.seating_notice_mark(uuid, uuid, uuid[])',
    'public.seating_notice_result(uuid, text, text)',
    'public.seating_notice_claim(uuid, int)',
    'public.seating_notice_requeue(uuid, text, int)',
    'public.seating_notice_status(text, text, text)',
    'public.seating_notice_pending(uuid)',
    'public.seating_live_move(uuid, uuid, uuid, uuid, text, boolean, boolean)',
    'public.seating_live_merge(uuid, uuid, uuid, uuid, text, boolean, boolean)',
    'public.seating_change_undo(uuid, uuid, uuid, boolean, boolean)',
    'public.seating_changes_list(uuid, uuid, int)',
    'public.seating_save_tracked(uuid, uuid, int, jsonb)',
    'public.event_day_owner_get(uuid, uuid)',
    'public.event_day_owner_setup(uuid, uuid, text, text, text)',
    'public.event_day_owner_rotate(uuid, uuid, text, text, text)',
    'public.event_day_live(uuid, uuid)',
    'public.checkin_owner_arrive(uuid, uuid, uuid, uuid, int)',
    'public.checkin_owner_undo(uuid, uuid, uuid)',
    'public.event_day_maintenance(int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
