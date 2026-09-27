-- Where each Badook Events account came from, and the partner API's record of calls.
--
-- Badook Events (the partner, features/partner) opens accounts here for its customers: a venue owner,
-- or one of their staff, clicks "digital invitations" there. A provisioning call may now say which of
-- its users made it (createdBy: their id in Badook Events, name, email, role), and a venue may say who
-- owns it (owner, the same shape, kept on partner_venues). partner_provisions keeps every provisioning
-- of an account — created, linked (a user the partner created earlier, claimed now), updated, a fresh
-- sign-in link — with who made it and the account's venue then; an account's "opened by" is its
-- opening's creator, else the owner of the venue it was opened for (or belongs to now). Kept with the
-- account (they go when it goes).
--
-- partner_api_calls keeps every call of the partner API — the endpoint, the answer's status and code,
-- the account when the answer names one, how long it took — for the admin console's API health, 90
-- days (admin_logs_maintenance, the daily job). No request bodies, no emails.
--
-- Same rules as before: service_role only, every function checks what it may touch.

-- ─── who in Badook Events opened the account ───────────────────────────────────────────────────

create table public.partner_provisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- the partner that made the call ('partner:badook-events')
  source text not null check (char_length(source) between 1 and 60),
  -- created: a new account; linked: a user the partner created before, claimed now; updated: the
  -- partner's user updated (POST or PATCH /users); login_link: a fresh one-time sign-in link
  action text not null check (action in ('created', 'linked', 'updated', 'login_link')),
  -- the partner's user who made the call (createdBy), as the call said it; null: it didn't say
  created_by_id text check (created_by_id is null or char_length(created_by_id) between 1 and 200),
  created_by_name text check (created_by_name is null or char_length(created_by_name) between 1 and 120),
  created_by_email text check (created_by_email is null or char_length(created_by_email) between 3 and 254),
  created_by_role text check (created_by_role is null or char_length(created_by_role) between 1 and 60),
  -- the account's venue after the call
  venue_id uuid references public.partner_venues (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_provisions_by_whole check (
    created_by_id is not null or (created_by_name is null and created_by_email is null and created_by_role is null)
  )
);
create index partner_provisions_user on public.partner_provisions (user_id, id);
create index partner_provisions_created on public.partner_provisions (created_at desc);
create index partner_provisions_venue_id_idx on public.partner_provisions (venue_id) where venue_id is not null;
alter table public.partner_provisions enable row level security;
revoke all on public.partner_provisions from anon, authenticated;

-- The venue's owner in Badook Events (PUT /venues/{venueId} { owner }): who opened an account for the
-- venue when the call didn't say.
alter table public.partner_venues
  add column owner_id text check (owner_id is null or char_length(owner_id) between 1 and 200),
  add column owner_name text check (owner_name is null or char_length(owner_name) between 1 and 120),
  add column owner_email text check (owner_email is null or char_length(owner_email) between 3 and 254),
  add column owner_role text check (owner_role is null or char_length(owner_role) between 1 and 60),
  add constraint partner_venues_owner_whole check (
    owner_id is not null or (owner_name is null and owner_email is null and owner_role is null)
  );

-- One of the partner's users as a call names it: { id, name, email, role } (text, trimmed; null when
-- there is no id).
create function public.partner_actor_json(p_by jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when nullif(btrim(p_by ->> 'id'), '') is null then null else jsonb_build_object(
    'id', left(btrim(p_by ->> 'id'), 200),
    'name', nullif(left(btrim(p_by ->> 'name'), 120), ''),
    'email', nullif(left(lower(btrim(p_by ->> 'email')), 254), ''),
    'role', nullif(left(btrim(p_by ->> 'role'), 60), '')
  ) end
$$;

-- Records one provisioning of one of the partner's accounts (after it was done): what happened, who
-- in Badook Events did it (p_by: createdBy, or null) and the account's venue now. false when the
-- account isn't the partner's.
create function public.partner_provision_record(p_source text, p_user_id uuid, p_action text, p_by jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_by jsonb := public.partner_actor_json(p_by);
begin
  if not exists (select 1 from public.accounts where user_id = p_user_id and source = p_source) then
    return false;
  end if;
  insert into public.partner_provisions (
    user_id, source, action, created_by_id, created_by_name, created_by_email, created_by_role, venue_id
  )
  select p_user_id, p_source, p_action, v_by ->> 'id', v_by ->> 'name', v_by ->> 'email', v_by ->> 'role',
         (select pu.venue_id
          from public.partner_venue_users pu
          join public.partner_venues v on v.id = pu.venue_id and v.source = p_source
          where pu.user_id = p_user_id);
  return true;
end $$;

-- ─── the partner API's calls ───────────────────────────────────────────────────────────────────

create table public.partner_api_calls (
  id bigint generated always as identity primary key,
  source text not null check (char_length(source) between 1 and 60),
  method text not null check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  -- the route, not the address (/users, /login-links, /discounts, /venues/{venueId})
  endpoint text not null check (endpoint ~ '^/[A-Za-z0-9/{}_-]{1,80}$'),
  status smallint not null check (status between 100 and 599),
  -- the answer's code when it wasn't ok (invalid, account_exists, rate_limited…)
  code text check (code is null or code ~ '^[a-z_]{1,60}$'),
  user_id uuid references auth.users (id) on delete set null,
  duration_ms int not null check (duration_ms between 0 and 3600000),
  created_at timestamptz not null default now()
);
create index partner_api_calls_created on public.partner_api_calls (created_at desc);
create index partner_api_calls_user_id_idx on public.partner_api_calls (user_id) where user_id is not null;
alter table public.partner_api_calls enable row level security;
revoke all on public.partner_api_calls from anon, authenticated;

-- Records one call of the partner API (after its answer). An account that is gone by now is left out.
create function public.partner_api_call_log(
  p_source text, p_method text, p_endpoint text, p_status int, p_code text, p_user_id uuid, p_duration_ms int
) returns void
language sql security definer set search_path = '' as $$
  insert into public.partner_api_calls (source, method, endpoint, status, code, user_id, duration_ms)
  values (
    p_source, upper(p_method), p_endpoint, p_status,
    case when p_code ~ '^[a-z_]{1,60}$' then p_code end,
    (select id from auth.users where id = p_user_id),
    least(greatest(coalesce(p_duration_ms, 0), 0), 3600000)
  )
$$;

-- ─── the partner's venues, with their owner ────────────────────────────────────────────────────

-- A venue as the partner sees it (as before), with its owner in Badook Events.
create or replace function public.partner_venue_json(v public.partner_venues) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'venueId', v.external_id,
    'name', v.name,
    'address', v.address,
    'widthMeters', v.width_meters,
    'floorPlan', case when v.plan_path is null then null else jsonb_build_object(
      'path', v.plan_path, 'contentType', v.plan_type, 'width', v.plan_width, 'height', v.plan_height,
      'bytes', v.plan_bytes, 'updatedAt', v.plan_updated_at) end,
    'owner', case when v.owner_id is null then null else jsonb_build_object(
      'id', v.owner_id, 'name', v.owner_name, 'email', v.owner_email, 'role', v.owner_role) end,
    'users', (select count(*) from public.partner_venue_users u where u.venue_id = v.id),
    'createdAt', v.created_at,
    'updatedAt', v.updated_at
  )
$$;

-- Creates the partner's venue (p_name required then) or updates it, as before; p_fields may now also
-- list 'owner' (p_owner: { id, name?, email?, role? }, null clears it). Callers that don't send an owner
-- call it as before.
drop function public.partner_venue_put(text, text, text[], text, text, numeric, jsonb);
create function public.partner_venue_put(
  p_source text, p_external_id text, p_fields text[], p_name text, p_address text, p_width_meters numeric,
  p_plan jsonb, p_owner jsonb default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.partner_venues;
  v_created boolean := false;
  v_old text;
  v_owner jsonb := public.partner_actor_json(p_owner);
  v_set_owner boolean := 'owner' = any (p_fields);
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
    plan_updated_at = case when 'floorPlan' = any (p_fields) then now() else plan_updated_at end,
    owner_id = case when v_set_owner then v_owner ->> 'id' else owner_id end,
    owner_name = case when v_set_owner then v_owner ->> 'name' else owner_name end,
    owner_email = case when v_set_owner then v_owner ->> 'email' else owner_email end,
    owner_role = case when v_set_owner then v_owner ->> 'role' else owner_role end
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

-- ─── privileges: the server's role only; the helper not even that ──────────────────────────────

revoke all on function public.partner_actor_json(jsonb) from public, anon, authenticated, service_role;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.partner_provision_record(text, uuid, text, jsonb)',
    'public.partner_api_call_log(text, text, text, int, text, uuid, int)',
    'public.partner_venue_put(text, text, text[], text, text, numeric, jsonb, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
-- partner_venue_json keeps its grants (create or replace keeps privileges)
