-- The budget's "by the list" numbers are the people expected, one truth with the guests page and the
-- seating: a guest who answered counts as their answer (adults and children as they replied; nobody
-- when not coming), a guest who hasn't answered yet counts as invited (party size, 1 when none, as
-- adults — the list doesn't say who is a child), and a "coming" reply through the general link not yet
-- matched to a guest counts too. Before, the list counted everyone invited — those who said no as well.
-- 'invited' stays everyone on the list (the guests page's "of N invited", and the host's sync).
create or replace function public.planning_headcount(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.plan_settings;
  v_basis text;
  v_invited int;
  v_ea int;
  v_ec int;
  v_ca int;
  v_cc int;
  v_tables int;
  v_adults int;
  v_children int;
begin
  select * into s from public.plan_settings where invitation_id = p_id;
  v_basis := coalesce(s.guest_basis, 'invited');
  if not coalesce((s.integrations ->> 'guests')::boolean, true) then v_basis := 'manual'; end if;
  select coalesce(sum(coalesce(party_size, 1)), 0)::int into v_invited
  from public.invitation_guests where invitation_id = p_id;
  select coalesce(sum(adults_count), 0)::int, coalesce(sum(children_count), 0)::int into v_ca, v_cc
  from public.rsvp_responses where invitation_id = p_id and attending;

  -- expected: each guest by their latest answer, or their invitation while they haven't answered
  with latest as (
    select distinct on (r.guest_id) r.guest_id, r.attending, r.adults_count, r.children_count
    from public.rsvp_responses r
    where r.invitation_id = p_id and r.guest_id is not null
    order by r.guest_id, r.updated_at desc, r.created_at desc
  )
  select
    coalesce(sum(case when l.guest_id is null then coalesce(g.party_size, 1)
                      when l.attending then l.adults_count else 0 end), 0)::int,
    coalesce(sum(case when l.attending then l.children_count else 0 end), 0)::int
  into v_ea, v_ec
  from public.invitation_guests g
  left join latest l on l.guest_id = g.id
  where g.invitation_id = p_id;
  select v_ea + coalesce(sum(adults_count), 0)::int, v_ec + coalesce(sum(children_count), 0)::int
  into v_ea, v_ec
  from public.rsvp_responses
  where invitation_id = p_id and guest_id is null and attending;

  if coalesce((s.integrations ->> 'seating')::boolean, true) then
    select count(*)::int into v_tables
    from public.seating_tables where invitation_id = p_id and deleted_at is null;
  else
    v_tables := coalesce(s.manual_tables, 0);
  end if;
  if v_basis = 'confirmed' then
    v_adults := v_ca; v_children := v_cc;
  elsif v_basis = 'manual' then
    v_adults := coalesce(s.manual_adults, 0); v_children := coalesce(s.manual_children, 0);
  else
    v_adults := v_ea; v_children := v_ec;
  end if;
  return jsonb_build_object(
    'basis', v_basis, 'adults', v_adults, 'children', v_children, 'guests', v_adults + v_children,
    'tables', v_tables, 'invited', v_invited, 'confirmedAdults', v_ca, 'confirmedChildren', v_cc,
    'expectedAdults', v_ea, 'expectedChildren', v_ec
  );
end $$;

-- The replies screen says who answered (the guest, or the host for them — 'manual') and any request to
-- bring more people waiting for the host (same as before, two more fields).
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
          'source', r.source,
          'extraRequested', r.extra_requested,
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
