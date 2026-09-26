-- The studio and accessibility layer (Phase 5C): every save of a draft can be recovered, the family
-- comments on a draft through a review link (pins on the invitation), and the invitation is read aloud
-- (the audio made once per language at publish, in the background). The design concepts need no
-- table: their daily limits count in gallery_rate_events like every other limit keyed by a hash.
--
-- Same rules as the rest of the app: row level security is on for every new table and there are no
-- policies, so nothing here is reachable from the browser. Every function is SECURITY DEFINER with an
-- empty search_path, checks the owner (the server passes the signed-in user's id) or a link's hash
-- itself, and only service_role may run it (the helpers not even that). The review link is a token the
-- server derives with its own key; only its SHA-256 hash is stored. Additive and safe on live data:
-- invitation_versions gains two columns (existing rows are the publishes they were) and its publish
-- functions keep their behaviour; the draft's save gets a tracked variant beside the old one.

-- ─── every save recoverable: the history keeps saves beside publishes ──────────────────────────

-- kind 'publish': one row per publish, numbered (as before), kept as long as the invitation.
-- kind 'save': a copy of the draft taken while the host edits — at most one per stretch of editing
-- (save_invitation_draft_tracked), one before a restore and one before a design concept replaces the
-- design (reason) — not numbered, capped per invitation and purged by the daily run after a while.
alter table public.invitation_versions
  add column kind text not null default 'publish',
  add column reason text,
  alter column version drop not null;
alter table public.invitation_versions
  add constraint invitation_versions_kind check (kind in ('publish', 'save')),
  add constraint invitation_versions_reason check (reason is null or reason in ('autosave', 'restore', 'concept')),
  -- a publish has its number and no reason; a save the other way round
  add constraint invitation_versions_kind_shape check (
    (kind = 'publish') = (version is not null) and (kind = 'save') = (reason is not null)
  );
create index invitation_versions_saves on public.invitation_versions (invitation_id, created_at desc)
  where kind = 'save';
create index invitation_versions_saves_age on public.invitation_versions (created_at) where kind = 'save';

-- ─── draft review: a link for family comments, and the comments (pins) ─────────────────────────

-- One per invitation, made when the host first asks for it: the link's token hash and the nonce the
-- server derives the token from (a copy of the database opens no draft), the Realtime channel that
-- tells open pages "something changed" (random, carries no data), an optional expiry, and how the host
-- hears about comments. Revoking keeps the row (the link then says so); a new link replaces the token
-- and the channel.
create table public.review_links (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_nonce text not null check (token_nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  channel text not null unique check (channel ~ '^[A-Za-z0-9_-]{16,64}$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  -- each: an email soon after new comments (at most one every few minutes); daily: one summary a day
  notify text not null default 'each' check (notify in ('each', 'daily', 'off')),
  -- comments written up to this moment were in an email already
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger review_links_touch before update on public.review_links
  for each row execute function public.touch_updated_at();

-- A comment pinned to a spot of a section of the draft (x, y: fractions of the section's box), numbered
-- 1, 2, 3… per invitation (numbers are never reused). The name is what the family member typed; the
-- author key is a hash of a random key their browser keeps, so they can remove their own comment. The
-- host and the family reply in `replies` ([{ id, by: host|reviewer, name, body, at, author }]). The
-- host marks a comment handled (or open again). draft_updated_at: the draft's updated_at when it was
-- written (the host sees the comment was about an earlier draft). Removed comments are marked
-- (deleted_at) and erased a month later; all of them go 90 days after the event (review_maintenance).
create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  number int not null check (number between 1 and 1000000),
  section_id text not null check (char_length(section_id) between 1 and 80),
  pos_x real not null check (pos_x between 0 and 1),
  pos_y real not null check (pos_y between 0 and 1),
  author_name text not null check (char_length(author_name) between 1 and 40),
  author_key text check (author_key is null or author_key ~ '^[0-9a-f]{64}$'),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'handled')),
  replies jsonb not null default '[]'::jsonb check (jsonb_typeof(replies) = 'array'),
  draft_updated_at timestamptz,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (invitation_id, number)
);
create index review_comments_live on public.review_comments (invitation_id, created_at)
  where deleted_at is null;
create index review_comments_removed on public.review_comments (deleted_at) where deleted_at is not null;
create trigger review_comments_touch before update on public.review_comments
  for each row execute function public.touch_updated_at();

-- ─── voice: the invitation read aloud, one audio file per language ─────────────────────────────

-- What each language of a published invitation should sound like (text_hash: the hash of the voice's
-- name and the text the server read out of the published document) and the audio made for it — kept
-- in the host's folder of invitation-media (path), with the hash it was made from (ready_hash). A new
-- publish with other words queues the language again; the old file stays until the new one is ready
-- (the page never plays audio whose hash isn't its own text's). Made in the background (voice_claim);
-- a failure is tried again later, three times at most.
create table public.invitation_voice (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2,3}$'),
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  voice text not null check (char_length(voice) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  path text check (path is null or char_length(path) between 1 and 300),
  ready_hash text check (ready_hash is null or ready_hash ~ '^[0-9a-f]{64}$'),
  bytes int check (bytes is null or bytes >= 0),
  attempts int not null default 0,
  error text check (error is null or char_length(error) <= 300),
  claimed_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (invitation_id, locale),
  check ((path is null) = (ready_hash is null))
);
create index invitation_voice_due on public.invitation_voice (updated_at)
  where status in ('pending', 'processing', 'failed');
create trigger invitation_voice_touch before update on public.invitation_voice
  for each row execute function public.touch_updated_at();

-- ─── row level security: on, no policies (service role only) ────────────────────────────────────

alter table public.review_links enable row level security;
alter table public.review_comments enable row level security;
alter table public.invitation_voice enable row level security;
revoke all on public.review_links, public.review_comments, public.invitation_voice from anon, authenticated;

-- ═══ every save recoverable ════════════════════════════════════════════════════════════════════

-- A copy of `p_doc` in the invitation's history as a save (why: p_reason) — unless the newest entry
-- (a save or a publish) holds the same document; then the oldest saves beyond p_max_saves go.
-- Internal: the callers checked the owner. Returns the new entry's id (null: nothing new to keep).
create function public.invitation_snapshot(p_id uuid, p_doc jsonb, p_reason text, p_max_saves int)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  if p_doc is null or exists (
    select 1 from (
      select v.document from public.invitation_versions v
      where v.invitation_id = p_id
      order by v.created_at desc, v.id desc
      limit 1
    ) last
    where last.document = p_doc
  ) then
    return null;
  end if;
  insert into public.invitation_versions (invitation_id, version, document, kind, reason)
  values (p_id, null, p_doc, 'save', p_reason)
  returning id into v_id;
  delete from public.invitation_versions v
  where v.invitation_id = p_id and v.kind = 'save'
    and v.id not in (
      select x.id from public.invitation_versions x
      where x.invitation_id = p_id and x.kind = 'save'
      order by x.created_at desc, x.id desc
      limit greatest(p_max_saves, 1)
    );
  return v_id;
end $$;

-- The review link's channel when the invitation has a working one (open pages are told the draft
-- changed). Internal.
create function public.review_live_channel(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select r.channel from public.review_links r
  where r.invitation_id = p_id and r.revoked_at is null and (r.expires_at is null or r.expires_at > now())
$$;

-- The template a document names when the database has it, else `p_fallback`. Internal.
create function public.invitation_template_of(p_doc jsonb, p_fallback text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select t.id from public.invitation_templates t where t.id = p_doc->>'templateId'), p_fallback)
$$;

-- Autosave with a history (the editor's saves): like save_invitation_draft — only when nobody saved
-- since p_expected_updated_at — and, before the draft is replaced, a copy of it is kept as a save when
-- the history's newest save is older than p_every_seconds (one per stretch of editing; a draft that is
-- the published one needs none). A design concept may bring another template: the invitation takes it
-- when the database has it. Returns { ok: true, updatedAt, kept, reviewChannel } |
-- { ok: false, code: 'conflict', updatedAt, draft } | null (not the owner's).
create function public.save_invitation_draft_tracked(
  p_id uuid,
  p_owner_id uuid,
  p_draft jsonb,
  p_expected_updated_at timestamptz,
  p_every_seconds int,
  p_max_saves int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  v public.invitations;
  v_template text;
  v_draft jsonb;
  v_last timestamptz;
  v_kept bigint;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner_id for update;
  if not found then
    return null;
  end if;
  if i.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'conflict', 'updatedAt', i.updated_at, 'draft', i.draft);
  end if;
  v_template := public.invitation_template_of(p_draft, i.template_id);
  -- the slug and the template always follow the row
  v_draft := jsonb_set(jsonb_set(p_draft, '{share,slug}', to_jsonb(i.slug)), '{templateId}', to_jsonb(v_template));
  if i.draft is distinct from v_draft and i.draft is distinct from i.published then
    select max(x.created_at) into v_last from public.invitation_versions x
    where x.invitation_id = p_id and x.kind = 'save';
    if v_last is null or v_last < now() - make_interval(secs => greatest(p_every_seconds, 0)) then
      v_kept := public.invitation_snapshot(p_id, i.draft, 'autosave', p_max_saves);
    end if;
  end if;
  update public.invitations x set
    draft = v_draft,
    template_id = v_template,
    event_type = coalesce(p_draft->>'eventType', x.event_type)
  where x.id = p_id
  returning * into v;
  return jsonb_build_object(
    'ok', true,
    'updatedAt', v.updated_at,
    'kept', v_kept is not null,
    'reviewChannel', public.review_live_channel(p_id)
  );
end $$;

-- A copy of the current draft kept on purpose: before a restore, before a design concept (p_reason
-- 'restore' | 'concept'). Returns { ok: true, id } (id null: the history already had it) | null.
create function public.snapshot_invitation_draft(p_id uuid, p_owner_id uuid, p_reason text, p_max_saves int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
begin
  if p_reason is null or p_reason not in ('restore', 'concept') then
    raise exception 'snapshot_invitation_draft: reason' using errcode = '22023';
  end if;
  select * into i from public.invitations where id = p_id and owner_id = p_owner_id for update;
  if not found then
    return null;
  end if;
  return jsonb_build_object('ok', true, 'id', public.invitation_snapshot(p_id, i.draft, p_reason, p_max_saves));
end $$;

-- The history, newest first: publishes and saves (not their documents).
create function public.owner_invitation_history(p_id uuid, p_owner_id uuid, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id,
      'kind', h.kind,
      'version', h.version,
      'reason', h.reason,
      'templateId', h.document->>'templateId',
      'createdAt', h.created_at
    ) order by h.created_at desc, h.id desc), '[]'::jsonb)
  from (
    select v.* from public.invitation_versions v
    join public.invitations i on i.id = v.invitation_id
    where i.id = p_id and i.owner_id = p_owner_id
    order by v.created_at desc, v.id desc
    limit least(greatest(p_limit, 1), 500)
  ) h
$$;

-- One entry of the history with its document (a preview, what changed).
create function public.owner_invitation_entry(p_id uuid, p_owner_id uuid, p_entry_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'kind', v.kind, 'version', v.version, 'reason', v.reason,
    'createdAt', v.created_at, 'document', v.document)
  from public.invitation_versions v
  join public.invitations i on i.id = v.invitation_id
  where i.id = p_id and i.owner_id = p_owner_id and v.id = p_entry_id
$$;

-- Restores an entry of the history (a save or a publish) into the draft, after keeping the current
-- draft as a save ('restore') — so the restore can be undone too. The invitation takes the entry's
-- template back (when the database has it); the slug stays the invitation's. Returns
-- { ok: true, draft, updatedAt, reviewChannel } | null (not the owner's, or no such entry).
create function public.restore_invitation_entry(p_id uuid, p_owner_id uuid, p_entry_id bigint, p_max_saves int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  e public.invitation_versions;
  v public.invitations;
  v_template text;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner_id for update;
  if not found then
    return null;
  end if;
  select * into e from public.invitation_versions where id = p_entry_id and invitation_id = p_id;
  if not found then
    return null;
  end if;
  perform public.invitation_snapshot(p_id, i.draft, 'restore', p_max_saves);
  v_template := public.invitation_template_of(e.document, i.template_id);
  update public.invitations x set
    draft = jsonb_set(jsonb_set(e.document, '{share,slug}', to_jsonb(x.slug)), '{templateId}', to_jsonb(v_template)),
    template_id = v_template,
    event_type = coalesce(e.document->>'eventType', x.event_type)
  where x.id = p_id
  returning * into v;
  return jsonb_build_object(
    'ok', true,
    'draft', v.draft,
    'updatedAt', v.updated_at,
    'reviewChannel', public.review_live_channel(p_id)
  );
end $$;

-- The daily run: saves older than p_keep_days go, and any beyond p_max_saves per invitation (a lower
-- cap than before). Publishes are never purged. Returns how many went.
create function public.invitation_saves_purge(p_keep_days int, p_max_saves int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
begin
  delete from public.invitation_versions
  where kind = 'save' and created_at < now() - make_interval(days => greatest(p_keep_days, 1));
  get diagnostics a = row_count;
  delete from public.invitation_versions v
  using (
    select r.id from (
      select x.id, row_number() over (partition by x.invitation_id order by x.created_at desc, x.id desc) n
      from public.invitation_versions x
      where x.kind = 'save'
    ) r
    where r.n > greatest(p_max_saves, 1)
  ) extra
  where v.id = extra.id;
  get diagnostics b = row_count;
  return a + b;
end $$;

-- The published versions only (the editor's list before saves were kept, and older clients).
create or replace function public.owner_invitation_versions(p_id uuid, p_owner_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'createdAt', v.created_at)
                  order by v.version desc), '[]'::jsonb)
  from public.invitation_versions v
  join public.invitations i on i.id = v.invitation_id
  where i.id = p_id and i.owner_id = p_owner_id and v.kind = 'publish'
$$;

create or replace function public.owner_invitation_version(p_id uuid, p_owner_id uuid, p_version int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select v.document
  from public.invitation_versions v
  join public.invitations i on i.id = v.invitation_id
  where i.id = p_id and i.owner_id = p_owner_id and v.kind = 'publish' and v.version = p_version
$$;

-- ═══ draft review ══════════════════════════════════════════════════════════════════════════════

-- A comment as the pages show it (the author's key never leaves the database).
create function public.review_comment_json(c public.review_comments) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'number', c.number,
    'sectionId', c.section_id,
    'x', c.pos_x,
    'y', c.pos_y,
    'name', c.author_name,
    'body', c.body,
    'status', c.status,
    'replies', coalesce((
      select jsonb_agg(r - 'author' order by ord)
      from jsonb_array_elements(c.replies) with ordinality as t(r, ord)
    ), '[]'::jsonb),
    'draftUpdatedAt', c.draft_updated_at,
    'handledAt', c.handled_at,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at
  )
$$;

-- The comments of an invitation (not removed), in the order they were written. Internal.
create function public.review_comments_of(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.review_comment_json(c) order by c.number), '[]'::jsonb)
  from public.review_comments c
  where c.invitation_id = p_id and c.deleted_at is null
$$;

-- The link as the host's screen needs it (with the hash and nonce the server derives the token from).
create function public.review_link_json(r public.review_links) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when r.invitation_id is null then null else jsonb_build_object(
    'tokenHash', r.token_hash,
    'tokenNonce', r.token_nonce,
    'channel', r.channel,
    'expiresAt', r.expires_at,
    'revokedAt', r.revoked_at,
    'notify', r.notify,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at
  ) end
$$;

-- The host's view: the link (or null) and the comments, with the draft's updatedAt.
create function public.review_owner_get(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
  r public.review_links;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  select * into r from public.review_links where invitation_id = p_id;
  return jsonb_build_object(
    'link', public.review_link_json(r),
    'updatedAt', i.updated_at,
    'comments', public.review_comments_of(p_id)
  );
end $$;

-- Makes the review link (or, when it was revoked, a new one in its place); a working link stays as
-- it is. p_expires_at: null = no expiry.
create function public.review_owner_setup(
  p_id uuid, p_owner uuid, p_hash text, p_nonce text, p_channel text, p_expires_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.review_links (invitation_id, token_hash, token_nonce, channel, expires_at)
  values (p_id, p_hash, p_nonce, p_channel, p_expires_at)
  on conflict (invitation_id) do update set
    token_hash = excluded.token_hash, token_nonce = excluded.token_nonce, channel = excluded.channel,
    expires_at = excluded.expires_at, revoked_at = null
  where public.review_links.revoked_at is not null;
  return public.review_owner_get(p_id, p_owner);
end $$;

-- A new link (the old one stops working at once) and a new channel; a revoked link works again.
create function public.review_owner_rotate(p_id uuid, p_owner uuid, p_hash text, p_nonce text, p_channel text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.review_links r set token_hash = p_hash, token_nonce = p_nonce, channel = p_channel,
    revoked_at = null
  from public.invitations i
  where r.invitation_id = p_id and i.id = r.invitation_id and i.owner_id = p_owner;
  if not found then
    return null;
  end if;
  return public.review_owner_get(p_id, p_owner);
end $$;

-- The link's expiry and how the host hears about comments: p_patch { expiresAt?: iso | null,
-- notify?: 'each' | 'daily' | 'off' } (keys left out stay).
create function public.review_owner_update(p_id uuid, p_owner uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_patch ? 'notify' and coalesce(p_patch->>'notify', '') not in ('each', 'daily', 'off') then
    raise exception 'review_owner_update: notify' using errcode = '22023';
  end if;
  update public.review_links r set
    expires_at = case when p_patch ? 'expiresAt' then (p_patch->>'expiresAt')::timestamptz else r.expires_at end,
    notify = coalesce(p_patch->>'notify', r.notify)
  from public.invitations i
  where r.invitation_id = p_id and i.id = r.invitation_id and i.owner_id = p_owner;
  if not found then
    return null;
  end if;
  return public.review_owner_get(p_id, p_owner);
end $$;

-- Revokes the link: it opens nothing any more (the comments stay).
create function public.review_owner_revoke(p_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.review_links r set revoked_at = coalesce(r.revoked_at, now())
  from public.invitations i
  where r.invitation_id = p_id and i.id = r.invitation_id and i.owner_id = p_owner;
  if not found then
    return null;
  end if;
  return public.review_owner_get(p_id, p_owner);
end $$;

-- The host answers a comment (p_reply_id from the host's screen: a retried request adds it once).
-- Returns { ok: true, comment } | { ok: false, code: 'not_found' | 'too_many' } | null.
create function public.review_owner_reply(
  p_id uuid, p_owner uuid, p_comment_id uuid, p_reply_id uuid, p_body text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.review_comments;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into c from public.review_comments
  where id = p_comment_id and invitation_id = p_id and deleted_at is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from jsonb_array_elements(c.replies) r where r->>'id' = p_reply_id::text) then
    return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
  end if;
  if jsonb_array_length(c.replies) >= 50 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'review_owner_reply: body' using errcode = '22023';
  end if;
  update public.review_comments set replies = replies || jsonb_build_array(jsonb_build_object(
      'id', p_reply_id, 'by', 'host', 'name', null, 'body', btrim(p_body), 'at', now()))
  where id = c.id
  returning * into c;
  return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
end $$;

-- Handled, or open again. Returns { ok: true, comment } | { ok: false, code: 'not_found' } | null.
create function public.review_owner_status(p_id uuid, p_owner uuid, p_comment_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.review_comments;
begin
  if p_status is null or p_status not in ('open', 'handled') then
    raise exception 'review_owner_status: status' using errcode = '22023';
  end if;
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  update public.review_comments set
    status = p_status,
    handled_at = case when p_status = 'handled' then coalesce(handled_at, now()) else null end
  where id = p_comment_id and invitation_id = p_id and deleted_at is null
  returning * into c;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
end $$;

-- The host removes a comment. Returns true when it was there.
create function public.review_owner_delete(p_id uuid, p_owner uuid, p_comment_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.review_comments c set deleted_at = now()
  from public.invitations i
  where c.id = p_comment_id and c.invitation_id = p_id and c.deleted_at is null
    and i.id = c.invitation_id and i.owner_id = p_owner;
  return found;
end $$;

-- The invitation behind a review link and the link's state: { invitationId, channel, state:
-- 'ok' | 'expired' | 'revoked' } | null (no such link). The server checks the event's features next.
create function public.review_link(p_token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invitationId', r.invitation_id,
    'channel', r.channel,
    'state', case
      when r.revoked_at is not null then 'revoked'
      when r.expires_at is not null and r.expires_at <= now() then 'expired'
      else 'ok' end)
  from public.review_links r
  where r.token_hash = p_token_hash
$$;

-- A working link's row (not revoked or expired), locked when p_lock. Internal.
create function public.review_link_row(p_token_hash text) returns public.review_links
language sql stable security definer set search_path = '' as $$
  select r.* from public.review_links r
  where r.token_hash = p_token_hash and r.revoked_at is null and (r.expires_at is null or r.expires_at > now())
$$;

-- What the review page shows: the current draft, its template, its updatedAt and the comments.
-- p_rate_key: the server's salted hash of the address. Returns { ok: true, … } |
-- { ok: false, code: 'rate' } | null (no working link).
create function public.review_open(p_token_hash text, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.review_links;
  i public.invitations;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 1200, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  r := public.review_link_row(p_token_hash);
  if r.invitation_id is null then
    return null;
  end if;
  select * into i from public.invitations where id = r.invitation_id;
  return jsonb_build_object(
    'ok', true,
    'channel', r.channel,
    'expiresAt', r.expires_at,
    'templateId', i.template_id,
    'draft', i.draft,
    'updatedAt', i.updated_at,
    'comments', public.review_comments_of(i.id)
  );
end $$;

-- The limits every review write shares: 40 writes / 10 minutes per address, 300 / hour per link. Internal.
create function public.review_write_allowed(p_token_hash text, p_rate_key text) returns boolean
language sql security definer set search_path = '' as $$
  select public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 40, 600)
     and public.gallery_rate_hit(encode(sha256(convert_to('review-link:' || p_token_hash, 'UTF8')), 'hex'), 300, 3600)
$$;

-- A family member pins a comment (p_comment_id from their page: a retried request adds it once).
-- Returns { ok: true, comment } | { ok: false, code: 'rate' | 'too_many' | 'unknown_section' } | null.
create function public.review_comment_add(
  p_token_hash text,
  p_rate_key text,
  p_author_key text,
  p_comment_id uuid,
  p_section_id text,
  p_x real,
  p_y real,
  p_name text,
  p_body text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.review_links;
  i public.invitations;
  c public.review_comments;
begin
  r := public.review_link_row(p_token_hash);
  if r.invitation_id is null then
    return null;
  end if;
  select * into c from public.review_comments where id = p_comment_id and invitation_id = r.invitation_id;
  if found then
    return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
  end if;
  if not public.review_write_allowed(p_token_hash, p_rate_key) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  -- one writer at a time per invitation: the numbers follow each other
  perform 1 from public.review_links where invitation_id = r.invitation_id for update;
  select * into i from public.invitations where id = r.invitation_id;
  if not exists (
    select 1 from jsonb_array_elements(i.draft->'sections') s where s->>'id' = p_section_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'unknown_section');
  end if;
  if (select count(*) from public.review_comments
      where invitation_id = r.invitation_id and deleted_at is null) >= 500 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  insert into public.review_comments (
    id, invitation_id, number, section_id, pos_x, pos_y, author_name, author_key, body, draft_updated_at
  ) values (
    p_comment_id, r.invitation_id,
    coalesce((select max(x.number) from public.review_comments x where x.invitation_id = r.invitation_id), 0) + 1,
    p_section_id, p_x, p_y, btrim(p_name), p_author_key, btrim(p_body), i.updated_at
  ) returning * into c;
  return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
end $$;

-- A family member answers a comment. Returns { ok: true, comment } |
-- { ok: false, code: 'rate' | 'not_found' | 'too_many' } | null.
create function public.review_reply_add(
  p_token_hash text,
  p_rate_key text,
  p_author_key text,
  p_comment_id uuid,
  p_reply_id uuid,
  p_name text,
  p_body text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.review_links;
  c public.review_comments;
begin
  r := public.review_link_row(p_token_hash);
  if r.invitation_id is null then
    return null;
  end if;
  select * into c from public.review_comments
  where id = p_comment_id and invitation_id = r.invitation_id and deleted_at is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from jsonb_array_elements(c.replies) x where x->>'id' = p_reply_id::text) then
    return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
  end if;
  if not public.review_write_allowed(p_token_hash, p_rate_key) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  if jsonb_array_length(c.replies) >= 50 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40
     or char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'review_reply_add: name or body' using errcode = '22023';
  end if;
  update public.review_comments set replies = replies || jsonb_build_array(jsonb_build_object(
      'id', p_reply_id, 'by', 'reviewer', 'name', btrim(p_name), 'body', btrim(p_body), 'at', now(),
      'author', p_author_key))
  where id = c.id
  returning * into c;
  return jsonb_build_object('ok', true, 'comment', public.review_comment_json(c));
end $$;

-- A family member removes their own comment (their browser's key). Returns { ok: true } |
-- { ok: false, code: 'rate' | 'not_found' } | null.
create function public.review_comment_remove(
  p_token_hash text, p_rate_key text, p_author_key text, p_comment_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.review_links;
begin
  r := public.review_link_row(p_token_hash);
  if r.invitation_id is null then
    return null;
  end if;
  if not public.review_write_allowed(p_token_hash, p_rate_key) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  update public.review_comments set deleted_at = now()
  where id = p_comment_id and invitation_id = r.invitation_id and deleted_at is null
    and author_key is not null and author_key = p_author_key;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- What the host hasn't been emailed about yet: the comments and family replies written after
-- notified_at, with the host's address, the draft (for its title and language) and the mode.
-- null when there is no link.
create function public.review_notify_pending(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.review_links;
  since timestamptz;
begin
  select * into r from public.review_links where invitation_id = p_id;
  if not found then
    return null;
  end if;
  since := coalesce(r.notified_at, '-infinity'::timestamptz);
  return jsonb_build_object(
    'id', r.invitation_id,
    'mode', r.notify,
    'notifiedAt', r.notified_at,
    'email', (select u.email from public.invitations i join auth.users u on u.id = i.owner_id where i.id = p_id),
    'document', (select i.draft from public.invitations i where i.id = p_id),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('number', c.number, 'name', c.author_name, 'body', c.body,
          'reply', false, 'at', c.created_at) order by c.created_at)
      from public.review_comments c
      where c.invitation_id = p_id and c.deleted_at is null and c.created_at > since
    ), '[]'::jsonb) || coalesce((
      select jsonb_agg(jsonb_build_object('number', c.number, 'name', x->>'name', 'body', x->>'body',
          'reply', true, 'at', x->>'at') order by x->>'at')
      from public.review_comments c, jsonb_array_elements(c.replies) x
      where c.invitation_id = p_id and c.deleted_at is null and x->>'by' = 'reviewer'
        and (x->>'at')::timestamptz > since
    ), '[]'::jsonb)
  );
end $$;

-- The emails went out up to p_at.
create function public.review_notify_mark(p_id uuid, p_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  update public.review_links set notified_at = greatest(coalesce(notified_at, p_at), p_at)
  where invitation_id = p_id
$$;

-- The daily run's summaries: the invitations whose host hears about comments (each / daily) and has
-- some not emailed yet — their ids (review_notify_pending gives the rest).
create function public.review_digest_due() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(r.invitation_id), '[]'::jsonb)
  from public.review_links r
  where r.notify in ('each', 'daily') and exists (
    select 1 from public.review_comments c
    where c.invitation_id = r.invitation_id and c.deleted_at is null
      and (c.created_at > coalesce(r.notified_at, '-infinity'::timestamptz)
        or exists (select 1 from jsonb_array_elements(c.replies) x
                   where x->>'by' = 'reviewer'
                     and (x->>'at')::timestamptz > coalesce(r.notified_at, '-infinity'::timestamptz)))
  )
$$;

-- What the privacy policy promises: comments go p_days after the event's date; removed ones after a
-- month.
create function public.review_maintenance(p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
begin
  delete from public.review_comments c
  using public.invitations i
  where c.invitation_id = i.id
    and coalesce(i.published, i.draft)#>>'{event,date}' ~ '^\d{4}-\d{2}-\d{2}$'
    and (coalesce(i.published, i.draft)#>>'{event,date}')::date < current_date - greatest(p_days, 1);
  get diagnostics a = row_count;
  delete from public.review_comments where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics b = row_count;
  return jsonb_build_object('comments', a, 'removed', b);
end $$;

-- ═══ voice ═════════════════════════════════════════════════════════════════════════════════════

-- After a publish: what each language should sound like now (p_items [{ locale, hash, voice }]). A
-- language whose text (or voice) changed is queued again; one that is the same stays as it is; a
-- language the invitation no longer has goes — returns { queued, remove: [its audio's paths] }.
-- null: not the owner's.
create function public.voice_queue(p_id uuid, p_owner uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  gone jsonb;
  item jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.invitation_voice (invitation_id, locale, text_hash, voice)
    values (p_id, item->>'locale', item->>'hash', item->>'voice')
    on conflict (invitation_id, locale) do update set
      text_hash = excluded.text_hash, voice = excluded.voice, status = 'pending', attempts = 0,
      error = null, claimed_at = null, next_attempt_at = null
    where public.invitation_voice.text_hash <> excluded.text_hash
       or public.invitation_voice.voice <> excluded.voice
       or public.invitation_voice.status = 'failed';
    if found then
      n := n + 1;
    end if;
  end loop;
  with d as (
    delete from public.invitation_voice v
    where v.invitation_id = p_id
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x where x->>'locale' = v.locale)
    returning v.path
  )
  select coalesce(jsonb_agg(d.path) filter (where d.path is not null), '[]'::jsonb) into gone from d;
  return jsonb_build_object('queued', n, 'remove', gone);
end $$;

-- Up to p_limit languages to make now (of one invitation, or any): queued ones, failed ones due for
-- another try (three at most), and ones a worker took over ten minutes ago without finishing — of
-- published invitations. Each is taken (processing) with its published document and owner.
create function public.voice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  claimed jsonb;
begin
  with c as (
    select v.invitation_id, v.locale from public.invitation_voice v
    join public.invitations i on i.id = v.invitation_id
    where (p_id is null or v.invitation_id = p_id)
      and i.status = 'published' and i.published is not null
      and (
        v.status = 'pending'
        or (v.status = 'failed' and v.attempts < 3 and coalesce(v.next_attempt_at, now()) <= now())
        or (v.status = 'processing' and v.claimed_at < now() - interval '10 minutes' and v.attempts < 3)
      )
    order by v.updated_at
    limit least(greatest(p_limit, 1), 50)
    for update of v skip locked
  ), u as (
    update public.invitation_voice v set status = 'processing', claimed_at = now(), attempts = v.attempts + 1
    from c
    where v.invitation_id = c.invitation_id and v.locale = c.locale
    returning v.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'invitationId', u.invitation_id,
      'locale', u.locale,
      'textHash', u.text_hash,
      'voice', u.voice,
      'attempts', u.attempts,
      'ownerId', i.owner_id,
      'slug', i.slug,
      'document', i.published
    )), '[]'::jsonb) into claimed
  from u join public.invitations i on i.id = u.invitation_id;
  return claimed;
end $$;

-- A language's audio is made (from the text with p_hash) and stored at p_path. Returns
-- { ok: true, old: the replaced file's path | null } — or { ok: false } when the words changed
-- meanwhile (the new file is then not wanted).
create function public.voice_done(p_id uuid, p_locale text, p_hash text, p_path text, p_bytes int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitation_voice;
begin
  select * into v from public.invitation_voice where invitation_id = p_id and locale = p_locale for update;
  if not found or v.text_hash <> p_hash then
    return jsonb_build_object('ok', false);
  end if;
  update public.invitation_voice set status = 'ready', path = p_path, ready_hash = p_hash, bytes = p_bytes,
    error = null, claimed_at = null, next_attempt_at = null
  where invitation_id = p_id and locale = p_locale;
  return jsonb_build_object('ok', true, 'old', case when v.path is distinct from p_path then v.path end);
end $$;

-- Making it failed: tried again after p_wait_seconds (while attempts are left).
create function public.voice_failed(p_id uuid, p_locale text, p_hash text, p_error text, p_wait_seconds int)
returns void
language sql security definer set search_path = '' as $$
  update public.invitation_voice set status = 'failed', error = left(p_error, 300), claimed_at = null,
    next_attempt_at = now() + make_interval(secs => greatest(p_wait_seconds, 0))
  where invitation_id = p_id and locale = p_locale and text_hash = p_hash
$$;

-- The guest's page: the audio each language of a published invitation has (the page plays it only
-- when its hash is its own text's).
create function public.voice_tracks(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('locale', v.locale, 'hash', v.ready_hash, 'path', v.path)
                  order by v.locale), '[]'::jsonb)
  from public.invitations i
  join public.invitation_voice v on v.invitation_id = i.id
  where i.slug = p_slug and i.status = 'published' and v.path is not null
$$;

-- The host's view: each language's state.
create function public.voice_owner_state(p_id uuid, p_owner uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner)
    then null
    else coalesce((
      select jsonb_agg(jsonb_build_object(
          'locale', v.locale, 'status', v.status, 'ready', v.ready_hash is not null and v.ready_hash = v.text_hash,
          'voice', v.voice, 'attempts', v.attempts, 'updatedAt', v.updated_at) order by v.locale)
      from public.invitation_voice v where v.invitation_id = p_id
    ), '[]'::jsonb) end
$$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  -- helpers: only the functions above run them (the server never calls them directly)
  foreach f in array array[
    'public.invitation_snapshot(uuid, jsonb, text, int)',
    'public.review_live_channel(uuid)',
    'public.invitation_template_of(jsonb, text)',
    'public.review_comment_json(public.review_comments)',
    'public.review_comments_of(uuid)',
    'public.review_link_json(public.review_links)',
    'public.review_link_row(text)',
    'public.review_write_allowed(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  -- what the server calls
  foreach f in array array[
    'public.save_invitation_draft_tracked(uuid, uuid, jsonb, timestamptz, int, int)',
    'public.snapshot_invitation_draft(uuid, uuid, text, int)',
    'public.owner_invitation_history(uuid, uuid, int)',
    'public.owner_invitation_entry(uuid, uuid, bigint)',
    'public.restore_invitation_entry(uuid, uuid, bigint, int)',
    'public.invitation_saves_purge(int, int)',
    'public.owner_invitation_versions(uuid, uuid)',
    'public.owner_invitation_version(uuid, uuid, int)',
    'public.review_owner_get(uuid, uuid)',
    'public.review_owner_setup(uuid, uuid, text, text, text, timestamptz)',
    'public.review_owner_rotate(uuid, uuid, text, text, text)',
    'public.review_owner_update(uuid, uuid, jsonb)',
    'public.review_owner_revoke(uuid, uuid)',
    'public.review_owner_reply(uuid, uuid, uuid, uuid, text)',
    'public.review_owner_status(uuid, uuid, uuid, text)',
    'public.review_owner_delete(uuid, uuid, uuid)',
    'public.review_link(text)',
    'public.review_open(text, text)',
    'public.review_comment_add(text, text, text, uuid, text, real, real, text, text)',
    'public.review_reply_add(text, text, text, uuid, uuid, text, text)',
    'public.review_comment_remove(text, text, text, uuid)',
    'public.review_notify_pending(uuid)',
    'public.review_notify_mark(uuid, timestamptz)',
    'public.review_digest_due()',
    'public.review_maintenance(int)',
    'public.voice_queue(uuid, uuid, jsonb)',
    'public.voice_claim(uuid, int)',
    'public.voice_done(uuid, text, text, text, int)',
    'public.voice_failed(uuid, text, text, text, int)',
    'public.voice_tracks(text)',
    'public.voice_owner_state(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
