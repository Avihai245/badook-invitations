-- Guest list & WhatsApp fixes: a re-import doesn't double guests without a phone; "add a guest" never
-- renames someone else; a reply stays with its guest (and finds its guest by phone); the site's sample
-- invitations keep no replies; WhatsApp retries wait; a send that may have reached Meta is never
-- repeated; what Meta never delivered is refunded; phones that asked to stop are never sent to again.
-- Same rules as before: the server routes resolve the user and pass ids; every function checks
-- ownership itself; service_role only.

-- ─── columns & tables ───────────────────────────────────────────────────────────────────────────

-- a message waiting for another try (Meta's rate limits) goes again from this time on
alter table public.whatsapp_messages add column if not exists next_attempt_at timestamptz;
-- its credit went back to the host (once, whichever reports the failure first)
alter table public.whatsapp_messages add column if not exists refunded_at timestamptz;
-- failures the API reported right away (they have no WhatsApp id) were refunded when they happened
update public.whatsapp_messages set refunded_at = updated_at
where status = 'failed' and wa_message_id is null and refunded_at is null;
create index if not exists whatsapp_messages_waiting on public.whatsapp_messages (guest_id)
  where status in ('queued', 'sending');

-- Phones that asked the system's number to stop: a "STOP" / "הסר" reply, or Meta's 131050 (they turned
-- off marketing messages from us). Global — every host sends from the same number; never sent to again.
create table if not exists public.whatsapp_opt_outs (
  phone text primary key check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  source text not null check (source in ('reply', 'meta')),
  created_at timestamptz not null default now()
);
alter table public.whatsapp_opt_outs enable row level security;
revoke all on public.whatsapp_opt_outs from anon, authenticated;

-- A guest's name as a re-import compares it: trimmed, single spaces, lower case.
create or replace function public.guest_name_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
$$;
create index if not exists invitation_guests_name_key
  on public.invitation_guests (invitation_id, public.guest_name_key(name)) where phone is null;

-- A number the system's WhatsApp can reach: Israeli numbers only as mobiles (+9725…) — a landline
-- never is; other countries' numbers are taken as they are.
create or replace function public.whatsapp_capable(p_phone text) returns boolean
language sql immutable set search_path = '' as $$
  select p_phone is not null and (p_phone !~ '^\+972' or p_phone ~ '^\+9725[0-9]{8}$')
$$;

-- ─── guests ─────────────────────────────────────────────────────────────────────────────────────

create or replace function public.guest_json(g public.invitation_guests) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'phone', g.phone,
    'email', g.email,
    'partySize', g.party_size,
    'group', g.group_name,
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

-- Adds guests (rows already validated: name, E.164 phone or null, email, partySize, group, token).
-- A guest already on the list is updated instead (name, email, party size, group), so an updated
-- spreadsheet can be imported again: found by phone — or, without a phone, by name (and email, when
-- both have one); each guest takes one row at most. Returns { added, updated, total } or null.
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
      name text, phone text, email text, "partySize" int, "group" text, token text
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
        party_size = coalesce(r."partySize", party_size), group_name = coalesce(r."group", group_name)
      where id = v_match;
      v_updated := v_updated + 1;
    else
      insert into public.invitation_guests (invitation_id, name, phone, email, party_size, group_name, token)
      values (p_id, r.name, r.phone, r.email, r."partySize", r."group", r.token)
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

-- One guest typed by hand (validated: name, E.164 phone or null, email, partySize, group, token).
-- Unlike an import, a phone already on the list is refused — with the guest who has it:
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
    insert into public.invitation_guests (invitation_id, name, phone, email, party_size, group_name, token)
    values (p_id, p_guest->>'name', nullif(p_guest->>'phone', ''), nullif(p_guest->>'email', ''),
            (p_guest->>'partySize')::int, nullif(p_guest->>'group', ''), p_guest->>'token')
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

-- ─── RSVP ───────────────────────────────────────────────────────────────────────────────────────

-- The site's sample invitations (owned by the non-login demo user — DEMO_OWNER_ID in
-- src/features/invitations/templates/seed-data.ts): the RSVP route stores nothing for them.
create or replace function public.invitation_is_demo(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.invitations
    where id = p_id and owner_id = '00000000-0000-4000-8000-00000000d3e0'::uuid
  )
$$;

-- RSVP (same signature): p_response.guest_id — resolved by the route from a personal link — links the
-- reply to that guest, and a guest answering again replaces their reply. The browser's edit token
-- finds its reply unless that reply is another guest's (a shared browser, a host trying several
-- personal links): a reply never moves from one guest to another — the new guest gets their own.
-- Through the general link, a reply whose phone is on the guest list (a guest who hasn't answered)
-- is linked to that guest.
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
  elsif v_guest is not null then
    select id, guest_id into v_id, v_linked from public.rsvp_responses
      where invitation_id = p_invitation_id and guest_id = v_guest
      order by updated_at desc limit 1
      for update;
  end if;

  if v_guest is null and v_linked is null and v_phone is not null then
    select g.id into v_guest from public.invitation_guests g
    where g.invitation_id = p_invitation_id and g.phone = v_phone
      and not exists (select 1 from public.rsvp_responses r where r.guest_id = g.id);
  end if;

  if v_id is not null then
    v_replaced := true;
    update public.rsvp_responses set
      attending = (p_response->>'attending')::boolean,
      locale = p_response->>'locale',
      primary_name = p_response->>'primary_name',
      phone = p_response->>'phone',
      email = p_response->>'email',
      adults_count = (p_response->>'adults_count')::int,
      children_count = (p_response->>'children_count')::int,
      message = p_response->>'message',
      answers = coalesce(p_response->'answers', '{}'::jsonb),
      ip_hash = p_response->>'ip_hash',
      guest_id = coalesce(v_guest, guest_id),
      edit_token_hash = coalesce(v_new_hash, edit_token_hash)
    where id = v_id;
    delete from public.rsvp_attendees where response_id = v_id;
  else
    insert into public.rsvp_responses (
      invitation_id, attending, locale, primary_name, phone, email, adults_count, children_count,
      message, answers, edit_token_hash, ip_hash, guest_id
    ) values (
      p_invitation_id,
      (p_response->>'attending')::boolean,
      p_response->>'locale',
      p_response->>'primary_name',
      p_response->>'phone',
      p_response->>'email',
      (p_response->>'adults_count')::int,
      (p_response->>'children_count')::int,
      p_response->>'message',
      coalesce(p_response->'answers', '{}'::jsonb),
      p_new_token_hash,
      p_response->>'ip_hash',
      v_guest
    ) returning id into v_id;
  end if;

  insert into public.rsvp_attendees (
    response_id, kind, position, first_name, last_name, full_name, age, phone, email, dietary, dietary_notes
  )
  select v_id, a.kind, a.position, a.first_name, a.last_name, a.full_name, a.age, a.phone, a.email,
         coalesce(a.dietary, '{}'), a.dietary_notes
  from jsonb_to_recordset(coalesce(p_attendees, '[]'::jsonb)) as a(
    kind text, position int, first_name text, last_name text, full_name text, age int,
    phone text, email text, dietary text[], dietary_notes text
  );

  return jsonb_build_object('id', v_id, 'replaced', v_replaced);
end $$;

-- ─── WhatsApp ───────────────────────────────────────────────────────────────────────────────────

-- Why a guest wouldn't get a message now (null: they would): 'landline' (no WhatsApp number),
-- 'opted_out' (asked us to stop), 'received' (already has the invitation: sent, delivered, read,
-- opened or answered — unless p_resend).
create or replace function public.whatsapp_skip_reason(g public.invitation_guests, p_resend boolean)
returns text
language sql stable set search_path = '' as $$
  select case
    when not public.whatsapp_capable(g.phone) then 'landline'
    when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'opted_out'
    when not p_resend and (
      g.send_status in ('sent', 'delivered', 'read') or g.opened_at is not null
      or exists (select 1 from public.rsvp_responses r where r.guest_id = g.id)
    ) then 'received'
  end
$$;

-- Gives a message's credit back to its host — once, whatever reports the failure first.
create or replace function public.whatsapp_refund(p_message_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  update public.whatsapp_messages set refunded_at = now()
  where id = p_message_id and refunded_at is null
  returning owner_id into v_owner;
  if not found then
    return false;
  end if;
  update public.accounts set message_credits = message_credits + 1 where user_id = v_owner;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (v_owner, 1, 'whatsapp_refund', p_message_id::text);
  return true;
end $$;

-- A phone that asked the system's number to stop ('reply': a STOP message; 'meta': error 131050).
-- true when it's new on the list.
create or replace function public.whatsapp_opt_out(p_phone text, p_source text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.whatsapp_opt_outs (phone, source) values (p_phone, p_source)
  on conflict (phone) do nothing;
  return found;
end $$;

drop function if exists public.whatsapp_queue(uuid, uuid, uuid[], numeric);
-- Queues one message per chosen guest with a phone (skipping guests already queued or being sent),
-- paying one credit each. Never queued, never charged: guests the system can't reach (a landline) and
-- phones that asked us to stop; with p_resend false (what the app sends unless the host asks to send
-- again), guests who already have the invitation either.
-- { ok: true, queued, balance } | { ok: false, code: 'credits', needed, balance } |
-- { ok: false, code: 'nobody' } | null — each with skipped: { landline, optedOut, received } when
-- any guest was.
create function public.whatsapp_queue(
  p_id uuid, p_owner_id uuid, p_guest_ids uuid[], p_price_usd numeric, p_resend boolean default true
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  v_balance int;
  v_landline int;
  v_opted int;
  v_received int;
  v_skipped jsonb := '{}';
begin
  if not exists (
    select 1 from public.invitations where id = p_id and owner_id = p_owner_id and status = 'published'
  ) then
    return null;
  end if;
  perform public.account_get(p_owner_id);
  perform 1 from public.invitation_guests
  where invitation_id = p_id and id = any(p_guest_ids) and phone is not null
  for update;
  select count(*) filter (where s is null), count(*) filter (where s = 'landline'),
         count(*) filter (where s = 'opted_out'), count(*) filter (where s = 'received')
  into n, v_landline, v_opted, v_received
  from (
    select public.whatsapp_skip_reason(g, p_resend) as s from public.invitation_guests g
    where g.invitation_id = p_id and g.id = any(p_guest_ids) and g.phone is not null
      and g.send_status <> 'queued'
  ) x;
  if v_landline + v_opted + v_received > 0 then
    v_skipped := jsonb_build_object('skipped', jsonb_build_object(
      'landline', v_landline, 'optedOut', v_opted, 'received', v_received));
  end if;
  if n = 0 then
    return jsonb_build_object('ok', false, 'code', 'nobody') || v_skipped;
  end if;
  update public.accounts set message_credits = message_credits - n
  where user_id = p_owner_id and message_credits >= n
  returning message_credits into v_balance;
  if not found then
    select message_credits into v_balance from public.accounts where user_id = p_owner_id;
    return jsonb_build_object('ok', false, 'code', 'credits', 'needed', n, 'balance', coalesce(v_balance, 0))
      || v_skipped;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_owner_id, -n, 'whatsapp_send', p_id::text);
  with picked as (
    insert into public.whatsapp_messages (invitation_id, guest_id, owner_id, to_phone, price_usd)
    select p_id, g.id, p_owner_id, g.phone, p_price_usd
    from public.invitation_guests g
    where g.invitation_id = p_id and g.id = any(p_guest_ids) and g.phone is not null
      and g.send_status <> 'queued' and public.whatsapp_skip_reason(g, p_resend) is null
    order by g.seq
    returning guest_id
  )
  update public.invitation_guests g set send_status = 'queued', send_channel = 'whatsapp', send_error = null
  from picked where g.id = picked.guest_id;
  return jsonb_build_object('ok', true, 'queued', n, 'balance', v_balance) || v_skipped;
end $$;

-- The API's answer for a message being sent: its WhatsApp id (sent) or the error (failed — the
-- credit goes back to the host; a phone that turned off our messages, 131050, goes on the
-- do-not-send list).
create or replace function public.whatsapp_result(p_message_id uuid, p_wa_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.whatsapp_messages;
begin
  update public.whatsapp_messages set
    wa_message_id = p_wa_id,
    status = case when p_wa_id is null then 'failed' else 'sent' end,
    error = left(p_error, 300),
    next_attempt_at = null
  where id = p_message_id and status = 'sending'
  returning * into m;
  if not found then
    return;
  end if;
  update public.invitation_guests set
    send_status = case when p_wa_id is null then 'failed' else 'sent' end,
    send_channel = 'whatsapp',
    sent_at = case when p_wa_id is null then sent_at else now() end,
    send_error = left(p_error, 300)
  where id = m.guest_id;
  if p_wa_id is null then
    perform public.whatsapp_refund(m.id);
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
end $$;

-- Claims up to p_limit messages that are due (queued, past their next try's time) — of one invitation,
-- or any when p_id is null — with what the template needs. A message to a phone that asked us to
-- stop after it was queued fails instead (refunded). A message left in 'sending' for 10 minutes (the
-- sender died mid-call) is never sent again — Meta may already have it: it fails as 'timeout' and its
-- credit goes back; the host can send it again.
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
      'slug', i.slug,
      'document', i.published
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id;
  return v;
end $$;

drop function if exists public.whatsapp_requeue(uuid, text);
-- A temporary failure (Meta's rate limits, a connection that never got through): back in the queue,
-- due again p_wait_seconds later (the sender backs off) — at most 3 tries, then it fails and its
-- credit goes back. false when it won't be tried again.
create function public.whatsapp_requeue(p_message_id uuid, p_error text, p_wait_seconds int default 0)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.whatsapp_messages
  where id = p_message_id and status = 'sending'
  for update;
  if not found then
    return false;
  end if;
  if n >= 3 then
    perform public.whatsapp_result(p_message_id, null, p_error);
    return false;
  end if;
  update public.whatsapp_messages set
    status = 'queued', claimed_at = null, error = left(p_error, 300),
    next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_wait_seconds, 0), 0))
  where id = p_message_id;
  return true;
end $$;

-- How many of an invitation's messages the page can still send now (due, or being sent).
create or replace function public.whatsapp_pending(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.whatsapp_messages
  where invitation_id = p_id
    and (status = 'sending' or (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())))
$$;

-- The invitation's messages waiting for another try: { count, nextAt } (the scheduled job sends them).
create or replace function public.whatsapp_waiting(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('count', count(*)::int, 'nextAt', min(next_attempt_at))
  from public.whatsapp_messages
  where invitation_id = p_id and status = 'queued' and next_attempt_at > now()
$$;

-- A status from Meta's webhook. Statuses only move forward (sent → delivered → read), since webhooks
-- can arrive out of order; 'failed' (not a WhatsApp number, Meta's per-user limits, turned off our
-- messages…) is recorded unless already read — and, when the message was never delivered (Meta bills
-- delivered messages only), its credit goes back, once. 131050 puts the phone on the do-not-send list.
create or replace function public.whatsapp_status(p_wa_id text, p_status text, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m public.whatsapp_messages;
  rank_of constant jsonb := '{"queued":0,"sending":1,"sent":2,"delivered":3,"read":4,"failed":1}';
begin
  select * into m from public.whatsapp_messages where wa_message_id = p_wa_id for update;
  if not found or p_status not in ('sent', 'delivered', 'read', 'failed') then
    return false;
  end if;
  if p_status = 'failed' then
    if m.status = 'read' then
      return false;
    end if;
  elsif (rank_of->>p_status)::int <= (rank_of->>m.status)::int and m.status <> 'failed' then
    return false;
  end if;
  update public.whatsapp_messages set status = p_status, error = left(p_error, 300) where id = m.id;
  update public.invitation_guests set send_status = p_status, send_error = left(p_error, 300)
  where id = m.guest_id and send_channel = 'whatsapp';
  if p_status = 'failed' then
    if m.status not in ('delivered', 'read') then
      perform public.whatsapp_refund(m.id);
    end if;
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
  return true;
end $$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.guest_name_key(text)',
    'public.whatsapp_capable(text)',
    'public.add_guest(uuid, uuid, jsonb, int)',
    'public.invitation_is_demo(uuid)',
    'public.whatsapp_skip_reason(public.invitation_guests, boolean)',
    'public.whatsapp_refund(uuid)',
    'public.whatsapp_opt_out(text, text)',
    'public.whatsapp_queue(uuid, uuid, uuid[], numeric, boolean)',
    'public.whatsapp_requeue(uuid, text, int)',
    'public.whatsapp_waiting(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
-- guest_json, import_guests, submit_rsvp, whatsapp_result, whatsapp_claim, whatsapp_pending and
-- whatsapp_status keep their grants (create or replace keeps privileges)
