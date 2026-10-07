-- "Want us to tag you?" for the hosts: every photo a guest asked to be tagged in, to download as a
-- list (the hosts, or their photographer, tag them when they post the event's photos), and how many
-- guests asked, for the gallery tab's button.

-- The gallery's numbers (as before), and how many Instagram usernames asked to be tagged.
create or replace function public.gallery_counts(p_invitation_id uuid) returns jsonb
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
    'bytes', coalesce(sum(i.original_size) filter (where i.status <> 'uploading'), 0),
    'tagged', count(distinct i.instagram) filter (where i.status in ('published', 'pending'))
  )
  from public.gallery_items i
  where i.invitation_id = p_invitation_id and i.deleted_at is null
$$;

-- The photos guests asked to be tagged in (in the gallery, or waiting for the host's approval), by
-- username, then in the order they were taken. null: not the owner's.
create function public.gallery_owner_tags(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.gallery_item_json(i)
      order by i.instagram, coalesce(i.taken_at, i.created_at), i.id)
    from public.gallery_items i
    where i.invitation_id = p_id
      and i.deleted_at is null
      and i.instagram is not null
      and i.status in ('published', 'pending')
  ), '[]'::jsonb);
end $$;

revoke all on function public.gallery_owner_tags(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gallery_owner_tags(uuid, uuid) to service_role;
