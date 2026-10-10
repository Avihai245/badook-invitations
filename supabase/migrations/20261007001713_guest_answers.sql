-- Who is coming, one truth from the guest list to the tables (the host's guests page, the RSVP form,
-- the seating and the event day):
--
--   · a guest's reply never counts more people than the guest was invited with (party_size): through
--     the personal link the form stops there, and anything beyond it — asked for in the form, or a
--     larger reply through the general link — waits as a request (extra_requested) for the host to
--     approve: approved, the guest is invited with more and they all count; until then, only up to
--     the invitation does;
--   · the host can set a guest's answer by hand (coming, how many; not coming; no answer yet) — a reply
--     like any other (source 'host'), so every count, the seating and the event day follow it;
--   · a guest's party size never goes below the people they confirmed;
--   · a family answering again through the general link (their phone on the list) replaces their reply
--     instead of adding a second one — no family counted twice;
--   · the seating's units follow every change to the list or the replies at once (no screen has to be
--     opened first), and a reply moved from one guest to another can no longer stop them following;
--   · a family that said it isn't coming is never sent its table number.

alter table public.rsvp_responses
  add column source text not null default 'guest' check (source in ('guest', 'host')),
  add column extra_requested int check (extra_requested between 1 and 99);

comment on column public.rsvp_responses.source is
  'guest: the guest answered (the RSVP form); host: the host set the answer on the guests page';
comment on column public.rsvp_responses.extra_requested is
  'people beyond the guest''s invitation (party_size) the guest asked to bring: not counted until the host approves';

-- A guest's reply as the guests page shows it: with who answered and what they asked for.
create or replace function public.guest_json(g public.invitation_guests) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'phone', g.phone,
    'email', g.email,
    'partySize', g.party_size,
    'group', g.group_name,
    'language', g.preferred_language,
    'token', g.token,
    'sendStatus', g.send_status,
    'sendChannel', g.send_channel,
    'sentAt', g.sent_at,
    'sendError', g.send_error,
    'openedAt', g.opened_at,
    'lastOpenedAt', g.last_opened_at,
    'openCount', g.open_count,
    'createdAt', g.created_at,
    -- asked the system's number to stop: never sent to on WhatsApp again
    'optedOut', g.phone is not null
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone),
    -- a WhatsApp message waiting for another try
    'retryAt', (
      select min(m.next_attempt_at) from public.whatsapp_messages m
      where m.guest_id = g.id and m.status = 'queued' and m.next_attempt_at is not null
    ),
    'response', (
      select jsonb_build_object(
        'id', r.id,
        'attending', r.attending,
        'adults', r.adults_count,
        'children', r.children_count,
        'source', r.source,
        'extraRequested', r.extra_requested,
        'updatedAt', r.updated_at
      )
      from public.rsvp_responses r
      where r.guest_id = g.id
      order by r.updated_at desc
      limit 1
    )
  )
$$;

-- The guest a personal link belongs to, with what the RSVP form may confirm for it.
create function public.guest_rsvp(p_invitation_id uuid, p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'partySize', g.party_size)
  from public.invitation_guests g
  where g.invitation_id = p_invitation_id and g.token = p_token
$$;

-- The people a guest confirmed (their latest reply, when coming), 0 without one.
create function public.guest_confirmed(p_guest_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when r.attending then r.adults_count + r.children_count else 0 end
    from public.rsvp_responses r
    where r.guest_id = p_guest_id
    order by r.updated_at desc
    limit 1
  ), 0)
$$;

-- RSVP (same signature): as before, plus —
--   · a reply for a guest (the personal link, or the general link with the guest's phone) counts at most
--     the guest's party size: the people beyond it (children first, never the first adult) are kept as
--     a request for the host, with any the form asked for (p_response.extra_requested);
--   · through the general link, the phone of a guest who already answered replaces that guest's reply
--     (answering again from another browser) instead of adding a second one.
create or replace function public.submit_rsvp(
  p_invitation_id uuid,
  p_response jsonb,
  p_attendees jsonb,
  p_existing_token_hash text,
  p_new_token_hash text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_linked uuid;
  v_replaced boolean := false;
  v_guest uuid := nullif(p_response->>'guest_id', '')::uuid;
  v_phone text := nullif(p_response->>'phone', '');
  v_new_hash text := p_new_token_hash;
  v_attending boolean := (p_response->>'attending')::boolean;
  v_adults int := coalesce((p_response->>'adults_count')::int, 0);
  v_children int := coalesce((p_response->>'children_count')::int, 0);
  v_extra int := coalesce(nullif(p_response->>'extra_requested', '')::int, 0);
  v_party int;
  v_over int;
  v_cut int;
begin
  if v_guest is not null and not exists (
    select 1 from public.invitation_guests where id = v_guest and invitation_id = p_invitation_id
  ) then
    v_guest := null;
  end if;

  if p_existing_token_hash is not null then
    select id, guest_id into v_id, v_linked from public.rsvp_responses
      where invitation_id = p_invitation_id and edit_token_hash = p_existing_token_hash
      for update;
    if v_id is not null and v_guest is not null and v_linked is distinct from v_guest then
      v_id := null;
      v_linked := null;
    end if;
  end if;
  if v_id is not null then
    v_new_hash := null; -- the browser keeps its token
  end if;

  -- the general link: the phone of a guest on the list is that guest (a reply being edited is linked to
  -- them only when they have no other reply)
  if v_guest is null and v_linked is null and v_phone is not null then
    select g.id into v_guest from public.invitation_guests g
    where g.invitation_id = p_invitation_id and g.phone = v_phone
      and (v_id is null or not exists (
        select 1 from public.rsvp_responses r where r.guest_id = g.id and r.id <> v_id
      ));
  end if;

  -- one reply per guest: answering again replaces it
  if v_id is null and v_guest is not null then
    select id, guest_id into v_id, v_linked from public.rsvp_responses
      where invitation_id = p_invitation_id and guest_id = v_guest
      order by updated_at desc limit 1
      for update;
  end if;

  -- a guest counts at most their invitation; the rest waits for the host
  if not v_attending then
    v_adults := 0;
    v_children := 0;
    v_extra := 0;
  elsif v_guest is not null then
    select party_size into v_party from public.invitation_guests where id = v_guest;
    if v_party is not null and v_adults + v_children > v_party then
      v_over := v_adults + v_children - v_party;
      v_cut := least(v_children, v_over);
      v_children := v_children - v_cut;
      v_adults := greatest(1, v_adults - (v_over - v_cut));
      v_extra := v_extra + v_over;
    end if;
  end if;

  if v_id is not null then
    v_replaced := true;
    update public.rsvp_responses set
      attending = v_attending,
      locale = p_response->>'locale',
      primary_name = p_response->>'primary_name',
      phone = p_response->>'phone',
      email = p_response->>'email',
      adults_count = v_adults,
      children_count = v_children,
      message = p_response->>'message',
      answers = coalesce(p_response->'answers', '{}'::jsonb),
      ip_hash = p_response->>'ip_hash',
      guest_id = coalesce(v_guest, guest_id),
      edit_token_hash = coalesce(v_new_hash, edit_token_hash),
      source = 'guest',
      extra_requested = nullif(least(v_extra, 99), 0)
    where id = v_id;
    delete from public.rsvp_attendees where response_id = v_id;
  else
    insert into public.rsvp_responses (
      invitation_id, attending, locale, primary_name, phone, email, adults_count, children_count,
      message, answers, edit_token_hash, ip_hash, guest_id, source, extra_requested
    ) values (
      p_invitation_id,
      v_attending,
      p_response->>'locale',
      p_response->>'primary_name',
      p_response->>'phone',
      p_response->>'email',
      v_adults,
      v_children,
      p_response->>'message',
      coalesce(p_response->'answers', '{}'::jsonb),
      p_new_token_hash,
      p_response->>'ip_hash',
      v_guest,
      'guest',
      nullif(least(v_extra, 99), 0)
    ) returning id into v_id;
  end if;

  -- the people counted (those beyond the invitation wait with the request, without their details)
  insert into public.rsvp_attendees (
    response_id, kind, position, first_name, last_name, full_name, age, phone, email, dietary, dietary_notes
  )
  select v_id, a.kind, a.position, a.first_name, a.last_name, a.full_name, a.age, a.phone, a.email,
         coalesce(a.dietary, '{}'), a.dietary_notes
  from jsonb_to_recordset(coalesce(p_attendees, '[]'::jsonb)) as a(
    kind text, position int, first_name text, last_name text, full_name text, age int,
    phone text, email text, dietary text[], dietary_notes text
  )
  where (a.kind = 'adult' and a.position < v_adults) or (a.kind = 'child' and a.position < v_children);

  return jsonb_build_object('id', v_id, 'replaced', v_replaced);
end $$;

-- The host sets a guest's answer: p_attending true (p_count people coming — more than the guest was
-- invited with invites them with that many), false (not coming), null (no answer: only an answer the
-- host set can be taken back; the guest's own stays). Whatever the guest asked to add is settled by it.
-- { ok: true, guest } | { ok: false, code: 'invalid' | 'guest_reply' } | null (not the owner's).
create function public.owner_set_response(
  p_id uuid, p_owner_id uuid, p_guest_id uuid, p_attending boolean, p_count int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.invitation_guests;
  r public.rsvp_responses;
  v_children int;
  v_adults int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  select * into g from public.invitation_guests where id = p_guest_id and invitation_id = p_id for update;
  if not found then
    return null;
  end if;
  if p_attending and (p_count is null or p_count < 1 or p_count > 99) then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  select * into r from public.rsvp_responses
    where guest_id = g.id order by updated_at desc limit 1 for update;

  if p_attending is null then
    if r.id is null then
      return jsonb_build_object('ok', true, 'guest', public.guest_json(g));
    end if;
    if r.source <> 'host' then
      return jsonb_build_object('ok', false, 'code', 'guest_reply');
    end if;
    delete from public.rsvp_responses where guest_id = g.id and source = 'host';
    return jsonb_build_object('ok', true, 'guest', public.guest_json(g));
  end if;

  -- coming with more than invited: invited with that many (the reply never counts above the invitation)
  if p_attending and (g.party_size is null or p_count > g.party_size) then
    update public.invitation_guests set party_size = p_count where id = g.id returning * into g;
  end if;

  if p_attending then
    v_children := least(coalesce(r.children_count, 0), p_count - 1);
    v_adults := p_count - v_children;
  else
    v_children := 0;
    v_adults := 0;
  end if;

  if r.id is not null then
    update public.rsvp_responses set
      attending = p_attending,
      adults_count = v_adults,
      children_count = v_children,
      source = 'host',
      extra_requested = null
    where id = r.id;
    delete from public.rsvp_attendees a
    where a.response_id = r.id
      and ((a.kind = 'adult' and a.position >= v_adults) or (a.kind = 'child' and a.position >= v_children));
  else
    insert into public.rsvp_responses (
      invitation_id, attending, locale, primary_name, phone, email, adults_count, children_count,
      message, answers, edit_token_hash, guest_id, source
    ) values (
      p_id, p_attending,
      coalesce(g.preferred_language, (select draft->>'defaultLocale' from public.invitations where id = p_id), 'he'),
      g.name, g.phone, g.email, v_adults, v_children, null, '{}'::jsonb,
      -- nobody holds this token: the guest's own link finds the reply by the guest
      encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'),
      g.id, 'host'
    );
  end if;
  return jsonb_build_object('ok', true, 'guest', public.guest_json(g));
end $$;

-- The host decides on a guest's request to bring more people: approved, the guest is invited with
-- them and they count (as adults: the form kept no details of them); declined, the request goes.
-- { ok: true, guest } | { ok: false, code: 'nothing' } | null.
create function public.owner_extra_decision(p_id uuid, p_owner_id uuid, p_guest_id uuid, p_approve boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.invitation_guests;
  r public.rsvp_responses;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  select * into g from public.invitation_guests where id = p_guest_id and invitation_id = p_id for update;
  if not found then
    return null;
  end if;
  select * into r from public.rsvp_responses
    where guest_id = g.id order by updated_at desc limit 1 for update;
  if r.id is null or r.extra_requested is null or not r.attending then
    return jsonb_build_object('ok', false, 'code', 'nothing');
  end if;
  if p_approve then
    update public.invitation_guests
      set party_size = greatest(coalesce(party_size, 0), r.adults_count + r.children_count + r.extra_requested)
      where id = g.id returning * into g;
    update public.rsvp_responses
      set adults_count = adults_count + extra_requested, extra_requested = null
      where id = r.id;
  else
    update public.rsvp_responses set extra_requested = null where id = r.id;
  end if;
  return jsonb_build_object('ok', true, 'guest', public.guest_json(g));
end $$;

-- A guest's party size never goes below the people they confirmed (an import, an edit — whoever
-- writes it): it stays at least that.
create function public.guest_party_floor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_confirmed int;
begin
  if new.party_size is distinct from old.party_size then
    v_confirmed := public.guest_confirmed(new.id);
    if v_confirmed > 0 and (new.party_size is null or new.party_size < v_confirmed) then
      new.party_size := v_confirmed;
    end if;
  end if;
  return new;
end $$;

create trigger invitation_guests_party_floor
  before update of party_size on public.invitation_guests
  for each row execute function public.guest_party_floor();

-- Editing a guest: as before, and a party size below the people they confirmed is refused with that
-- number ({ ok: false, code: 'below_confirmed', confirmed }).
create or replace function public.update_guest(
  p_id uuid, p_owner_id uuid, p_guest_id uuid, p_name text, p_phone text, p_email text,
  p_party_size int, p_group text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitation_guests;
  v_confirmed int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  v_confirmed := public.guest_confirmed(p_guest_id);
  if v_confirmed > 0 and (p_party_size is null or p_party_size < v_confirmed) then
    return jsonb_build_object('ok', false, 'code', 'below_confirmed', 'confirmed', v_confirmed);
  end if;
  begin
    update public.invitation_guests set
      name = p_name, phone = p_phone, email = p_email, party_size = p_party_size, group_name = p_group
    where id = p_guest_id and invitation_id = p_id
    returning * into v;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_phone');
  end;
  if not found then
    return null;
  end if;
  return jsonb_build_object('ok', true, 'guest', public.guest_json(v));
end $$;

-- The seating's units (same as before, two fixes): a guest's unit lets go of a reply that is no longer
-- the guest's (moved to another guest, or unlinked) before the units are matched again — so a reply
-- moved from one guest to another never makes the whole sync fail, as it did on the unique index.
create or replace function public.seating_sync_units(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v record;
begin
  -- every guest on the list is a unit
  insert into public.seating_units (invitation_id, guest_id)
  select g.invitation_id, g.id
  from public.invitation_guests g
  where g.invitation_id = p_id
    and not exists (select 1 from public.seating_units u where u.guest_id = g.id)
  on conflict (guest_id) where guest_id is not null do nothing;

  -- a guest's unit holding a reply that isn't the guest's any more lets go of it
  update public.seating_units u set response_id = null
  from public.rsvp_responses r
  where u.invitation_id = p_id and u.guest_id is not null and u.response_id = r.id
    and r.guest_id is distinct from u.guest_id;

  -- a reply's own unit whose reply now belongs to a guest: merged into the guest's unit, with its seat
  -- (unless the guest's unit already has one) and its rules
  for v in
    select ur.id as from_id, ug.id as to_id
    from public.seating_units ur
    join public.rsvp_responses r on r.id = ur.response_id
    join public.seating_units ug on ug.guest_id = r.guest_id
    where ur.invitation_id = p_id and ur.guest_id is null and r.guest_id is not null
  loop
    if not exists (select 1 from public.seat_assignments a where a.unit_id = v.to_id) then
      update public.seat_assignments set unit_id = v.to_id where unit_id = v.from_id;
    end if;
    update public.seating_constraints set unit_a = v.to_id where unit_a = v.from_id and unit_b <> v.to_id;
    update public.seating_constraints set unit_b = v.to_id where unit_b = v.from_id and unit_a <> v.to_id;
    delete from public.seating_units where id = v.from_id;
  end loop;

  -- a guest's unit follows the guest's latest reply (answering again replaces the earlier one)
  update public.seating_units u set response_id = x.response_id
  from (
    select distinct on (r.guest_id) r.guest_id, r.id as response_id
    from public.rsvp_responses r
    where r.invitation_id = p_id and r.guest_id is not null
    order by r.guest_id, r.updated_at desc, r.created_at desc
  ) x
  where u.guest_id = x.guest_id and u.response_id is distinct from x.response_id;

  -- a "coming" reply without a guest is a unit of its own
  insert into public.seating_units (invitation_id, response_id)
  select r.invitation_id, r.id
  from public.rsvp_responses r
  where r.invitation_id = p_id and r.guest_id is null and r.attending
    and not exists (select 1 from public.seating_units u where u.response_id = r.id)
  on conflict (response_id) where response_id is not null do nothing;

  -- neither a guest nor a reply left: nobody to seat
  delete from public.seating_units u where u.invitation_id = p_id and u.guest_id is null and u.response_id is null;
exception when unique_violation then
  null;
end $$;

-- The units follow the list and the replies as they change — whoever changes them (a guest's reply,
-- the host's answer, an import, a deletion): the table guide, the table-number messages, the event
-- day and the plan's facts never read a stale unit.
create function public.seating_sync_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v uuid;
begin
  if tg_op = 'DELETE' then
    for v in select distinct invitation_id from old_rows loop
      perform public.seating_sync_units(v);
    end loop;
  else
    for v in select distinct invitation_id from new_rows loop
      perform public.seating_sync_units(v);
    end loop;
  end if;
  return null;
end $$;

create trigger rsvp_responses_sync_ins after insert on public.rsvp_responses
  referencing new table as new_rows for each statement execute function public.seating_sync_changed();
create trigger rsvp_responses_sync_upd after update on public.rsvp_responses
  referencing new table as new_rows for each statement execute function public.seating_sync_changed();
create trigger rsvp_responses_sync_del after delete on public.rsvp_responses
  referencing old table as old_rows for each statement execute function public.seating_sync_changed();
create trigger invitation_guests_sync_ins after insert on public.invitation_guests
  referencing new table as new_rows for each statement execute function public.seating_sync_changed();
create trigger invitation_guests_sync_del after delete on public.invitation_guests
  referencing old table as old_rows for each statement execute function public.seating_sync_changed();

-- A family that said it isn't coming is never sent its table number (nor charged for it): not a
-- candidate at all.
create or replace function public.seating_notice_candidates(p_id uuid, p_unit_ids uuid[])
returns table (unit_id uuid, guest_id uuid, phone text, table_id uuid, number int, label text, reason text)
language sql stable set search_path = '' as $$
  select u.id, g.id, g.phone, t.id, t.number, t.label,
    case
      when g.id is null or g.phone is null then 'noPhone'
      when not public.whatsapp_capable(g.phone) then 'landline'
      when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'optedOut'
      when t.id is null then 'noTable'
      when exists (
        select 1 from public.seating_notices n
        where n.unit_id = u.id and n.status in ('queued', 'sending') and n.table_number = t.number
      ) then 'queued'
    end
  from public.seating_units u
  left join public.invitation_guests g on g.id = u.guest_id
  left join public.seat_assignments a on a.unit_id = u.id
  left join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
  where u.invitation_id = p_id and u.id = any(p_unit_ids)
    and not exists (
      select 1 from public.rsvp_responses r where r.id = u.response_id and not r.attending
    )
$$;

-- The list card: also how many guests on the list answered (a reply of their own) — "N of M
-- answered" never counts a reply twice or one that isn't a listed guest's — and the requests to bring
-- more waiting for the host.
create or replace function public.owner_invitations(p_owner_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'status', i.status,
      'templateId', i.template_id,
      'eventType', i.event_type,
      'hosts', i.draft->'hosts',
      'date', i.draft#>>'{event,date}',
      'locales', i.draft->'locales',
      'defaultLocale', i.draft->>'defaultLocale',
      'palette', i.draft#>'{theme,palette}',
      'monogram', i.draft#>'{cover,monogram}',
      'sealColor', i.draft#>>'{cover,sealColor}',
      'version', i.version,
      'unpublishedChanges', i.published is not null and i.draft is distinct from i.published,
      'publishedAt', i.published_at,
      'updatedAt', i.updated_at,
      'responses', coalesce(r.responses, 0),
      'attending', coalesce(r.attending, 0),
      'guests', (select count(*) from public.invitation_guests g where g.invitation_id = i.id),
      'answered', (
        select count(*) from public.invitation_guests g
        where g.invitation_id = i.id and exists (select 1 from public.rsvp_responses x where x.guest_id = g.id)
      ),
      'extraRequests', coalesce(r.extra, 0),
      'sent', (
        select count(*) from public.invitation_guests g
        where g.invitation_id = i.id and g.send_status in ('sent', 'delivered', 'read')
      )
    ) order by i.updated_at desc), '[]'::jsonb)
  from public.invitations i
  left join lateral (
    select count(*) as responses,
           sum(case when x.attending then x.adults_count + x.children_count else 0 end) as attending,
           count(*) filter (where x.attending and x.extra_requested is not null) as extra
    from public.rsvp_responses x
    where x.invitation_id = i.id
  ) r on true
  where i.owner_id = p_owner_id
$$;

revoke all on function public.guest_rsvp(uuid, text) from public, anon, authenticated;
revoke all on function public.guest_confirmed(uuid) from public, anon, authenticated;
revoke all on function public.owner_set_response(uuid, uuid, uuid, boolean, int) from public, anon, authenticated;
revoke all on function public.owner_extra_decision(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.guest_party_floor() from public, anon, authenticated;
revoke all on function public.seating_sync_changed() from public, anon, authenticated;
grant execute on function public.guest_rsvp(uuid, text) to service_role;
grant execute on function public.guest_confirmed(uuid) to service_role;
grant execute on function public.owner_set_response(uuid, uuid, uuid, boolean, int) to service_role;
grant execute on function public.owner_extra_decision(uuid, uuid, uuid, boolean) to service_role;
