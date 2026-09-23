-- Invitations feature — database contract (MASTER_PROMPT §4).
-- Tenancy: per user (owner_id = auth.uid()); the product has no orgs/workspaces.
-- Additions to §4 (kept minimal, all listed in the P1 report):
--   · rsvp_rate_events + rsvp_rate_hit()  — RSVP rate limit (10/min per ip_hash + invitation) that works
--     across serverless instances;
--   · submit_rsvp()                       — response + attendees in one transaction, edit-token replace;
--   · publish_invitation() / restore_invitation_version() — atomic publish/restore for the server routes;
--   · updated_at triggers, CHECK constraints on counts/locale, storage buckets.

-- ─── tables ──────────────────────────────────────────────────────────────────────────────────────

create table public.invitation_templates (
  id text primary key,                 -- 'sahar-bordeaux'
  manifest jsonb not null,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.invitation_templates(id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  event_type text not null,
  draft jsonb not null,
  published jsonb,
  version int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitation_versions (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  version int not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  unique (invitation_id, version)
);

create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  attending boolean not null,
  locale text not null check (locale ~ '^[a-z]{2}$'),
  primary_name text not null,
  phone text, email text,
  adults_count int not null default 0 check (adults_count >= 0),
  children_count int not null default 0 check (children_count >= 0),
  message text,
  answers jsonb not null default '{}',
  edit_token_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rsvp_attendees (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.rsvp_responses(id) on delete cascade,
  kind text not null check (kind in ('adult','child')),
  position int not null,
  first_name text, last_name text, full_name text,
  age int check (age between 0 and 17),
  phone text, email text,
  dietary text[] not null default '{}',
  dietary_notes text
);

-- one row per RSVP attempt; rows older than an hour are pruned by rsvp_rate_hit()
create table public.rsvp_rate_events (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index on public.invitations (owner_id, updated_at desc);
create index on public.rsvp_responses (invitation_id, created_at desc);
create index on public.rsvp_responses (invitation_id, edit_token_hash);
create index on public.rsvp_attendees (response_id);
create index on public.rsvp_rate_events (invitation_id, ip_hash, created_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger invitations_touch before update on public.invitations
  for each row execute function public.touch_updated_at();
create trigger rsvp_responses_touch before update on public.rsvp_responses
  for each row execute function public.touch_updated_at();

-- ─── row level security ─────────────────────────────────────────────────────────────────────────

alter table public.invitation_templates enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_versions enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.rsvp_attendees enable row level security;
alter table public.rsvp_rate_events enable row level security;

create policy "active templates are public" on public.invitation_templates
  for select to anon, authenticated using (is_active);

-- owner full CRUD; no public select (guests read through get_published_invitation)
create policy "owner reads invitations" on public.invitations
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates invitations" on public.invitations
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates invitations" on public.invitations
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes invitations" on public.invitations
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner reads versions" on public.invitation_versions
  for select to authenticated using (
    exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid()))
  );

-- responses: owner select/delete; no public insert (writes only via submit_rsvp, service role)
create policy "owner reads responses" on public.rsvp_responses
  for select to authenticated using (
    exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid()))
  );
create policy "owner deletes responses" on public.rsvp_responses
  for delete to authenticated using (
    exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid()))
  );
create policy "owner reads attendees" on public.rsvp_attendees
  for select to authenticated using (
    exists (
      select 1 from public.rsvp_responses r join public.invitations i on i.id = r.invitation_id
      where r.id = response_id and i.owner_id = (select auth.uid())
    )
  );
-- rsvp_rate_events: no policies — service role only

-- guests never write tables directly, and anonymous users read nothing but active templates
revoke all on public.invitations, public.invitation_versions, public.rsvp_responses,
  public.rsvp_attendees, public.rsvp_rate_events from anon;
revoke insert, update on public.rsvp_responses, public.rsvp_attendees, public.invitation_versions,
  public.rsvp_rate_events from authenticated;
revoke insert, update, delete on public.invitation_templates from anon, authenticated;

-- ─── functions ──────────────────────────────────────────────────────────────────────────────────

-- Public read: the published document of a published invitation — never draft, owner or anything else.
create function public.get_published_invitation(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'document', i.published, 'template', t.manifest)
  from public.invitations i
  join public.invitation_templates t on t.id = i.template_id
  where i.slug = p_slug and i.status = 'published' and i.published is not null
$$;

-- RSVP counter for the endpoint's rate limit: records the attempt, returns true while within the limit.
create function public.rsvp_rate_hit(p_invitation_id uuid, p_ip_hash text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.rsvp_rate_events
    where invitation_id = p_invitation_id and created_at < now() - interval '1 hour';
  insert into public.rsvp_rate_events (invitation_id, ip_hash) values (p_invitation_id, p_ip_hash);
  select count(*) into n from public.rsvp_rate_events
    where invitation_id = p_invitation_id and ip_hash = p_ip_hash
      and created_at > now() - make_interval(secs => p_window_seconds);
  return n <= p_limit;
end $$;

-- Response + attendees in one transaction. With p_existing_token_hash matching a response of this
-- invitation, that response is replaced in place (same id); otherwise a new one is created with
-- p_new_token_hash. Returns { id, replaced }. Input is already validated and sanitized by the server.
create function public.submit_rsvp(
  p_invitation_id uuid,
  p_response jsonb,
  p_attendees jsonb,
  p_existing_token_hash text,
  p_new_token_hash text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_replaced boolean := false;
begin
  if p_existing_token_hash is not null then
    select id into v_id from public.rsvp_responses
      where invitation_id = p_invitation_id and edit_token_hash = p_existing_token_hash
      for update;
  end if;

  if v_id is not null then
    v_replaced := true;
    update public.rsvp_responses set
      attending = (p_response->>'attending')::boolean,
      locale = p_response->>'locale',
      primary_name = p_response->>'primary_name',
      phone = p_response->>'phone',
      email = p_response->>'email',
      adults_count = (p_response->>'adults_count')::int,
      children_count = (p_response->>'children_count')::int,
      message = p_response->>'message',
      answers = coalesce(p_response->'answers', '{}'::jsonb),
      ip_hash = p_response->>'ip_hash'
    where id = v_id;
    delete from public.rsvp_attendees where response_id = v_id;
  else
    insert into public.rsvp_responses (
      invitation_id, attending, locale, primary_name, phone, email, adults_count, children_count,
      message, answers, edit_token_hash, ip_hash
    ) values (
      p_invitation_id,
      (p_response->>'attending')::boolean,
      p_response->>'locale',
      p_response->>'primary_name',
      p_response->>'phone',
      p_response->>'email',
      (p_response->>'adults_count')::int,
      (p_response->>'children_count')::int,
      p_response->>'message',
      coalesce(p_response->'answers', '{}'::jsonb),
      p_new_token_hash,
      p_response->>'ip_hash'
    ) returning id into v_id;
  end if;

  insert into public.rsvp_attendees (
    response_id, kind, position, first_name, last_name, full_name, age, phone, email, dietary, dietary_notes
  )
  select v_id, a.kind, a.position, a.first_name, a.last_name, a.full_name, a.age, a.phone, a.email,
         coalesce(a.dietary, '{}'), a.dietary_notes
  from jsonb_to_recordset(coalesce(p_attendees, '[]'::jsonb)) as a(
    kind text, position int, first_name text, last_name text, full_name text, age int,
    phone text, email text, dietary text[], dietary_notes text
  );

  return jsonb_build_object('id', v_id, 'replaced', v_replaced);
end $$;

-- Publish (called by the server route after validating the draft and checking the session user):
-- draft → published, version + 1, snapshot in invitation_versions. Returns { slug, version } or null.
create function public.publish_invitation(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  update public.invitations set
    published = draft, status = 'published', version = version + 1, published_at = now()
  where id = p_id and owner_id = p_owner_id
  returning * into v;
  if not found then
    return null;
  end if;
  insert into public.invitation_versions (invitation_id, version, document) values (v.id, v.version, v.published);
  return jsonb_build_object('slug', v.slug, 'version', v.version);
end $$;

-- Restore: copies a published version back into the draft. Returns true when restored.
create function public.restore_invitation_version(p_id uuid, p_owner_id uuid, p_version int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations i set draft = v.document
  from public.invitation_versions v
  where i.id = p_id and i.owner_id = p_owner_id and v.invitation_id = i.id and v.version = p_version;
  return found;
end $$;

-- Supabase's default privileges grant EXECUTE to anon/authenticated directly, not only via PUBLIC.
revoke all on function public.get_published_invitation(text) from public, anon, authenticated;
revoke all on function public.rsvp_rate_hit(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.submit_rsvp(uuid, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.publish_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.restore_invitation_version(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

grant execute on function public.get_published_invitation(text) to anon, authenticated, service_role;
grant execute on function public.rsvp_rate_hit(uuid, text, int, int) to service_role;
grant execute on function public.submit_rsvp(uuid, jsonb, jsonb, text, text) to service_role;
grant execute on function public.publish_invitation(uuid, uuid) to service_role;
grant execute on function public.restore_invitation_version(uuid, uuid, int) to service_role;

-- ─── storage ────────────────────────────────────────────────────────────────────────────────────
-- Public buckets (reads through public URLs). Writes: invitation-media via signed upload URLs created
-- by the server (P2); template-media by the team. Paths: invitation-media/{owner_id}/{invitation_id}/…

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('invitation-media', 'invitation-media', true, 15728640,
    array['image/jpeg','image/png','image/webp','image/avif','video/mp4','audio/mpeg']),
  ('template-media', 'template-media', true, 52428800,
    array['image/jpeg','image/png','image/webp','image/avif','video/mp4','audio/mpeg'])
on conflict (id) do nothing;
