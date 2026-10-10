-- "Want us to tag you?": a guest may give their Instagram username with what they share, so the hosts
-- (or their photographer) can tag them when they post the event's photos. Optional, given by the guest
-- (a switch, off until they turn it on); shown with their posts and to the hosts.

alter table public.gallery_items
  add column instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');

comment on column public.gallery_items.instagram is
  'the Instagram username the guest asked to be tagged with (without @); null when they did not';

-- An item as the pages get it (as before): also the username to tag.
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
    'createdAt', i.created_at,
    'completedAt', i.completed_at,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at
  )
$$;

-- Reserving uploads (as before): each item may carry the username to tag.
create or replace function public.gallery_reserve(
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
    thumb_path, thumb_size, width, height, duration_ms, taken_at, uploader_hash, guest_id, uploader_name,
    placement, post_key, instagram
  )
  select (x->>'id')::uuid, p_invitation_id, x->>'kind', x->>'originalPath', x->>'originalType',
    (x->>'originalSize')::bigint, x->>'displayPath', (x->>'displaySize')::int, x->>'thumbPath',
    (x->>'thumbSize')::int, (x->>'width')::int, (x->>'height')::int, (x->>'durationMs')::int,
    (x->>'takenAt')::timestamptz, p_uploader_hash, v_guest, nullif(btrim(p_name), ''),
    coalesce(x->>'placement', 'feed'),
    case when coalesce(x->>'placement', 'feed') = 'feed' then nullif(x->>'post', '') end,
    nullif(x->>'instagram', '')
  from jsonb_array_elements(p_items) x;
  return jsonb_build_object('ok', true);
end $$;
