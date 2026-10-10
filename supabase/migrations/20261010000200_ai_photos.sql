-- AI photos with the people of honor (feature ai_photos): the host uploads a photo of each person the
-- event celebrates — the couple, the bar mitzvah boy, the birthday girl… — and guests, on the gallery's
-- page, create photos with them through OpenAI's image model: a photo they took at the event plus a
-- request ("add Aviv drinking water"), or a new scene. The work is queued (it takes up to a minute or
-- two) and done by the server; a guest may add the result to the event's gallery.
--
-- Limits are counted here, under a lock: per guest's device and per event (the host's settings) and a
-- daily ceiling for the whole site — a blocked or failed photo doesn't count. Files live in a private
-- bucket (signed URLs only) and go with the rows: the gallery's trash queue removes them from storage
-- (gallery_trash, now for this bucket too). Everything is erased 30 days after the event (the daily
-- run), at once when the host deletes, and with the invitation.
--
-- Same rules as the rest of the app: row level security on and no policies, SECURITY DEFINER functions
-- with an empty search_path that check the owner or the gallery's link (the server resolves it first),
-- service_role only. Additive only.

-- ─── storage ────────────────────────────────────────────────────────────────────────────────────

-- ai-photos: <invitation>/people/<person>/<file> (the people of honor, ≤1024px JPEG made on the host's
-- device) and <invitation>/photos/<photo>/{source,result,thumb}.jpg (the guest's photo, the result).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ai-photos', 'ai-photos', false, 12582912, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- the gallery's trash queue removes this bucket's files too
alter table public.gallery_trash drop constraint if exists gallery_trash_bucket_check;
alter table public.gallery_trash add constraint gallery_trash_bucket_check
  check (bucket in ('gallery-originals', 'gallery-media', 'ai-photos'));

-- ─── an AI photo in the gallery ─────────────────────────────────────────────────────────────────

alter table public.gallery_items add column ai_generated boolean not null default false;

-- An item as the pages get it (as before): also whether it is an AI photo.
create or replace function public.gallery_item_json(i public.gallery_items) returns jsonb
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
    'by', case when i.source = 'host' then 'host' else left(i.uploader_hash, 16) end,
    'guestId', i.guest_id,
    'source', i.source,
    'placement', i.placement,
    'instagram', i.instagram,
    'post', coalesce(i.post_key, i.id::text),
    'ai', i.ai_generated,
    'createdAt', i.created_at,
    'completedAt', i.completed_at,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at
  )
$$;

-- ─── tables ─────────────────────────────────────────────────────────────────────────────────────

-- The host's settings for the event: off until they turn it on (after uploading the photos and saying
-- they have the people's consent), how many photos each guest's device and the whole event may make,
-- and whether guests may add their photos to the gallery.
create table public.ai_photo_settings (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  enabled boolean not null default false,
  per_guest int not null default 3 check (per_guest between 1 and 20),
  per_event int not null default 100 check (per_event between 1 and 2000),
  to_gallery boolean not null default true,
  -- the host said the people in the photos agreed (when, and who said it)
  consent_at timestamptz,
  consent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_photo_settings_consent_by_idx on public.ai_photo_settings (consent_by) where consent_by is not null;
create trigger ai_photo_settings_touch before update on public.ai_photo_settings
  for each row execute function public.touch_updated_at();

-- The people of honor (at most four an event): their role, their name in the invitation's languages,
-- a few words that help the model ("glasses, a beard"), and their photo.
create table public.ai_photo_people (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  seq int not null default 0,
  role text not null check (role in (
    'groom', 'bride', 'partner', 'bar_mitzvah', 'bat_mitzvah', 'birthday', 'parent', 'baby', 'honoree'
  )),
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  description text check (description is null or char_length(description) <= 200),
  photo_path text check (photo_path is null or starts_with(photo_path, invitation_id::text || '/people/')),
  photo_size int check (photo_size is null or photo_size > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_photo_people_invitation on public.ai_photo_people (invitation_id, seq);
create trigger ai_photo_people_touch before update on public.ai_photo_people
  for each row execute function public.touch_updated_at();

-- One photo a guest asked for: who (their device's hash, never its id; the guest when they came through
-- their personal link; the name they gave), what (their words, the people, their photo), and where it
-- stands — queued, running (with OpenAI's id while it works in the background), done, failed, or
-- blocked by the content rules. Counted for the limits unless failed or blocked.
create table public.ai_photos (
  id uuid primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  uploader_hash text not null check (uploader_hash ~ '^[0-9a-f]{64}$'),
  guest_id uuid references public.invitation_guests(id) on delete set null,
  guest_name text check (guest_name is null or char_length(guest_name) between 1 and 60),
  prompt text not null check (char_length(prompt) between 1 and 600),
  people uuid[] not null default '{}' check (cardinality(people) <= 4),
  locale text check (locale is null or locale in ('he', 'en', 'ru', 'ar', 'fr', 'es', 'am')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'blocked')),
  error text check (error is null or char_length(error) <= 300),
  source_path text check (source_path is null or starts_with(source_path, invitation_id::text || '/photos/')),
  result_path text check (result_path is null or starts_with(result_path, invitation_id::text || '/photos/')),
  thumb_path text check (thumb_path is null or starts_with(thumb_path, invitation_id::text || '/photos/')),
  width int check (width is null or width between 1 and 10000),
  height int check (height is null or height between 1 and 10000),
  -- OpenAI's response id while it works in the background (transport 'background')
  external_id text check (external_id is null or char_length(external_id) <= 200),
  attempts int not null default 0,
  claimed_at timestamptz,
  checked_at timestamptz,
  -- the gallery item it became when the guest added it to the gallery
  gallery_item_id uuid references public.gallery_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_photos_invitation on public.ai_photos (invitation_id, created_at desc);
create index ai_photos_uploader on public.ai_photos (invitation_id, uploader_hash, created_at desc);
create index ai_photos_open on public.ai_photos (created_at) where status in ('queued', 'running');
create index ai_photos_day on public.ai_photos (created_at);
create index ai_photos_guest_id_idx on public.ai_photos (guest_id) where guest_id is not null;
create index ai_photos_gallery_item_id_idx on public.ai_photos (gallery_item_id) where gallery_item_id is not null;
create trigger ai_photos_touch before update on public.ai_photos
  for each row execute function public.touch_updated_at();

alter table public.ai_photo_settings enable row level security;
alter table public.ai_photo_people enable row level security;
alter table public.ai_photos enable row level security;
revoke all on public.ai_photo_settings, public.ai_photo_people, public.ai_photos from anon, authenticated;

-- ─── files go with their rows ───────────────────────────────────────────────────────────────────

create function public.ai_photos_trash() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'ai_photo_people' then
    if old.photo_path is not null and (tg_op = 'DELETE' or new.photo_path is distinct from old.photo_path) then
      insert into public.gallery_trash (bucket, path) values ('ai-photos', old.photo_path);
    end if;
  else
    insert into public.gallery_trash (bucket, path)
    select 'ai-photos', p from unnest(array[old.source_path, old.result_path, old.thumb_path]) p
    where p is not null;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger ai_photo_people_trash after delete or update of photo_path on public.ai_photo_people
  for each row execute function public.ai_photos_trash();
create trigger ai_photos_trash after delete on public.ai_photos
  for each row execute function public.ai_photos_trash();

-- ─── helpers ────────────────────────────────────────────────────────────────────────────────────

create function public.ai_photo_settings_json(s public.ai_photo_settings) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'enabled', coalesce(s.enabled, false),
    'perGuest', coalesce(s.per_guest, 3),
    'perEvent', coalesce(s.per_event, 100),
    'toGallery', coalesce(s.to_gallery, true),
    'consentAt', s.consent_at
  )
$$;

create function public.ai_photo_person_json(p public.ai_photo_people) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'seq', p.seq,
    'role', p.role,
    'name', p.name,
    'description', p.description,
    'photoPath', p.photo_path,
    'updatedAt', p.updated_at
  )
$$;

create function public.ai_photo_json(p public.ai_photos) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'error', p.error,
    'prompt', p.prompt,
    'people', to_jsonb(p.people),
    'locale', p.locale,
    'guestName', p.guest_name,
    'guestId', p.guest_id,
    'sourcePath', p.source_path,
    'resultPath', p.result_path,
    'thumbPath', p.thumb_path,
    'width', p.width,
    'height', p.height,
    'externalId', p.external_id,
    'attempts', p.attempts,
    'galleryItemId', p.gallery_item_id,
    'createdAt', p.created_at,
    'finishedAt', p.finished_at
  )
$$;

-- What counts toward the limits: everything but what failed or was blocked.
create function public.ai_photo_counts(p_invitation_id uuid, p_uploader_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'guest', count(*) filter (where p.uploader_hash = p_uploader_hash and p.status not in ('failed', 'blocked')),
    'event', count(*) filter (where p.status not in ('failed', 'blocked'))
  )
  from public.ai_photos p
  where p.invitation_id = p_invitation_id
$$;

-- ─── the host ───────────────────────────────────────────────────────────────────────────────────

-- The host's view: the invitation (slug, document), the settings (defaults before they saved any), the
-- people, the counts and whether the event's gallery is on. null when it isn't the owner's.
create function public.ai_photo_owner_get(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
  s public.ai_photo_settings;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  select * into s from public.ai_photo_settings where invitation_id = p_id;
  return jsonb_build_object(
    'slug', i.slug,
    'document', coalesce(i.published, i.draft),
    'settings', public.ai_photo_settings_json(s),
    'people', coalesce((
      select jsonb_agg(public.ai_photo_person_json(p) order by p.seq, p.created_at)
      from public.ai_photo_people p where p.invitation_id = p_id
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'done', (select count(*) from public.ai_photos x where x.invitation_id = p_id and x.status = 'done'),
      'used', (select count(*) from public.ai_photos x
        where x.invitation_id = p_id and x.status not in ('failed', 'blocked')),
      'blocked', (select count(*) from public.ai_photos x where x.invitation_id = p_id and x.status = 'blocked')
    ),
    'gallery', exists (select 1 from public.galleries g where g.invitation_id = p_id and g.enabled)
  );
end $$;

-- The host's settings (only the keys sent change): enabled, perGuest, perEvent, toGallery, consent
-- (true records now and who). Turning it on needs the consent and a person with a photo. Returns
-- { ok: true } | { ok: false, code: 'consent' | 'no_people' } | null.
create function public.ai_photo_owner_settings(p_id uuid, p_owner uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.ai_photo_settings;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.ai_photo_settings (invitation_id) values (p_id) on conflict (invitation_id) do nothing;
  update public.ai_photo_settings set
    per_guest = case when p_patch ? 'perGuest' then (p_patch->>'perGuest')::int else per_guest end,
    per_event = case when p_patch ? 'perEvent' then (p_patch->>'perEvent')::int else per_event end,
    to_gallery = case when p_patch ? 'toGallery' then (p_patch->>'toGallery')::boolean else to_gallery end,
    consent_at = case when coalesce((p_patch->>'consent')::boolean, false) then now()
      when p_patch ? 'consent' then null else consent_at end,
    consent_by = case when coalesce((p_patch->>'consent')::boolean, false) then p_owner
      when p_patch ? 'consent' then null else consent_by end
  where invitation_id = p_id
  returning * into s;
  if p_patch ? 'enabled' then
    if (p_patch->>'enabled')::boolean then
      if s.consent_at is null then
        return jsonb_build_object('ok', false, 'code', 'consent');
      end if;
      if not exists (select 1 from public.ai_photo_people where invitation_id = p_id and photo_path is not null) then
        return jsonb_build_object('ok', false, 'code', 'no_people');
      end if;
    end if;
    update public.ai_photo_settings set enabled = (p_patch->>'enabled')::boolean where invitation_id = p_id;
  elsif s.consent_at is null and s.enabled then
    -- the consent taken back: off
    update public.ai_photo_settings set enabled = false where invitation_id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Adds a person (no id) or changes one (id): role, name, description, and the photo the server stored
-- (photoPath, photoSize; absent: kept). At most p_max people. Returns the person, { error: 'full' } or
-- null (not the owner's, or no such person).
create function public.ai_photo_person_save(p_id uuid, p_owner uuid, p_person jsonb, p_max int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.ai_photo_people;
  v_id uuid := nullif(p_person->>'id', '')::uuid;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  perform 1 from public.invitations where id = p_id for update;
  if v_id is null then
    if (select count(*) from public.ai_photo_people where invitation_id = p_id) >= p_max then
      return jsonb_build_object('error', 'full');
    end if;
    insert into public.ai_photo_people (invitation_id, seq, role, name, description, photo_path, photo_size)
    values (
      p_id,
      coalesce((select max(seq) + 1 from public.ai_photo_people where invitation_id = p_id), 0),
      p_person->>'role',
      coalesce(p_person->'name', '{}'::jsonb),
      nullif(btrim(p_person->>'description'), ''),
      p_person->>'photoPath',
      (p_person->>'photoSize')::int
    )
    returning * into p;
  else
    update public.ai_photo_people set
      role = coalesce(p_person->>'role', role),
      name = coalesce(p_person->'name', name),
      description = case when p_person ? 'description' then nullif(btrim(p_person->>'description'), '') else description end,
      photo_path = case when p_person ? 'photoPath' then p_person->>'photoPath' else photo_path end,
      photo_size = case when p_person ? 'photoPath' then (p_person->>'photoSize')::int else photo_size end
    where id = v_id and invitation_id = p_id
    returning * into p;
    if not found then
      return null;
    end if;
  end if;
  return public.ai_photo_person_json(p);
end $$;

-- Removes a person (their photo goes with them). The event turns off when nobody with a photo is left.
create function public.ai_photo_person_delete(p_id uuid, p_owner uuid, p_person uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  delete from public.ai_photo_people where id = p_person and invitation_id = p_id;
  if not found then
    return false;
  end if;
  if not exists (select 1 from public.ai_photo_people where invitation_id = p_id and photo_path is not null) then
    update public.ai_photo_settings set enabled = false where invitation_id = p_id;
  end if;
  return true;
end $$;

-- The event's photos, newest first (before p_before), for the host. null when it isn't the owner's.
create function public.ai_photo_owner_list(p_id uuid, p_owner uuid, p_before timestamptz, p_limit int)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.ai_photo_json(x.p) order by (x.p).created_at desc)
    from (
      select p from public.ai_photos p
      where p.invitation_id = p_id and (p_before is null or p.created_at < p_before)
      order by p.created_at desc
      limit least(greatest(p_limit, 1), 200)
    ) x
  ), '[]'::jsonb);
end $$;

-- The host deletes photos (their files go). Returns how many, or null.
create function public.ai_photo_owner_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  delete from public.ai_photos where invitation_id = p_id and id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── guests (the server resolved the gallery's link first) ──────────────────────────────────────

-- What a guest's page needs: the settings, the people who have a photo (no paths), and what this
-- device and the event have used; the device's own photos, newest first.
create function public.ai_photo_guest_state(p_invitation_id uuid, p_uploader_hash text, p_limit int)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', public.ai_photo_settings_json(s),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'role', p.role, 'name', p.name) order by p.seq, p.created_at)
      from public.ai_photo_people p where p.invitation_id = p_invitation_id and p.photo_path is not null
    ), '[]'::jsonb),
    'used', public.ai_photo_counts(p_invitation_id, p_uploader_hash),
    'mine', coalesce((
      select jsonb_agg(public.ai_photo_json(x.p) order by (x.p).created_at desc)
      from (
        select p from public.ai_photos p
        where p.invitation_id = p_invitation_id and p.uploader_hash = p_uploader_hash
        order by p.created_at desc
        limit least(greatest(p_limit, 1), 50)
      ) x
    ), '[]'::jsonb)
  )
  from (select 1) one
  left join public.ai_photo_settings s on s.invitation_id = p_invitation_id
$$;

-- A guest asks for a photo: checked and queued under the event's lock — the feature on, the people
-- theirs and with a photo, this device's and the event's limits, the site's daily ceiling. { ok: true,
-- left } | { ok: false, code: 'off' | 'no_people' | 'guest_limit' | 'event_limit' | 'daily_limit' }.
create function public.ai_photo_create(
  p_invitation_id uuid, p_uploader_hash text, p_guest_id uuid, p_name text, p_photo jsonb, p_daily_limit int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.ai_photo_settings;
  v_people uuid[];
  v_counts jsonb;
  v_guest uuid := p_guest_id;
begin
  select * into s from public.ai_photo_settings where invitation_id = p_invitation_id for update;
  if not found or not s.enabled then
    return jsonb_build_object('ok', false, 'code', 'off');
  end if;
  select coalesce(array_agg(p.id order by p.seq), '{}') into v_people
  from public.ai_photo_people p
  where p.invitation_id = p_invitation_id and p.photo_path is not null
    and p.id in (select (e #>> '{}')::uuid from jsonb_array_elements(coalesce(p_photo->'people', '[]')) e);
  if cardinality(v_people) = 0 then
    return jsonb_build_object('ok', false, 'code', 'no_people');
  end if;
  v_counts := public.ai_photo_counts(p_invitation_id, p_uploader_hash);
  if (v_counts->>'guest')::int >= s.per_guest then
    return jsonb_build_object('ok', false, 'code', 'guest_limit', 'limit', s.per_guest);
  end if;
  if (v_counts->>'event')::int >= s.per_event then
    return jsonb_build_object('ok', false, 'code', 'event_limit');
  end if;
  if (select count(*) from public.ai_photos
      where created_at > now() - interval '1 day' and status not in ('failed', 'blocked')) >= p_daily_limit then
    return jsonb_build_object('ok', false, 'code', 'daily_limit');
  end if;
  if v_guest is not null and not exists (
    select 1 from public.invitation_guests where id = v_guest and invitation_id = p_invitation_id
  ) then
    v_guest := null;
  end if;
  insert into public.ai_photos (id, invitation_id, uploader_hash, guest_id, guest_name, prompt, people, locale, source_path)
  values (
    (p_photo->>'id')::uuid, p_invitation_id, p_uploader_hash, v_guest, nullif(btrim(p_name), ''),
    p_photo->>'prompt', v_people, p_photo->>'locale', p_photo->>'sourcePath'
  );
  return jsonb_build_object('ok', true, 'left', s.per_guest - (v_counts->>'guest')::int - 1);
end $$;

-- One of this device's photos (null: not theirs).
create function public.ai_photo_guest_get(p_invitation_id uuid, p_uploader_hash text, p_photo uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.ai_photo_json(p) from public.ai_photos p
  where p.id = p_photo and p.invitation_id = p_invitation_id and p.uploader_hash = p_uploader_hash
$$;

-- A guest deletes one of their photos (its files go). false when it isn't theirs.
create function public.ai_photo_guest_delete(p_invitation_id uuid, p_uploader_hash text, p_photo uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.ai_photos
  where id = p_photo and invitation_id = p_invitation_id and uploader_hash = p_uploader_hash
    and status in ('done', 'failed', 'blocked');
  return found;
end $$;

-- A guest adds a finished photo to the gallery: an item of theirs (their device, name and guest) whose
-- files the server copied, published or awaiting the host as the gallery's mode says, marked as an AI
-- photo. { ok: true, status, itemId } | { ok: false, code: 'not_found' | 'not_done' | 'shared' | 'off' |
-- 'no_gallery' | 'full' }.
create function public.ai_photo_share(
  p_invitation_id uuid, p_uploader_hash text, p_photo uuid, p_item jsonb, p_max_items int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.ai_photos;
  g public.galleries;
  v_status text;
  v_count int;
begin
  select * into p from public.ai_photos
  where id = p_photo and invitation_id = p_invitation_id and uploader_hash = p_uploader_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if p.status <> 'done' then
    return jsonb_build_object('ok', false, 'code', 'not_done');
  end if;
  if p.gallery_item_id is not null then
    return jsonb_build_object('ok', false, 'code', 'shared');
  end if;
  if not exists (select 1 from public.ai_photo_settings where invitation_id = p_invitation_id and to_gallery) then
    return jsonb_build_object('ok', false, 'code', 'off');
  end if;
  select * into g from public.galleries where invitation_id = p_invitation_id for update;
  if not found or not g.enabled then
    return jsonb_build_object('ok', false, 'code', 'no_gallery');
  end if;
  select count(*) into v_count from public.gallery_items where invitation_id = p_invitation_id and deleted_at is null;
  if v_count + 1 > p_max_items then
    return jsonb_build_object('ok', false, 'code', 'full');
  end if;
  v_status := case when g.mode = 'approval' then 'pending' else 'published' end;
  insert into public.gallery_items (
    id, invitation_id, kind, status, status_reason, original_path, original_type, original_size,
    original_done, display_path, display_size, thumb_path, thumb_size, width, height, taken_at,
    uploader_hash, guest_id, uploader_name, completed_at, published_at, placement, ai_generated
  ) values (
    (p_item->>'id')::uuid, p_invitation_id, 'image', v_status,
    case when v_status = 'pending' then 'approval' else 'ok' end,
    p_item->>'originalPath', 'image/jpeg', (p_item->>'originalSize')::bigint, true,
    p_item->>'displayPath', (p_item->>'displaySize')::int, p_item->>'thumbPath', (p_item->>'thumbSize')::int,
    (p_item->>'width')::int, (p_item->>'height')::int, now(),
    p_uploader_hash, p.guest_id, p.guest_name, now(),
    case when v_status = 'published' then now() end, 'feed', true
  );
  insert into public.gallery_moderation (item_id, check_name, result, detail, decided_by)
  values ((p_item->>'id')::uuid, 'mode', v_status, jsonb_build_object('ai', true), 'server');
  update public.ai_photos set gallery_item_id = (p_item->>'id')::uuid where id = p.id;
  return jsonb_build_object('ok', true, 'status', v_status, 'itemId', p_item->>'id');
end $$;

-- ─── the worker ─────────────────────────────────────────────────────────────────────────────────

-- Claims up to p_limit photos to start (one invitation's, or any when p_id is null): queued ones, and
-- ones a worker started without finishing (running for p_stale_seconds with no background id) — those
-- go again while they have tries left (p_max_attempts), else fail ('timeout'). With what the request
-- needs: the event (type, document), the people (role, name, description, photo path).
create function public.ai_photo_claim(p_id uuid, p_limit int, p_stale_seconds int, p_max_attempts int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  update public.ai_photos set status = 'failed', error = 'timeout', finished_at = now()
  where (p_id is null or invitation_id = p_id) and status = 'running' and external_id is null
    and claimed_at < now() - make_interval(secs => p_stale_seconds) and attempts >= p_max_attempts;
  with picked as (
    select p.id from public.ai_photos p
    where (p_id is null or p.invitation_id = p_id)
      and (p.status = 'queued' or (p.status = 'running' and p.external_id is null
        and p.claimed_at < now() - make_interval(secs => p_stale_seconds)))
    order by p.created_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  ), claimed as (
    update public.ai_photos p set status = 'running', claimed_at = now(), attempts = p.attempts + 1
    from picked where p.id = picked.id
    returning p.*
  )
  select coalesce(jsonb_agg(public.ai_photo_json(c) || jsonb_build_object(
      'invitationId', c.invitation_id,
      'document', coalesce(i.published, i.draft),
      'persons', coalesce((
        select jsonb_agg(public.ai_photo_person_json(pp) order by array_position(c.people, pp.id))
        from public.ai_photo_people pp where pp.id = any(c.people) and pp.photo_path is not null
      ), '[]'::jsonb)
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id;
  return v;
end $$;

-- A photo working in OpenAI's background: its response id, to check on it later.
create function public.ai_photo_started(p_photo uuid, p_external_id text) returns boolean
language sql security definer set search_path = '' as $$
  update public.ai_photos set external_id = p_external_id, checked_at = now()
  where id = p_photo and status = 'running'
  returning true
$$;

-- Photos working in the background that are due a check (not checked for p_every_seconds), claimed so
-- two servers don't check the same one at once; those older than p_give_up_seconds fail ('timeout').
create function public.ai_photo_checks(p_id uuid, p_limit int, p_every_seconds int, p_give_up_seconds int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  update public.ai_photos set status = 'failed', error = 'timeout', finished_at = now()
  where (p_id is null or invitation_id = p_id) and status = 'running' and external_id is not null
    and claimed_at < now() - make_interval(secs => p_give_up_seconds);
  with picked as (
    select p.id from public.ai_photos p
    where (p_id is null or p.invitation_id = p_id) and p.status = 'running' and p.external_id is not null
      and (p.checked_at is null or p.checked_at < now() - make_interval(secs => p_every_seconds))
    order by p.checked_at nulls first
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  ), claimed as (
    update public.ai_photos p set checked_at = now()
    from picked where p.id = picked.id
    returning p.*
  )
  select coalesce(jsonb_agg(public.ai_photo_json(c) || jsonb_build_object('invitationId', c.invitation_id)), '[]'::jsonb)
  into v from claimed c;
  return v;
end $$;

-- The photo is done: its files and size.
create function public.ai_photo_done(
  p_photo uuid, p_result_path text, p_thumb_path text, p_width int, p_height int
) returns boolean
language sql security definer set search_path = '' as $$
  update public.ai_photos set status = 'done', result_path = p_result_path, thumb_path = p_thumb_path,
    width = p_width, height = p_height, error = null, finished_at = now()
  where id = p_photo and status = 'running'
  returning true
$$;

-- The photo failed ('failed') or the content rules refused it ('blocked'): it doesn't count.
create function public.ai_photo_fail(p_photo uuid, p_status text, p_error text) returns boolean
language sql security definer set search_path = '' as $$
  update public.ai_photos set status = case when p_status = 'blocked' then 'blocked' else 'failed' end,
    error = left(p_error, 300), finished_at = now()
  where id = p_photo and status in ('queued', 'running')
  returning true
$$;

-- A temporary failure: queued again while it has tries left (p_max_attempts), else failed.
create function public.ai_photo_retry(p_photo uuid, p_error text, p_max_attempts int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.ai_photos where id = p_photo and status = 'running' for update;
  if not found then
    return false;
  end if;
  if n >= p_max_attempts then
    update public.ai_photos set status = 'failed', error = left(p_error, 300), finished_at = now() where id = p_photo;
    return false;
  end if;
  update public.ai_photos set status = 'queued', external_id = null, claimed_at = null, error = left(p_error, 300)
  where id = p_photo;
  return true;
end $$;

-- ─── housekeeping ───────────────────────────────────────────────────────────────────────────────

-- The privacy promise: p_days after the event its photos and the people's photos are erased (the
-- files with them); the settings stay (off). Returns how many of each.
create function public.ai_photo_maintenance(p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
begin
  with old as (
    select i.id from public.invitations i
    where (coalesce(i.published, i.draft)->'event'->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      and (coalesce(i.published, i.draft)->'event'->>'date')::date < current_date - p_days
  )
  delete from public.ai_photos p using old where p.invitation_id = old.id;
  get diagnostics a = row_count;
  with old as (
    select i.id from public.invitations i
    where (coalesce(i.published, i.draft)->'event'->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      and (coalesce(i.published, i.draft)->'event'->>'date')::date < current_date - p_days
  )
  delete from public.ai_photo_people p using old where p.invitation_id = old.id;
  get diagnostics b = row_count;
  update public.ai_photo_settings s set enabled = false
  where s.enabled and not exists (
    select 1 from public.ai_photo_people p where p.invitation_id = s.invitation_id and p.photo_path is not null
  );
  return jsonb_build_object('photos', a, 'people', b);
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.ai_photos_trash()',
    'public.ai_photo_settings_json(public.ai_photo_settings)',
    'public.ai_photo_person_json(public.ai_photo_people)',
    'public.ai_photo_json(public.ai_photos)',
    'public.ai_photo_counts(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.ai_photo_owner_get(uuid, uuid)',
    'public.ai_photo_owner_settings(uuid, uuid, jsonb)',
    'public.ai_photo_person_save(uuid, uuid, jsonb, int)',
    'public.ai_photo_person_delete(uuid, uuid, uuid)',
    'public.ai_photo_owner_list(uuid, uuid, timestamptz, int)',
    'public.ai_photo_owner_delete(uuid, uuid, uuid[])',
    'public.ai_photo_guest_state(uuid, text, int)',
    'public.ai_photo_create(uuid, text, uuid, text, jsonb, int)',
    'public.ai_photo_guest_get(uuid, text, uuid)',
    'public.ai_photo_guest_delete(uuid, text, uuid)',
    'public.ai_photo_share(uuid, text, uuid, jsonb, int)',
    'public.ai_photo_claim(uuid, int, int, int)',
    'public.ai_photo_started(uuid, text)',
    'public.ai_photo_checks(uuid, int, int, int)',
    'public.ai_photo_done(uuid, text, text, int, int)',
    'public.ai_photo_fail(uuid, text, text)',
    'public.ai_photo_retry(uuid, text, int)',
    'public.ai_photo_maintenance(int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
