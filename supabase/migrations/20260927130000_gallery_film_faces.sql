-- The gallery keeps giving (Phase 5B), part 1: the host's highlights film and "the photos I'm in".
--
--   · The highlights film (feature auto_reel) is made in the host's own browser from the gallery's
--     approved photos and short videos; the host may add it to the gallery as an item of their own,
--     through the same private storage and signed upload URLs as guests' uploads.
--   · Face search (feature face_albums — off everywhere until INVITES_FACE_ALBUMS, which follows a legal
--     approval): browsers (the phone that uploaded a photo, the host's computer) find the faces in the
--     gallery's photos and turn each into a descriptor of 128 numbers; a guest's selfie becomes one too,
--     on their phone, and is sent once to find the photos they are in — never stored or logged. Only
--     per-face rows are kept: the photo, where the face is, its descriptor. No face crops, no names.
--     A guest may ask to be left out of everyone's searches. Everything is erased 30 days after the
--     event (the daily run), at once when the host turns the feature off or the gallery goes, and with
--     the account.
--
-- Same rules as the rest of the app: row level security on and no policies; every function SECURITY
-- DEFINER with an empty search_path, checking the owner (the server passes the signed-in user's id);
-- guests' calls come through the server after it resolved the gallery's link. service_role only.
-- Additive: one new column with a default, one function extended with a key, new tables and functions.

-- ─── the host's own items ───────────────────────────────────────────────────────────────────────

-- Who added an item: a guest (through the gallery's link) or the host (their highlights film).
alter table public.gallery_items
  add column source text not null default 'guest' check (source in ('guest', 'host'));

-- One item as the server works with it (paths included: the server signs URLs for them) — now with
-- who added it.
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
    'guestId', i.guest_id,
    'source', i.source,
    'createdAt', i.created_at,
    'completedAt', i.completed_at,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at
  )
$$;

-- The host adds an item of their own (the highlights film): reserved like a guest's upload — its id
-- and paths come from the server, under the gallery's lock and cap — whatever the upload window says
-- (it's the host's gallery). { ok } or { ok: false, code: 'full' | 'not_found', left }.
create function public.gallery_owner_add(p_id uuid, p_owner_id uuid, p_item jsonb, p_max_items int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform 1 from public.galleries where invitation_id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select count(*) into v_count from public.gallery_items where invitation_id = p_id and deleted_at is null;
  if v_count + 1 > p_max_items then
    return jsonb_build_object('ok', false, 'code', 'full', 'left', greatest(p_max_items - v_count, 0));
  end if;
  insert into public.gallery_items (
    id, invitation_id, kind, original_path, original_type, original_size, display_path, display_size,
    thumb_path, thumb_size, width, height, duration_ms, taken_at, uploader_hash, source
  ) values (
    (p_item->>'id')::uuid, p_id, p_item->>'kind', p_item->>'originalPath', p_item->>'originalType',
    (p_item->>'originalSize')::bigint, p_item->>'displayPath', (p_item->>'displaySize')::int,
    p_item->>'thumbPath', (p_item->>'thumbSize')::int, (p_item->>'width')::int, (p_item->>'height')::int,
    (p_item->>'durationMs')::int, (p_item->>'takenAt')::timestamptz,
    -- the host's items share one uploader: a hash of the event, never a device's
    encode(sha256(convert_to('gallery-host:' || p_id::text, 'UTF8')), 'hex'), 'host'
  );
  return jsonb_build_object('ok', true);
end $$;

-- The host's item arrived (the server checked its files in storage): in the feed (p_show) or kept
-- for the host only (hidden, shown later with "show"), with the real file sizes. Recorded like the
-- host's other decisions. The item, or null when it isn't the host's own item waiting for its files.
create function public.gallery_owner_add_done(
  p_id uuid, p_owner_id uuid, p_item_id uuid, p_show boolean, p_sizes jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.gallery_items;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  update public.gallery_items set
    status = case when p_show then 'published' else 'hidden' end,
    status_reason = 'host',
    completed_at = now(),
    published_at = case when p_show then now() end,
    original_done = true,
    original_size = coalesce((p_sizes->>'original')::bigint, original_size),
    display_size = coalesce((p_sizes->>'display')::int, display_size),
    thumb_size = coalesce((p_sizes->>'thumb')::int, thumb_size)
  where id = p_item_id and invitation_id = p_id and source = 'host' and status = 'uploading'
    and deleted_at is null
  returning * into v;
  if not found then
    return null;
  end if;
  insert into public.gallery_moderation (item_id, check_name, result, decided_by, actor_id)
  values (v.id, 'host', case when p_show then 'published' else 'hidden' end, 'host', p_owner_id);
  return public.gallery_item_json(v);
end $$;

-- ─── face search: tables ────────────────────────────────────────────────────────────────────────

-- One face in one of the gallery's photos, found by a browser: where it is (fractions of the photo's
-- width and height, as the photo is shown), the detector's confidence, and its descriptor (128
-- numbers). No crop of the face and no name. A guest who asks to be left out of everyone's searches
-- excludes the faces that match them: excluded_at is set and the descriptor erased (nothing is left
-- to match). When its photo is deleted, the descriptor is erased at once (deleted_at) and the row goes
-- with the photo's own record.
create table public.gallery_faces (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.galleries(invitation_id) on delete cascade,
  item_id uuid not null references public.gallery_items(id) on delete cascade,
  box real[] not null check (cardinality(box) = 4),
  score real not null check (score between 0 and 1),
  descriptor real[] check (descriptor is null or cardinality(descriptor) = 128),
  excluded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- a descriptor exists exactly while the face may still be found
  check ((descriptor is null) = (excluded_at is not null or deleted_at is not null))
);
create index gallery_faces_search on public.gallery_faces (invitation_id) where descriptor is not null;
create index gallery_faces_item on public.gallery_faces (item_id);
create trigger gallery_faces_touch before update on public.gallery_faces
  for each row execute function public.touch_updated_at();

-- Which photos a browser has already looked at for faces (a photo without any has its row too): the
-- host's "prepare face search" goes on from where it stopped, and no photo is done twice.
create table public.gallery_face_scans (
  item_id uuid primary key references public.gallery_items(id) on delete cascade,
  invitation_id uuid not null references public.galleries(invitation_id) on delete cascade,
  faces int not null check (faces between 0 and 100),
  -- whose browser: the phone that uploaded the photo, or the host's
  source text not null check (source in ('guest', 'host')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_face_scans_invitation on public.gallery_face_scans (invitation_id);
create trigger gallery_face_scans_touch before update on public.gallery_face_scans
  for each row execute function public.touch_updated_at();

-- Guests who asked to be left out of everyone's searches: the descriptor of their face (never a
-- photo), kept only so that photos added later leave them out too; erased with the event's face data.
create table public.gallery_face_optouts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.galleries(invitation_id) on delete cascade,
  descriptor real[] not null check (cardinality(descriptor) = 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_face_optouts_invitation on public.gallery_face_optouts (invitation_id);
create trigger gallery_face_optouts_touch before update on public.gallery_face_optouts
  for each row execute function public.touch_updated_at();

alter table public.gallery_faces enable row level security;
alter table public.gallery_face_scans enable row level security;
alter table public.gallery_face_optouts enable row level security;
revoke all on public.gallery_faces, public.gallery_face_scans, public.gallery_face_optouts
  from anon, authenticated;

-- ─── face search: helpers (internal: only the functions below call them) ────────────────────────

-- The Euclidean distance of two descriptors (0 = the same; the same person is usually under 0.5).
create function public.face_distance(a real[], b real[]) returns real
language sql immutable set search_path = '' as $$
  select sqrt(sum((x - y) * (x - y)))::real from unnest(a, b) as t(x, y)
$$;

-- A descriptor as the browsers make it: 128 finite numbers, each within ±2.
create function public.face_descriptor_ok(d real[]) returns boolean
language sql immutable set search_path = '' as $$
  select d is not null and cardinality(d) = 128 and array_ndims(d) = 1
    and not exists (
      select 1 from unnest(d) x
      where x is null or x = 'NaN'::real or x = 'Infinity'::real or x = '-Infinity'::real or abs(x) > 2
    )
$$;

-- p_value as a descriptor, or null when it isn't one.
create function public.face_descriptor(p_value jsonb) returns real[]
language plpgsql immutable set search_path = '' as $$
declare
  d real[];
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) <> 128 then
    return null;
  end if;
  if exists (select 1 from jsonb_array_elements(p_value) e where jsonb_typeof(e) <> 'number') then
    return null;
  end if;
  select array_agg(e::text::real order by n) into d from jsonb_array_elements(p_value) with ordinality as t(e, n);
  return case when public.face_descriptor_ok(d) then d end;
end $$;

-- Erases every piece of an event's face data: faces, which photos were looked at, the opt-outs.
create function public.gallery_face_erase(p_invitation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
  c int;
begin
  delete from public.gallery_faces where invitation_id = p_invitation_id;
  get diagnostics a = row_count;
  delete from public.gallery_face_scans where invitation_id = p_invitation_id;
  get diagnostics b = row_count;
  delete from public.gallery_face_optouts where invitation_id = p_invitation_id;
  get diagnostics c = row_count;
  return jsonb_build_object('faces', a, 'scans', b, 'optouts', c);
end $$;

-- A browser's faces for one photo of the event (p_faces: [{ box: [x, y, w, h], score, descriptor }],
-- at most 100): recorded once — a photo already looked at is left as it is. A face that matches a
-- guest who asked to be left out (within p_exclude) is excluded at once. Only finished photos that
-- aren't deleted. { ok, faces, excluded } | { ok: false, code: 'not_found' | 'invalid' }.
create function public.gallery_face_add(
  p_invitation_id uuid, p_item_id uuid, p_source text, p_faces jsonb, p_exclude real
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f jsonb;
  v_box real[];
  v_desc real[];
  v_score real;
  v_faces int := 0;
  v_excluded int := 0;
  v_out boolean;
begin
  if p_source not in ('guest', 'host') then
    raise exception 'gallery_face_add: bad source';
  end if;
  perform 1 from public.gallery_items
  where id = p_item_id and invitation_id = p_invitation_id and kind = 'image'
    and status <> 'uploading' and deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from public.gallery_face_scans where item_id = p_item_id) then
    return jsonb_build_object('ok', true, 'faces', 0, 'excluded', 0, 'already', true);
  end if;
  if p_faces is null or jsonb_typeof(p_faces) <> 'array' or jsonb_array_length(p_faces) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  for f in select * from jsonb_array_elements(p_faces) loop
    if jsonb_typeof(f) <> 'object' or jsonb_typeof(f->'box') is distinct from 'array'
       or jsonb_array_length(f->'box') <> 4 or jsonb_typeof(f->'score') is distinct from 'number'
       or exists (select 1 from jsonb_array_elements(f->'box') e where jsonb_typeof(e) <> 'number') then
      raise exception 'gallery_face_add: invalid face' using errcode = '22023';
    end if;
    v_desc := public.face_descriptor(f->'descriptor');
    if v_desc is null then
      raise exception 'gallery_face_add: invalid face' using errcode = '22023';
    end if;
    select array_agg(e::text::real order by n) into v_box
    from jsonb_array_elements(f->'box') with ordinality as t(e, n);
    v_score := (f->>'score')::real;
    if v_box[1] < 0 or v_box[2] < 0 or v_box[3] <= 0 or v_box[4] <= 0
       or v_box[1] + v_box[3] > 1.001 or v_box[2] + v_box[4] > 1.001 or v_score < 0 or v_score > 1 then
      raise exception 'gallery_face_add: invalid face' using errcode = '22023';
    end if;
    v_out := exists (
      select 1 from public.gallery_face_optouts o
      where o.invitation_id = p_invitation_id and public.face_distance(o.descriptor, v_desc) <= p_exclude
    );
    insert into public.gallery_faces (invitation_id, item_id, box, score, descriptor, excluded_at)
    values (p_invitation_id, p_item_id, v_box, v_score,
            case when v_out then null else v_desc end, case when v_out then now() end);
    v_faces := v_faces + 1;
    if v_out then
      v_excluded := v_excluded + 1;
    end if;
  end loop;
  insert into public.gallery_face_scans (item_id, invitation_id, faces, source)
  values (p_item_id, p_invitation_id, v_faces, p_source);
  return jsonb_build_object('ok', true, 'faces', v_faces, 'excluded', v_excluded);
exception
  -- a face that isn't one (or numbers out of range): nothing of this photo is kept
  when sqlstate '22023' or sqlstate '22003' or sqlstate '22P02' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
end $$;

-- ─── face search: the guests (through the server, after it resolved the gallery's link) ─────────

-- The phone that uploaded a photo sends its faces (only its own uploads: the device's uploader hash).
create function public.gallery_face_index_upload(
  p_invitation_id uuid, p_item_id uuid, p_uploader_hash text, p_faces jsonb, p_exclude real
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.gallery_items
    where id = p_item_id and invitation_id = p_invitation_id and uploader_hash = p_uploader_hash
      and source = 'guest' and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return public.gallery_face_add(p_invitation_id, p_item_id, 'guest', p_faces, p_exclude);
end $$;

-- "The photos I'm in": the published photos with a face within p_threshold of the guest's descriptor
-- (which is only compared here — never stored), newest in the feed first, with the closest distance.
create function public.gallery_face_search(
  p_invitation_id uuid, p_descriptor real[], p_threshold real, p_limit int
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.face_descriptor_ok(p_descriptor) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.gallery_item_json(x.item) || jsonb_build_object('distance', round(x.d::numeric, 3))
      order by (x.item).published_at desc, (x.item).id desc)
    from (
      select i as item, m.d
      from (
        select f.item_id, min(public.face_distance(f.descriptor, p_descriptor)) as d
        from public.gallery_faces f
        where f.invitation_id = p_invitation_id and f.descriptor is not null
        group by f.item_id
      ) m
      join public.gallery_items i on i.id = m.item_id
      where m.d <= p_threshold and i.status = 'published' and i.deleted_at is null
      order by i.published_at desc, i.id desc
      limit least(greatest(p_limit, 1), 1000)
    ) x
  ), '[]'::jsonb);
end $$;

-- A guest asks to be left out of everyone's searches: the faces that match them (within p_threshold)
-- are excluded and their descriptors erased, and their own descriptor is kept (once) so that photos
-- added later leave them out too. { excluded } | null for a descriptor that isn't one.
create function public.gallery_face_leave_out(p_invitation_id uuid, p_descriptor real[], p_threshold real)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not public.face_descriptor_ok(p_descriptor) then
    return null;
  end if;
  update public.gallery_faces set descriptor = null, excluded_at = now()
  where invitation_id = p_invitation_id and descriptor is not null
    and public.face_distance(descriptor, p_descriptor) <= p_threshold;
  get diagnostics n = row_count;
  if not exists (
    select 1 from public.gallery_face_optouts o
    where o.invitation_id = p_invitation_id and public.face_distance(o.descriptor, p_descriptor) <= p_threshold / 2
  ) then
    insert into public.gallery_face_optouts (invitation_id, descriptor) values (p_invitation_id, p_descriptor);
  end if;
  return jsonb_build_object('excluded', n);
end $$;

-- "Forget me": the faces that match the guest (within p_threshold) are erased at once, and so is a
-- request of theirs to be left out — nothing about them stays. { erased } | null.
create function public.gallery_face_forget(p_invitation_id uuid, p_descriptor real[], p_threshold real)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
begin
  if not public.face_descriptor_ok(p_descriptor) then
    return null;
  end if;
  delete from public.gallery_faces
  where invitation_id = p_invitation_id and descriptor is not null
    and public.face_distance(descriptor, p_descriptor) <= p_threshold;
  get diagnostics a = row_count;
  delete from public.gallery_face_optouts
  where invitation_id = p_invitation_id and public.face_distance(descriptor, p_descriptor) <= p_threshold;
  get diagnostics b = row_count;
  return jsonb_build_object('erased', a, 'optouts', b);
end $$;

-- ─── face search: the host (the server passes the signed-in user's id; null when not theirs) ────

-- Where the event's face search stands: its photos, how many were looked at, the faces found (and
-- excluded), the guests who asked to be left out, and the event's date (the data goes 30 days after).
create function public.gallery_face_owner_state(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'eventDate', coalesce(i.published, i.draft)#>>'{event,date}',
    'timezone', coalesce(i.published, i.draft)->>'timezone',
    'gallery', exists (select 1 from public.galleries where invitation_id = p_id),
    'photos', (
      select count(*) from public.gallery_items
      where invitation_id = p_id and kind = 'image' and deleted_at is null
        and status in ('published', 'pending', 'hidden')
    ),
    'scanned', (
      select count(*) from public.gallery_face_scans s
      join public.gallery_items it on it.id = s.item_id
      where s.invitation_id = p_id and it.deleted_at is null and it.status in ('published', 'pending', 'hidden')
    ),
    'faces', (select count(*) from public.gallery_faces where invitation_id = p_id and descriptor is not null),
    'excluded', (select count(*) from public.gallery_faces where invitation_id = p_id and excluded_at is not null),
    'optouts', (select count(*) from public.gallery_face_optouts where invitation_id = p_id)
  );
end $$;

-- The next photos no browser has looked at yet (oldest first), for the host's "prepare face search".
create function public.gallery_face_owner_pending(p_id uuid, p_owner_id uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', x.id, 'displayPath', x.display_path, 'width', x.width, 'height', x.height
      ) order by x.created_at, x.id)
    from (
      select i.id, i.display_path, i.width, i.height, i.created_at
      from public.gallery_items i
      where i.invitation_id = p_id and i.kind = 'image' and i.deleted_at is null
        and i.status in ('published', 'pending', 'hidden') and i.display_path is not null
        and not exists (select 1 from public.gallery_face_scans s where s.item_id = i.id)
      order by i.created_at, i.id
      limit least(greatest(p_limit, 1), 50)
    ) x
  ), '[]'::jsonb);
end $$;

-- The host's browser sends what it found, for several photos (p_results: [{ id, faces }]).
-- { done, faces, excluded, invalid } — invalid: photos refused (not the event's, or bad data).
create function public.gallery_face_owner_index(p_id uuid, p_owner_id uuid, p_results jsonb, p_exclude real)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v jsonb;
  v_done int := 0;
  v_faces int := 0;
  v_excluded int := 0;
  v_invalid int := 0;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  if not exists (select 1 from public.galleries where invitation_id = p_id) then
    return null;
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    if coalesce(r->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_invalid := v_invalid + 1;
      continue;
    end if;
    v := public.gallery_face_add(p_id, (r->>'id')::uuid, 'host', r->'faces', p_exclude);
    if (v->>'ok')::boolean then
      v_done := v_done + 1;
      v_faces := v_faces + coalesce((v->>'faces')::int, 0);
      v_excluded := v_excluded + coalesce((v->>'excluded')::int, 0);
    else
      v_invalid := v_invalid + 1;
    end if;
  end loop;
  return jsonb_build_object('done', v_done, 'faces', v_faces, 'excluded', v_excluded, 'invalid', v_invalid);
end $$;

-- The host erases the event's face data now (the feature stays as it is: guests' phones and the
-- host's browser may index again while it is on).
create function public.gallery_face_owner_erase(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return public.gallery_face_erase(p_id);
end $$;

-- ─── face search: keeping it short ──────────────────────────────────────────────────────────────

-- The events that have face data at all (the daily run checks each one still has the feature).
create function public.gallery_face_events() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct x.invitation_id), '[]'::jsonb)
  from (
    select invitation_id from public.gallery_face_scans
    union select invitation_id from public.gallery_faces
    union select invitation_id from public.gallery_face_optouts
  ) x
$$;

-- Erases the face data of these events (the feature is off for them now: the deployment, the plan or
-- the host). Returns how many events had some.
create function public.gallery_face_erase_events(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v uuid;
  n int := 0;
  r jsonb;
begin
  foreach v in array coalesce(p_ids, '{}'::uuid[]) loop
    r := public.gallery_face_erase(v);
    if (r->>'faces')::int + (r->>'scans')::int + (r->>'optouts')::int > 0 then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- What the privacy policy promises: all face data is erased p_days after the event's date.
create function public.gallery_face_maintenance(p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v uuid;
  n int := 0;
begin
  for v in
    select g.invitation_id
    from public.galleries g
    join public.invitations i on i.id = g.invitation_id
    where coalesce(i.published, i.draft)#>>'{event,date}' ~ '^\d{4}-\d{2}-\d{2}$'
      and (coalesce(i.published, i.draft)#>>'{event,date}')::date < current_date - p_days
      and (
        exists (select 1 from public.gallery_face_scans s where s.invitation_id = g.invitation_id)
        or exists (select 1 from public.gallery_faces f where f.invitation_id = g.invitation_id)
        or exists (select 1 from public.gallery_face_optouts o where o.invitation_id = g.invitation_id)
      )
  loop
    perform public.gallery_face_erase(v);
    n := n + 1;
  end loop;
  return jsonb_build_object('events', n);
end $$;

-- ─── face search: triggers ──────────────────────────────────────────────────────────────────────

-- A deleted photo's faces: the descriptors go at once (the rows go with the photo's record).
create function public.gallery_faces_item_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.gallery_faces set descriptor = null, deleted_at = now()
    where item_id = new.id and deleted_at is null;
  end if;
  return new;
end $$;
create trigger gallery_items_faces_deleted after update of deleted_at on public.gallery_items
  for each row execute function public.gallery_faces_item_deleted();

-- The host switched face search off for the event: its face data is erased at once.
create function public.gallery_faces_feature_off() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.features->'off', '[]'::jsonb) ? 'face_albums'
     and not coalesce(old.features->'off', '[]'::jsonb) ? 'face_albums' then
    perform public.gallery_face_erase(new.id);
  end if;
  return new;
end $$;
create trigger invitations_faces_feature_off after update of features on public.invitations
  for each row execute function public.gallery_faces_feature_off();

-- ─── the highlights film: the gallery's photos and videos to choose from ────────────────────────

-- Every published photo and video guests added (with a preview), newest first, with what the film's
-- choice weighs — sharpness, exposure, size, time taken, the automatic check's quality score, the
-- perceptual hash — and where faces are when face search found them (never their descriptors).
create function public.gallery_owner_film(p_id uuid, p_owner_id uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.gallery_item_json(x.item) || jsonb_build_object('faces', coalesce((
        select jsonb_agg(to_jsonb(f.box) order by f.score desc)
        from public.gallery_faces f
        where f.item_id = (x.item).id and f.deleted_at is null
      ), '[]'::jsonb))
      order by (x.item).published_at desc, (x.item).id desc)
    from (
      select i as item from public.gallery_items i
      where i.invitation_id = p_id and i.status = 'published' and i.deleted_at is null
        and i.source = 'guest' and i.thumb_path is not null and i.display_path is not null
      order by i.published_at desc, i.id desc
      limit least(greatest(p_limit, 1), 3000)
    ) x
  ), '[]'::jsonb);
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  -- helpers: only the functions above run them (the server never calls them directly)
  foreach f in array array[
    'public.face_distance(real[], real[])',
    'public.face_descriptor_ok(real[])',
    'public.face_descriptor(jsonb)',
    'public.gallery_face_erase(uuid)',
    'public.gallery_face_add(uuid, uuid, text, jsonb, real)',
    'public.gallery_faces_item_deleted()',
    'public.gallery_faces_feature_off()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  -- what the server calls
  foreach f in array array[
    'public.gallery_owner_add(uuid, uuid, jsonb, int)',
    'public.gallery_owner_add_done(uuid, uuid, uuid, boolean, jsonb)',
    'public.gallery_owner_film(uuid, uuid, int)',
    'public.gallery_face_index_upload(uuid, uuid, text, jsonb, real)',
    'public.gallery_face_search(uuid, real[], real, int)',
    'public.gallery_face_leave_out(uuid, real[], real)',
    'public.gallery_face_forget(uuid, real[], real)',
    'public.gallery_face_owner_state(uuid, uuid)',
    'public.gallery_face_owner_pending(uuid, uuid, int)',
    'public.gallery_face_owner_index(uuid, uuid, jsonb, real)',
    'public.gallery_face_owner_erase(uuid, uuid)',
    'public.gallery_face_events()',
    'public.gallery_face_erase_events(uuid[])',
    'public.gallery_face_maintenance(int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
