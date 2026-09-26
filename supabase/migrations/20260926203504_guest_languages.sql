-- A language per guest (src/features/invitations/server/guests.ts): the host sets the language each
-- guest reads the invitation in — typed in the guest list, or from a spreadsheet's "language" column.
-- null: the invitation's own default. The personal link opens in it and every automatic message to
-- the guest (the WhatsApp invitation) is written in it. Additive: a new nullable column, the functions
-- replaced with the same signatures (their grants stay) and one new function.

alter table public.invitation_guests
  add column if not exists preferred_language text
    constraint invitation_guests_preferred_language_check
    check (preferred_language is null or preferred_language in ('he', 'en', 'ru', 'ar', 'fr', 'es', 'am'));

-- ─── the guest as the host's screens read it: + language ────────────────────────────────────────

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
        'updatedAt', r.updated_at
      )
      from public.rsvp_responses r
      where r.guest_id = g.id
      order by r.updated_at desc
      limit 1
    )
  )
$$;

-- Adds guests (rows already validated: name, E.164 phone or null, email, partySize, group, language,
-- token). A guest already on the list is updated instead (name, email, party size, group, language —
-- an empty cell keeps what the guest has), so an updated spreadsheet can be imported again: found by
-- phone — or, without a phone, by name (and email, when both have one); each guest takes one row at
-- most. Returns { added, updated, total } or null.
create or replace function public.import_guests(p_id uuid, p_owner_id uuid, p_rows jsonb, p_max int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_match uuid;
  v_seen uuid[] := '{}';
  v_added int := 0;
  v_updated int := 0;
  v_total int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      name text, phone text, email text, "partySize" int, "group" text, language text, token text
    )
  loop
    v_match := null;
    if r.phone is not null then
      select g.id into v_match from public.invitation_guests g
      where g.invitation_id = p_id and g.phone = r.phone;
    else
      select g.id into v_match from public.invitation_guests g
      where g.invitation_id = p_id and g.phone is null
        and public.guest_name_key(g.name) = public.guest_name_key(r.name)
        and (r.email is null or g.email is null or g.email = r.email)
        and g.id <> all (v_seen)
      order by g.email is not distinct from r.email desc, g.seq
      limit 1;
    end if;
    if v_match is not null then
      update public.invitation_guests set
        name = r.name, email = coalesce(r.email, email),
        party_size = coalesce(r."partySize", party_size), group_name = coalesce(r."group", group_name),
        preferred_language = coalesce(nullif(r.language, ''), preferred_language)
      where id = v_match;
      v_updated := v_updated + 1;
    else
      insert into public.invitation_guests
        (invitation_id, name, phone, email, party_size, group_name, preferred_language, token)
      values (p_id, r.name, r.phone, r.email, r."partySize", r."group", nullif(r.language, ''), r.token)
      returning id into v_match;
      v_added := v_added + 1;
    end if;
    v_seen := v_seen || v_match;
  end loop;
  select count(*) into v_total from public.invitation_guests where invitation_id = p_id;
  if v_total > p_max then
    raise exception 'guest_limit' using errcode = 'P0001';
  end if;
  return jsonb_build_object('added', v_added, 'updated', v_updated, 'total', v_total);
end $$;

-- One guest typed by hand (validated: name, E.164 phone or null, email, partySize, group, language,
-- token). Unlike an import, a phone already on the list is refused — with the guest who has it:
-- { ok: true, guest } | { ok: false, code: 'duplicate_phone', guest: { id, name } } | null.
-- Past p_max guests: raises guest_limit.
create or replace function public.add_guest(p_id uuid, p_owner_id uuid, p_guest jsonb, p_max int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitation_guests;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  select * into v from public.invitation_guests
  where invitation_id = p_id and phone = nullif(p_guest->>'phone', '');
  if found then
    return jsonb_build_object('ok', false, 'code', 'duplicate_phone',
                              'guest', jsonb_build_object('id', v.id, 'name', v.name));
  end if;
  begin
    insert into public.invitation_guests
      (invitation_id, name, phone, email, party_size, group_name, preferred_language, token)
    values (p_id, p_guest->>'name', nullif(p_guest->>'phone', ''), nullif(p_guest->>'email', ''),
            (p_guest->>'partySize')::int, nullif(p_guest->>'group', ''),
            nullif(p_guest->>'language', ''), p_guest->>'token')
    returning * into v;
  exception when unique_violation then
    -- the same phone added a moment ago (another tab)
    return jsonb_build_object('ok', false, 'code', 'duplicate_phone');
  end;
  if (select count(*) from public.invitation_guests where invitation_id = p_id) > p_max then
    raise exception 'guest_limit' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true, 'guest', public.guest_json(v));
end $$;

-- The host sets the language of some guests (p_language null: the invitation's default). Returns
-- how many, or null when the invitation isn't theirs. A code outside the seven raises (the column's
-- check).
create function public.set_guests_language(p_id uuid, p_owner_id uuid, p_guest_ids uuid[], p_language text)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  update public.invitation_guests set preferred_language = nullif(p_language, '')
  where invitation_id = p_id and id = any(p_guest_ids)
    and preferred_language is distinct from nullif(p_language, '');
  get diagnostics n = row_count;
  return n;
end $$;

-- A guest opened their personal link: { name, phone, partySize, language } (and the visit is
-- counted), or null when the token isn't of this published invitation.
create or replace function public.guest_open(p_slug text, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitation_guests;
begin
  update public.invitation_guests g set
    opened_at = coalesce(g.opened_at, now()), last_opened_at = now(), open_count = g.open_count + 1
  from public.invitations i
  where g.token = p_token and g.invitation_id = i.id and i.slug = p_slug and i.status = 'published'
  returning g.* into v;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'name', v.name, 'phone', v.phone, 'partySize', v.party_size, 'language', v.preferred_language
  );
end $$;

-- Claims up to p_limit messages that are due (as before) — now with the guest's language, which picks
-- the template's language (src/features/whatsapp/languages.ts).
create or replace function public.whatsapp_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select m.id from public.whatsapp_messages m
    where (p_id is null or m.invitation_id = p_id)
      and m.status = 'sending' and m.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.whatsapp_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select m.id from public.whatsapp_messages m
    where (p_id is null or m.invitation_id = p_id) and m.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = m.to_phone)
    for update skip locked
  loop
    update public.whatsapp_messages set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.whatsapp_result(v_msg, null, 'opted_out');
  end loop;
  with picked as (
    select m.id from public.whatsapp_messages m
    where (p_id is null or m.invitation_id = p_id)
      and m.status = 'queued' and (m.next_attempt_at is null or m.next_attempt_at <= now())
    order by coalesce(m.next_attempt_at, m.created_at), m.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.whatsapp_messages m set status = 'sending', claimed_at = now(), attempts = m.attempts + 1
    from picked where m.id = picked.id
    returning m.*
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
      'document', i.published
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id;
  return v;
end $$;

-- service_role only (guest_json, import_guests, add_guest, guest_open and whatsapp_claim keep their
-- grants: create or replace keeps privileges)
revoke all on function public.set_guests_language(uuid, uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.set_guests_language(uuid, uuid, uuid[], text) to service_role;
