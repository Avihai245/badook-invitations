-- Security hardening of what the public Data API (PostgREST, with the publishable key that ships in the
-- browser) can reach. The app reads and writes every table through the service role, with the verified
-- user's id (src/lib/supabase/server.ts, session.ts — the user's own session is used for Auth only), so
-- `anon` and `authenticated` need no table, sequence or default privileges at all; the one public RPC,
-- get_published_invitation(text), keeps its own grant.
--
--   · invitations: a signed-in user could PATCH their own row through /rest/v1/invitations — features
--     (grant: every paid feature), status / published (publishing a document the publish route never
--     validated), template_id (premium designs) — the owner policies of the first migration. Gone.
--   · invitation_versions, rsvp_responses (with edit_token_hash / ip_hash), rsvp_attendees,
--     rsvp_rate_events: the owner's leftover select / delete. Gone.
--   · billing_cards (Tranzila's card tokens) and billing_claims: still held every default privilege of
--     `anon` and `authenticated` (RLS without policies was all that stood in the way; TRUNCATE ignores RLS).
--   · invitation_templates: read through get_published_invitation only.
--   · sequences: `anon` could setval() every one of them.
--   · default privileges: a table, sequence or function created later starts with nothing for `anon` /
--     `authenticated` (each migration grants what it means to; PUBLIC's execute is revoked per function
--     as before).
--   · the active-invitation limit: only the first live full invitation of a save-the-date is free — the
--     follow-up route could otherwise make any number of them outside the plan's limit.
--   · user-facing buckets: their privacy, size limits and file types are applied even when the bucket
--     existed before its migration ran (those inserts said `on conflict do nothing`).

-- ─── direct table access ─────────────────────────────────────────────────────────────────────────

drop policy if exists "owner reads invitations" on public.invitations;
drop policy if exists "owner creates invitations" on public.invitations;
drop policy if exists "owner updates invitations" on public.invitations;
drop policy if exists "owner deletes invitations" on public.invitations;
drop policy if exists "owner reads versions" on public.invitation_versions;
drop policy if exists "owner reads responses" on public.rsvp_responses;
drop policy if exists "owner deletes responses" on public.rsvp_responses;
drop policy if exists "owner reads attendees" on public.rsvp_attendees;
drop policy if exists "active templates are public" on public.invitation_templates;

-- every table and sequence in public: nothing for anon / authenticated (RLS stays on everywhere)
do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass as obj, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  loop
    if r.relkind = 'S' then
      execute format('revoke all on sequence %s from anon, authenticated', r.obj);
    else
      execute format('revoke all on table %s from anon, authenticated', r.obj);
    end if;
  end loop;
end $$;

-- what objects created from now on start with
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- ─── the plan's limit on active invitations ─────────────────────────────────────────────────────

-- One more active invitation only while the owner is under their plan's limit (20260924080558). What
-- counts: every active invitation except a save-the-date's FIRST active full invitation — a second
-- full invitation of the same save-the-date counts like any other.
create or replace function public.invitations_active_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  n int;
begin
  if new.status = 'archived' then
    return new;
  end if;
  -- an active invitation that stays what it was: the count doesn't change
  if tg_op = 'UPDATE' and old.status <> 'archived' and new.source_id is not distinct from old.source_id then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invitations_active:' || new.owner_id::text, 0));
  if new.source_id is not null and not exists (
    select 1 from public.invitations f
    where f.source_id = new.source_id and f.status <> 'archived' and f.id <> new.id
  ) then
    return new;
  end if;
  select active_invitation_limit into v_limit from public.accounts where user_id = new.owner_id;
  if v_limit is null then
    return new;
  end if;
  select count(*) filter (where source_id is null)
         + (count(*) filter (where source_id is not null) - count(distinct source_id))
    into n
  from public.invitations
  where owner_id = new.owner_id and status <> 'archived' and id <> new.id;
  if n >= v_limit then
    raise exception 'plan_limit' using errcode = 'P0001', detail = format('limit %s', v_limit);
  end if;
  return new;
end $$;

revoke execute on function public.invitations_active_limit() from public, anon, authenticated;

-- ─── user-facing buckets: as their migrations meant them ────────────────────────────────────────

update storage.buckets set public = true, file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','audio/mpeg']
where id = 'invitation-media';
update storage.buckets set public = true, file_size_limit = 15728640,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
where id = 'venue-plans';
update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where id = 'plan-files';
