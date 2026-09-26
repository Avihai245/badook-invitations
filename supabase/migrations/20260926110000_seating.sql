-- Seating (Phase 3): an event's floor plan, its tables, who sits where, and the host's rules — plus the
-- venues of the partner (Badook Events), whose floor plan a venue owner sends through the partner API so
-- their customers start seating from it. Same rules as before: row level security on and no policies;
-- every read and write goes through the functions below (security definer, search_path ''), which the
-- server calls with the service role only, after resolving the signed-in host (or verifying the
-- partner's key) — each function checks what it may touch itself.
--
-- Designed for what comes next (Phase 5: each guest's table number and a map to it, check-in at the
-- entrance, re-seating live with an audit trail): tables keep a stable id and a number that is unique
-- among the event's live tables, and a removed table is only marked removed; a "unit" (a family or a
-- party that sits together) keeps a stable id for as long as its guest or its reply exists.

-- ─── storage ────────────────────────────────────────────────────────────────────────────────────

-- Floor plans: the hosts' own (<owner id>/<invitation id>/…, uploaded from the seating screen — a PDF is
-- turned into an image in the browser first) and the venues' (venues/<venue id>/…, sent by the
-- partner; PNG, JPEG, WebP or PDF). Public reads, like invitation-media: the paths are unguessable and a
-- plan carries no guest data; the guests' map to their table (Phase 5) reads the same files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('venue-plans', 'venue-plans', true, 15728640,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ─── the partner's venues ───────────────────────────────────────────────────────────────────────

create table public.partner_venues (
  id uuid primary key default gen_random_uuid(),
  -- the partner that sent it ('partner:badook-events') and the partner's own id for the venue
  source text not null check (char_length(source) between 1 and 60),
  external_id text not null check (char_length(external_id) between 1 and 200),
  name text not null check (char_length(name) between 1 and 120),
  address text check (address is null or char_length(address) <= 300),
  -- the floor plan as stored in venue-plans; its size in pixels (unknown for a PDF until a browser
  -- renders it)
  plan_path text check (plan_path is null or char_length(plan_path) <= 300),
  plan_type text
    check (plan_type is null or plan_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  plan_width int check (plan_width is null or plan_width between 1 and 30000),
  plan_height int check (plan_height is null or plan_height between 1 and 30000),
  plan_bytes int check (plan_bytes is null or plan_bytes > 0),
  -- how many meters the plan's full width shows: its scale, so the host doesn't have to calibrate
  width_meters numeric(7, 2) check (width_meters is null or (width_meters > 0 and width_meters <= 5000)),
  plan_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_venues_plan_whole check ((plan_path is null) = (plan_type is null))
);
create unique index partner_venues_external on public.partner_venues (source, external_id);
create trigger partner_venues_touch before update on public.partner_venues
  for each row execute function public.touch_updated_at();

-- The venue a partner's user (the venue owner's customer) belongs to — one per user. Seating for that
-- user's events starts from the venue's floor plan.
create table public.partner_venue_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  venue_id uuid not null references public.partner_venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partner_venue_users_venue_id_idx on public.partner_venue_users (venue_id);
create trigger partner_venue_users_touch before update on public.partner_venue_users
  for each row execute function public.touch_updated_at();

-- ─── an event's floor plan and tables ───────────────────────────────────────────────────────────

-- One per event. Coordinates on the plan are in meters (x to the right, y down, from the plan's top
-- left corner): tables keep their real size whatever the image's resolution, and calibrating the plan
-- only changes how many meters one of its pixels is.
create table public.venue_layouts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations (id) on delete cascade,
  -- the floor plan under the tables (venue-plans bucket); null: an empty room with a grid
  background_path text check (background_path is null or char_length(background_path) <= 300),
  background_type text check (
    background_type is null or background_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')
  ),
  -- the plan's size in pixels (null for a venue's PDF until the host's browser renders it)
  background_width int check (background_width is null or background_width between 1 and 30000),
  background_height int check (background_height is null or background_height between 1 and 30000),
  -- from calibration (a line drawn on the plan and its length in meters), or from the venue's width;
  -- null: not calibrated yet (the screen assumes a typical hall and says so)
  meters_per_pixel numeric(14, 8) check (meters_per_pixel is null or meters_per_pixel > 0),
  -- where the plan came from: the host's upload, the venue (partner), or 'none' — the host removed it
  -- (then the venue's plan isn't put back by itself); null: never set
  source text check (source is null or source in ('upload', 'partner', 'none')),
  venue_id uuid references public.partner_venues (id) on delete set null,
  -- the venue's plan the background came from (a PDF's rendering still points at the PDF): the screen
  -- offers the venue's plan again once the venue sends a new one
  venue_plan_path text check (venue_plan_path is null or char_length(venue_plan_path) <= 300),
  grid_m numeric(4, 2) not null default 0.5 check (grid_m between 0.1 and 5),
  -- the stage, dance floor, bar, entrance and exits drawn on the plan: [{ id, kind, x, y, w, h, rotation,
  -- label }] (validated by the server; the solver measures "near the stage" from them)
  landmarks jsonb not null default '[]'::jsonb check (jsonb_typeof(landmarks) = 'array'),
  -- the host's choices for the automatic seating: { categories: 'group' | 'mix' | 'ignore', minFill }
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  -- bumped by every save: two windows (or two hosts) editing at once never overwrite each other blindly
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_layouts_background_whole check ((background_path is null) = (background_type is null))
);
create index venue_layouts_venue_id_idx on public.venue_layouts (venue_id) where venue_id is not null;
create trigger venue_layouts_touch before update on public.venue_layouts
  for each row execute function public.touch_updated_at();

-- The event's tables. The id comes from the editor (a table exists before its first save, and undo /
-- redo bring back the same one); a removed table is only marked removed (deleted_at), so the ids and
-- numbers a message or a check-in referred to stay traceable. updated_at moves only when the table
-- itself changes.
create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  -- what guests are told ("table 12"): unique among the event's live tables
  number int not null check (number between 1 and 999),
  label text check (label is null or char_length(label) <= 40),
  -- round; rect (a square or rectangular table); knights (a long banquet table)
  shape text not null check (shape in ('round', 'rect', 'knights')),
  capacity int not null check (capacity between 1 and 40),
  -- its center and size in meters, and its rotation in degrees (clockwise)
  x numeric(7, 2) not null check (x between -1000 and 6000),
  y numeric(7, 2) not null check (y between -1000 and 6000),
  w numeric(5, 2) not null check (w > 0 and w <= 50),
  h numeric(5, 2) not null check (h > 0 and h <= 50),
  rotation smallint not null default 0 check (rotation between 0 and 359),
  -- what the host marked about it: near the stage / the dance floor / an exit, reachable in a wheelchair
  zones text[] not null default '{}' check (zones <@ array['stage', 'dance', 'exit', 'accessible']),
  -- locked: the automatic seating never changes who sits here
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index seating_tables_number on public.seating_tables (invitation_id, number)
  where deleted_at is null;
create index seating_tables_invitation_id_idx on public.seating_tables (invitation_id);

-- ─── who is seated: units ───────────────────────────────────────────────────────────────────────

-- A unit is a family or a party that sits together and moves as one. How confirmed guests become
-- units (seating_sync_units keeps this true every time the screen loads):
--   · every guest on the list is a unit (a family invited together): its seats are the people its
--     latest reply brings (adults + children), or — before they reply — the list's party size (1 when
--     empty); a guest who declined needs no seat;
--   · a reply that came without a guest (the general link, a phone that isn't on the list) is a unit
--     of its own, once it says "coming";
--   · a reply linked to a guest after the fact (the guest answered again from their personal link)
--     merges into that guest's unit — its seat and rules go with it;
--   · a guest removed from the list keeps being seated by their reply (the unit keeps its id); a unit
--     with neither a guest nor a reply left is removed, with its seat and rules.
-- The category ("groom's side", "work", "army") is the guest list's group unless the host sets one here.
create table public.seating_units (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  guest_id uuid references public.invitation_guests (id) on delete set null,
  -- the reply that says how many come (a guest's latest one)
  response_id uuid references public.rsvp_responses (id) on delete set null,
  category text check (category is null or char_length(category) <= 60),
  -- -1 far from it, 0 either way, 1 near it
  pref_stage smallint not null default 0 check (pref_stage between -1 and 1),
  pref_dance smallint not null default 0 check (pref_dance between -1 and 1),
  pref_exit smallint not null default 0 check (pref_exit between -1 and 1),
  -- comes in a wheelchair (or needs step-free access): only at a table marked accessible
  accessible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index seating_units_guest on public.seating_units (guest_id) where guest_id is not null;
create unique index seating_units_response on public.seating_units (response_id) where response_id is not null;
create index seating_units_invitation_id_idx on public.seating_units (invitation_id);
create trigger seating_units_touch before update on public.seating_units
  for each row execute function public.touch_updated_at();

-- Which table a unit sits at — the whole unit at one table (a family is never split). `source`: placed
-- by the host or by the automatic seating.
create table public.seat_assignments (
  unit_id uuid primary key references public.seating_units (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  table_id uuid not null references public.seating_tables (id) on delete cascade,
  source text not null default 'host' check (source in ('host', 'solver')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seat_assignments_table_id_idx on public.seat_assignments (table_id);
create index seat_assignments_invitation_id_idx on public.seat_assignments (invitation_id);

-- The host's rules between two units: together (at the same table) or apart; hard rules must hold,
-- soft ones are wishes the automatic seating weighs.
create table public.seating_constraints (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  kind text not null check (kind in ('together', 'apart')),
  unit_a uuid not null references public.seating_units (id) on delete cascade,
  unit_b uuid not null references public.seating_units (id) on delete cascade,
  hard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seating_constraints_two check (unit_a <> unit_b)
);
create index seating_constraints_invitation_id_idx on public.seating_constraints (invitation_id);
create index seating_constraints_unit_a_idx on public.seating_constraints (unit_a);
create index seating_constraints_unit_b_idx on public.seating_constraints (unit_b);
create trigger seating_constraints_touch before update on public.seating_constraints
  for each row execute function public.touch_updated_at();

-- ─── row level security: service role only ──────────────────────────────────────────────────────

alter table public.partner_venues enable row level security;
alter table public.partner_venue_users enable row level security;
alter table public.venue_layouts enable row level security;
alter table public.seating_tables enable row level security;
alter table public.seating_units enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.seating_constraints enable row level security;
revoke all on public.partner_venues, public.partner_venue_users, public.venue_layouts,
  public.seating_tables, public.seating_units, public.seat_assignments, public.seating_constraints
  from anon, authenticated;

-- ─── units ──────────────────────────────────────────────────────────────────────────────────────

-- Keeps an event's units in step with its guest list and replies (the rules above). Idempotent; runs
-- every time the seating screen loads. Two loads at the same moment may race on an insert: the loser
-- skips this round (the next load finishes the job) instead of failing the screen.
create function public.seating_sync_units(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v record;
begin
  -- every guest on the list is a unit
  insert into public.seating_units (invitation_id, guest_id)
  select g.invitation_id, g.id
  from public.invitation_guests g
  where g.invitation_id = p_id
    and not exists (select 1 from public.seating_units u where u.guest_id = g.id)
  on conflict (guest_id) where guest_id is not null do nothing;

  -- a reply's own unit whose reply now belongs to a guest: merged into the guest's unit, with its seat
  -- (unless the guest's unit already has one) and its rules
  for v in
    select ur.id as from_id, ug.id as to_id
    from public.seating_units ur
    join public.rsvp_responses r on r.id = ur.response_id
    join public.seating_units ug on ug.guest_id = r.guest_id
    where ur.invitation_id = p_id and ur.guest_id is null and r.guest_id is not null
  loop
    if not exists (select 1 from public.seat_assignments a where a.unit_id = v.to_id) then
      update public.seat_assignments set unit_id = v.to_id where unit_id = v.from_id;
    end if;
    update public.seating_constraints set unit_a = v.to_id where unit_a = v.from_id and unit_b <> v.to_id;
    update public.seating_constraints set unit_b = v.to_id where unit_b = v.from_id and unit_a <> v.to_id;
    delete from public.seating_units where id = v.from_id;
  end loop;

  -- a guest's unit follows the guest's latest reply (answering again replaces the earlier one)
  update public.seating_units u set response_id = x.response_id
  from (
    select distinct on (r.guest_id) r.guest_id, r.id as response_id
    from public.rsvp_responses r
    where r.invitation_id = p_id and r.guest_id is not null
    order by r.guest_id, r.updated_at desc, r.created_at desc
  ) x
  where u.guest_id = x.guest_id and u.response_id is distinct from x.response_id;

  -- a "coming" reply without a guest is a unit of its own
  insert into public.seating_units (invitation_id, response_id)
  select r.invitation_id, r.id
  from public.rsvp_responses r
  where r.invitation_id = p_id and r.guest_id is null and r.attending
    and not exists (select 1 from public.seating_units u where u.response_id = r.id)
  on conflict (response_id) where response_id is not null do nothing;

  -- neither a guest nor a reply left: nobody to seat
  delete from public.seating_units u where u.invitation_id = p_id and u.guest_id is null and u.response_id is null;
exception when unique_violation then
  null;
end $$;

-- An event's units as the screen and the checks see them: who (the guest list's name, or the reply's),
-- the seats they need, and where they stand — 'confirmed' (said coming), 'pending' (on the list, no
-- reply yet: seated by the list's party size), 'declined' (needs no seat).
create function public.seating_unit_rows(p_id uuid)
returns table (
  id uuid, guest_id uuid, response_id uuid, name text, status text, seats int, adults int, children int,
  guest_group text, category text, pref_stage smallint, pref_dance smallint, pref_exit smallint,
  accessible boolean
)
language sql stable security definer set search_path = '' as $$
  select u.id, u.guest_id, u.response_id,
         coalesce(g.name, r.primary_name, '') as name,
         case when r.id is null then 'pending' when r.attending then 'confirmed' else 'declined' end,
         case when r.id is null then coalesce(g.party_size, 1)
              when r.attending then r.adults_count + r.children_count else 0 end,
         case when r.attending then r.adults_count else 0 end,
         case when r.attending then r.children_count else 0 end,
         g.group_name, u.category, u.pref_stage, u.pref_dance, u.pref_exit, u.accessible
  from public.seating_units u
  left join public.invitation_guests g on g.id = u.guest_id
  left join public.rsvp_responses r on r.id = u.response_id
  where u.invitation_id = p_id
$$;

-- ─── the seating screen ─────────────────────────────────────────────────────────────────────────

-- Everything the seating screen needs for one of the owner's events: the floor plan, the live tables,
-- the units (kept in step first), who sits where, the rules, and the owner's venue (when a partner
-- linked them to one). The first time, the event's layout is created — from the venue's floor plan when
-- there is one; a layout that never had a plan picks up the venue's plan once it arrives. null when the
-- event isn't the owner's.
create function public.seating_state(p_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_venue public.partner_venues;
  l public.venue_layouts;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  perform public.seating_sync_units(p_id);

  select v.* into v_venue
  from public.partner_venue_users pu
  join public.partner_venues v on v.id = pu.venue_id
  where pu.user_id = p_owner;

  insert into public.venue_layouts (invitation_id) values (p_id) on conflict (invitation_id) do nothing;
  -- the venue's plan, when the host never had one (a removed plan stays removed: source 'none')
  if v_venue.plan_path is not null then
    update public.venue_layouts set
      background_path = v_venue.plan_path,
      background_type = v_venue.plan_type,
      background_width = v_venue.plan_width,
      background_height = v_venue.plan_height,
      meters_per_pixel = case when v_venue.width_meters is not null and v_venue.plan_width is not null
                              then v_venue.width_meters / v_venue.plan_width end,
      source = 'partner',
      venue_id = v_venue.id,
      venue_plan_path = v_venue.plan_path
    where invitation_id = p_id and source is null;
  end if;
  select * into l from public.venue_layouts where invitation_id = p_id;

  return jsonb_build_object(
    'layout', jsonb_build_object(
      'version', l.version,
      'updatedAt', l.updated_at,
      'background', case when l.background_path is null then null else jsonb_build_object(
        'path', l.background_path, 'type', l.background_type,
        'width', l.background_width, 'height', l.background_height) end,
      'metersPerPixel', l.meters_per_pixel,
      'source', l.source,
      'venuePlan', l.venue_plan_path,
      'gridM', l.grid_m,
      'landmarks', l.landmarks,
      'settings', l.settings
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'number', t.number, 'label', t.label, 'shape', t.shape, 'capacity', t.capacity,
          'x', t.x, 'y', t.y, 'w', t.w, 'h', t.h, 'rotation', t.rotation, 'zones', to_jsonb(t.zones),
          'locked', t.locked
        ) order by t.number)
      from public.seating_tables t
      where t.invitation_id = p_id and t.deleted_at is null
    ), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', u.id,
          'guestId', u.guest_id,
          'name', u.name,
          'status', u.status,
          'seats', u.seats,
          'adults', u.adults,
          'children', u.children,
          'people', coalesce((
            select jsonb_agg(coalesce(
                nullif(btrim(a.full_name), ''),
                nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''),
                ''
              ) order by a.kind, a.position)
            from public.rsvp_attendees a
            where a.response_id = u.response_id and u.status = 'confirmed'
          ), '[]'::jsonb),
          'group', u.guest_group,
          'category', u.category,
          'prefs', jsonb_build_object('stage', u.pref_stage, 'dance', u.pref_dance, 'exit', u.pref_exit),
          'accessible', u.accessible
        ) order by u.name, u.id)
      from public.seating_unit_rows(p_id) u
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('unitId', a.unit_id, 'tableId', a.table_id, 'source', a.source)
                       order by a.created_at, a.unit_id)
      from public.seat_assignments a
      where a.invitation_id = p_id
    ), '[]'::jsonb),
    'constraints', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'a', c.unit_a, 'b', c.unit_b, 'hard', c.hard)
                       order by c.created_at, c.id)
      from public.seating_constraints c
      where c.invitation_id = p_id
    ), '[]'::jsonb),
    'venue', case when v_venue.id is null then null else jsonb_build_object(
      'name', v_venue.name,
      'address', v_venue.address,
      'widthMeters', v_venue.width_meters,
      'plan', case when v_venue.plan_path is null then null else jsonb_build_object(
        'path', v_venue.plan_path, 'type', v_venue.plan_type,
        'width', v_venue.plan_width, 'height', v_venue.plan_height) end
    ) end
  );
end $$;

-- Saves the whole seating plan the editor holds (already validated by the server: shapes, sizes,
-- counts) — but only on top of the version it was loaded at (p_version); otherwise nothing changes and
-- the answer says so, with the version now stored, and the editor merges. In one transaction:
--   · the layout's plan, scale, grid, landmarks and options;
--   · the tables: those in the plan are created or updated, the rest are marked removed;
--   · the units' settings (category, preferences, accessibility) — for units that still exist;
--   · who sits where and the rules, replaced by the plan's (units that no longer exist are skipped).
-- Refused without writing anything ({ ok: false, code }): 'conflict'; 'invalid' (an id of another
-- event, a table number twice, a seat at a table that isn't in the plan, a plan file that isn't the
-- host's or their venue's); 'over_capacity' (with the table's number) — when a table gets more people
-- than seats by this save (a table already over because replies changed may stay so, until the host
-- moves someone: nothing is ever refused for what the guests did). null when the event isn't the owner's.
create function public.seating_save(p_id uuid, p_owner uuid, p_version int, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.venue_layouts;
  v_now timestamptz := now();
  v_bg text := p_plan #>> '{layout,background,path}';
  v_venue_plan text;
  v_number int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.venue_layouts (invitation_id) values (p_id) on conflict (invitation_id) do nothing;
  select * into l from public.venue_layouts where invitation_id = p_id for update;
  if l.version <> p_version then
    return jsonb_build_object('ok', false, 'code', 'conflict', 'version', l.version);
  end if;

  -- ── checks (nothing is written before they pass) ──
  select v.plan_path into v_venue_plan
  from public.partner_venue_users pu join public.partner_venues v on v.id = pu.venue_id
  where pu.user_id = p_owner;
  if v_bg is not null
     and not starts_with(v_bg, p_owner::text || '/' || p_id::text || '/')
     and v_bg is distinct from v_venue_plan
     and v_bg is distinct from l.background_path then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'reason', 'background');
  end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'tables', '[]')) x(id uuid)
    join public.seating_tables t on t.id = x.id
    where t.invitation_id <> p_id
  ) or exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'constraints', '[]')) x(id uuid)
    join public.seating_constraints c on c.id = x.id
    where c.invitation_id <> p_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'reason', 'foreign_id');
  end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'tables', '[]')) x(number int)
    group by x.number having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'tables', '[]')) x(id uuid)
    group by x.id having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'reason', 'duplicate_table');
  end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'assignments', '[]')) a("unitId" uuid, "tableId" uuid)
    join public.seating_units u on u.id = a."unitId" and u.invitation_id = p_id
    where not exists (
      select 1 from jsonb_to_recordset(coalesce(p_plan->'tables', '[]')) t(id uuid) where t.id = a."tableId"
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'reason', 'unknown_table');
  end if;

  -- a table this save gives more people than seats: one that gets someone new, or fewer seats
  with seats as materialized (
    select s.id, s.seats from public.seating_unit_rows(p_id) s
  ), occupancy as (
    select a."tableId" as table_id,
           sum(s.seats) as occupied,
           bool_or(not exists (
             select 1 from public.seat_assignments sa where sa.unit_id = a."unitId" and sa.table_id = a."tableId"
           )) as grew
    from jsonb_to_recordset(coalesce(p_plan->'assignments', '[]')) a("unitId" uuid, "tableId" uuid)
    join seats s on s.id = a."unitId"
    group by a."tableId"
  )
  select t.number into v_number
  from jsonb_to_recordset(coalesce(p_plan->'tables', '[]')) t(id uuid, number int, capacity int)
  join occupancy o on o.table_id = t.id
  left join public.seating_tables old on old.id = t.id
  where o.occupied > t.capacity and (o.grew or t.capacity < coalesce(old.capacity, 0))
  order by t.number
  limit 1;
  if v_number is not null then
    return jsonb_build_object('ok', false, 'code', 'over_capacity', 'table', v_number);
  end if;

  -- ── layout ──
  update public.venue_layouts set
    background_path = v_bg,
    background_type = case when v_bg is null then null else p_plan #>> '{layout,background,type}' end,
    background_width = case when v_bg is null then null else (p_plan #>> '{layout,background,width}')::int end,
    background_height = case when v_bg is null then null else (p_plan #>> '{layout,background,height}')::int end,
    meters_per_pixel = (p_plan #>> '{layout,metersPerPixel}')::numeric,
    source = p_plan #>> '{layout,source}',
    -- the venue's plan (kept, or chosen again by the host): which venue, and which of its plans
    venue_id = case when p_plan #>> '{layout,source}' = 'partner' then coalesce(
      venue_id, (select pu.venue_id from public.partner_venue_users pu where pu.user_id = p_owner)
    ) end,
    venue_plan_path = case
      when p_plan #>> '{layout,source}' = 'partner'
           and p_plan #>> '{layout,venuePlan}' in (v_venue_plan, l.venue_plan_path)
      then p_plan #>> '{layout,venuePlan}' end,
    grid_m = coalesce((p_plan #>> '{layout,gridM}')::numeric, grid_m),
    landmarks = coalesce(p_plan #> '{layout,landmarks}', '[]'::jsonb),
    settings = coalesce(p_plan #> '{layout,settings}', '{}'::jsonb),
    version = version + 1
  where id = l.id
  returning * into l;

  -- ── tables: the live ones step aside (their numbers free), then the plan's come (back) ──
  update public.seating_tables set deleted_at = v_now where invitation_id = p_id and deleted_at is null;
  insert into public.seating_tables as t (
    id, invitation_id, number, label, shape, capacity, x, y, w, h, rotation, zones, locked, created_at,
    updated_at, deleted_at
  )
  select x.id, p_id, x.number, nullif(btrim(x.label), ''), x.shape, x.capacity, x.x, x.y, x.w, x.h,
         x.rotation, coalesce(x.zones, '{}'), coalesce(x.locked, false), v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_plan->'tables', '[]')) as x(
    id uuid, number int, label text, shape text, capacity int, x numeric, y numeric, w numeric, h numeric,
    rotation int, zones text[], locked boolean
  )
  on conflict (id) do update set
    number = excluded.number, label = excluded.label, shape = excluded.shape, capacity = excluded.capacity,
    x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, rotation = excluded.rotation,
    zones = excluded.zones, locked = excluded.locked, deleted_at = null,
    -- only a real change (or coming back) moves updated_at
    updated_at = case
      when t.deleted_at is distinct from v_now
        or (t.number, t.label, t.shape, t.capacity, t.x, t.y, t.w, t.h, t.rotation, t.zones, t.locked)
           is distinct from (excluded.number, excluded.label, excluded.shape, excluded.capacity, excluded.x,
                             excluded.y, excluded.w, excluded.h, excluded.rotation, excluded.zones, excluded.locked)
      then v_now else t.updated_at end
  where t.invitation_id = p_id;

  -- ── units' settings ──
  update public.seating_units u set
    category = nullif(btrim(x.category), ''),
    pref_stage = coalesce(x.stage, 0), pref_dance = coalesce(x.dance, 0), pref_exit = coalesce(x.exit, 0),
    accessible = coalesce(x.accessible, false)
  from jsonb_to_recordset(coalesce(p_plan->'units', '[]')) as x(
    id uuid, category text, stage smallint, dance smallint, exit smallint, accessible boolean
  )
  where u.id = x.id and u.invitation_id = p_id
    and (u.category, u.pref_stage, u.pref_dance, u.pref_exit, u.accessible)
        is distinct from (nullif(btrim(x.category), ''), coalesce(x.stage, 0), coalesce(x.dance, 0),
                          coalesce(x.exit, 0), coalesce(x.accessible, false));

  -- ── who sits where ──
  delete from public.seat_assignments sa
  where sa.invitation_id = p_id and not exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'assignments', '[]')) a("unitId" uuid, "tableId" uuid)
    where a."unitId" = sa.unit_id and a."tableId" = sa.table_id
  );
  insert into public.seat_assignments as sa (unit_id, invitation_id, table_id, source)
  select a."unitId", p_id, a."tableId", coalesce(a.source, 'host')
  from jsonb_to_recordset(coalesce(p_plan->'assignments', '[]')) a("unitId" uuid, "tableId" uuid, source text)
  join public.seating_units u on u.id = a."unitId" and u.invitation_id = p_id
  on conflict (unit_id) do update set source = excluded.source,
    updated_at = case when sa.source is distinct from excluded.source then v_now else sa.updated_at end;

  -- ── rules ──
  delete from public.seating_constraints c
  where c.invitation_id = p_id and not exists (
    select 1 from jsonb_to_recordset(coalesce(p_plan->'constraints', '[]')) x(id uuid) where x.id = c.id
  );
  insert into public.seating_constraints as c (id, invitation_id, kind, unit_a, unit_b, hard)
  select x.id, p_id, x.kind, x.a, x.b, coalesce(x.hard, true)
  from jsonb_to_recordset(coalesce(p_plan->'constraints', '[]')) x(id uuid, kind text, a uuid, b uuid, hard boolean)
  join public.seating_units ua on ua.id = x.a and ua.invitation_id = p_id
  join public.seating_units ub on ub.id = x.b and ub.invitation_id = p_id
  where x.a <> x.b
  on conflict (id) do update set kind = excluded.kind, unit_a = excluded.unit_a, unit_b = excluded.unit_b,
    hard = excluded.hard
  where (c.kind, c.unit_a, c.unit_b, c.hard) is distinct from (excluded.kind, excluded.unit_a, excluded.unit_b,
                                                             excluded.hard);

  return jsonb_build_object('ok', true, 'version', l.version, 'updatedAt', l.updated_at);
end $$;

-- ─── the partner's venues ───────────────────────────────────────────────────────────────────────

-- A venue as the partner sees it: its own id, the plan as stored, and how many of its users are linked.
create function public.partner_venue_json(v public.partner_venues) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'venueId', v.external_id,
    'name', v.name,
    'address', v.address,
    'widthMeters', v.width_meters,
    'floorPlan', case when v.plan_path is null then null else jsonb_build_object(
      'path', v.plan_path, 'contentType', v.plan_type, 'width', v.plan_width, 'height', v.plan_height,
      'bytes', v.plan_bytes, 'updatedAt', v.plan_updated_at) end,
    'users', (select count(*) from public.partner_venue_users u where u.venue_id = v.id),
    'createdAt', v.created_at,
    'updatedAt', v.updated_at
  )
$$;

-- Creates the partner's venue (p_name required then) or updates it. p_fields lists what the partner
-- sent — 'name', 'address', 'widthMeters', 'floorPlan' — and only those change (null clears address,
-- widthMeters and floorPlan). p_plan: the stored plan { path, contentType, width, height, bytes }.
-- Returns { ok, created, venue, replacedPlan } — replacedPlan: the previous plan's file when no event's
-- layout uses it any more (the server deletes it) — or { ok: false, code: 'name_required' }.
create function public.partner_venue_put(
  p_source text, p_external_id text, p_fields text[], p_name text, p_address text, p_width_meters numeric,
  p_plan jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.partner_venues;
  v_created boolean := false;
  v_old text;
begin
  select * into v from public.partner_venues where source = p_source and external_id = p_external_id for update;
  if not found then
    if not ('name' = any (p_fields)) or nullif(btrim(p_name), '') is null then
      return jsonb_build_object('ok', false, 'code', 'name_required');
    end if;
    insert into public.partner_venues (source, external_id, name)
    values (p_source, p_external_id, btrim(p_name))
    on conflict (source, external_id) do nothing;
    v_created := found;
    select * into v from public.partner_venues where source = p_source and external_id = p_external_id for update;
  end if;
  v_old := v.plan_path;
  update public.partner_venues set
    name = case when 'name' = any (p_fields) then coalesce(nullif(btrim(p_name), ''), name) else name end,
    address = case when 'address' = any (p_fields) then nullif(btrim(p_address), '') else address end,
    width_meters = case when 'widthMeters' = any (p_fields) then p_width_meters else width_meters end,
    plan_path = case when 'floorPlan' = any (p_fields) then p_plan->>'path' else plan_path end,
    plan_type = case when 'floorPlan' = any (p_fields) then p_plan->>'contentType' else plan_type end,
    plan_width = case when 'floorPlan' = any (p_fields) then (p_plan->>'width')::int else plan_width end,
    plan_height = case when 'floorPlan' = any (p_fields) then (p_plan->>'height')::int else plan_height end,
    plan_bytes = case when 'floorPlan' = any (p_fields) then (p_plan->>'bytes')::int else plan_bytes end,
    plan_updated_at = case when 'floorPlan' = any (p_fields) then now() else plan_updated_at end
  where id = v.id
  returning * into v;
  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'venue', public.partner_venue_json(v),
    'replacedPlan', case
      when v_old is not null and v_old is distinct from v.plan_path
           and not exists (select 1 from public.venue_layouts l where l.background_path = v_old)
      then v_old end
  );
end $$;

-- One of the partner's venues (null: none by that id).
create function public.partner_venue_get(p_source text, p_external_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.partner_venue_json(v) from public.partner_venues v
  where v.source = p_source and v.external_id = p_external_id
$$;

-- Links one of the partner's users to one of its venues (p_venue null: unlinks). null when the user
-- isn't the partner's; { ok: false, code: 'venue_not_found' }; { ok: true, venueId }.
create function public.partner_user_venue_set(p_source text, p_user_id uuid, p_venue text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_venue uuid;
begin
  if not exists (select 1 from public.accounts a where a.user_id = p_user_id and a.source = p_source) then
    return null;
  end if;
  if p_venue is null then
    delete from public.partner_venue_users where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'venueId', null);
  end if;
  select id into v_venue from public.partner_venues where source = p_source and external_id = p_venue;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'venue_not_found');
  end if;
  insert into public.partner_venue_users (user_id, venue_id) values (p_user_id, v_venue)
  on conflict (user_id) do update set venue_id = excluded.venue_id
  where public.partner_venue_users.venue_id <> excluded.venue_id;
  return jsonb_build_object('ok', true, 'venueId', p_venue);
end $$;

-- The partner's id of the venue one of its users belongs to (null: none).
create function public.partner_user_venue(p_source text, p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select v.external_id
  from public.partner_venue_users pu join public.partner_venues v on v.id = pu.venue_id
  where pu.user_id = p_user_id and v.source = p_source
$$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.seating_sync_units(uuid)',
    'public.seating_unit_rows(uuid)',
    'public.seating_state(uuid, uuid)',
    'public.seating_save(uuid, uuid, int, jsonb)',
    'public.partner_venue_json(public.partner_venues)',
    'public.partner_venue_put(text, text, text[], text, text, numeric, jsonb)',
    'public.partner_venue_get(text, text)',
    'public.partner_user_venue_set(text, uuid, text)',
    'public.partner_user_venue(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
