-- Live event gallery (features live_gallery, gallery_ai, projector): guests upload photos and videos
-- from the event with the gallery's link, without signing up and without an app, and watch them in a
-- live feed; the host checks and approves them, shows them on the venue's screen and downloads the
-- original files.
--
-- Same rules as the rest of the app: row level security is on and there are no policies, so nothing
-- here is reachable from the browser. Every function is SECURITY DEFINER with an empty search_path,
-- checks the owner (the server passes the signed-in user's id) or a token's hash itself, and only
-- service_role may run it. Files live in two PRIVATE storage buckets and are only ever served through
-- short-lived signed URLs that the server creates.

-- ─── tables ─────────────────────────────────────────────────────────────────────────────────────

-- One gallery per invitation: the host turns it on. The links are tokens the server derives from the
-- nonces below with its own key; only their SHA-256 hashes are kept, so the database alone can't
-- produce a working link. A new nonce (and hash) makes a new link and retires the old one.
create table public.galleries (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  -- off: guests and the projector see nothing; the photos stay
  enabled boolean not null default true,
  -- instant: uploads go straight to the feed (unless a check holds them); approval: the host approves each
  mode text not null default 'instant' check (mode in ('instant', 'approval')),
  -- uploads stop for now; the feed stays
  paused boolean not null default false,
  -- uploads are accepted only between these (either may be open-ended)
  opens_at timestamptz,
  closes_at timestamptz,
  upload_token_hash text not null unique check (upload_token_hash ~ '^[0-9a-f]{64}$'),
  upload_token_nonce text not null check (upload_token_nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  projector_token_hash text not null unique check (projector_token_hash ~ '^[0-9a-f]{64}$'),
  projector_token_nonce text not null check (projector_token_nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- an optional code guests type before uploading: a salted SHA-256 hash (the host can replace it, not read it)
  access_code_hash text check (access_code_hash is null or access_code_hash ~ '^[0-9a-f]{64}$'),
  access_code_salt text check (access_code_salt is null or access_code_salt ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- the Realtime broadcast channel that tells open pages "something changed" (random, carries no data)
  channel text not null unique check (channel ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at is null or closes_at is null or closes_at > opens_at),
  check ((access_code_hash is null) = (access_code_salt is null))
);
create trigger galleries_touch before update on public.galleries
  for each row execute function public.touch_updated_at();

-- One photo or video. Reserved (status 'uploading') when the server hands out its upload URLs; the
-- preview files come first, then the original. Storage paths are always <invitation>/<item>/<file>:
-- the original in gallery-originals, the display version and the thumbnail in gallery-media. The
-- quality scores, dimensions, duration and time taken are kept for what comes later (highlights,
-- albums). Deleting sets deleted_at (the files are removed at once, see gallery_items_trash); the row
-- itself goes a month later.
create table public.gallery_items (
  id uuid primary key,
  invitation_id uuid not null references public.galleries(invitation_id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  status text not null default 'uploading'
    check (status in ('uploading', 'pending', 'published', 'hidden', 'rejected')),
  -- why it is where it is (the last decision): shown to the host in the review queue
  status_reason text check (status_reason in (
    'ok', 'approval', 'nsfw', 'unsafe', 'quality', 'blurry', 'dark', 'duplicate', 'unchecked',
    'no_preview', 'host'
  )),
  original_path text not null,
  original_type text not null check (char_length(original_type) <= 60),
  original_size bigint not null check (original_size > 0),
  -- the original can finish after the item is already in the feed (it is the largest file)
  original_done boolean not null default false,
  -- no display version / thumbnail: a format the phone couldn't open (the original is still kept)
  display_path text,
  display_size int check (display_size is null or display_size > 0),
  thumb_path text,
  thumb_size int check (thumb_size is null or thumb_size > 0),
  width int check (width is null or width between 1 and 100000),
  height int check (height is null or height between 1 and 100000),
  duration_ms int check (duration_ms is null or duration_ms >= 0),
  -- from the photo's EXIF (or the video's header); null when it has none
  taken_at timestamptz,
  -- the browser's checks on the thumbnail: variance of the Laplacian (sharpness), mean luminance 0..1
  sharpness real,
  brightness real,
  -- the display version got a gentle levels/contrast lift
  enhanced boolean not null default false,
  -- the automatic content check (gallery_ai): 0..1
  ai_nsfw real check (ai_nsfw is null or ai_nsfw between 0 and 1),
  ai_quality real check (ai_quality is null or ai_quality between 0 and 1),
  -- perceptual hash (dHash, 64 bits as hex) of the thumbnail: finds the same photo uploaded twice
  phash text check (phash is null or phash ~ '^[0-9a-f]{16}$'),
  -- who uploaded it: a hash of the device's random uploader id (never the id itself), and the guest
  -- when they came through their personal link; an optional name they typed
  uploader_hash text not null check (uploader_hash ~ '^[0-9a-f]{64}$'),
  guest_id uuid references public.invitation_guests(id) on delete set null,
  uploader_name text check (uploader_name is null or char_length(uploader_name) between 1 and 60),
  created_at timestamptz not null default now(),
  -- the preview files arrived and the checks ran
  completed_at timestamptz,
  -- the last time it entered the feed (new approvals come first)
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text check (deleted_by in ('host', 'guest', 'system')),
  check (starts_with(original_path, invitation_id::text || '/' || id::text || '/')),
  check (display_path is null or starts_with(display_path, invitation_id::text || '/' || id::text || '/')),
  check (thumb_path is null or starts_with(thumb_path, invitation_id::text || '/' || id::text || '/'))
);
create index gallery_items_feed on public.gallery_items (invitation_id, published_at desc, id desc)
  where deleted_at is null and status = 'published';
create index gallery_items_list on public.gallery_items (invitation_id, created_at desc, id desc)
  where deleted_at is null;
create index gallery_items_changes on public.gallery_items (invitation_id, updated_at);
create index gallery_items_uploader on public.gallery_items (invitation_id, uploader_hash);
create index gallery_items_guest on public.gallery_items (guest_id) where guest_id is not null;
create index gallery_items_abandoned on public.gallery_items (created_at) where status = 'uploading';
create index gallery_items_tombstones on public.gallery_items (deleted_at) where deleted_at is not null;
create trigger gallery_items_touch before update on public.gallery_items
  for each row execute function public.touch_updated_at();

-- Every check an item went through and every decision about it: the browser's (blur, darkness,
-- duplicate), the automatic content check's, the host's mode, the host's own approve / hide / reject /
-- delete, a guest deleting their upload. The score is the check's own number (sharpness, luminance,
-- hash distance, the AI's nsfw score).
create table public.gallery_moderation (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.gallery_items(id) on delete cascade,
  check_name text not null check (check_name in ('blur', 'dark', 'duplicate', 'ai', 'mode', 'host', 'guest')),
  result text not null check (result in (
    'pass', 'flag', 'error', 'skipped', 'published', 'pending', 'hidden', 'rejected', 'deleted'
  )),
  score real,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  decided_by text not null check (decided_by in ('browser', 'server', 'ai', 'host', 'guest')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index gallery_moderation_item on public.gallery_moderation (item_id, created_at);

-- Rate limits of the guests' requests (per link, per hashed address, per device): one row per
-- request, a day at most.
create table public.gallery_rate_events (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index gallery_rate_events_key on public.gallery_rate_events (key_hash, created_at desc);

-- Files to remove from storage: filled by the trigger below whenever an item is deleted (by the
-- host, a guest, the gallery or invitation or account going), emptied by the server's sweeper.
-- No foreign key: the rows outlive the items they came from.
create table public.gallery_trash (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket in ('gallery-originals', 'gallery-media')),
  path text not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index gallery_trash_open on public.gallery_trash (id) where claimed_at is null;

-- An item's files go to the trash when it is deleted (soft delete: at once; a row deleted outright —
-- the gallery, invitation or account went — unless it was already soft-deleted).
create function public.gallery_items_trash() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.gallery_items;
begin
  if tg_op = 'DELETE' then
    if old.deleted_at is not null then
      return old;
    end if;
    r := old;
  elsif old.deleted_at is null and new.deleted_at is not null then
    r := new;
  else
    return new;
  end if;
  insert into public.gallery_trash (bucket, path)
  select v.bucket, v.path
  from (values
    ('gallery-originals', r.original_path),
    ('gallery-media', r.display_path),
    ('gallery-media', r.thumb_path)
  ) v(bucket, path)
  where v.path is not null;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger gallery_items_trash_delete after delete on public.gallery_items
  for each row execute function public.gallery_items_trash();
create trigger gallery_items_trash_soft after update of deleted_at on public.gallery_items
  for each row execute function public.gallery_items_trash();

-- ─── row level security: on, no policies (service role only) ────────────────────────────────────

alter table public.galleries enable row level security;
alter table public.gallery_items enable row level security;
alter table public.gallery_moderation enable row level security;
alter table public.gallery_rate_events enable row level security;
alter table public.gallery_trash enable row level security;
revoke all on public.galleries, public.gallery_items, public.gallery_moderation,
  public.gallery_rate_events, public.gallery_trash from anon, authenticated;

-- ─── helpers ────────────────────────────────────────────────────────────────────────────────────

-- A gallery's settings as the server reads them (the token hashes and nonces stay on the server: it
-- derives the links from them; the browser only ever gets the links).
create function public.gallery_json(g public.galleries) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'invitationId', g.invitation_id,
    'enabled', g.enabled,
    'mode', g.mode,
    'paused', g.paused,
    'opensAt', g.opens_at,
    'closesAt', g.closes_at,
    'hasCode', g.access_code_hash is not null,
    'uploadTokenHash', g.upload_token_hash,
    'uploadTokenNonce', g.upload_token_nonce,
    'projectorTokenHash', g.projector_token_hash,
    'projectorTokenNonce', g.projector_token_nonce,
    'channel', g.channel,
    'createdAt', g.created_at,
    'updatedAt', g.updated_at
  )
$$;

-- How many items a gallery has, by status and kind, and from how many devices (uploads still under
-- way and deleted items don't count).
create function public.gallery_counts(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', count(*) filter (where i.status <> 'uploading'),
    'published', count(*) filter (where i.status = 'published'),
    'pending', count(*) filter (where i.status = 'pending'),
    'hidden', count(*) filter (where i.status = 'hidden'),
    'rejected', count(*) filter (where i.status = 'rejected'),
    'uploading', count(*) filter (where i.status = 'uploading'),
    'images', count(*) filter (where i.kind = 'image' and i.status <> 'uploading'),
    'videos', count(*) filter (where i.kind = 'video' and i.status <> 'uploading'),
    'uploaders', count(distinct i.uploader_hash) filter (where i.status <> 'uploading'),
    'bytes', coalesce(sum(i.original_size) filter (where i.status <> 'uploading'), 0)
  )
  from public.gallery_items i
  where i.invitation_id = p_invitation_id and i.deleted_at is null
$$;

-- One item as the server works with it (paths included: the server signs URLs for them).
create function public.gallery_item_json(i public.gallery_items) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id,
    'kind', i.kind,
    'status', i.status,
    'reason', i.status_reason,
    'originalPath', i.original_path,
    'originalType', i.original_type,
    'originalSize', i.original_size,
    'originalDone', i.original_done,
    'displayPath', i.display_path,
    'displaySize', i.display_size,
    'thumbPath', i.thumb_path,
    'thumbSize', i.thumb_size,
    'width', i.width,
    'height', i.height,
    'durationMs', i.duration_ms,
    'takenAt', i.taken_at,
    'sharpness', i.sharpness,
    'brightness', i.brightness,
    'enhanced', i.enhanced,
    'aiNsfw', i.ai_nsfw,
    'aiQuality', i.ai_quality,
    'phash', i.phash,
    'name', i.uploader_name,
    'guestId', i.guest_id,
    'createdAt', i.created_at,
    'completedAt', i.completed_at,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at
  )
$$;

-- ─── the host (the server passes the signed-in user's id; null when it isn't their invitation) ──

-- The gallery's settings and counts ({ gallery: null } before the host turned it on), with the
-- invitation's slug (the links), status (an archived invitation's gallery is closed) and time zone
-- (the download's file names).
create function public.gallery_owner_get(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.galleries;
  i public.invitations;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner_id;
  if not found then
    return null;
  end if;
  select * into g from public.galleries where invitation_id = p_id;
  return jsonb_build_object(
    'slug', i.slug,
    'status', i.status,
    'timezone', coalesce(i.published, i.draft)->>'timezone',
    'gallery', case when g.invitation_id is null then null else public.gallery_json(g) end,
    'counts', case when g.invitation_id is null then null else public.gallery_counts(p_id) end
  );
end $$;

-- Turns the gallery on: creates it with its links and channel, or switches an existing one back on
-- (its links stay).
create function public.gallery_owner_create(
  p_id uuid, p_owner_id uuid,
  p_upload_hash text, p_upload_nonce text,
  p_projector_hash text, p_projector_nonce text,
  p_channel text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  insert into public.galleries (
    invitation_id, upload_token_hash, upload_token_nonce, projector_token_hash, projector_token_nonce, channel
  ) values (p_id, p_upload_hash, p_upload_nonce, p_projector_hash, p_projector_nonce, p_channel)
  on conflict (invitation_id) do update set enabled = true;
  return public.gallery_owner_get(p_id, p_owner_id);
end $$;

-- Changes the settings: only the keys present in p_patch (enabled, mode, paused, opensAt, closesAt,
-- accessCode = { hash, salt } or null to remove it). null when there is no such gallery of theirs.
create function public.gallery_owner_update(p_id uuid, p_owner_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.galleries g set
    enabled = case when p_patch ? 'enabled' then (p_patch->>'enabled')::boolean else g.enabled end,
    mode = case when p_patch ? 'mode' then p_patch->>'mode' else g.mode end,
    paused = case when p_patch ? 'paused' then (p_patch->>'paused')::boolean else g.paused end,
    opens_at = case when p_patch ? 'opensAt' then (p_patch->>'opensAt')::timestamptz else g.opens_at end,
    closes_at = case when p_patch ? 'closesAt' then (p_patch->>'closesAt')::timestamptz else g.closes_at end,
    access_code_hash = case
      when p_patch ? 'accessCode' then p_patch->'accessCode'->>'hash' else g.access_code_hash end,
    access_code_salt = case
      when p_patch ? 'accessCode' then p_patch->'accessCode'->>'salt' else g.access_code_salt end
  from public.invitations i
  where g.invitation_id = p_id and i.id = g.invitation_id and i.owner_id = p_owner_id;
  if not found then
    return null;
  end if;
  return public.gallery_owner_get(p_id, p_owner_id);
end $$;

-- A new link for guests ('upload') or for the screen ('projector'); the old one stops working. The
-- broadcast channel changes with it.
create function public.gallery_owner_rotate(
  p_id uuid, p_owner_id uuid, p_which text, p_hash text, p_nonce text, p_channel text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_which not in ('upload', 'projector') then
    raise exception 'gallery_owner_rotate: bad link kind';
  end if;
  update public.galleries g set
    upload_token_hash = case when p_which = 'upload' then p_hash else g.upload_token_hash end,
    upload_token_nonce = case when p_which = 'upload' then p_nonce else g.upload_token_nonce end,
    projector_token_hash = case when p_which = 'projector' then p_hash else g.projector_token_hash end,
    projector_token_nonce = case when p_which = 'projector' then p_nonce else g.projector_token_nonce end,
    channel = p_channel
  from public.invitations i
  where g.invitation_id = p_id and i.id = g.invitation_id and i.owner_id = p_owner_id;
  if not found then
    return null;
  end if;
  return public.gallery_owner_get(p_id, p_owner_id);
end $$;

-- Deletes the gallery and every item in it (their files go to the trash). false when not theirs.
create function public.gallery_owner_delete(p_id uuid, p_owner_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.galleries g
  using public.invitations i
  where g.invitation_id = p_id and i.id = g.invitation_id and i.owner_id = p_owner_id;
  return found;
end $$;

-- The host's list: every finished item that isn't deleted, newest first (p_status: one status or
-- 'all'), after the (created_at, id) of the last one the host has, with the guest's name when the
-- upload came through a personal link.
create function public.gallery_owner_items(
  p_id uuid, p_owner_id uuid, p_status text, p_before_at timestamptz, p_before_id uuid, p_limit int
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.gallery_item_json(x.item) || jsonb_build_object('guestName', x.guest_name)
      order by (x.item).created_at desc, (x.item).id desc)
    from (
      select i as item, gu.name as guest_name
      from public.gallery_items i
      left join public.invitation_guests gu on gu.id = i.guest_id
      where i.invitation_id = p_id
        and i.deleted_at is null
        and i.status <> 'uploading'
        and (p_status = 'all' or i.status = p_status)
        and (p_before_at is null or (i.created_at, i.id) < (p_before_at, p_before_id))
      order by i.created_at desc, i.id desc
      limit least(greatest(p_limit, 1), 200)
    ) x
  ), '[]'::jsonb);
end $$;

-- The host decides about items of their gallery: 'publish' (approve, or show again), 'hide', 'reject'
-- or 'delete'. Each decision is recorded. Returns { count, ids } of the items it changed.
create function public.gallery_owner_moderate(p_id uuid, p_owner_id uuid, p_item_ids uuid[], p_action text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  if p_action not in ('publish', 'hide', 'reject', 'delete') then
    raise exception 'gallery_owner_moderate: bad action';
  end if;
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  with changed as (
    update public.gallery_items i set
      status = case p_action
        when 'publish' then 'published' when 'hide' then 'hidden' when 'reject' then 'rejected' else i.status end,
      status_reason = case when p_action = 'delete' then i.status_reason else 'host' end,
      published_at = case when p_action = 'publish' and i.status <> 'published' then now() else i.published_at end,
      deleted_at = case when p_action = 'delete' then now() else i.deleted_at end,
      deleted_by = case when p_action = 'delete' then 'host' else i.deleted_by end
    where i.invitation_id = p_id
      and i.id = any(p_item_ids)
      and i.deleted_at is null
      and i.status <> 'uploading'
    returning i.id
  )
  select coalesce(array_agg(id), '{}') into v_ids from changed;
  insert into public.gallery_moderation (item_id, check_name, result, decided_by, actor_id)
  select id, 'host',
    case p_action when 'publish' then 'published' when 'hide' then 'hidden' when 'reject' then 'rejected' else 'deleted' end,
    'host', p_owner_id
  from unnest(v_ids) id;
  return jsonb_build_object('count', cardinality(v_ids), 'ids', to_jsonb(v_ids));
end $$;

-- The files for "download everything", oldest first, after the (created_at, id) of the last one the
-- host has: every finished item that isn't deleted ('all'), or only what is in the feed
-- ('published'). With the totals.
create function public.gallery_owner_originals(
  p_id uuid, p_owner_id uuid, p_scope text, p_after_at timestamptz, p_after_id uuid, p_limit int
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(public.gallery_item_json(x.item) order by (x.item).created_at, (x.item).id)
      from (
        select i as item from public.gallery_items i
        where i.invitation_id = p_id
          and i.deleted_at is null
          and i.status <> 'uploading'
          and (p_scope = 'all' or i.status = 'published')
          and (p_after_at is null or (i.created_at, i.id) > (p_after_at, p_after_id))
        order by i.created_at, i.id
        limit least(greatest(p_limit, 1), 500)
      ) x
    ), '[]'::jsonb),
    'total', (
      select count(*) from public.gallery_items i
      where i.invitation_id = p_id and i.deleted_at is null and i.status <> 'uploading'
        and (p_scope = 'all' or i.status = 'published')
    ),
    'bytes', (
      select coalesce(sum(case when i.original_done then i.original_size else coalesce(i.display_size, 0) end), 0)
      from public.gallery_items i
      where i.invitation_id = p_id and i.deleted_at is null and i.status <> 'uploading'
        and (p_scope = 'all' or i.status = 'published')
    )
  );
end $$;

-- ─── guests and the screen (by a link's hash) ───────────────────────────────────────────────────

-- The gallery a link opens ('upload': the guests' link, 'projector': the screen's) and what its pages
-- show about the event. The access code's hash and salt are for the server's check only. null for an
-- unknown link.
create function public.gallery_by_token(p_token_hash text, p_kind text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'gallery', public.gallery_json(g)
      || jsonb_build_object('accessCodeHash', g.access_code_hash, 'accessCodeSalt', g.access_code_salt),
    'invitation', jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'status', i.status,
      'eventType', i.event_type,
      'templateId', i.template_id,
      'hosts', d.doc->'hosts',
      'date', d.doc->'event'->>'date',
      'timezone', d.doc->>'timezone',
      'locales', d.doc->'locales',
      'defaultLocale', d.doc->>'defaultLocale',
      'palette', d.doc->'theme'->'palette'
    )
  )
  from public.galleries g
  join public.invitations i on i.id = g.invitation_id
  cross join lateral (select coalesce(i.published, i.draft) as doc) d
  where (p_kind = 'upload' and g.upload_token_hash = p_token_hash)
     or (p_kind = 'projector' and g.projector_token_hash = p_token_hash)
$$;

-- The languages of the invitation behind a slug that has a gallery (the gallery pages' <html lang>).
create function public.gallery_slug_locale(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'defaultLocale', coalesce(i.published, i.draft)->>'defaultLocale',
    'locales', coalesce(i.published, i.draft)->'locales'
  )
  from public.invitations i
  join public.galleries g on g.invitation_id = i.id
  where i.slug = p_slug
$$;

-- Reserves the items a guest is about to upload (their ids and paths come from the server, which has
-- checked their types and sizes), under a lock so the gallery never passes p_max_items. The guest
-- counts only when they belong to this invitation. { ok } or { ok: false, code: 'full', left }.
create function public.gallery_reserve(
  p_invitation_id uuid, p_uploader_hash text, p_guest_id uuid, p_name text, p_items jsonb, p_max_items int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_guest uuid := p_guest_id;
begin
  perform 1 from public.galleries where invitation_id = p_invitation_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select count(*) into v_count from public.gallery_items
  where invitation_id = p_invitation_id and deleted_at is null;
  if v_count + jsonb_array_length(p_items) > p_max_items then
    return jsonb_build_object('ok', false, 'code', 'full', 'left', greatest(p_max_items - v_count, 0));
  end if;
  if v_guest is not null and not exists (
    select 1 from public.invitation_guests where id = v_guest and invitation_id = p_invitation_id
  ) then
    v_guest := null;
  end if;
  insert into public.gallery_items (
    id, invitation_id, kind, original_path, original_type, original_size, display_path, display_size,
    thumb_path, thumb_size, width, height, duration_ms, taken_at, uploader_hash, guest_id, uploader_name
  )
  select (x->>'id')::uuid, p_invitation_id, x->>'kind', x->>'originalPath', x->>'originalType',
    (x->>'originalSize')::bigint, x->>'displayPath', (x->>'displaySize')::int, x->>'thumbPath',
    (x->>'thumbSize')::int, (x->>'width')::int, (x->>'height')::int, (x->>'durationMs')::int,
    (x->>'takenAt')::timestamptz, p_uploader_hash, v_guest, nullif(btrim(p_name), '')
  from jsonb_array_elements(p_items) x;
  return jsonb_build_object('ok', true);
end $$;

-- One item of this device (null when it isn't theirs, or deleted), with the closest perceptual-hash
-- distance to another item of the gallery when p_phash is given (null: nothing to compare with).
create function public.gallery_item_for_uploader(
  p_invitation_id uuid, p_item_id uuid, p_uploader_hash text, p_phash text
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.gallery_item_json(i) || jsonb_build_object(
    'nearest', (
      select min(bit_count(('x' || o.phash)::bit(64) # ('x' || p_phash)::bit(64)))::int
      from public.gallery_items o
      where p_phash ~ '^[0-9a-f]{16}$'
        and o.invitation_id = p_invitation_id
        and o.id <> i.id
        and o.deleted_at is null
        and o.status <> 'uploading'
        and o.phash is not null
    )
  )
  from public.gallery_items i
  where i.id = p_item_id
    and i.invitation_id = p_invitation_id
    and i.uploader_hash = p_uploader_hash
    and i.deleted_at is null
$$;

-- An upload finished. The first time (the preview files arrived): the checks' outcome p_status with
-- its reason, the browser's metrics and the AI's scores, the real file sizes, and one row per check.
-- Later calls only record that the original arrived. Returns the item's { status, reason,
-- originalDone, first } (first: this call decided); null when it isn't this device's item.
create function public.gallery_complete(
  p_invitation_id uuid, p_item_id uuid, p_uploader_hash text,
  p_status text, p_reason text, p_metrics jsonb, p_checks jsonb, p_sizes jsonb, p_original_done boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gallery_items;
  v_first boolean := false;
begin
  select * into v from public.gallery_items
  where id = p_item_id and invitation_id = p_invitation_id and uploader_hash = p_uploader_hash
    and deleted_at is null
  for update;
  if not found then
    return null;
  end if;
  if v.status = 'uploading' then
    if p_status is null or p_status not in ('pending', 'published', 'rejected') then
      raise exception 'gallery_complete: bad status';
    end if;
    v_first := true;
    update public.gallery_items set
      status = p_status,
      status_reason = p_reason,
      completed_at = now(),
      published_at = case when p_status = 'published' then now() end,
      sharpness = (p_metrics->>'sharpness')::real,
      brightness = (p_metrics->>'brightness')::real,
      enhanced = coalesce((p_metrics->>'enhanced')::boolean, false),
      phash = p_metrics->>'phash',
      ai_nsfw = (p_metrics->>'aiNsfw')::real,
      ai_quality = (p_metrics->>'aiQuality')::real,
      display_size = coalesce((p_sizes->>'display')::int, display_size),
      thumb_size = coalesce((p_sizes->>'thumb')::int, thumb_size),
      original_size = coalesce((p_sizes->>'original')::bigint, original_size),
      original_done = original_done or coalesce(p_original_done, false)
    where id = v.id
    returning * into v;
    insert into public.gallery_moderation (item_id, check_name, result, score, detail, decided_by)
    select v.id, c->>'check', c->>'result', (c->>'score')::real, coalesce(c->'detail', '{}'::jsonb),
      c->>'decidedBy'
    from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) c;
  elsif coalesce(p_original_done, false) and not v.original_done then
    update public.gallery_items set
      original_done = true,
      original_size = coalesce((p_sizes->>'original')::bigint, original_size)
    where id = v.id
    returning * into v;
  end if;
  return jsonb_build_object(
    'status', v.status, 'reason', v.status_reason, 'originalDone', v.original_done, 'first', v_first
  );
end $$;

-- The feed: what is published, newest in the feed first, after the (published_at, id) of the last one
-- the page has.
create function public.gallery_feed(
  p_invitation_id uuid, p_before_at timestamptz, p_before_id uuid, p_limit int
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.gallery_item_json(x.item)
    order by (x.item).published_at desc, (x.item).id desc), '[]'::jsonb)
  from (
    select i as item from public.gallery_items i
    where i.invitation_id = p_invitation_id
      and i.deleted_at is null
      and i.status = 'published'
      and (p_before_at is null or (i.published_at, i.id) < (p_before_at, p_before_id))
    order by i.published_at desc, i.id desc
    limit least(greatest(p_limit, 1), 200)
  ) x
$$;

-- What changed in the feed since p_since: items that entered it, and items that left it (hidden,
-- rejected, deleted). With the database's clock, for the next call.
create function public.gallery_changes(p_invitation_id uuid, p_since timestamptz, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'now', now(),
    'added', coalesce((
      select jsonb_agg(public.gallery_item_json(x.item) order by (x.item).published_at desc, (x.item).id desc)
      from (
        select i as item from public.gallery_items i
        where i.invitation_id = p_invitation_id
          and i.deleted_at is null
          and i.status = 'published'
          and i.published_at > p_since
        order by i.published_at desc, i.id desc
        limit least(greatest(p_limit, 1), 200)
      ) x
    ), '[]'::jsonb),
    'removed', coalesce((
      select jsonb_agg(i.id)
      from public.gallery_items i
      where i.invitation_id = p_invitation_id
        and i.updated_at > p_since
        and i.published_at is not null
        and (i.status <> 'published' or i.deleted_at is not null)
    ), '[]'::jsonb)
  )
$$;

-- This device's own uploads (so a guest sees which are waiting for approval), newest first.
create function public.gallery_uploader_items(p_invitation_id uuid, p_uploader_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.gallery_item_json(x.item)
    order by (x.item).created_at desc, (x.item).id desc), '[]'::jsonb)
  from (
    select i as item from public.gallery_items i
    where i.invitation_id = p_invitation_id
      and i.uploader_hash = p_uploader_hash
      and i.deleted_at is null
    order by i.created_at desc, i.id desc
    limit 200
  ) x
$$;

-- A guest deletes one of their own uploads (from the device that uploaded it).
create function public.gallery_guest_delete(p_invitation_id uuid, p_item_id uuid, p_uploader_hash text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.gallery_items set deleted_at = now(), deleted_by = 'guest'
  where id = p_item_id and invitation_id = p_invitation_id and uploader_hash = p_uploader_hash
    and deleted_at is null;
  if not found then
    return false;
  end if;
  insert into public.gallery_moderation (item_id, check_name, result, decided_by)
  values (p_item_id, 'guest', 'deleted', 'guest');
  return true;
end $$;

-- Records a request; true while the key stays within p_limit in the window (a day of rows is kept).
create function public.gallery_rate_hit(p_key_hash text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.gallery_rate_events where key_hash = p_key_hash and created_at < now() - interval '1 day';
  insert into public.gallery_rate_events (key_hash) values (p_key_hash);
  select count(*) into n from public.gallery_rate_events
  where key_hash = p_key_hash and created_at > now() - make_interval(secs => p_window_seconds);
  return n <= p_limit;
end $$;

-- ─── housekeeping (the server's sweeper) ────────────────────────────────────────────────────────

-- Up to p_limit files to remove from storage, claimed for ten minutes (a sweeper that dies leaves
-- them to the next one).
create function public.gallery_trash_claim(p_limit int) returns jsonb
language sql security definer set search_path = '' as $$
  with c as (
    select t.id from public.gallery_trash t
    where t.claimed_at is null or t.claimed_at < now() - interval '10 minutes'
    order by t.id
    limit least(greatest(p_limit, 1), 1000)
    for update skip locked
  ), u as (
    update public.gallery_trash t set claimed_at = now()
    from c where t.id = c.id
    returning t.id, t.bucket, t.path
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'bucket', u.bucket, 'path', u.path) order by u.id), '[]'::jsonb)
  from u
$$;

-- The files that are gone from storage.
create function public.gallery_trash_done(p_ids bigint[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.gallery_trash where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- What the privacy policy promises: uploads that never finished go after p_abandoned_hours (their
-- files with them), deleted items' rows after p_tombstone_days, rate-limit rows after a day.
create function public.gallery_maintenance(p_abandoned_hours int, p_tombstone_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
  c int;
begin
  delete from public.gallery_items
  where status = 'uploading' and created_at < now() - make_interval(hours => p_abandoned_hours);
  get diagnostics a = row_count;
  delete from public.gallery_items
  where deleted_at is not null and deleted_at < now() - make_interval(days => p_tombstone_days);
  get diagnostics b = row_count;
  delete from public.gallery_rate_events where created_at < now() - interval '1 day';
  get diagnostics c = row_count;
  return jsonb_build_object('abandoned', a, 'tombstones', b, 'rate', c);
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.gallery_items_trash()',
    'public.gallery_json(public.galleries)',
    'public.gallery_counts(uuid)',
    'public.gallery_item_json(public.gallery_items)',
    'public.gallery_owner_get(uuid, uuid)',
    'public.gallery_owner_create(uuid, uuid, text, text, text, text, text)',
    'public.gallery_owner_update(uuid, uuid, jsonb)',
    'public.gallery_owner_rotate(uuid, uuid, text, text, text, text)',
    'public.gallery_owner_delete(uuid, uuid)',
    'public.gallery_owner_items(uuid, uuid, text, timestamptz, uuid, int)',
    'public.gallery_owner_moderate(uuid, uuid, uuid[], text)',
    'public.gallery_owner_originals(uuid, uuid, text, timestamptz, uuid, int)',
    'public.gallery_by_token(text, text)',
    'public.gallery_slug_locale(text)',
    'public.gallery_reserve(uuid, text, uuid, text, jsonb, int)',
    'public.gallery_item_for_uploader(uuid, uuid, text, text)',
    'public.gallery_complete(uuid, uuid, text, text, text, jsonb, jsonb, jsonb, boolean)',
    'public.gallery_feed(uuid, timestamptz, uuid, int)',
    'public.gallery_changes(uuid, timestamptz, int)',
    'public.gallery_uploader_items(uuid, text)',
    'public.gallery_guest_delete(uuid, uuid, text)',
    'public.gallery_rate_hit(text, int, int)',
    'public.gallery_trash_claim(int)',
    'public.gallery_trash_done(bigint[])',
    'public.gallery_maintenance(int, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if f <> 'public.gallery_items_trash()' then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- ─── storage: two private buckets (signed URLs only) ────────────────────────────────────────────
-- gallery-originals: the files as the guests' phones made them (photos and videos; the largest).
-- gallery-media: what pages show — the display version (≤2560px) and the thumbnail (≤480px), JPEG
-- or WebP made in the browser. Uploads use signed upload URLs (resumable for large files); reads use
-- signed URLs the server creates in batches. Supabase's own upload limit (project settings) must be
-- at least gallery-originals' limit for the largest videos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('gallery-originals', 'gallery-originals', false, 209715200, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'
  ]),
  ('gallery-media', 'gallery-media', false, 12582912, array['image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
