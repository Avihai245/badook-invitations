-- The admin console (/app/admin): its staff and their roles, the record of what they do there, and the
-- channel its pages listen on for "something changed".
--
-- Who is staff: an account whose email is on the staff list — added from the console by an owner or an
-- admin, or one of the platform's owners in INVITES_ADMIN_EMAILS, which the server keeps on the list as
-- owners (admin_whoami). And only an account its owner opened and confirmed: never one Badook Events
-- provisioned (the partner is handed its sign-in links), whatever its email; the partner API refuses
-- staff emails too (admin_email_reserved). A banned or deleted account isn't staff.
--
-- The console reads and acts only through the functions of this file and those after it, each taking
-- the acting staff member (p_actor) and checking their role's permission first (admin_require): the
-- server passes the verified user, the database decides what they may do. Every action is recorded
-- (admin_audit), kept two years (admin_maintenance). Roles and permissions: features/admin/permissions.ts
-- (the same matrix; tests/db/admin.test.ts holds them equal).

-- ─── staff ─────────────────────────────────────────────────────────────────────────────────────

create table public.admin_staff (
  email text primary key
    check (email = lower(email) and char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  role text not null check (role in ('owner', 'admin', 'support', 'finance', 'viewer')),
  -- 'env': one of INVITES_ADMIN_EMAILS (changed there, not in the console)
  source text not null default 'console' check (source in ('console', 'env')),
  note text check (note is null or char_length(note) <= 200),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz
);
create index admin_staff_added_by on public.admin_staff (added_by);
alter table public.admin_staff enable row level security;
revoke all on public.admin_staff from anon, authenticated;

-- ─── what staff did ────────────────────────────────────────────────────────────────────────────

create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  -- who it was, also after their account is gone
  actor_email text not null check (char_length(actor_email) <= 254),
  action text not null check (char_length(action) <= 64 and action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text check (
    target_type is null
    or target_type in ('user', 'invitation', 'ticket', 'staff', 'payment', 'partner', 'system')
  ),
  target_id text check (target_id is null or char_length(target_id) <= 254),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384),
  created_at timestamptz not null default now()
);
create index admin_audit_created on public.admin_audit (created_at desc);
create index admin_audit_target on public.admin_audit (target_type, target_id, created_at desc);
create index admin_audit_actor on public.admin_audit (actor_id, created_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- ─── roles and permissions ─────────────────────────────────────────────────────────────────────

-- A role's permissions (features/admin/permissions.ts has the same matrix).
create function public.admin_can(p_role text, p_perm text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_perm = any(case p_role
    when 'owner' then array[
      'dashboard.view', 'users.view', 'users.pii', 'users.credits', 'users.plan', 'users.suspend',
      'invitations.view', 'invitations.features', 'messages.view', 'finance.view', 'finance.export',
      'support.view', 'support.reply', 'partners.view', 'staff.view', 'staff.manage', 'staff.owners',
      'audit.view', 'system.view']
    when 'admin' then array[
      'dashboard.view', 'users.view', 'users.pii', 'users.credits', 'users.plan', 'users.suspend',
      'invitations.view', 'invitations.features', 'messages.view', 'finance.view', 'finance.export',
      'support.view', 'support.reply', 'partners.view', 'staff.view', 'staff.manage',
      'audit.view', 'system.view']
    when 'support' then array[
      'dashboard.view', 'users.view', 'users.pii', 'users.credits', 'invitations.view', 'messages.view',
      'support.view', 'support.reply', 'partners.view']
    when 'finance' then array[
      'dashboard.view', 'users.view', 'users.pii', 'users.credits', 'invitations.view', 'messages.view',
      'finance.view', 'finance.export', 'partners.view']
    when 'viewer' then array[
      'dashboard.view', 'users.view', 'invitations.view', 'messages.view', 'finance.view', 'partners.view']
  end), false)
$$;

-- A user's console role (null: not staff).
create function public.admin_role_of(p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.role
  from auth.users u
  join public.admin_staff s on s.email = lower(u.email) and s.removed_at is null
  where u.id = p_user_id
    and u.email_confirmed_at is not null
    and coalesce(u.raw_app_meta_data ->> 'provisioned_by', '') = ''
    and (u.banned_until is null or u.banned_until <= now())
    and u.deleted_at is null
$$;

-- The actor's role when it has the permission; else raises 'forbidden' (every console function starts
-- with it).
create function public.admin_require(p_actor uuid, p_perm text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_role_of(p_actor);
begin
  if v_role is null or not public.admin_can(v_role, p_perm) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return v_role;
end $$;

-- Records one action of a staff member (inside the action's own transaction).
create function public.admin_log(
  p_actor uuid, p_action text, p_target_type text, p_target_id text, p_details jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  insert into public.admin_audit (actor_id, actor_email, action, target_type, target_id, details)
  select p_actor, coalesce(lower(u.email), '(unknown)'), p_action, p_target_type, p_target_id,
         coalesce(p_details, '{}'::jsonb)
  from (select 1) one
  left join auth.users u on u.id = p_actor
  returning id into v_id;
  return v_id;
end $$;

-- ─── who is asking (the console's gate) ────────────────────────────────────────────────────────

-- Keeps the platform's owners (INVITES_ADMIN_EMAILS, from the server) on the staff list as owners —
-- one no longer there leaves it — and returns the user's role and email (null: not staff). Writes only
-- when the list changed.
create function public.admin_whoami(p_user_id uuid, p_env_emails text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_env text[] := coalesce((
    select array_agg(distinct lower(trim(e)))
    from unnest(coalesce(p_env_emails, '{}'::text[])) e
    where lower(trim(e)) ~ '^[^@\s]+@[^@\s]+$' and char_length(trim(e)) <= 254
  ), '{}'::text[]);
  v_role text;
begin
  insert into public.admin_staff as s (email, role, source)
  select e, 'owner', 'env' from unnest(v_env) e
  on conflict (email) do update
    set role = 'owner', source = 'env', removed_at = null, updated_at = now()
    where s.role <> 'owner' or s.source <> 'env' or s.removed_at is not null;
  update public.admin_staff
    set removed_at = now(), updated_at = now()
    where source = 'env' and removed_at is null and email <> all(v_env);
  v_role := public.admin_role_of(p_user_id);
  if v_role is null then
    return null;
  end if;
  return jsonb_build_object(
    'role', v_role,
    'email', (select lower(email) from auth.users where id = p_user_id)
  );
end $$;

-- Whether the user may open the console (the host app shows them the way in). Reads only.
create function public.admin_is_staff(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.admin_role_of(p_user_id) is not null
$$;

-- An email the partner API may not open or move an account to: a staff member's.
create function public.admin_email_reserved(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_staff where email = lower(trim(p_email)) and removed_at is null
  )
$$;

-- ─── staff, managed in the console ─────────────────────────────────────────────────────────────

create function public.admin_staff_json(s public.admin_staff) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', s.email,
    'role', s.role,
    'source', s.source,
    'note', s.note,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at,
    'addedBy', (select lower(email) from auth.users where id = s.added_by),
    -- whether the email's account can use the console (it signs up and confirms first)
    'account', (
      select jsonb_build_object(
        'userId', u.id,
        'confirmed', u.email_confirmed_at is not null,
        'partner', coalesce(u.raw_app_meta_data ->> 'provisioned_by', '') <> '',
        'banned', u.banned_until is not null and u.banned_until > now(),
        'lastSignInAt', u.last_sign_in_at
      )
      from auth.users u
      where lower(u.email) = s.email and u.deleted_at is null
      limit 1
    )
  )
$$;

create function public.admin_staff_list(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_require(p_actor, 'staff.view');
  return coalesce((
    select jsonb_agg(public.admin_staff_json(s) order by
      array_position(array['owner', 'admin', 'support', 'finance', 'viewer'], s.role), s.email)
    from public.admin_staff s
    where s.removed_at is null
  ), '[]'::jsonb);
end $$;

-- Owners among the staff who can use the console, but one (the console may not be left without one).
create function public.admin_owner_count(p_except text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.admin_staff s
  join auth.users u on lower(u.email) = s.email
  where s.role = 'owner' and s.removed_at is null and s.email <> coalesce(p_except, '')
    and u.email_confirmed_at is not null
    and coalesce(u.raw_app_meta_data ->> 'provisioned_by', '') = ''
    and (u.banned_until is null or u.banned_until <= now())
    and u.deleted_at is null
$$;

-- Adds a staff member or changes their role. Admins manage every role but owners; owners manage all.
-- Not: one's own role, the platform's owners (INVITES_ADMIN_EMAILS), the last owner.
create function public.admin_staff_set(p_actor uuid, p_email text, p_role text, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_old public.admin_staff;
  v_had boolean;
  v_new public.admin_staff;
begin
  perform public.admin_require(p_actor, 'staff.manage');
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if p_role is null or p_role not in ('owner', 'admin', 'support', 'finance', 'viewer') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'invalid_note' using errcode = 'P0001';
  end if;
  select * into v_old from public.admin_staff where email = v_email for update;
  -- (an active row: a removed one is added again)
  v_had := found and v_old.removed_at is null;
  if v_had and v_old.source = 'env' then
    raise exception 'managed_by_env' using errcode = 'P0001';
  end if;
  if v_email = (select lower(email) from auth.users where id = p_actor) then
    raise exception 'self' using errcode = 'P0001';
  end if;
  if p_role = 'owner' or (v_had and v_old.role = 'owner') then
    perform public.admin_require(p_actor, 'staff.owners');
  end if;
  if v_had and v_old.role = 'owner' and p_role <> 'owner' and public.admin_owner_count(v_email) < 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  insert into public.admin_staff as s (email, role, source, note, added_by)
  values (v_email, p_role, 'console', v_note, p_actor)
  on conflict (email) do update
    set role = excluded.role, source = 'console', note = excluded.note,
        added_by = case when s.removed_at is null then s.added_by else excluded.added_by end,
        removed_at = null, updated_at = now()
  returning * into v_new;
  perform public.admin_log(p_actor, 'staff.set', 'staff', v_email, jsonb_build_object(
    'role', p_role,
    'before', case when v_had then v_old.role end,
    'note', v_note
  ));
  return public.admin_staff_json(v_new);
end $$;

create function public.admin_staff_remove(p_actor uuid, p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_old public.admin_staff;
begin
  perform public.admin_require(p_actor, 'staff.manage');
  select * into v_old from public.admin_staff where email = v_email and removed_at is null for update;
  if not found then
    return false;
  end if;
  if v_old.source = 'env' then
    raise exception 'managed_by_env' using errcode = 'P0001';
  end if;
  if v_email = (select lower(email) from auth.users where id = p_actor) then
    raise exception 'self' using errcode = 'P0001';
  end if;
  if v_old.role = 'owner' then
    perform public.admin_require(p_actor, 'staff.owners');
    if public.admin_owner_count(v_email) < 1 then
      raise exception 'last_owner' using errcode = 'P0001';
    end if;
  end if;
  update public.admin_staff set removed_at = now(), updated_at = now() where email = v_email;
  perform public.admin_log(p_actor, 'staff.remove', 'staff', v_email, jsonb_build_object('role', v_old.role));
  return true;
end $$;

-- ─── the record of actions ─────────────────────────────────────────────────────────────────────

-- An action the server did outside the database (e.g. a sign-in ban through Supabase Auth), recorded
-- after it; the server checked the permission. Any staff member.
create function public.admin_audit_add(
  p_actor uuid, p_action text, p_target_type text, p_target_id text, p_details jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  if public.admin_role_of(p_actor) is null then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return public.admin_log(p_actor, p_action, p_target_type, p_target_id, p_details);
end $$;

-- Newest first, a page at a time (p_before: the last id seen), optionally about one target.
create function public.admin_audit_list(
  p_actor uuid, p_limit int, p_before bigint, p_target_type text, p_target_id text
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_require(p_actor, 'audit.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'at', a.created_at,
      'actorId', a.actor_id,
      'actorEmail', a.actor_email,
      'action', a.action,
      'targetType', a.target_type,
      'targetId', a.target_id,
      'details', a.details
    ) order by a.id desc)
    from (
      select * from public.admin_audit
      where (p_before is null or id < p_before)
        and (p_target_type is null or target_type = p_target_type)
        and (p_target_id is null or target_id = p_target_id)
      order by id desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) a
  ), '[]'::jsonb);
end $$;

-- ─── the console's live channel ────────────────────────────────────────────────────────────────

-- The channel the console's pages listen on (a random name, made on first use from the server's
-- candidate): the server says "something changed" on it (lib/live/broadcast.ts) — no data, no ids —
-- and the pages ask again.
create function public.admin_channel(p_actor uuid, p_candidate text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v text;
begin
  perform public.admin_require(p_actor, 'dashboard.view');
  if p_candidate is null or p_candidate !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  insert into public.app_meta (key, value) values ('admin:channel', p_candidate)
  on conflict (key) do nothing;
  select value into v from public.app_meta where key = 'admin:channel';
  return v;
end $$;

-- For the server's hints from anywhere (a signup, an RSVP, a payment): the channel, null until made.
create function public.admin_channel_peek() returns text
language sql stable security definer set search_path = '' as $$
  select value from public.app_meta where key = 'admin:channel'
$$;

-- A new channel name (an owner, e.g. after a laptop was lost with the console open).
create function public.admin_channel_rotate(p_actor uuid, p_candidate text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_require(p_actor, 'staff.owners');
  if p_candidate is null or p_candidate !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  insert into public.app_meta (key, value, updated_at) values ('admin:channel', p_candidate, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.admin_log(p_actor, 'system.channel_rotate', 'system', null, '{}'::jsonb);
  return p_candidate;
end $$;

-- ─── housekeeping (the daily job) ──────────────────────────────────────────────────────────────

-- The record of actions is kept two years (the privacy policy says so).
create function public.admin_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_audit int;
begin
  delete from public.admin_audit where created_at < now() - interval '2 years';
  get diagnostics v_audit = row_count;
  return jsonb_build_object('audit', v_audit);
end $$;

-- ─── privileges: the server's role only; the helpers not even that ─────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_can(text, text)',
    'public.admin_role_of(uuid)',
    'public.admin_require(uuid, text)',
    'public.admin_log(uuid, text, text, text, jsonb)',
    'public.admin_staff_json(public.admin_staff)',
    'public.admin_owner_count(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.admin_whoami(uuid, text[])',
    'public.admin_is_staff(uuid)',
    'public.admin_email_reserved(text)',
    'public.admin_staff_list(uuid)',
    'public.admin_staff_set(uuid, text, text, text)',
    'public.admin_staff_remove(uuid, text)',
    'public.admin_audit_add(uuid, text, text, text, jsonb)',
    'public.admin_audit_list(uuid, int, bigint, text, text)',
    'public.admin_channel(uuid, text)',
    'public.admin_channel_peek()',
    'public.admin_channel_rotate(uuid, text)',
    'public.admin_maintenance()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
