-- WhatsApp messages, scheduled: the guests' WhatsApp section gets a second way to send besides "send
-- now" — a ready sequence of stages (the invitation, RSVP follow-ups, the event-day reminder, the
-- thank-you) that the system sends by itself at the times the host chose. Nothing new about how a
-- message goes out: every stage queues its messages through the same queues, credits, refunds,
-- opt-outs and webhook statuses as a send from the screen (whatsapp_queue for the invitation,
-- album_notice_queue for the album's thank-you), and the templates that had no queue yet (the RSVP
-- follow-up, the event reminder, the thank-you without an album) share one: whatsapp_notices.
--
-- A stage runs once, in one transaction (whatsapp_stage_run): it picks its audience at that moment
-- (the RSVP answers as they are then), charges and queues — or charges nothing and says why. A
-- follow-up's message checks its guest again when it is sent: a guest who answered in between isn't
-- nagged, and the credit goes back.
--
-- Same rules as the rest: the server routes resolve the user and pass ids; every function checks
-- ownership itself; service_role only; RLS on, no grants to anon / authenticated.

-- ─── the schedule and its stages ────────────────────────────────────────────────────────────────

-- One per event: the preset the host started from and whether the system sends it now.
create table public.whatsapp_schedules (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  preset text not null check (preset in ('basic', 'advanced', 'smart', 'premium')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'canceled')),
  -- the host confirmed their guests expect these messages (WhatsApp's opt-in policy), when activating
  consent_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index whatsapp_schedules_owner on public.whatsapp_schedules (owner_id);
create trigger whatsapp_schedules_touch before update on public.whatsapp_schedules
  for each row execute function public.touch_updated_at();

-- One message of the sequence: which template, to whom (decided when it runs), when. `key` names the
-- stage within the event ('invitation', 'followup1'…, 'event_reminder', 'thanks', 'custom1'…).
create table public.whatsapp_stages (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.whatsapp_schedules(invitation_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^[a-z_]+[0-9]?$' and char_length(key) <= 24),
  kind text not null check (kind in ('invitation', 'followup', 'event_reminder', 'thanks', 'custom')),
  message text not null check (message in ('invitation', 'reminder', 'event_reminder', 'thanks', 'album')),
  audience text not null
    check (audience in ('not_received', 'unanswered', 'attending', 'declined', 'all', 'arrived')),
  label text check (label is null or char_length(label) between 1 and 60),
  send_at timestamptz not null,
  enabled boolean not null default true,
  -- scheduled → done (queued, or nobody to send to) | failed (no credits, template not approved…) |
  -- missed (more than 12 hours late: the schedule was paused, or the system was down) | canceled
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'failed', 'missed', 'canceled')),
  ran_at timestamptz,
  outcome jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invitation_id, key)
);
create index whatsapp_stages_due on public.whatsapp_stages (send_at) where status = 'scheduled' and enabled;
create index whatsapp_stages_owner on public.whatsapp_stages (owner_id);
create trigger whatsapp_stages_touch before update on public.whatsapp_stages
  for each row execute function public.touch_updated_at();

-- The templates with no queue of their own (the RSVP follow-up, the event reminder, the thank-you
-- without an album): one message to one guest, sent from the screen (stage_id null) or by a stage.
-- `audience` is checked again when the message is sent.
create table public.whatsapp_notices (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id uuid references public.invitation_guests(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  stage_id uuid references public.whatsapp_stages(id) on delete set null,
  template text not null check (template in ('reminder', 'event_reminder', 'thanks')),
  audience text check (audience in ('not_received', 'unanswered', 'attending', 'declined', 'all', 'arrived')),
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  to_phone text not null check (to_phone ~ '^\+[1-9][0-9]{6,14}$'),
  wa_message_id text unique,
  error text check (error is null or char_length(error) <= 300),
  price_usd numeric(10, 4) not null default 0,
  attempts int not null default 0,
  claimed_at timestamptz,
  next_attempt_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- a stage reaches each guest once
create unique index whatsapp_notices_stage_guest on public.whatsapp_notices (stage_id, guest_id)
  where stage_id is not null and guest_id is not null;
create index whatsapp_notices_guest on public.whatsapp_notices (guest_id, created_at desc) where guest_id is not null;
create index whatsapp_notices_invitation on public.whatsapp_notices (invitation_id, created_at desc);
create index whatsapp_notices_pending on public.whatsapp_notices (created_at) where status in ('queued', 'sending');
create index whatsapp_notices_owner on public.whatsapp_notices (owner_id);
create trigger whatsapp_notices_touch before update on public.whatsapp_notices
  for each row execute function public.touch_updated_at();

-- The invitation's and the album's messages a stage queued (null: sent from the screen).
alter table public.whatsapp_messages
  add column if not exists stage_id uuid references public.whatsapp_stages(id) on delete set null;
create index if not exists whatsapp_messages_stage on public.whatsapp_messages (stage_id) where stage_id is not null;
alter table public.album_notices
  add column if not exists stage_id uuid references public.whatsapp_stages(id) on delete set null;
create index if not exists album_notices_stage on public.album_notices (stage_id) where stage_id is not null;

alter table public.whatsapp_schedules enable row level security;
alter table public.whatsapp_stages enable row level security;
alter table public.whatsapp_notices enable row level security;
revoke all on public.whatsapp_schedules, public.whatsapp_stages, public.whatsapp_notices from anon, authenticated;

-- ─── audiences ──────────────────────────────────────────────────────────────────────────────────

-- Whether a guest is in an audience now: 'all'; 'not_received' (the invitation hasn't reached them:
-- not sent, delivered, read or opened); 'unanswered' (it has, and they haven't answered); 'attending'
-- / 'declined' (their latest answer); 'arrived' (checked in at the entrance).
create function public.whatsapp_audience_match(g public.invitation_guests, p_audience text) returns boolean
language sql stable set search_path = '' as $$
  select case p_audience
    when 'all' then true
    when 'not_received' then not (g.send_status in ('sent', 'delivered', 'read') or g.opened_at is not null)
      and not exists (select 1 from public.rsvp_responses r where r.guest_id = g.id)
    when 'unanswered' then (g.send_status in ('sent', 'delivered', 'read') or g.opened_at is not null)
      and not exists (select 1 from public.rsvp_responses r where r.guest_id = g.id)
    when 'attending' then coalesce((
      select r.attending from public.rsvp_responses r where r.guest_id = g.id
      order by r.updated_at desc limit 1), false)
    when 'declined' then coalesce((
      select not r.attending from public.rsvp_responses r where r.guest_id = g.id
      order by r.updated_at desc limit 1), false)
    when 'arrived' then exists (
      select 1 from public.checkins c where c.guest_id = g.id and c.deleted_at is null)
    else false
  end
$$;

-- The event's guests in an audience now, in the list's order.
create function public.whatsapp_audience(p_id uuid, p_audience text) returns uuid[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(g.id order by g.seq), '{}'::uuid[])
  from public.invitation_guests g
  where g.invitation_id = p_id and public.whatsapp_audience_match(g, p_audience)
$$;

-- ─── the notices' queue (as album_notices) ──────────────────────────────────────────────────────

-- The chosen guests as a message would find them, and why one can't get it now (null: it can).
create function public.whatsapp_notice_candidates(p_id uuid, p_guest_ids uuid[], p_template text, p_stage_id uuid)
returns table (guest_id uuid, phone text, reason text)
language sql stable set search_path = '' as $$
  select g.id, g.phone,
    case
      when g.phone is null then 'noPhone'
      when not public.whatsapp_capable(g.phone) then 'landline'
      when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'optedOut'
      when p_stage_id is not null and exists (
        select 1 from public.whatsapp_notices n where n.stage_id = p_stage_id and n.guest_id = g.id
      ) then 'queued'
      when exists (
        select 1 from public.whatsapp_notices n
        where n.guest_id = g.id and n.template = p_template and n.status in ('queued', 'sending')
      ) then 'queued'
    end
  from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids)
$$;

-- Queues the template to each chosen guest the system's number can reach, one credit each.
-- { ok: true, queued, balance } | { ok: false, code: 'credits', needed, balance } |
-- { ok: false, code: 'nobody' } — with skipped when any was left out — or null (not the owner's).
create function public.whatsapp_notice_queue(
  p_id uuid, p_owner uuid, p_guest_ids uuid[], p_price_usd numeric, p_template text, p_audience text,
  p_stage_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  v_balance int;
  v_skipped jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  if p_template not in ('reminder', 'event_reminder', 'thanks') then
    raise exception 'invalid template' using errcode = '22023';
  end if;
  perform public.account_get(p_owner);
  perform 1 from public.invitation_guests where invitation_id = p_id and id = any(p_guest_ids) for update;
  select count(*) filter (where c.reason is null),
         case when count(*) filter (where c.reason is not null) = 0 then '{}'::jsonb
              else jsonb_build_object('skipped', jsonb_build_object(
                'noPhone', count(*) filter (where c.reason = 'noPhone'),
                'landline', count(*) filter (where c.reason = 'landline'),
                'optedOut', count(*) filter (where c.reason = 'optedOut'),
                'queued', count(*) filter (where c.reason = 'queued'))) end
  into n, v_skipped
  from public.whatsapp_notice_candidates(p_id, p_guest_ids, p_template, p_stage_id) c;
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
  insert into public.whatsapp_notices
    (invitation_id, guest_id, owner_id, stage_id, template, audience, status, to_phone, price_usd)
  select p_id, c.guest_id, p_owner, p_stage_id, p_template, p_audience, 'queued', c.phone, p_price_usd
  from public.whatsapp_notice_candidates(p_id, p_guest_ids, p_template, p_stage_id) c
  where c.reason is null;
  return jsonb_build_object('ok', true, 'queued', n, 'balance', v_balance) || v_skipped;
end $$;

-- Gives a notice's credit back to its host — once.
create function public.whatsapp_notice_refund(p_notice_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  update public.whatsapp_notices set refunded_at = now()
  where id = p_notice_id and refunded_at is null
  returning owner_id into v_owner;
  if not found then
    return false;
  end if;
  update public.accounts set message_credits = message_credits + 1 where user_id = v_owner;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (v_owner, 1, 'whatsapp_refund', p_notice_id::text);
  return true;
end $$;

-- The API's answer for a notice being sent: its WhatsApp id (sent) or the error (failed: refunded;
-- 131050 → the do-not-send list).
create function public.whatsapp_notice_result(p_notice_id uuid, p_wa_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.whatsapp_notices;
begin
  update public.whatsapp_notices set
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
    perform public.whatsapp_notice_refund(m.id);
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
end $$;

-- Claims up to p_limit notices that are due (one invitation's, or any when p_id is null), with what
-- the template needs. Before that: stuck ones fail (refunded, never sent twice), and queued ones whose
-- guest asked to stop, left the list, or left the audience (answered the RSVP meanwhile) are skipped
-- (refunded) — the RSVP is checked right before sending.
create function public.whatsapp_notice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select n.id from public.whatsapp_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.whatsapp_notice_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select n.id from public.whatsapp_notices n
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = n.to_phone)
    for update skip locked
  loop
    update public.whatsapp_notices set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.whatsapp_notice_result(v_msg, null, 'opted_out');
  end loop;
  for v_msg in
    select n.id from public.whatsapp_notices n
    left join public.invitation_guests g on g.id = n.guest_id
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and (n.next_attempt_at is null or n.next_attempt_at <= now())
      and (g.id is null or (n.audience is not null and not public.whatsapp_audience_match(g, n.audience)))
    for update of n skip locked
  loop
    update public.whatsapp_notices set status = 'skipped', error = 'audience', next_attempt_at = null
    where id = v_msg;
    perform public.whatsapp_notice_refund(v_msg);
  end loop;
  with picked as (
    select n.id from public.whatsapp_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'queued' and (n.next_attempt_at is null or n.next_attempt_at <= now())
    order by coalesce(n.next_attempt_at, n.created_at), n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.whatsapp_notices n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'invitationId', c.invitation_id,
      'template', c.template,
      'toPhone', c.to_phone,
      'attempts', c.attempts,
      'guestName', g.name,
      'guestToken', g.token,
      'guestLanguage', g.preferred_language,
      'slug', i.slug,
      'document', coalesce(i.published, i.draft)
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id;
  return v;
end $$;

-- A temporary failure: back in the queue p_wait_seconds later — at most 3 tries, then it fails
-- (refunded). false when it won't be tried again.
create function public.whatsapp_notice_requeue(p_notice_id uuid, p_error text, p_wait_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.whatsapp_notices where id = p_notice_id and status = 'sending' for update;
  if not found then
    return false;
  end if;
  if n >= 3 then
    perform public.whatsapp_notice_result(p_notice_id, null, p_error);
    return false;
  end if;
  update public.whatsapp_notices set
    status = 'queued', claimed_at = null, error = left(p_error, 300),
    next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_wait_seconds, 0), 0))
  where id = p_notice_id;
  return true;
end $$;

-- A status from Meta's webhook for a notice (false: not one of them, or out of order).
create function public.whatsapp_notice_status(p_wa_id text, p_status text, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m public.whatsapp_notices;
  rank_of constant jsonb := '{"queued":0,"sending":1,"sent":2,"delivered":3,"read":4,"failed":1,"skipped":1}';
begin
  select * into m from public.whatsapp_notices where wa_message_id = p_wa_id for update;
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
  update public.whatsapp_notices set status = p_status, error = left(p_error, 300) where id = m.id;
  if p_status = 'failed' then
    if m.status not in ('delivered', 'read') then
      perform public.whatsapp_notice_refund(m.id);
    end if;
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
  return true;
end $$;

-- How many of an invitation's notices the page can still send now (due, or being sent).
create function public.whatsapp_notice_pending(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.whatsapp_notices
  where invitation_id = p_id
    and (status = 'sending' or (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())))
$$;

-- ─── the schedule: the host's side ──────────────────────────────────────────────────────────────

create function public.whatsapp_stage_json(s public.whatsapp_stages) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'key', s.key,
    'kind', s.kind,
    'message', s.message,
    'audience', s.audience,
    'label', s.label,
    'sendAt', s.send_at,
    'enabled', s.enabled,
    'status', s.status,
    'ranAt', s.ran_at,
    'outcome', s.outcome,
    -- what became of the messages it queued, by status (the three queues a stage can use)
    'stats', coalesce((
      select jsonb_object_agg(x.status, x.n) from (
        select m.status, count(*)::int as n from (
          select status from public.whatsapp_messages where stage_id = s.id
          union all select status from public.album_notices where stage_id = s.id
          union all select status from public.whatsapp_notices where stage_id = s.id
        ) m group by m.status
      ) x
    ), '{}'::jsonb)
  )
$$;

-- The WhatsApp section of an event: its schedule and stages, the latest messages of every kind, and
-- what the screen needs to offer (the album is on, there are check-ins). null when not the owner's.
create function public.whatsapp_hub_state(p_id uuid, p_owner uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.whatsapp_schedules;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into s from public.whatsapp_schedules where invitation_id = p_id;
  return jsonb_build_object(
    'schedule', case when s.invitation_id is null then null else jsonb_build_object(
      'preset', s.preset, 'status', s.status, 'consentAt', s.consent_at, 'activatedAt', s.activated_at,
      'updatedAt', s.updated_at) end,
    'stages', coalesce((
      select jsonb_agg(public.whatsapp_stage_json(st) order by st.send_at, st.key)
      from public.whatsapp_stages st where st.invitation_id = p_id
    ), '[]'::jsonb),
    'album', exists (select 1 from public.gallery_albums where invitation_id = p_id and enabled),
    'checkins', exists (select 1 from public.checkins where invitation_id = p_id and deleted_at is null),
    'history', coalesce((
      select jsonb_agg(h.j order by h.at desc) from (
        select x.at, jsonb_build_object('id', x.id, 'kind', x.kind, 'guestId', x.guest_id, 'name', g.name,
                 'status', x.status, 'error', x.error, 'at', x.at, 'stageId', x.stage_id) as j
        from (
          select m.id, 'invitation' as kind, m.guest_id, m.status, m.error, m.created_at as at, m.stage_id
          from public.whatsapp_messages m where m.invitation_id = p_id
          union all
          select a.id, 'album', a.guest_id, a.status, a.error, a.created_at, a.stage_id
          from public.album_notices a where a.invitation_id = p_id and a.channel = 'whatsapp'
          union all
          select n.id, n.template, n.guest_id, n.status, n.error, n.created_at, n.stage_id
          from public.whatsapp_notices n where n.invitation_id = p_id
        ) x
        left join public.invitation_guests g on g.id = x.guest_id
        order by x.at desc
        limit greatest(1, least(coalesce(p_limit, 200), 500))
      ) h
    ), '[]'::jsonb)
  );
end $$;

-- Saves the host's sequence (already validated by the server): the preset, the schedule's status
-- (p_status: 'draft' | 'active' | 'paused' | 'canceled' | null = keep it) and the stages — each by
-- its key; a stage that already ran (done, failed, missed) keeps what it was unless it is sent again
-- (p_stages[].retry). Stages missing from p_stages that never ran go. Returns the new state, or null.
create function public.whatsapp_schedule_save(
  p_id uuid, p_owner uuid, p_preset text, p_status text, p_stages jsonb, p_consent boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_status text;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.whatsapp_schedules (invitation_id, owner_id, preset, status)
  values (p_id, p_owner, p_preset, coalesce(p_status, 'draft'))
  on conflict (invitation_id) do update set
    preset = excluded.preset,
    status = coalesce(p_status, public.whatsapp_schedules.status)
  returning status into v_status;
  if p_consent then
    update public.whatsapp_schedules set consent_at = now() where invitation_id = p_id;
  end if;
  if v_status = 'active' then
    update public.whatsapp_schedules set activated_at = coalesce(activated_at, now()) where invitation_id = p_id;
  end if;
  if p_stages is not null then
    -- stages that never ran and aren't in the sequence anymore
    delete from public.whatsapp_stages st
    where st.invitation_id = p_id and st.status in ('scheduled', 'canceled')
      and not exists (select 1 from jsonb_array_elements(p_stages) e where e->>'key' = st.key);
    for r in
      select * from jsonb_to_recordset(p_stages) as x(
        key text, kind text, message text, audience text, label text, "sendAt" timestamptz,
        enabled boolean, retry boolean
      )
    loop
      insert into public.whatsapp_stages
        (invitation_id, owner_id, key, kind, message, audience, label, send_at, enabled)
      values (p_id, p_owner, r.key, r.kind, r.message, r.audience, nullif(r.label, ''), r."sendAt",
              coalesce(r.enabled, true))
      on conflict (invitation_id, key) do update set
        kind = excluded.kind, message = excluded.message, audience = excluded.audience,
        label = excluded.label, send_at = excluded.send_at, enabled = excluded.enabled,
        status = 'scheduled', ran_at = null, outcome = null
      where public.whatsapp_stages.status in ('scheduled', 'canceled')
        or (coalesce(r.retry, false) and public.whatsapp_stages.status in ('failed', 'missed'));
    end loop;
  end if;
  -- a canceled sequence: nothing of it is sent anymore
  if v_status = 'canceled' then
    update public.whatsapp_stages set status = 'canceled' where invitation_id = p_id and status = 'scheduled';
  end if;
  return public.whatsapp_hub_state(p_id, p_owner, 200);
end $$;

-- ─── the schedule: the system's side ────────────────────────────────────────────────────────────

-- The stages whose time has come (in active sequences), oldest first, with their owner — the server
-- decides per owner what it may send (its plan, an admin's credits) and runs each with
-- whatsapp_stage_run.
create function public.whatsapp_stages_due(p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'invitationId', x.invitation_id, 'ownerId', x.owner_id, 'ownerEmail', x.email,
      'preset', x.preset, 'message', x.message, 'audience', x.audience, 'kind', x.kind,
      'audienceSize', cardinality(public.whatsapp_audience(x.invitation_id, x.audience)))
    order by x.send_at), '[]'::jsonb)
  from (
    select st.id, st.invitation_id, st.owner_id, st.message, st.audience, st.kind, st.send_at, s.preset, u.email
    from public.whatsapp_stages st
    join public.whatsapp_schedules s on s.invitation_id = st.invitation_id and s.status = 'active'
    left join auth.users u on u.id = st.owner_id
    where st.status = 'scheduled' and st.enabled and st.send_at <= now()
    order by st.send_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) x
$$;

-- Runs one stage, once (a stage being run elsewhere, or not due, is left alone: null): picks its
-- audience now, then queues its messages through the queue of its template — or, when it can't, says
-- why and charges nothing. p_approved: the templates WhatsApp approved here; p_album: the event's plan
-- has the album; p_unlimited: the owner is one of the platform's admins (credits topped up, as the
-- screen does). A stage more than 12 hours late is missed, not sent (a reminder days late helps nobody).
-- The album's thank-you falls back to the plain thank-you when the album isn't there.
create function public.whatsapp_stage_run(
  p_stage_id uuid, p_approved text[], p_album boolean, p_price_usd numeric, p_unlimited boolean,
  p_plan_ok boolean default true
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st public.whatsapp_stages;
  v_message text;
  v_ids uuid[];
  v_balance int;
  v_result jsonb;
  v_status text;
  v_fallback text;
  v_outcome jsonb;
begin
  select st2.* into st from public.whatsapp_stages st2
  join public.whatsapp_schedules s on s.invitation_id = st2.invitation_id and s.status = 'active'
  where st2.id = p_stage_id and st2.status = 'scheduled' and st2.enabled and st2.send_at <= now()
  for update of st2 skip locked;
  if not found then
    return null;
  end if;
  v_message := st.message;
  if st.send_at < now() - interval '12 hours' then
    v_status := 'missed';
    v_outcome := jsonb_build_object('ok', false, 'code', 'late');
  elsif not p_plan_ok then
    v_status := 'failed';
    v_outcome := jsonb_build_object('ok', false, 'code', 'plan');
  elsif not exists (select 1 from public.invitations where id = st.invitation_id and status = 'published') then
    v_status := 'failed';
    v_outcome := jsonb_build_object('ok', false, 'code', 'not_published');
  else
    if v_message = 'album' and not (
      p_album and exists (select 1 from public.gallery_albums where invitation_id = st.invitation_id and enabled)
    ) then
      if 'thanks' = any(p_approved) then
        v_message := 'thanks';
        v_fallback := 'thanks';
      else
        v_status := 'failed';
        v_outcome := jsonb_build_object('ok', false, 'code', 'no_album');
      end if;
    end if;
    if v_status is null and not (v_message = any(p_approved)) then
      v_status := 'failed';
      v_outcome := jsonb_build_object('ok', false, 'code', 'template');
    end if;
  end if;
  if v_status is null then
    v_ids := public.whatsapp_audience(st.invitation_id, st.audience);
    if p_unlimited and cardinality(v_ids) > 0 then
      perform public.account_get(st.owner_id);
      select message_credits into v_balance from public.accounts where user_id = st.owner_id for update;
      if coalesce(v_balance, 0) < cardinality(v_ids) then
        update public.accounts set message_credits = cardinality(v_ids) where user_id = st.owner_id;
        insert into public.credit_ledger (user_id, delta, reason, ref)
        values (st.owner_id, cardinality(v_ids) - coalesce(v_balance, 0), 'admin', 'whatsapp:' || st.invitation_id);
      end if;
    end if;
    if cardinality(v_ids) = 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'nobody');
    elsif v_message = 'invitation' then
      -- the invitation's own queue: guests who already have it never get it twice
      v_result := public.whatsapp_queue(st.invitation_id, st.owner_id, v_ids, p_price_usd, false);
      update public.whatsapp_messages set stage_id = st.id
      where invitation_id = st.invitation_id and stage_id is null and created_at = now()
        and guest_id = any(v_ids);
    elsif v_message = 'album' then
      v_result := public.album_notice_queue(st.invitation_id, st.owner_id, v_ids, p_price_usd);
      update public.album_notices set stage_id = st.id
      where invitation_id = st.invitation_id and stage_id is null and created_at = now()
        and guest_id = any(v_ids);
    else
      v_result := public.whatsapp_notice_queue(
        st.invitation_id, st.owner_id, v_ids, p_price_usd, v_message, st.audience, st.id);
    end if;
    if v_result is null then
      v_status := 'failed';
      v_outcome := jsonb_build_object('ok', false, 'code', 'not_published');
    elsif (v_result->>'ok')::boolean or v_result->>'code' = 'nobody' then
      -- nobody to send to is done too: everyone answered, nobody is coming yet…
      v_status := 'done';
      v_outcome := v_result;
    else
      v_status := 'failed';
      v_outcome := v_result;
    end if;
  end if;
  if v_fallback is not null then
    v_outcome := v_outcome || jsonb_build_object('fallback', v_fallback);
  end if;
  update public.whatsapp_stages set status = v_status, ran_at = now(), outcome = v_outcome where id = st.id;
  return jsonb_build_object('id', st.id, 'invitationId', st.invitation_id, 'status', v_status, 'outcome', v_outcome);
end $$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.whatsapp_audience_match(public.invitation_guests, text)',
    'public.whatsapp_notice_candidates(uuid, uuid[], text, uuid)',
    'public.whatsapp_notice_refund(uuid)',
    'public.whatsapp_stage_json(public.whatsapp_stages)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.whatsapp_audience(uuid, text)',
    'public.whatsapp_notice_queue(uuid, uuid, uuid[], numeric, text, text, uuid)',
    'public.whatsapp_notice_result(uuid, text, text)',
    'public.whatsapp_notice_claim(uuid, int)',
    'public.whatsapp_notice_requeue(uuid, text, int)',
    'public.whatsapp_notice_status(text, text, text)',
    'public.whatsapp_notice_pending(uuid)',
    'public.whatsapp_hub_state(uuid, uuid, int)',
    'public.whatsapp_schedule_save(uuid, uuid, text, text, jsonb, boolean)',
    'public.whatsapp_stages_due(int)',
    'public.whatsapp_stage_run(uuid, text[], boolean, numeric, boolean, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
