-- AI photos (feature ai_photos): a guest's page shows the people of honor as they are — their photo in
-- a circle beside their name — so it is clear at a glance who the photos are made with. The guest's
-- state now carries each person's photo path; the server turns it into a short-lived signed link (the
-- bucket stays private, the path never reaches the page). Otherwise as before.

create or replace function public.ai_photo_guest_state(p_invitation_id uuid, p_uploader_hash text, p_limit int)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', public.ai_photo_settings_json(s),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'role', p.role, 'name', p.name, 'photoPath', p.photo_path)
        order by p.seq, p.created_at)
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
