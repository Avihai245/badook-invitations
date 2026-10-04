-- One count of RSVPs everywhere (UX report B2). A reply through the invitation's general link (not a
-- guest's personal one) belongs to no guest: the overview counted it, the guest list didn't, and
-- nothing said why. The dashboard's replies now say whose guest each one is (guestId, null for the
-- general link), and the host can match such a reply to a guest on the list in one click.

create or replace function public.owner_responses(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return jsonb_build_object(
    'notify', coalesce((select n.mode from public.invitation_notifications n where n.invitation_id = p_id), 'each'),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'guestId', r.guest_id,
          'attending', r.attending,
          'locale', r.locale,
          'name', r.primary_name,
          'phone', r.phone,
          'email', r.email,
          'adults', r.adults_count,
          'children', r.children_count,
          'message', r.message,
          'answers', r.answers,
          'createdAt', r.created_at,
          'updatedAt', r.updated_at,
          'attendees', coalesce((
            select jsonb_agg(jsonb_build_object(
                'kind', a.kind,
                'position', a.position,
                'firstName', a.first_name,
                'lastName', a.last_name,
                'fullName', a.full_name,
                'age', a.age,
                'dietary', to_jsonb(a.dietary),
                'dietaryNotes', a.dietary_notes
              ) order by a.kind, a.position)
            from public.rsvp_attendees a
            where a.response_id = r.id
          ), '[]'::jsonb)
        ) order by r.created_at desc)
      from public.rsvp_responses r
      where r.invitation_id = p_id
    ), '[]'::jsonb)
  );
end $$;

-- Matches a reply that came through the general link to a guest on the list (or, with p_guest_id null,
-- unmatches it). 'taken' when the guest already has a reply of their own; null when either isn't the
-- owner's.
create function public.owner_link_response(p_id uuid, p_owner_id uuid, p_response_id uuid, p_guest_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  if not exists (select 1 from public.rsvp_responses where id = p_response_id and invitation_id = p_id) then
    return null;
  end if;
  if p_guest_id is not null then
    if not exists (select 1 from public.invitation_guests where id = p_guest_id and invitation_id = p_id) then
      return null;
    end if;
    if exists (
      select 1 from public.rsvp_responses
      where guest_id = p_guest_id and id <> p_response_id
    ) then
      return 'taken';
    end if;
  end if;
  update public.rsvp_responses set guest_id = p_guest_id where id = p_response_id;
  return 'ok';
end $$;

revoke all on function public.owner_link_response(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.owner_link_response(uuid, uuid, uuid, uuid) to service_role;
