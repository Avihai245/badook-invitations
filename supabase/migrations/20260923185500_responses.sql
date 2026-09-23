-- Responses dashboard + host notifications (P4). Like the host-app functions: the server routes resolve
-- the signed-in user and pass its id; every function checks ownership itself; service_role only.

-- ─── notification settings ──────────────────────────────────────────────────────────────────────

-- How the host hears about replies: an email per reply ('each', the default when there is no row),
-- a daily digest, or nothing. Its own table, so changing it never touches invitations.updated_at
-- (the editor's autosave compares against it).
create table public.invitation_notifications (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  mode text not null default 'each' check (mode in ('each', 'digest', 'off')),
  digest_sent_at timestamptz
);
alter table public.invitation_notifications enable row level security;
-- no policies: service role only
revoke all on public.invitation_notifications from anon, authenticated;

-- ─── dashboard ──────────────────────────────────────────────────────────────────────────────────

-- The responses of one invitation, newest first, each with its attendees, and the notification mode.
-- null when the invitation isn't the owner's.
create function public.owner_responses(p_id uuid, p_owner_id uuid) returns jsonb
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

-- Deletes one response (and its attendees). false when it isn't the owner's.
create function public.owner_delete_response(p_id uuid, p_owner_id uuid, p_response_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.rsvp_responses r
  using public.invitations i
  where r.id = p_response_id and r.invitation_id = i.id and i.id = p_id and i.owner_id = p_owner_id;
  return found;
end $$;

create function public.set_invitation_notify(p_id uuid, p_owner_id uuid, p_mode text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_mode not in ('each', 'digest', 'off') then
    return false;
  end if;
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return false;
  end if;
  insert into public.invitation_notifications (invitation_id, mode) values (p_id, p_mode)
  on conflict (invitation_id) do update set mode = excluded.mode;
  return true;
end $$;

-- ─── notifications ──────────────────────────────────────────────────────────────────────────────

-- Who to tell about a new reply (called by the RSVP route after submit_rsvp): the owner's email and
-- the mode. null for an unknown invitation.
create function public.rsvp_notification_target(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id,
    'email', u.email,
    'mode', coalesce(n.mode, 'each')
  )
  from public.invitations i
  join auth.users u on u.id = i.owner_id
  left join public.invitation_notifications n on n.invitation_id = i.id
  where i.id = p_invitation_id
$$;

-- Daily digest: invitations in 'digest' mode with replies since their last digest (first digest: the
-- last 24 hours), with those replies and the owner's email. The route sends each one, then marks it.
create function public.rsvp_digest_due(p_now timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'email', u.email,
      'document', coalesce(i.published, i.draft),
      'since', s.since,
      'responses', (
        select jsonb_agg(jsonb_build_object(
            'name', r.primary_name,
            'attending', r.attending,
            'adults', r.adults_count,
            'children', r.children_count,
            'createdAt', r.created_at
          ) order by r.created_at)
        from public.rsvp_responses r
        where r.invitation_id = i.id and r.updated_at > s.since and r.updated_at <= p_now
      )
    )), '[]'::jsonb)
  from public.invitation_notifications n
  join public.invitations i on i.id = n.invitation_id
  join auth.users u on u.id = i.owner_id
  cross join lateral (select coalesce(n.digest_sent_at, p_now - interval '1 day') as since) s
  where n.mode = 'digest'
    and exists (
      select 1 from public.rsvp_responses r
      where r.invitation_id = i.id and r.updated_at > s.since and r.updated_at <= p_now
    )
$$;

create function public.mark_rsvp_digest_sent(p_id uuid, p_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  update public.invitation_notifications set digest_sent_at = p_at where invitation_id = p_id
$$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

revoke all on function public.owner_responses(uuid, uuid) from public, anon, authenticated;
revoke all on function public.owner_delete_response(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_invitation_notify(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rsvp_notification_target(uuid) from public, anon, authenticated;
revoke all on function public.rsvp_digest_due(timestamptz) from public, anon, authenticated;
revoke all on function public.mark_rsvp_digest_sent(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.owner_responses(uuid, uuid) to service_role;
grant execute on function public.owner_delete_response(uuid, uuid, uuid) to service_role;
grant execute on function public.set_invitation_notify(uuid, uuid, text) to service_role;
grant execute on function public.rsvp_notification_target(uuid) to service_role;
grant execute on function public.rsvp_digest_due(timestamptz) to service_role;
grant execute on function public.mark_rsvp_digest_sent(uuid, timestamptz) to service_role;
