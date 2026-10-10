-- The feed's likes (features/live-gallery): a post's key is the random token the phone gave the photos
-- it shared together — or, for a photo shared alone before posts existed, its id. The check compared
-- the id after casting the key to a uuid; the planner may evaluate that cast for any row, so a like on
-- a token that isn't a uuid failed ("invalid input syntax for type uuid") once the gallery held a
-- photo without a post. The id is now compared as text: no cast, the same answer.
--
-- Same rules as the rest of the app: service_role only. Additive only.

create or replace function public.gallery_post_visible(p_invitation_id uuid, p_post text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.gallery_items i
    where i.invitation_id = p_invitation_id
      and i.deleted_at is null
      and i.status = 'published'
      and i.placement = 'feed'
      and (i.post_key = p_post or (i.post_key is null and i.id::text = p_post))
  )
$$;

revoke all on function public.gallery_post_visible(uuid, text) from public, anon, authenticated;
