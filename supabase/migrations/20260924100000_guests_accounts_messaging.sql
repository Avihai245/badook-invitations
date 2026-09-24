-- Guests, accounts & plans, WhatsApp sending, support-chat limits, partner provisioning.
-- Same rules as the host-app functions: the server routes resolve the signed-in user (or verify a
-- partner / webhook secret) and pass ids; every function checks ownership itself; service_role only.

-- ─── accounts: profile, plan, message credits ───────────────────────────────────────────────────

-- One row per user, created on first use (account_get). The plan comes from the payment provider's
-- webhook (billing_apply); credits pay for WhatsApp messages (one per message).
create table public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  plan_status text not null default 'active'
    check (plan_status in ('active', 'trialing', 'past_due', 'canceled')),
  plan_renews_at timestamptz,
  billing_provider text check (billing_provider is null or char_length(billing_provider) <= 40),
  billing_customer_id text check (billing_customer_id is null or char_length(billing_customer_id) <= 200),
  billing_subscription_id text
    check (billing_subscription_id is null or char_length(billing_subscription_id) <= 200),
  message_credits int not null default 0 check (message_credits >= 0),
  -- how the account came to be: 'signup', 'google', 'partner:<name>'
  source text not null default 'signup' check (char_length(source) <= 60),
  -- the partner system's own id for this user (Badook Events)
  external_id text check (external_id is null or char_length(external_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index accounts_partner_external on public.accounts (source, external_id)
  where external_id is not null;
create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();

-- Every change to a credit balance, for support questions and refunds.
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('purchase', 'plan_grant', 'whatsapp_send', 'whatsapp_refund', 'admin')),
  ref text check (ref is null or char_length(ref) <= 200),
  created_at timestamptz not null default now()
);
create index on public.credit_ledger (user_id, created_at desc);

-- Payment-provider webhook events already applied (idempotency) — and an audit trail.
create table public.billing_events (
  id text primary key,
  provider text not null,
  type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── guests ─────────────────────────────────────────────────────────────────────────────────────

-- The host's guest list for one invitation (imported from Excel/CSV or added by hand). `token` is the
-- guest's personal link (/i/<slug>?g=<token>): it prefills the RSVP form and greets them by name.
create table public.invitation_guests (
  id uuid primary key default gen_random_uuid(),
  -- insertion order: a spreadsheet's rows keep their order (they share one created_at)
  seq bigint generated always as identity,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (email is null or char_length(email) <= 254),
  party_size int check (party_size between 1 and 99),
  group_name text check (group_name is null or char_length(group_name) <= 60),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- the invitation's delivery: by WhatsApp (webhook statuses) or marked by the host
  send_status text not null default 'none'
    check (send_status in ('none', 'queued', 'sent', 'delivered', 'read', 'failed')),
  send_channel text check (send_channel in ('whatsapp', 'manual')),
  sent_at timestamptz,
  send_error text check (send_error is null or char_length(send_error) <= 300),
  opened_at timestamptz,
  last_opened_at timestamptz,
  open_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.invitation_guests (invitation_id, seq);
-- one row per phone number in a list (a re-import updates the name instead of duplicating)
create unique index invitation_guests_phone on public.invitation_guests (invitation_id, phone)
  where phone is not null;
create trigger invitation_guests_touch before update on public.invitation_guests
  for each row execute function public.touch_updated_at();

-- A reply that came through a guest's personal link belongs to that guest.
alter table public.rsvp_responses
  add column guest_id uuid references public.invitation_guests(id) on delete set null;
create index on public.rsvp_responses (guest_id) where guest_id is not null;

-- ─── WhatsApp messages ──────────────────────────────────────────────────────────────────────────

-- One template message to one guest, sent from the system's WhatsApp Business number. Queued with its
-- credit already taken; the sender claims batches; Meta's webhook moves it to delivered / read.
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id uuid references public.invitation_guests(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  to_phone text not null check (to_phone ~ '^\+[1-9][0-9]{6,14}$'),
  wa_message_id text unique,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
  error text check (error is null or char_length(error) <= 300),
  price_usd numeric(10, 4) not null default 0,
  attempts int not null default 0,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.whatsapp_messages (invitation_id, created_at desc);
create index whatsapp_messages_pending on public.whatsapp_messages (created_at)
  where status in ('queued', 'sending');
create trigger whatsapp_messages_touch before update on public.whatsapp_messages
  for each row execute function public.touch_updated_at();

-- ─── support chat ───────────────────────────────────────────────────────────────────────────────

-- One row per question to the support assistant (hashed user id or IP) — its rate limit.
create table public.support_rate_events (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index on public.support_rate_events (key_hash, created_at desc);

-- ─── contact form ───────────────────────────────────────────────────────────────────────────────

-- Messages from the site's contact form (also emailed to support when email is set up). Kept up to two
-- years (purge_expired).
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (char_length(phone) <= 40),
  topic text not null check (topic in ('support', 'billing', 'privacy', 'accessibility', 'business', 'other')),
  message text not null check (char_length(message) between 1 and 5000),
  locale text not null default 'he' check (locale in ('he', 'en')),
  user_id uuid references auth.users (id) on delete set null
);
create index on public.contact_messages (created_at desc);

-- ─── row level security: service role only ──────────────────────────────────────────────────────

alter table public.accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.billing_events enable row level security;
alter table public.invitation_guests enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.support_rate_events enable row level security;
alter table public.contact_messages enable row level security;
revoke all on public.accounts, public.credit_ledger, public.billing_events, public.invitation_guests,
  public.whatsapp_messages, public.support_rate_events, public.contact_messages from anon, authenticated;

-- ─── account functions ──────────────────────────────────────────────────────────────────────────

create function public.account_json(a public.accounts) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'userId', a.user_id,
    'fullName', a.full_name,
    'phone', a.phone,
    'plan', a.plan,
    'planStatus', a.plan_status,
    'planRenewsAt', a.plan_renews_at,
    'billingProvider', a.billing_provider,
    'hasSubscription', a.billing_subscription_id is not null,
    'credits', a.message_credits,
    'source', a.source,
    'createdAt', a.created_at,
    'activeInvitations', (
      select count(*) from public.invitations i where i.owner_id = a.user_id and i.status <> 'archived'
    )
  )
$$;

-- The user's account (created with the name from sign-up the first time). null for an unknown user.
create function public.account_get(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    return null;
  end if;
  insert into public.accounts (user_id, full_name, source)
  select u.id,
         nullif(left(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), 120), ''),
         case when u.raw_app_meta_data->>'provider' = 'google' then 'google' else 'signup' end
  from auth.users u where u.id = p_user_id
  on conflict (user_id) do nothing;
  select * into v from public.accounts where user_id = p_user_id;
  return public.account_json(v);
end $$;

create function public.account_update(p_user_id uuid, p_full_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  perform public.account_get(p_user_id);
  update public.accounts set full_name = nullif(left(trim(p_full_name), 120), ''), phone = p_phone
  where user_id = p_user_id returning * into v;
  if not found then
    return null;
  end if;
  return public.account_json(v);
end $$;

-- Applies one payment-provider event exactly once: the plan fields present in p_patch, and
-- p_credits (a credit pack or a plan's monthly grant). false = already applied.
create function public.billing_apply(
  p_event_id text,
  p_provider text,
  p_type text,
  p_user_id uuid,
  p_patch jsonb,
  p_credits int,
  p_payload jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_events (id, provider, type, user_id, payload)
  values (p_event_id, p_provider, p_type, p_user_id, coalesce(p_payload, '{}'))
  on conflict (id) do nothing;
  if not found then
    return false;
  end if;
  if p_user_id is null then
    return true;
  end if;
  perform public.account_get(p_user_id);
  update public.accounts set
    plan = coalesce(p_patch->>'plan', plan),
    plan_status = coalesce(p_patch->>'planStatus', plan_status),
    plan_renews_at = case when p_patch ? 'planRenewsAt' then (p_patch->>'planRenewsAt')::timestamptz
                          else plan_renews_at end,
    billing_provider = coalesce(p_patch->>'billingProvider', billing_provider),
    billing_customer_id = coalesce(p_patch->>'billingCustomerId', billing_customer_id),
    billing_subscription_id = case when p_patch ? 'billingSubscriptionId'
                                   then p_patch->>'billingSubscriptionId' else billing_subscription_id end,
    message_credits = message_credits + greatest(coalesce(p_credits, 0), 0)
  where user_id = p_user_id;
  if coalesce(p_credits, 0) > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref)
    values (p_user_id, p_credits, case when p_patch ? 'plan' then 'plan_grant' else 'purchase' end, p_event_id);
  end if;
  return true;
end $$;

-- The account paying through this provider subscription / customer (webhooks without our user id).
create function public.account_by_billing(p_provider text, p_subscription_id text, p_customer_id text)
returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.accounts
  where billing_provider = p_provider
    and ((p_subscription_id is not null and billing_subscription_id = p_subscription_id)
      or (p_customer_id is not null and billing_customer_id = p_customer_id))
  limit 1
$$;

-- Adds credits by hand (support) — the ledger says why.
create function public.credits_add(p_user_id uuid, p_count int, p_reason text, p_ref text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v int;
begin
  perform public.account_get(p_user_id);
  update public.accounts set message_credits = message_credits + p_count
  where user_id = p_user_id and p_count > 0
  returning message_credits into v;
  if found then
    insert into public.credit_ledger (user_id, delta, reason, ref) values (p_user_id, p_count, p_reason, p_ref);
  end if;
  return v;
end $$;

-- ─── guest functions ────────────────────────────────────────────────────────────────────────────

create function public.guest_json(g public.invitation_guests) returns jsonb
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

-- The guest list of one invitation, in the order it was added. null when it isn't the owner's.
create function public.owner_guests(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(public.guest_json(g) order by g.seq)
    from public.invitation_guests g
    where g.invitation_id = p_id
  ), '[]'::jsonb);
end $$;

-- Adds guests (rows already validated: name, E.164 phone or null, email, partySize, group, token).
-- A phone already on the list updates that guest instead (name, email, party size, group) — so an
-- updated spreadsheet can be imported again. Returns { added, updated, total } or null.
create function public.import_guests(p_id uuid, p_owner_id uuid, p_rows jsonb, p_max int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
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
    if r.phone is not null then
      update public.invitation_guests set
        name = r.name, email = coalesce(r.email, email),
        party_size = coalesce(r."partySize", party_size), group_name = coalesce(r."group", group_name)
      where invitation_id = p_id and phone = r.phone;
      if found then
        v_updated := v_updated + 1;
        continue;
      end if;
    end if;
    insert into public.invitation_guests (invitation_id, name, phone, email, party_size, group_name, token)
    values (p_id, r.name, r.phone, r.email, r."partySize", r."group", r.token);
    v_added := v_added + 1;
  end loop;
  select count(*) into v_total from public.invitation_guests where invitation_id = p_id;
  if v_total > p_max then
    raise exception 'guest_limit' using errcode = 'P0001';
  end if;
  return jsonb_build_object('added', v_added, 'updated', v_updated, 'total', v_total);
end $$;

-- Edits one guest. { ok: true, guest } | { ok: false, code: 'duplicate_phone' } | null.
create function public.update_guest(
  p_id uuid, p_owner_id uuid, p_guest_id uuid, p_name text, p_phone text, p_email text,
  p_party_size int, p_group text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitation_guests;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
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

-- Removes guests (their replies stay, unlinked). Returns how many, or null.
create function public.delete_guests(p_id uuid, p_owner_id uuid, p_guest_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  delete from public.invitation_guests where invitation_id = p_id and id = any(p_guest_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- The host sent the links themselves (their own WhatsApp, SMS…): marks them sent (a WhatsApp
-- status from the system's number is never downgraded). Returns how many, or null.
create function public.mark_guests_sent(p_id uuid, p_owner_id uuid, p_guest_ids uuid[], p_sent boolean)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  if p_sent then
    update public.invitation_guests set
      send_status = 'sent', send_channel = 'manual', sent_at = coalesce(sent_at, now()), send_error = null
    where invitation_id = p_id and id = any(p_guest_ids) and send_status in ('none', 'failed');
  else
    update public.invitation_guests set send_status = 'none', send_channel = null, sent_at = null
    where invitation_id = p_id and id = any(p_guest_ids) and send_channel = 'manual';
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- A guest opened their personal link: { name, phone, partySize } (and the visit is counted), or null
-- when the token isn't of this published invitation.
create function public.guest_open(p_slug text, p_token text) returns jsonb
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
  return jsonb_build_object('name', v.name, 'phone', v.phone, 'partySize', v.party_size);
end $$;

-- The guest a personal link belongs to (the RSVP route links the reply to them), or null.
create function public.guest_by_token(p_invitation_id uuid, p_token text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.invitation_guests where invitation_id = p_invitation_id and token = p_token
$$;

-- RSVP (replaces the P1 function, same signature): p_response.guest_id — resolved by the route from the
-- personal link — links the reply to that guest; a guest answering again (another browser, no edit
-- token) replaces their earlier reply instead of adding a second one.
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
  v_replaced boolean := false;
  v_guest uuid := nullif(p_response->>'guest_id', '')::uuid;
  v_new_hash text := p_new_token_hash;
begin
  if v_guest is not null and not exists (
    select 1 from public.invitation_guests where id = v_guest and invitation_id = p_invitation_id
  ) then
    v_guest := null;
  end if;

  if p_existing_token_hash is not null then
    select id into v_id from public.rsvp_responses
      where invitation_id = p_invitation_id and edit_token_hash = p_existing_token_hash
      for update;
  end if;
  if v_id is not null then
    v_new_hash := null; -- the browser keeps its token
  elsif v_guest is not null then
    select id into v_id from public.rsvp_responses
      where invitation_id = p_invitation_id and guest_id = v_guest
      order by updated_at desc limit 1
      for update;
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

-- The list card also counts the guest list.
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
      'guests', (select count(*) from public.invitation_guests g where g.invitation_id = i.id)
    ) order by i.updated_at desc), '[]'::jsonb)
  from public.invitations i
  left join lateral (
    select count(*) as responses,
           sum(case when x.attending then x.adults_count + x.children_count else 0 end) as attending
    from public.rsvp_responses x
    where x.invitation_id = i.id
  ) r on true
  where i.owner_id = p_owner_id
$$;

-- ─── WhatsApp functions ─────────────────────────────────────────────────────────────────────────

-- Queues one message per chosen guest with a phone (skipping guests already queued or sending),
-- paying one credit each. { ok: true, queued } | { ok: false, code: 'credits', needed, balance } |
-- { ok: false, code: 'nobody' } | null.
create function public.whatsapp_queue(p_id uuid, p_owner_id uuid, p_guest_ids uuid[], p_price_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  v_balance int;
begin
  if not exists (
    select 1 from public.invitations where id = p_id and owner_id = p_owner_id and status = 'published'
  ) then
    return null;
  end if;
  perform public.account_get(p_owner_id);
  select count(*) into n from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids) and g.phone is not null
    and g.send_status not in ('queued');
  if n = 0 then
    return jsonb_build_object('ok', false, 'code', 'nobody');
  end if;
  update public.accounts set message_credits = message_credits - n
  where user_id = p_owner_id and message_credits >= n
  returning message_credits into v_balance;
  if not found then
    select message_credits into v_balance from public.accounts where user_id = p_owner_id;
    return jsonb_build_object('ok', false, 'code', 'credits', 'needed', n, 'balance', coalesce(v_balance, 0));
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_owner_id, -n, 'whatsapp_send', p_id::text);
  insert into public.whatsapp_messages (invitation_id, guest_id, owner_id, to_phone, price_usd)
  select p_id, g.id, p_owner_id, g.phone, p_price_usd
  from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids) and g.phone is not null
    and g.send_status not in ('queued')
  order by g.seq;
  update public.invitation_guests set send_status = 'queued', send_channel = 'whatsapp', send_error = null
  where invitation_id = p_id and id = any(p_guest_ids) and phone is not null and send_status not in ('queued');
  return jsonb_build_object('ok', true, 'queued', n, 'balance', v_balance);
end $$;

-- Claims up to p_limit queued messages (of one invitation, or any when p_id is null) for sending —
-- with what the template needs. Messages stuck in 'sending' for 10 minutes (the sender died) are
-- claimed again, up to 3 tries; after that they fail and their credit goes back.
create function public.whatsapp_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_stuck uuid;
begin
  for v_stuck in
    select m.id from public.whatsapp_messages m
    where (p_id is null or m.invitation_id = p_id)
      and m.status = 'sending' and m.claimed_at < now() - interval '10 minutes' and m.attempts >= 3
    for update skip locked
  loop
    perform public.whatsapp_result(v_stuck, null, 'no answer from WhatsApp after 3 tries');
  end loop;
  with picked as (
    select m.id from public.whatsapp_messages m
    where (p_id is null or m.invitation_id = p_id)
      and (m.status = 'queued' or (m.status = 'sending' and m.claimed_at < now() - interval '10 minutes'))
    order by m.created_at
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

-- The API's answer for one message: its WhatsApp id (sent) or the error (failed — the credit goes
-- back to the host).
create function public.whatsapp_result(p_message_id uuid, p_wa_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.whatsapp_messages;
begin
  update public.whatsapp_messages set
    wa_message_id = p_wa_id,
    status = case when p_wa_id is null then 'failed' else 'sent' end,
    error = left(p_error, 300)
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
    update public.accounts set message_credits = message_credits + 1 where user_id = m.owner_id;
    insert into public.credit_ledger (user_id, delta, reason, ref)
    values (m.owner_id, 1, 'whatsapp_refund', m.id::text);
  end if;
end $$;

-- A temporary failure (Meta's rate limits, a timeout): back in the queue — at most 3 tries, then failed.
create function public.whatsapp_requeue(p_message_id uuid, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.whatsapp_messages where id = p_message_id and status = 'sending';
  if not found then
    return false;
  end if;
  if n >= 3 then
    perform public.whatsapp_result(p_message_id, null, p_error);
    return false;
  end if;
  update public.whatsapp_messages set status = 'queued', claimed_at = null, error = left(p_error, 300)
  where id = p_message_id;
  return true;
end $$;

-- How many of an invitation's messages are still waiting (queued or being sent).
create function public.whatsapp_pending(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.whatsapp_messages
  where invitation_id = p_id and status in ('queued', 'sending')
$$;

-- A status from Meta's webhook. Statuses only move forward (sent → delivered → read), since webhooks
-- can arrive out of order; 'failed' (e.g. not a WhatsApp number) is recorded unless already read.
create function public.whatsapp_status(p_wa_id text, p_status text, p_error text) returns boolean
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
  return true;
end $$;

-- ─── support chat ───────────────────────────────────────────────────────────────────────────────

-- Records a question; true while the key stays within p_limit in the window (a day of rows is kept).
create function public.support_rate_hit(p_key_hash text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from public.support_rate_events where key_hash = p_key_hash and created_at < now() - interval '1 day';
  insert into public.support_rate_events (key_hash) values (p_key_hash);
  select count(*) into n from public.support_rate_events
  where key_hash = p_key_hash and created_at > now() - make_interval(secs => p_window_seconds);
  return n <= p_limit;
end $$;

-- A contact-form message; returns its id.
create function public.contact_submit(
  p_name text, p_email text, p_phone text, p_topic text, p_message text, p_locale text, p_user_id uuid
) returns uuid
language sql security definer set search_path = '' as $$
  insert into public.contact_messages (name, email, phone, topic, message, locale, user_id)
  values (p_name, p_email, nullif(p_phone, ''), p_topic, p_message, p_locale, p_user_id)
  returning id
$$;

-- What the privacy policy promises about keeping data (run daily with the RSVP summary): rate-limit
-- rows after a day, a reply's hashed IP after 30 days, contact messages after two years.
create function public.purge_expired() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
  c int;
  d int;
begin
  delete from public.rsvp_rate_events where created_at < now() - interval '1 day';
  get diagnostics a = row_count;
  delete from public.support_rate_events where created_at < now() - interval '1 day';
  get diagnostics b = row_count;
  update public.rsvp_responses set ip_hash = null
  where ip_hash is not null and created_at < now() - interval '30 days';
  get diagnostics c = row_count;
  delete from public.contact_messages where created_at < now() - interval '2 years';
  get diagnostics d = row_count;
  return jsonb_build_object('rsvpRate', a, 'supportRate', b, 'ipHashes', c, 'contact', d);
end $$;

-- ─── partner provisioning ───────────────────────────────────────────────────────────────────────

-- The user with this email (the partner API finds before it creates). null when there is none.
create function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

-- Links a user to the partner that opened it (and keeps the name / phone the partner sent).
create function public.account_link_partner(
  p_user_id uuid, p_source text, p_external_id text, p_full_name text, p_phone text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  perform public.account_get(p_user_id);
  update public.accounts set
    source = case when source = 'signup' then p_source else source end,
    external_id = coalesce(p_external_id, external_id),
    full_name = coalesce(nullif(left(trim(p_full_name), 120), ''), full_name),
    phone = coalesce(p_phone, phone)
  where user_id = p_user_id returning * into v;
  return public.account_json(v);
end $$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.account_json(public.accounts)',
    'public.account_get(uuid)',
    'public.account_update(uuid, text, text)',
    'public.billing_apply(text, text, text, uuid, jsonb, int, jsonb)',
    'public.account_by_billing(text, text, text)',
    'public.credits_add(uuid, int, text, text)',
    'public.guest_json(public.invitation_guests)',
    'public.owner_guests(uuid, uuid)',
    'public.import_guests(uuid, uuid, jsonb, int)',
    'public.update_guest(uuid, uuid, uuid, text, text, text, int, text)',
    'public.delete_guests(uuid, uuid, uuid[])',
    'public.mark_guests_sent(uuid, uuid, uuid[], boolean)',
    'public.guest_open(text, text)',
    'public.guest_by_token(uuid, text)',
    'public.whatsapp_queue(uuid, uuid, uuid[], numeric)',
    'public.whatsapp_claim(uuid, int)',
    'public.whatsapp_result(uuid, text, text)',
    'public.whatsapp_status(text, text, text)',
    'public.whatsapp_requeue(uuid, text)',
    'public.whatsapp_pending(uuid)',
    'public.support_rate_hit(text, int, int)',
    'public.contact_submit(text, text, text, text, text, text, uuid)',
    'public.purge_expired()',
    'public.user_id_by_email(text)',
    'public.account_link_partner(uuid, text, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
-- submit_rsvp and owner_invitations keep their P1/P2 grants (create or replace keeps privileges)
