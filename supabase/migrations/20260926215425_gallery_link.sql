-- The gallery keeps giving (Phase 5B), part 2: the invitation leads guests to the live gallery.
--
--   · The invitation's page (an ISR page, cached for everyone) links to the gallery: a section the host
--     adds, with a button and a QR code to the gallery's upload page. The page asks for the gallery's
--     link here when it is rendered; the link itself is derived by the server from the nonce.
--   · "Send guests the gallery link": each guest's personal gallery link (it keeps their personal
--     invitation link, so their uploads carry their name), from the system's WhatsApp number with a
--     third Meta template (docs/whatsapp-setup.md §9) — one credit each, refunded when it isn't
--     delivered — or from the host's own WhatsApp, marked by hand. Queued and sent like the table
--     numbers (*_event_day.sql): claimed in batches, retried on Meta's rate limits, never sent twice.
--
-- Same rules as the rest of the app: row level security on and no policies, SECURITY DEFINER functions
-- with an empty search_path that check the owner, service_role only. Additive only.

-- ─── the invitation's link to its gallery ───────────────────────────────────────────────────────

-- What the invitation's page needs to link to the gallery (null when the event has none): whether it
-- is on, its upload window, and the upload link's nonce and hash (the server derives the link from
-- them — only the server has the key).
create function public.gallery_invitation_link(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', g.enabled,
    'paused', g.paused,
    'opensAt', g.opens_at,
    'closesAt', g.closes_at,
    'hasCode', g.access_code_hash is not null,
    'uploadTokenHash', g.upload_token_hash,
    'uploadTokenNonce', g.upload_token_nonce
  )
  from public.galleries g
  where g.invitation_id = p_invitation_id
$$;

-- ─── the gallery link to guests ─────────────────────────────────────────────────────────────────

-- One gallery link to one guest: a message from the system's WhatsApp number (queued and sent like
-- the invitations, with its own template) or the host's note that they sent it themselves (their own
-- WhatsApp, channel 'manual').
create table public.gallery_notices (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id uuid references public.invitation_guests(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'manual')),
  -- whatsapp: the queue's states (like whatsapp_messages); manual: 'sent'
  status text not null default 'sent'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
  to_phone text check (to_phone is null or to_phone ~ '^\+[1-9][0-9]{6,14}$'),
  wa_message_id text unique,
  error text check (error is null or char_length(error) <= 300),
  price_usd numeric(10, 4) not null default 0,
  attempts int not null default 0,
  claimed_at timestamptz,
  -- a message waiting for another try (Meta asked us to slow down) goes again from this time on
  next_attempt_at timestamptz,
  -- its credit went back to the host (once, whichever reports the failure first)
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel = 'whatsapp') = (to_phone is not null))
);
create index gallery_notices_guest on public.gallery_notices (guest_id, created_at desc) where guest_id is not null;
create index gallery_notices_invitation on public.gallery_notices (invitation_id, created_at desc);
create index gallery_notices_pending on public.gallery_notices (created_at) where status in ('queued', 'sending');
create index gallery_notices_owner_id_idx on public.gallery_notices (owner_id);
create trigger gallery_notices_touch before update on public.gallery_notices
  for each row execute function public.touch_updated_at();

alter table public.gallery_notices enable row level security;
revoke all on public.gallery_notices from anon, authenticated;

-- The dialog: every guest of the list, whether the system's number can reach them, their personal
-- link's token, and the last gallery link they got (its channel, status and time); `gallery`: the
-- event's gallery is on. null when the event isn't the owner's.
create function public.gallery_notices_state(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return jsonb_build_object(
    'gallery', exists (select 1 from public.galleries where invitation_id = p_id and enabled),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'guestId', g.id,
          'name', g.name,
          'phone', g.phone,
          'token', g.token,
          'group', g.group_name,
          'reach', case
            when g.phone is null then 'none'
            when not public.whatsapp_capable(g.phone) then 'landline'
            when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'opted_out'
            else 'ok' end,
          'last', (
            select jsonb_build_object('channel', n.channel, 'status', n.status, 'at', n.created_at)
            from public.gallery_notices n
            where n.guest_id = g.id
            order by (n.status = 'failed'), n.created_at desc
            limit 1
          ),
          'queued', exists (
            select 1 from public.gallery_notices n where n.guest_id = g.id and n.status in ('queued', 'sending'))
        ) order by g.seq)
      from public.invitation_guests g
      where g.invitation_id = p_id
    ), '[]'::jsonb)
  );
end $$;

-- The chosen guests as a message would find them — and why one can't get a WhatsApp now (null: it
-- can): 'noPhone', 'landline', 'optedOut' (asked us to stop), 'queued' (a gallery link is already on
-- its way to them).
create function public.gallery_notice_candidates(p_id uuid, p_guest_ids uuid[])
returns table (guest_id uuid, phone text, reason text)
language sql stable set search_path = '' as $$
  select g.id, g.phone,
    case
      when g.phone is null then 'noPhone'
      when not public.whatsapp_capable(g.phone) then 'landline'
      when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'optedOut'
      when exists (
        select 1 from public.gallery_notices n where n.guest_id = g.id and n.status in ('queued', 'sending')
      ) then 'queued'
    end
  from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids)
$$;

-- Queues the gallery link to each chosen guest the system's number can reach, paying one credit each.
-- Never queued, never charged: the guests gallery_notice_candidates leaves out. { ok: true, queued,
-- balance } | { ok: false, code: 'credits', needed, balance } | { ok: false, code: 'nobody' |
-- 'no_gallery' } — each with skipped: { noPhone, landline, optedOut, queued } when any was left out —
-- or null.
create function public.gallery_notice_queue(p_id uuid, p_owner uuid, p_guest_ids uuid[], p_price_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  v_balance int;
  v_skipped jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  if not exists (select 1 from public.galleries where invitation_id = p_id and enabled) then
    return jsonb_build_object('ok', false, 'code', 'no_gallery');
  end if;
  perform public.account_get(p_owner);
  -- one queue at a time for these guests (two clicks never queue twice)
  perform 1 from public.invitation_guests where invitation_id = p_id and id = any(p_guest_ids) for update;
  select count(*) filter (where c.reason is null),
         case when count(*) filter (where c.reason is not null) = 0 then '{}'::jsonb
              else jsonb_build_object('skipped', jsonb_build_object(
                'noPhone', count(*) filter (where c.reason = 'noPhone'),
                'landline', count(*) filter (where c.reason = 'landline'),
                'optedOut', count(*) filter (where c.reason = 'optedOut'),
                'queued', count(*) filter (where c.reason = 'queued'))) end
  into n, v_skipped
  from public.gallery_notice_candidates(p_id, p_guest_ids) c;
  if n = 0 then
    return jsonb_build_object('ok', false, 'code', 'nobody') || v_skipped;
  end if;
  update public.accounts set message_credits = message_credits - n
  where user_id = p_owner and message_credits >= n
  returning message_credits into v_balance;
  if not found then
    select message_credits into v_balance from public.accounts where user_id = p_owner;
    return jsonb_build_object('ok', false, 'code', 'credits', 'needed', n, 'balance', coalesce(v_balance, 0))
      || v_skipped;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_owner, -n, 'whatsapp_send', p_id::text);
  insert into public.gallery_notices (invitation_id, guest_id, owner_id, channel, status, to_phone, price_usd)
  select p_id, c.guest_id, p_owner, 'whatsapp', 'queued', c.phone, p_price_usd
  from public.gallery_notice_candidates(p_id, p_guest_ids) c
  where c.reason is null;
  return jsonb_build_object('ok', true, 'queued', n, 'balance', v_balance) || v_skipped;
end $$;

-- The host sent these guests the gallery link themselves (their own WhatsApp, a copied link).
-- Returns how many, or null.
create function public.gallery_notice_mark(p_id uuid, p_owner uuid, p_guest_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.gallery_notices (invitation_id, guest_id, owner_id, channel, status)
  select p_id, g.id, p_owner, 'manual', 'sent'
  from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── sending (the server's queue, like the table numbers') ──────────────────────────────────────

-- Gives a message's credit back to its host — once, whatever reports the failure first.
create function public.gallery_notice_refund(p_notice_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  update public.gallery_notices set refunded_at = now()
  where id = p_notice_id and channel = 'whatsapp' and refunded_at is null
  returning owner_id into v_owner;
  if not found then
    return false;
  end if;
  update public.accounts set message_credits = message_credits + 1 where user_id = v_owner;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (v_owner, 1, 'whatsapp_refund', p_notice_id::text);
  return true;
end $$;

-- The API's answer for a message being sent: its WhatsApp id (sent) or the error (failed — the credit
-- goes back; a phone that turned off our messages, 131050, goes on the do-not-send list).
create function public.gallery_notice_result(p_notice_id uuid, p_wa_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.gallery_notices;
begin
  update public.gallery_notices set
    wa_message_id = p_wa_id,
    status = case when p_wa_id is null then 'failed' else 'sent' end,
    error = left(p_error, 300),
    next_attempt_at = null
  where id = p_notice_id and status = 'sending'
  returning * into m;
  if not found then
    return;
  end if;
  if p_wa_id is null then
    perform public.gallery_notice_refund(m.id);
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
end $$;

-- Claims up to p_limit messages that are due — of one invitation, or any when p_id is null — with what
-- the template needs: the guest's name and personal token, the invitation's slug and document, and the
-- gallery's upload link nonce and hash (the server derives the link). A message to a phone that asked
-- us to stop after it was queued fails instead (refunded); one left in 'sending' for 10 minutes is
-- never sent again (Meta may already have it): it fails as 'timeout' and its credit goes back.
create function public.gallery_notice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select n.id from public.gallery_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.gallery_notice_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select n.id from public.gallery_notices n
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = n.to_phone)
    for update skip locked
  loop
    update public.gallery_notices set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.gallery_notice_result(v_msg, null, 'opted_out');
  end loop;
  with picked as (
    select n.id from public.gallery_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'queued' and (n.next_attempt_at is null or n.next_attempt_at <= now())
    order by coalesce(n.next_attempt_at, n.created_at), n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.gallery_notices n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
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
      'slug', i.slug,
      'document', coalesce(i.published, i.draft),
      'uploadTokenHash', ga.upload_token_hash,
      'uploadTokenNonce', ga.upload_token_nonce
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id
  left join public.galleries ga on ga.invitation_id = c.invitation_id;
  return v;
end $$;

-- A temporary failure (Meta's rate limits, a connection that never got through): back in the queue,
-- due again p_wait_seconds later — at most 3 tries, then it fails and its credit goes back. false when
-- it won't be tried again.
create function public.gallery_notice_requeue(p_notice_id uuid, p_error text, p_wait_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.gallery_notices where id = p_notice_id and status = 'sending' for update;
  if not found then
    return false;
  end if;
  if n >= 3 then
    perform public.gallery_notice_result(p_notice_id, null, p_error);
    return false;
  end if;
  update public.gallery_notices set
    status = 'queued', claimed_at = null, error = left(p_error, 300),
    next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_wait_seconds, 0), 0))
  where id = p_notice_id;
  return true;
end $$;

-- A status from Meta's webhook for a gallery link (false: not one of them, or out of order). Statuses
-- only move forward; 'failed' before delivery refunds the credit, once; 131050 → the do-not-send list.
create function public.gallery_notice_status(p_wa_id text, p_status text, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m public.gallery_notices;
  rank_of constant jsonb := '{"queued":0,"sending":1,"sent":2,"delivered":3,"read":4,"failed":1}';
begin
  select * into m from public.gallery_notices where wa_message_id = p_wa_id for update;
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
  update public.gallery_notices set status = p_status, error = left(p_error, 300) where id = m.id;
  if p_status = 'failed' then
    if m.status not in ('delivered', 'read') then
      perform public.gallery_notice_refund(m.id);
    end if;
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
  return true;
end $$;

-- How many of an invitation's gallery links the page can still send now (due, or being sent).
create function public.gallery_notice_pending(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.gallery_notices
  where invitation_id = p_id
    and (status = 'sending' or (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())))
$$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  -- helpers: only the functions above run them
  foreach f in array array[
    'public.gallery_notice_candidates(uuid, uuid[])',
    'public.gallery_notice_refund(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.gallery_invitation_link(uuid)',
    'public.gallery_notices_state(uuid, uuid)',
    'public.gallery_notice_queue(uuid, uuid, uuid[], numeric)',
    'public.gallery_notice_mark(uuid, uuid, uuid[])',
    'public.gallery_notice_result(uuid, text, text)',
    'public.gallery_notice_claim(uuid, int)',
    'public.gallery_notice_requeue(uuid, text, int)',
    'public.gallery_notice_status(text, text, text)',
    'public.gallery_notice_pending(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
