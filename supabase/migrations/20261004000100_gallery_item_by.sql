-- The live gallery's stories: the guests' feed groups what each person uploaded, so every item says who
-- it is from — an opaque key (the start of the uploader's hash, which is already one-way: it never leads
-- back to the device's own id, the only thing that can delete an upload) or 'host' for the hosts' own
-- items (their highlights film). A named guest is told apart from another by the name; an unnamed one
-- only by this key.

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
    'createdAt', i.created_at,
    'completedAt', i.completed_at,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at
  )
$$;
