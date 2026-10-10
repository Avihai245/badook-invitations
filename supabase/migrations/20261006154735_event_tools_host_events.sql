-- 1. The event's tools (features/invitations/lib/tools.ts): what the host said they need for this event —
-- the digital invitation, planning, seating, the event day. It only shapes what the event's screens show
-- (the sidebar, the event's home, the card on the list); what the event may use is still the features'
-- (invitation_features). Kept in invitations.features.tools, beside the host's switches.

-- The host sets the event's tools (a list of short keys). null when the event isn't theirs.
create function public.invitation_tools_set(p_id uuid, p_owner uuid, p_tools jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if jsonb_typeof(p_tools) is distinct from 'array' or jsonb_array_length(p_tools) > 8 or exists (
    select 1 from jsonb_array_elements(p_tools) e
    where jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^[a-z_]{2,20}$'
  ) then
    raise exception 'invitation_tools_set: bad tools';
  end if;
  update public.invitations i
  set features = jsonb_set(i.features, '{tools}', p_tools)
  where i.id = p_id and i.owner_id = p_owner
  returning i.features into v;
  return v;
end $$;

-- 2. The host's path through the app (features/analytics): a few named steps — entering an event, the
-- next step taken, publishing, the first send — to see where new hosts stop. First party: no cookie, no
-- third party; the server writes them for a signed-in host. Kept 400 days.
create table public.host_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  invitation_id uuid references public.invitations (id) on delete set null,
  name text not null check (name ~ '^[a-z_]{2,40}$'),
  props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and length(props::text) <= 2000),
  created_at timestamptz not null default now()
);
create index host_events_name_at on public.host_events (name, created_at);
create index host_events_user_at on public.host_events (user_id, created_at);
create index host_events_invitation_id on public.host_events (invitation_id);
alter table public.host_events enable row level security;
revoke all on public.host_events from anon, authenticated;

-- One step of a host's path (the app checked it: a known name, the host's own event). Server only.
create function public.host_event_add(p_user uuid, p_invitation uuid, p_name text, p_props jsonb)
returns void
language sql security definer set search_path = '' as $$
  insert into public.host_events (user_id, invitation_id, name, props)
  values (p_user, p_invitation, p_name, coalesce(p_props, '{}'::jsonb))
$$;

-- The funnel between two instants: per step, how many hosts took it and how often (the admin console).
create function public.host_funnel(p_from timestamptz, p_to timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'hosts', s.hosts, 'times', s.times)
    order by s.hosts desc), '[]'::jsonb)
  from (
    select e.name, count(distinct e.user_id) as hosts, count(*) as times
    from public.host_events e
    where e.created_at >= p_from and e.created_at < p_to
    group by e.name
  ) s
$$;

-- Old steps go after 400 days (called by the daily cleanup, like the other purges).
create function public.host_events_purge() returns integer
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.host_events where created_at < now() - interval '400 days' returning 1
  )
  select count(*)::integer from gone
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.invitation_tools_set(uuid, uuid, jsonb)',
    'public.host_event_add(uuid, uuid, text, jsonb)',
    'public.host_funnel(timestamptz, timestamptz)',
    'public.host_events_purge()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
