-- The event day in the guest's language (supabase/migrations/*_guest_languages.sql gave each guest one):
-- their table guide opens in it (/e/<slug>/table?g=…, src/features/event-day/server/pages.ts), the
-- WhatsApp message with their table is written in it when the template is approved in it, else in the
-- invitation's (src/features/event-day/server/notify.ts), and the host's "send from my WhatsApp" text
-- follows it too. Three of the event day's functions return the guest's language besides what they
-- returned: the same definitions otherwise (copied from *_event_day.sql), the same signatures — create
-- or replace keeps their grants (service_role only). Additive: nothing else changes, no data moves.

-- ─── the guest's table guide: + the guest's language ───────────────────────────────────────────

create or replace function public.seating_guide(p_slug text, p_token_hash text, p_rate_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  g public.invitation_guests;
  l public.venue_layouts;
  v_unit public.seating_units;
  v_status text := null;
  v_seats int := null;
  v_table public.seating_tables;
  v_arrived int := 0;
begin
  if not public.gallery_rate_hit(coalesce(p_rate_key, 'none'), 600, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into i from public.invitations where slug = p_slug and status = 'published';
  if not found then
    return null;
  end if;
  select * into g from public.invitation_guests
  where invitation_id = i.id and encode(sha256(convert_to(token, 'UTF8')), 'hex') = p_token_hash;
  if not found then
    return null;
  end if;
  -- one link: a guest reloading their map, not a machine
  if not public.gallery_rate_hit(encode(sha256(convert_to('guide-link:' || p_token_hash, 'UTF8')), 'hex'), 120, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate');
  end if;

  select * into v_unit from public.seating_units where guest_id = g.id;
  if found then
    select case when r.id is null then 'pending' when r.attending then 'confirmed' else 'declined' end,
           case when r.id is null then coalesce(g.party_size, 1)
                when r.attending then r.adults_count + r.children_count else 0 end
    into v_status, v_seats
    from (select 1) one
    left join public.rsvp_responses r on r.id = v_unit.response_id;
    select t.* into v_table
    from public.seat_assignments a
    join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
    where a.unit_id = v_unit.id;
    select coalesce(sum(c.count), 0)::int into v_arrived
    from public.checkins c where c.unit_id = v_unit.id and c.deleted_at is null;
  end if;
  select * into l from public.venue_layouts where invitation_id = i.id;

  return jsonb_build_object(
    'ok', true,
    'invitation', public.event_day_invitation_json(i),
    'guest', jsonb_build_object('id', g.id, 'name', g.name, 'language', g.preferred_language),
    'unit', case when v_unit.id is null then null
                 else jsonb_build_object('id', v_unit.id, 'status', v_status, 'seats', v_seats) end,
    'table', case when v_table.id is null then null else jsonb_build_object(
      'id', v_table.id, 'number', v_table.number, 'label', v_table.label, 'shape', v_table.shape,
      'capacity', v_table.capacity, 'x', v_table.x, 'y', v_table.y, 'w', v_table.w, 'h', v_table.h,
      'rotation', v_table.rotation) end,
    'arrived', v_arrived,
    'layout', jsonb_build_object(
      -- a PDF plan isn't drawn on phones (the host's screen turns it into an image when they open it)
      'background', case when l.background_path is null or l.background_type = 'application/pdf' then null
        else jsonb_build_object('path', l.background_path, 'type', l.background_type,
                                'width', l.background_width, 'height', l.background_height) end,
      'metersPerPixel', l.meters_per_pixel,
      'landmarks', coalesce(l.landmarks, '[]'::jsonb)
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'number', t.number, 'shape', t.shape, 'capacity', t.capacity,
          'x', t.x, 'y', t.y, 'w', t.w, 'h', t.h, 'rotation', t.rotation
        ) order by t.number)
      from public.seating_tables t
      where t.invitation_id = i.id and t.deleted_at is null
    ), '[]'::jsonb)
  );
end $$;

-- ─── the host's list of families to tell their table: + each guest's language ──────────────────

create or replace function public.seating_notices_state(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_told jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  v_told := public.seating_told(p_id);
  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'unitId', u.id,
          'guestId', u.guest_id,
          'name', u.name,
          'seats', u.seats,
          'status', u.status,
          'phone', g.phone,
          'token', g.token,
          'language', g.preferred_language,
          'reach', case
            when g.id is null or g.phone is null then 'none'
            when not public.whatsapp_capable(g.phone) then 'landline'
            when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'opted_out'
            else 'ok' end,
          'table', case when t.id is null then null
                        else jsonb_build_object('id', t.id, 'number', t.number, 'label', t.label) end,
          'told', v_told->(u.id::text),
          'queued', exists (
            select 1 from public.seating_notices n where n.unit_id = u.id and n.status in ('queued', 'sending'))
        ) order by u.name, u.id)
      from public.seating_unit_rows(p_id) u
      left join public.invitation_guests g on g.id = u.guest_id
      left join public.seat_assignments a on a.unit_id = u.id
      left join public.seating_tables t on t.id = a.table_id and t.deleted_at is null
      where (u.status = 'confirmed' and u.seats > 0) or t.id is not null or v_told ? u.id::text
    ), '[]'::jsonb)
  );
end $$;

-- ─── the table-number messages the sender claims: + the guest's language ───────────────────────

create or replace function public.seating_notice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select n.id from public.seating_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.seating_notice_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select n.id from public.seating_notices n
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = n.to_phone)
    for update skip locked
  loop
    update public.seating_notices set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.seating_notice_result(v_msg, null, 'opted_out');
  end loop;
  with picked as (
    select n.id from public.seating_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'queued' and (n.next_attempt_at is null or n.next_attempt_at <= now())
    order by coalesce(n.next_attempt_at, n.created_at), n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.seating_notices n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'invitationId', c.invitation_id,
      'toPhone', c.to_phone,
      'attempts', c.attempts,
      'guestName', g.name,
      'guestToken', g.token,
      'guestLanguage', g.preferred_language,
      'slug', i.slug,
      'tableNumber', c.table_number,
      'tableLabel', c.table_label,
      'document', i.published
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id;
  return v;
end $$;
