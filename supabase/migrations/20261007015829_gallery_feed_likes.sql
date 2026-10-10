-- The live gallery as the event's own Instagram: a guest shares to the story (the circles at the
-- top, played full screen) or to the feed (posts that stay, and that guests like). Several photos shared
-- to the feed together are one post (a swipe between them): they carry the same post key, made by the
-- phone. An item shared before this keeps to the feed, one post each (its key is its id).
--
-- A like is one per phone and post: the phone's uploader hash (the same one-way hash of its random id
-- that marks its uploads — never the id itself). Only a published post of the feed can be liked; likes
-- go with the gallery.

alter table public.gallery_items
  add column placement text not null default 'feed' check (placement in ('story', 'feed')),
  add column post_key text check (post_key is null or post_key ~ '^[A-Za-z0-9_-]{8,40}$');
create index gallery_items_post on public.gallery_items (invitation_id, post_key) where post_key is not null;

create table public.gallery_likes (
  invitation_id uuid not null references public.galleries(invitation_id) on delete cascade,
  post_key text not null check (post_key ~ '^[A-Za-z0-9_-]{8,40}$'),
  liker_hash text not null check (liker_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (invitation_id, post_key, liker_hash)
);
alter table public.gallery_likes enable row level security;
revoke all on public.gallery_likes from anon, authenticated;

-- An item as the pages get it (as before): also where it was shared, and its post.
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
    'post', coalesce(i.post_key, i.id::text),
    'createdAt', i.created_at,
    'completedAt', i.completed_at,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at
  )
$$;

-- Reserving uploads (as before): each item says where it goes, and a feed item its post.
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
    placement, post_key
  )
  select (x->>'id')::uuid, p_invitation_id, x->>'kind', x->>'originalPath', x->>'originalType',
    (x->>'originalSize')::bigint, x->>'displayPath', (x->>'displaySize')::int, x->>'thumbPath',
    (x->>'thumbSize')::int, (x->>'width')::int, (x->>'height')::int, (x->>'durationMs')::int,
    (x->>'takenAt')::timestamptz, p_uploader_hash, v_guest, nullif(btrim(p_name), ''),
    coalesce(x->>'placement', 'feed'),
    case when coalesce(x->>'placement', 'feed') = 'feed' then nullif(x->>'post', '') end
  from jsonb_array_elements(p_items) x;
  return jsonb_build_object('ok', true);
end $$;

-- A post of the feed (a key, or an item's id) that guests may see.
create function public.gallery_post_visible(p_invitation_id uuid, p_post text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.gallery_items i
    where i.invitation_id = p_invitation_id
      and i.deleted_at is null
      and i.status = 'published'
      and i.placement = 'feed'
      and (
        i.post_key = p_post
        or (i.post_key is null and p_post ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and i.id = p_post::uuid)
      )
  )
$$;

-- A phone likes a post (p_on) or takes its like back. { ok, n, mine } | { ok: false, code: 'not_found' }.
create function public.gallery_like(p_invitation_id uuid, p_post text, p_liker_hash text, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.gallery_post_visible(p_invitation_id, p_post) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if p_on then
    insert into public.gallery_likes (invitation_id, post_key, liker_hash)
    values (p_invitation_id, p_post, p_liker_hash)
    on conflict do nothing;
  else
    delete from public.gallery_likes
    where invitation_id = p_invitation_id and post_key = p_post and liker_hash = p_liker_hash;
  end if;
  return jsonb_build_object(
    'ok', true,
    'n', (select count(*)::int from public.gallery_likes where invitation_id = p_invitation_id and post_key = p_post),
    'mine', p_on
  );
end $$;

-- The likes of these posts: { post: { n, mine } } (a post nobody liked is left out).
create function public.gallery_likes_of(p_invitation_id uuid, p_posts text[], p_liker_hash text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(l.post_key, jsonb_build_object('n', l.n, 'mine', l.mine)), '{}'::jsonb)
  from (
    select post_key, count(*)::int as n, coalesce(bool_or(liker_hash = p_liker_hash), false) as mine
    from public.gallery_likes
    where invitation_id = p_invitation_id and post_key = any(p_posts)
    group by post_key
  ) l
$$;

revoke all on function public.gallery_post_visible(uuid, text) from public, anon, authenticated;
revoke all on function public.gallery_like(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.gallery_likes_of(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.gallery_like(uuid, text, text, boolean) to service_role;
grant execute on function public.gallery_likes_of(uuid, text[], text) to service_role;
