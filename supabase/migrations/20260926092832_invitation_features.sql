-- Feature flags per event (src/features/flags): what the host switched off for the event and what the
-- platform granted it beyond its plan. The owner's plan decides the rest, in the app. Same rules as
-- before: service_role only, every function checks what it may touch.

alter table public.invitations
  add column features jsonb not null default '{}'::jsonb
    check (jsonb_typeof(features) = 'object');

-- What the flags need about an event: its overrides, and its owner's plan and email (admins have
-- everything). null for an unknown event. Server only: the email never leaves the server.
create function public.invitation_features(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'overrides', i.features,
    'ownerId', i.owner_id,
    'ownerEmail', u.email,
    'plan', coalesce(a.plan, 'free'),
    'planStatus', coalesce(a.plan_status, 'active'),
    'planRenewsAt', a.plan_renews_at
  )
  from public.invitations i
  join auth.users u on u.id = i.owner_id
  left join public.accounts a on a.user_id = i.owner_id
  where i.id = p_id
$$;

-- p_list's features with p_feature added (p_on) or removed, each once.
create function public.feature_list_set(p_list jsonb, p_feature text, p_on boolean) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(distinct f order by f), '[]'::jsonb)
  from (
    select jsonb_array_elements_text(
      case when jsonb_typeof(p_list) = 'array' then p_list else '[]'::jsonb end
    ) f
    union all
    select p_feature where p_on
  ) s
  where f <> p_feature or p_on
$$;

-- The host switches a feature off for their event (p_off), or back to what the plan gives. null when
-- the event isn't theirs. Returns the event's overrides.
create function public.invitation_feature_off(p_id uuid, p_owner uuid, p_feature text, p_off boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if p_feature !~ '^[a-z_]{2,40}$' then
    raise exception 'invitation_feature_off: bad feature';
  end if;
  update public.invitations i
  set features = jsonb_set(i.features, '{off}', public.feature_list_set(i.features -> 'off', p_feature, p_off))
  where i.id = p_id and i.owner_id = p_owner
  returning i.features into v;
  return v;
end $$;

-- The platform grants a feature to one event beyond its plan (an admin, a partner), or takes it
-- back. Never on a host's request. null for an unknown event.
create function public.invitation_feature_grant(p_id uuid, p_feature text, p_grant boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if p_feature !~ '^[a-z_]{2,40}$' then
    raise exception 'invitation_feature_grant: bad feature';
  end if;
  update public.invitations i
  set features = jsonb_set(i.features, '{grant}', public.feature_list_set(i.features -> 'grant', p_feature, p_grant))
  where i.id = p_id
  returning i.features into v;
  return v;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.invitation_features(uuid)',
    'public.feature_list_set(jsonb, text, boolean)',
    'public.invitation_feature_off(uuid, uuid, text, boolean)',
    'public.invitation_feature_grant(uuid, text, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
