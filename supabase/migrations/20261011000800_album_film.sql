-- The album's film: the highlights film the system made from the guests' photos (features/film) is
-- marked when the host saves it to the gallery, and the album page shows it at the top. One film per
-- event: the newest made one. A marker on the gallery item — nothing else about the item changes
-- (the feed, the host's tab and the privacy of a hidden one stay as they were).

alter table public.gallery_items add column if not exists is_film boolean not null default false;
-- at most one film per event
create unique index if not exists gallery_items_one_film
  on public.gallery_items (invitation_id) where is_film and deleted_at is null;

-- The host's highlights film, once its item is saved: marks it (and lets go of the event's earlier
-- film). The host's own video items only. true when marked; null when the event isn't the owner's.
create function public.gallery_mark_film(p_id uuid, p_owner_id uuid, p_item_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  if not exists (
    select 1 from public.gallery_items
    where id = p_item_id and invitation_id = p_id and source = 'host' and kind = 'video'
      and deleted_at is null
  ) then
    return false;
  end if;
  update public.gallery_items set is_film = false
  where invitation_id = p_id and is_film and id <> p_item_id;
  update public.gallery_items set is_film = true where id = p_item_id;
  return true;
end $$;

-- What the album shows (as before) — each item now says whether it is the event's film.
create or replace function public.album_items(p_invitation_id uuid, p_all boolean, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.gallery_item_json(x.item)
      || jsonb_build_object('hidden', (x.item).id = any(coalesce(a.hidden_items, '{}')),
                            'film', (x.item).is_film)
    order by coalesce((x.item).taken_at, (x.item).published_at), (x.item).id), '[]'::jsonb)
  from (
    select i as item from public.gallery_items i
    where i.invitation_id = p_invitation_id and i.deleted_at is null and i.status = 'published'
      and i.display_path is not null
    order by coalesce(i.taken_at, i.published_at), i.id
    limit least(greatest(p_limit, 1), 3000)
  ) x
  left join public.gallery_albums a on a.invitation_id = p_invitation_id
  -- the film is shown at the top whatever the hosts' "videos in the album" switch says
  where p_all or (x.item).is_film or (
    not ((x.item).id = any(coalesce(a.hidden_items, '{}')))
    and (coalesce(a.show_videos, true) or (x.item).kind = 'image')
  )
$$;

revoke all on function public.gallery_mark_film(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.gallery_mark_film(uuid, uuid, uuid) to service_role;
