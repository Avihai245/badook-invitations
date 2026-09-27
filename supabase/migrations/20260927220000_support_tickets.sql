-- Support tickets: a customer writes to the team — from the app's "Support" page (/app/support), from
-- the assistant ("talk to a person", the conversation attached) or through the site's contact form (a
-- visitor too) — and the team answers from the admin console (/app/admin/support).
--
-- A ticket's status: 'open' (waiting for the team), 'waiting' (the team answered, waiting for the
-- customer), 'closed'. The customer's reply opens it again (a closed one too); the team's public reply
-- sets 'waiting'; a team note (internal) is never shown to the customer and changes nothing they see.
-- Answered tickets the customer doesn't come back to close by themselves after 14 days; closed tickets
-- and their messages are erased two years after closing, and tickets the team deleted (spam) 30 days
-- after (support_maintenance, the daily run — the privacy policy says so).
--
-- The customer's functions take the verified user (p_user_id) and only touch their own tickets; the
-- console's take the acting staff member (p_actor) and check their role first — support.view to read,
-- support.reply to answer, note, change the status, the priority or who it is assigned to — record each
-- change (admin_log) and hide contact details from roles without users.pii. Service role only.

-- ─── tables ────────────────────────────────────────────────────────────────────────────────────

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  -- the ticket's number for people ("#1042"): in emails, on the phone, in the console's search
  number bigint generated always as identity (start with 1001) unique,
  -- the customer's account (null: a visitor from the contact form, or an account since deleted)
  user_id uuid references auth.users (id) on delete set null,
  -- what the contact form was sent with (a visitor's only way back): the name, the address the team's
  -- answers go to, an optional phone
  name text check (name is null or char_length(name) between 1 and 120),
  email text check (email is null or (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+$')),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  subject text not null check (char_length(subject) between 1 and 200),
  category text not null
    check (category in ('support', 'billing', 'privacy', 'accessibility', 'business', 'bug', 'other')),
  status text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  -- the staff member handling it
  assigned_to uuid references auth.users (id) on delete set null,
  source text not null check (source in ('app', 'chat', 'contact')),
  -- the customer's own invitation it is about
  invitation_id uuid references public.invitations (id) on delete set null,
  -- the customer's language (the team's emails to them)
  locale text not null default 'he' check (locale in ('he', 'en')),
  -- the conversation with the assistant the customer attached ("talk to a person"): [{role, content}]
  chat jsonb check (
    chat is null
    or (jsonb_typeof(chat) = 'array' and jsonb_array_length(chat) between 1 and 20 and pg_column_size(chat) <= 65536)
  ),
  -- the Realtime channel of the customer's ticket page (random; its hints carry no data)
  channel text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (channel ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the customer's last message, the team's last public answer, anything at all (the inbox's order)
  last_customer_at timestamptz,
  last_team_at timestamptz,
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  -- when the customer last looked at it in the app (the "new answer" mark)
  customer_seen_at timestamptz,
  -- deleted by the team (spam): gone from every list, erased 30 days later
  deleted_at timestamptz,
  check ((status = 'closed') = (closed_at is not null))
);
create index support_tickets_user on public.support_tickets (user_id, last_activity_at desc)
  where deleted_at is null;
create index support_tickets_inbox on public.support_tickets (status, last_activity_at desc)
  where deleted_at is null;
create index support_tickets_assigned on public.support_tickets (assigned_to);
create index support_tickets_invitation on public.support_tickets (invitation_id);
create index support_tickets_created on public.support_tickets (created_at desc);
create index support_tickets_closed on public.support_tickets (closed_at) where status = 'closed';
create index support_tickets_deleted on public.support_tickets (deleted_at) where deleted_at is not null;
create index support_tickets_email on public.support_tickets (lower(email)) where email is not null;

create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author text not null check (author in ('customer', 'staff', 'system')),
  -- the customer's or the staff member's account (null: a visitor, the system, an account since deleted)
  author_id uuid references auth.users (id) on delete set null,
  -- the staff member who wrote it or did it, also after their account is gone
  author_email text check (author_email is null or char_length(author_email) <= 254),
  body text check (body is null or char_length(body) between 1 and 8000),
  -- a team note: the customer never sees it
  internal boolean not null default false,
  -- a line of the system: what happened, and its details
  event text check (event is null or event in ('closed', 'reopened', 'status', 'assigned', 'priority')),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 2048),
  -- a team answer's email to the customer (null: none was due)
  emailed text check (emailed is null or emailed in ('sent', 'failed')),
  created_at timestamptz not null default now(),
  check ((author = 'system') = (event is not null)),
  check (author = 'system' or body is not null),
  check (not internal or author <> 'customer')
);
create index support_messages_ticket on public.support_messages (ticket_id, id);
create index support_messages_author on public.support_messages (author_id);
create index support_messages_answers on public.support_messages (created_at desc)
  where author = 'staff' and not internal;

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;

-- ─── helpers ───────────────────────────────────────────────────────────────────────────────────

-- d***@gmail.com — an address for roles without users.pii.
create function public.support_mask_email(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p is null then null
    when position('@' in p) < 2 then '***'
    else left(p, 1) || '***' || substr(p, position('@' in p))
  end
$$;

-- +972 5X-XXX-X123 — a phone number for roles without users.pii.
create function public.support_mask_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p is null then null
    when p like '+972%' and char_length(p) >= 12 then '+972 ' || substr(p, 5, 1) || 'X-XXX-X' || right(p, 3)
    when char_length(p) > 6 then left(p, 3) || repeat('X', char_length(p) - 6) || right(p, 3)
    else '***'
  end
$$;

-- "נועה & איתי": an invitation's hosts in its own language (null when it has none yet).
create function public.support_invitation_title(i public.invitations) returns text
language sql stable set search_path = '' as $$
  select nullif(concat_ws(' & ',
    nullif(trim(i.draft #>> array['hosts', 'primary', coalesce(i.draft ->> 'defaultLocale', 'he')]), ''),
    nullif(trim(i.draft #>> array['hosts', 'secondary', coalesce(i.draft ->> 'defaultLocale', 'he')]), '')
  ), '')
$$;

-- A ticket as its customer sees it: never a team note, never who on the team wrote. p_full: with the
-- conversation, the attached chat and the page's channel.
create function public.support_ticket_view(t public.support_tickets, p_full boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'number', t.number,
    'subject', t.subject,
    'category', t.category,
    'status', t.status,
    'source', t.source,
    'createdAt', t.created_at,
    'lastActivityAt', greatest(t.created_at, t.last_customer_at, t.last_team_at, t.closed_at),
    'closedAt', t.closed_at,
    'unread', t.last_team_at is not null and (t.customer_seen_at is null or t.last_team_at > t.customer_seen_at),
    'invitation', (
      select jsonb_build_object('id', i.id, 'slug', i.slug, 'title', public.support_invitation_title(i))
      from public.invitations i
      where i.id = t.invitation_id and i.owner_id = t.user_id
    )
  ) || case when p_full then jsonb_build_object(
    'channel', t.channel,
    'chat', t.chat,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'author', case m.author when 'staff' then 'team' else m.author end,
        'body', m.body,
        'event', m.event,
        'by', m.meta ->> 'by',
        'at', m.created_at
      ) order by m.id)
      from public.support_messages m
      where m.ticket_id = t.id and not m.internal
    ), '[]'::jsonb)
  ) else '{}'::jsonb end
$$;

-- A ticket in the console's lists; contact details masked unless p_pii.
create function public.admin_support_item(t public.support_tickets, p_pii boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'number', t.number,
    'subject', t.subject,
    'category', t.category,
    'status', t.status,
    'priority', t.priority,
    'source', t.source,
    'locale', t.locale,
    'createdAt', t.created_at,
    'lastActivityAt', t.last_activity_at,
    'lastCustomerAt', t.last_customer_at,
    'lastTeamAt', t.last_team_at,
    'closedAt', t.closed_at,
    -- open: since the customer's last word; waiting: since the team's answer
    'waitingSince', case t.status
      when 'open' then coalesce(t.last_customer_at, t.created_at)
      when 'waiting' then t.last_team_at
    end,
    'customer', jsonb_build_object(
      -- account · visitor (the contact form, no account) · gone (the account was deleted)
      'kind', case when u.id is not null then 'account' when t.email is not null then 'visitor' else 'gone' end,
      'userId', u.id,
      'name', coalesce(nullif(trim(a.full_name), ''), t.name),
      'email', case
        when p_pii then coalesce(t.email, lower(u.email))
        else public.support_mask_email(coalesce(t.email, lower(u.email)))
      end
    ),
    'assignee', (
      select jsonb_build_object('userId', s.id, 'email', lower(s.email))
      from auth.users s where s.id = t.assigned_to
    )
  )
  from (select 1) one
  left join auth.users u on u.id = t.user_id
  left join public.accounts a on a.user_id = t.user_id
$$;

-- A system line on a ticket (closed, reopened, …); p_internal: the team's eyes only.
create function public.support_event(
  p_ticket_id uuid, p_event text, p_meta jsonb, p_actor uuid, p_internal boolean
) returns void
language sql security definer set search_path = '' as $$
  insert into public.support_messages (ticket_id, author, author_id, author_email, event, meta, internal)
  values (
    p_ticket_id, 'system', p_actor, (select lower(email) from auth.users where id = p_actor), p_event,
    coalesce(p_meta, '{}'::jsonb), p_internal
  )
$$;

-- A subject, a category and a message as the tickets take them (raises the reason when not).
create function public.support_check(p_subject text, p_category text, p_body text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_subject is null or char_length(trim(p_subject)) not between 1 and 200 then
    raise exception 'invalid_subject' using errcode = 'P0001';
  end if;
  if p_category is null
    or p_category not in ('support', 'billing', 'privacy', 'accessibility', 'business', 'bug', 'other') then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 8000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
end $$;

-- ─── the customer (the app) ────────────────────────────────────────────────────────────────────

-- A new ticket from the app ('app') or from the assistant ('chat', with its conversation). The
-- invitation, when given, must be the customer's. The ticket as the customer sees it; null for an
-- unknown user.
create function public.support_ticket_open(
  p_user_id uuid, p_subject text, p_category text, p_body text, p_invitation_id uuid, p_locale text,
  p_source text, p_chat jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.support_tickets;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    return null;
  end if;
  perform public.support_check(p_subject, p_category, p_body);
  if p_source is null or p_source not in ('app', 'chat') then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;
  if p_locale is null or p_locale not in ('he', 'en') then
    raise exception 'invalid_locale' using errcode = 'P0001';
  end if;
  if (p_source = 'chat') <> (p_chat is not null) or (p_chat is not null and (
    jsonb_typeof(p_chat) <> 'array'
    or jsonb_array_length(p_chat) not between 1 and 20
    or exists (
      select 1 from jsonb_array_elements(p_chat) e
      where jsonb_typeof(e) <> 'object'
        or coalesce(e ->> 'role', '') not in ('user', 'assistant')
        or jsonb_typeof(e -> 'content') is distinct from 'string'
        or char_length(e ->> 'content') not between 1 and 2000
    )
  )) then
    raise exception 'invalid_chat' using errcode = 'P0001';
  end if;
  if p_invitation_id is not null and not exists (
    select 1 from public.invitations where id = p_invitation_id and owner_id = p_user_id
  ) then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;
  insert into public.support_tickets (
    user_id, subject, category, source, invitation_id, locale, chat,
    last_customer_at, last_activity_at, customer_seen_at
  ) values (
    p_user_id, trim(p_subject), p_category, p_source, p_invitation_id, p_locale, p_chat, now(), now(), now()
  ) returning * into v;
  insert into public.support_messages (ticket_id, author, author_id, body)
  values (v.id, 'customer', p_user_id, trim(p_body));
  return public.support_ticket_view(v, true);
end $$;

-- A ticket from the site's contact form: a visitor's (p_user_id null — the team's answers reach them
-- by email only) or a signed-in customer's (theirs in the app too). { id, number }.
create function public.support_contact_ticket(
  p_user_id uuid, p_name text, p_email text, p_phone text, p_subject text, p_category text, p_body text,
  p_locale text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select id from auth.users where id = p_user_id);
  v_email text := lower(trim(coalesce(p_email, '')));
  v public.support_tickets;
begin
  perform public.support_check(p_subject, p_category, p_body);
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' or char_length(v_email) not between 3 and 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if nullif(p_phone, '') is not null and p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;
  if p_locale is null or p_locale not in ('he', 'en') then
    raise exception 'invalid_locale' using errcode = 'P0001';
  end if;
  insert into public.support_tickets (
    user_id, name, email, phone, subject, category, source, locale,
    last_customer_at, last_activity_at, customer_seen_at
  ) values (
    v_user, trim(p_name), v_email, nullif(p_phone, ''), trim(p_subject), p_category, 'contact', p_locale,
    now(), now(), now()
  ) returning * into v;
  insert into public.support_messages (ticket_id, author, author_id, body)
  values (v.id, 'customer', v_user, trim(p_body));
  return jsonb_build_object('id', v.id, 'number', v.number);
end $$;

-- The customer's tickets, the latest activity first (without the conversations).
create function public.support_ticket_list(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.support_ticket_view(t, false)
    order by greatest(t.created_at, t.last_customer_at, t.last_team_at, t.closed_at) desc, t.number desc), '[]'::jsonb)
  from (
    select * from public.support_tickets
    where user_id = p_user_id and deleted_at is null
    order by greatest(created_at, last_customer_at, last_team_at, closed_at) desc
    limit 200
  ) t
$$;

-- One of the customer's tickets with its conversation (null: not theirs). p_seen: they are looking at
-- it — the team's answers are no longer new.
create function public.support_ticket_get(p_user_id uuid, p_id uuid, p_seen boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.support_tickets;
begin
  select * into v from public.support_tickets
  where id = p_id and user_id = p_user_id and deleted_at is null;
  if not found then
    return null;
  end if;
  if p_seen then
    update public.support_tickets set customer_seen_at = now() where id = p_id returning * into v;
  end if;
  return public.support_ticket_view(v, true);
end $$;

-- The customer answers: a closed ticket opens again, an answered one goes back to the team. null: not
-- theirs.
create function public.support_ticket_reply(p_user_id uuid, p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.support_tickets;
begin
  if p_body is null or char_length(trim(p_body)) not between 1 and 8000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  select * into v from public.support_tickets
  where id = p_id and user_id = p_user_id and deleted_at is null
  for update;
  if not found then
    return null;
  end if;
  if v.status = 'closed' then
    perform public.support_event(p_id, 'reopened', jsonb_build_object('by', 'customer'), null, false);
  end if;
  insert into public.support_messages (ticket_id, author, author_id, body)
  values (p_id, 'customer', p_user_id, trim(p_body));
  update public.support_tickets set
    status = 'open', closed_at = null, last_customer_at = now(), last_activity_at = now(),
    customer_seen_at = now(), updated_at = now()
  where id = p_id
  returning * into v;
  return public.support_ticket_view(v, true);
end $$;

-- The customer closes their ticket (writing again opens it). null: not theirs.
create function public.support_ticket_close(p_user_id uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.support_tickets;
begin
  select * into v from public.support_tickets
  where id = p_id and user_id = p_user_id and deleted_at is null
  for update;
  if not found then
    return null;
  end if;
  if v.status <> 'closed' then
    perform public.support_event(p_id, 'closed', jsonb_build_object('by', 'customer'), null, false);
    update public.support_tickets set
      status = 'closed', closed_at = now(), last_activity_at = now(), customer_seen_at = now(),
      updated_at = now()
    where id = p_id
    returning * into v;
  end if;
  return public.support_ticket_view(v, true);
end $$;

-- The customer's tickets with an answer they haven't seen (the app's menu).
create function public.support_unread(p_user_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.support_tickets
  where user_id = p_user_id and deleted_at is null and last_team_at is not null
    and (customer_seen_at is null or last_team_at > customer_seen_at)
$$;

-- ─── the server's own steps (emails, live pages) ───────────────────────────────────────────────

-- Who hears about a ticket, for the server's emails after an action: the customer's address (the
-- form's, else the account's), first name and language, and the page's channel. null: no such ticket.
create function public.support_notify_target(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'number', t.number,
    'subject', t.subject,
    'category', t.category,
    'source', t.source,
    'status', t.status,
    'locale', t.locale,
    'channel', t.channel,
    'userId', u.id,
    'email', coalesce(t.email, lower(u.email)),
    'firstName', nullif(split_part(trim(coalesce(nullif(trim(a.full_name), ''), t.name, '')), ' ', 1), '')
  )
  from public.support_tickets t
  left join auth.users u on u.id = t.user_id
  left join public.accounts a on a.user_id = t.user_id
  where t.id = p_id and t.deleted_at is null
$$;

-- Whether a team answer's email reached the customer's mail service.
create function public.support_message_emailed(p_message_id bigint, p_ok boolean) returns boolean
language sql security definer set search_path = '' as $$
  update public.support_messages
  set emailed = case when p_ok then 'sent' else 'failed' end
  where id = p_message_id and author = 'staff' and not internal
  returning true
$$;

-- ─── the console ───────────────────────────────────────────────────────────────────────────────

-- The inbox: one tab (open / waiting / closed / all), filtered (p_scope: all / mine / unassigned; a
-- category; a priority; a search in the subject, the customer's name, their address — for roles with
-- users.pii — or the number), the latest activity first, a page at a time; with each tab's count under
-- the same filters. { items, counts: { open, waiting, closed, all }, total }.
create function public.admin_support_list(
  p_actor uuid, p_status text, p_scope text, p_category text, p_priority text, p_query text,
  p_limit int, p_offset int
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  v_status text := coalesce(p_status, 'all');
  v_scope text := coalesce(p_scope, 'all');
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_like text;
  v_number bigint;
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_result jsonb;
begin
  if v_status not in ('open', 'waiting', 'closed', 'all') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if v_scope not in ('all', 'mine', 'unassigned') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;
  if v_q is not null then
    v_q := left(v_q, 100);
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    if ltrim(v_q, '#') ~ '^[0-9]{1,15}$' then
      v_number := ltrim(v_q, '#')::bigint;
    end if;
  end if;
  with base as (
    select t.*
    from public.support_tickets t
    left join auth.users u on u.id = t.user_id
    left join public.accounts a on a.user_id = t.user_id
    where t.deleted_at is null
      and (v_scope = 'all'
        or (v_scope = 'mine' and t.assigned_to = p_actor)
        or (v_scope = 'unassigned' and t.assigned_to is null))
      and (p_category is null or t.category = p_category)
      and (p_priority is null or t.priority = p_priority)
      and (v_q is null
        or t.number = v_number
        or t.subject ilike v_like
        or coalesce(nullif(trim(a.full_name), ''), t.name, '') ilike v_like
        or (v_pii and coalesce(t.email, u.email, '') ilike v_like))
  ),
  page as (
    select * from base
    where v_status = 'all' or status = v_status
    order by last_activity_at desc, number desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(public.admin_support_item(p, v_pii) order by p.last_activity_at desc, p.number desc)
      from page p
    ), '[]'::jsonb),
    'counts', (
      select jsonb_build_object(
        'open', count(*) filter (where status = 'open'),
        'waiting', count(*) filter (where status = 'waiting'),
        'closed', count(*) filter (where status = 'closed'),
        'all', count(*)
      ) from base
    ),
    'total', (select count(*) from base where v_status = 'all' or status = v_status)
  ) into v_result;
  return v_result;
end $$;

-- One ticket: the conversation with the team's notes and what happened (who assigned, closed…), the
-- customer (their account: plan, credits, invitations, since when, where from — contact details masked
-- unless the role has users.pii), the invitation it is about, the assistant's conversation attached,
-- and the team members who may answer (to assign it). null: no such ticket.
create function public.admin_support_get(p_actor uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  t public.support_tickets;
begin
  select * into t from public.support_tickets where id = p_id and deleted_at is null;
  if not found then
    return null;
  end if;
  return public.admin_support_item(t, v_pii) || jsonb_build_object(
    'chat', t.chat,
    'invitation', (
      select jsonb_build_object(
        'id', i.id, 'slug', i.slug, 'status', i.status, 'title', public.support_invitation_title(i)
      )
      from public.invitations i where i.id = t.invitation_id
    ),
    'customer', (
      select jsonb_build_object(
        'kind', case when u.id is not null then 'account' when t.email is not null then 'visitor' else 'gone' end,
        'userId', u.id,
        'name', coalesce(nullif(trim(a.full_name), ''), t.name),
        'email', case
          when v_pii then coalesce(t.email, lower(u.email))
          else public.support_mask_email(coalesce(t.email, lower(u.email)))
        end,
        'phone', case
          when v_pii then coalesce(t.phone, a.phone)
          else public.support_mask_phone(coalesce(t.phone, a.phone))
        end,
        'plan', case when u.id is not null then coalesce(a.plan, 'free') end,
        'planStatus', a.plan_status,
        'credits', case when u.id is not null then coalesce(a.message_credits, 0) end,
        'invitations', case when u.id is not null then (
          select count(*) from public.invitations i where i.owner_id = u.id
        ) end,
        'joinedAt', u.created_at,
        'source', case when u.id is not null then coalesce(a.source, 'signup') end,
        -- this customer's tickets, this one included
        'tickets', (
          select count(*) from public.support_tickets x
          where x.deleted_at is null
            and ((u.id is not null and x.user_id = u.id)
              or (u.id is null and t.email is not null and lower(x.email) = lower(t.email)))
        )
      )
      from (select 1) one
      left join auth.users u on u.id = t.user_id
      left join public.accounts a on a.user_id = t.user_id
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'author', m.author,
        'authorEmail', case when m.author <> 'customer' then m.author_email end,
        'body', m.body,
        'internal', m.internal,
        'event', m.event,
        'meta', m.meta,
        'emailed', m.emailed,
        'at', m.created_at
      ) order by m.id)
      from public.support_messages m where m.ticket_id = p_id
    ), '[]'::jsonb),
    'agents', coalesce((
      select jsonb_agg(jsonb_build_object('userId', u.id, 'email', s.email, 'role', s.role) order by s.email)
      from public.admin_staff s
      join auth.users u on lower(u.email) = s.email
      where s.removed_at is null
        and public.admin_can(s.role, 'support.reply')
        and u.email_confirmed_at is not null
        and coalesce(u.raw_app_meta_data ->> 'provisioned_by', '') = ''
        and (u.banned_until is null or u.banned_until <= now())
        and u.deleted_at is null
    ), '[]'::jsonb)
  );
end $$;

-- The team answers the customer (they see it in the app and get it by email): the ticket waits for
-- them — or, p_close, is closed. A closed ticket answered opens again. { messageId, status }.
create function public.admin_support_reply(p_actor uuid, p_id uuid, p_body text, p_close boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
  v_message bigint;
  v_status text := case when coalesce(p_close, false) then 'closed' else 'waiting' end;
begin
  perform public.admin_require(p_actor, 'support.reply');
  if p_body is null or char_length(trim(p_body)) not between 1 and 8000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  select * into t from public.support_tickets where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- an account since deleted, without an address: nobody would get it
  if t.email is null and not exists (select 1 from auth.users where id = t.user_id) then
    raise exception 'no_recipient' using errcode = 'P0001';
  end if;
  if t.status = 'closed' then
    perform public.support_event(p_id, 'reopened', jsonb_build_object('by', 'team'), p_actor, false);
  end if;
  insert into public.support_messages (ticket_id, author, author_id, author_email, body)
  values (p_id, 'staff', p_actor, (select lower(email) from auth.users where id = p_actor), trim(p_body))
  returning id into v_message;
  if v_status = 'closed' then
    perform public.support_event(p_id, 'closed', jsonb_build_object('by', 'team'), p_actor, false);
  end if;
  update public.support_tickets set
    status = v_status,
    closed_at = case when v_status = 'closed' then now() end,
    last_team_at = now(), last_activity_at = now(), updated_at = now()
  where id = p_id;
  perform public.admin_log(p_actor, 'support.reply', 'ticket', p_id::text, jsonb_build_object(
    'number', t.number, 'close', v_status = 'closed', 'before', t.status
  ));
  return jsonb_build_object('messageId', v_message, 'status', v_status);
end $$;

-- A note for the team only: the customer sees nothing of it. { messageId }.
create function public.admin_support_note(p_actor uuid, p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
  v_message bigint;
begin
  perform public.admin_require(p_actor, 'support.reply');
  if p_body is null or char_length(trim(p_body)) not between 1 and 8000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  select * into t from public.support_tickets where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into public.support_messages (ticket_id, author, author_id, author_email, body, internal)
  values (p_id, 'staff', p_actor, (select lower(email) from auth.users where id = p_actor), trim(p_body), true)
  returning id into v_message;
  update public.support_tickets set last_activity_at = now(), updated_at = now() where id = p_id;
  perform public.admin_log(p_actor, 'support.note', 'ticket', p_id::text, jsonb_build_object('number', t.number));
  return jsonb_build_object('messageId', v_message);
end $$;

-- The status by hand: closing (the customer sees it closed), opening a closed one again (they see
-- that too), or moving between waiting for the team and for the customer. { status, changed }.
create function public.admin_support_status(p_actor uuid, p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
begin
  perform public.admin_require(p_actor, 'support.reply');
  if p_status is null or p_status not in ('open', 'waiting', 'closed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into t from public.support_tickets where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if t.status = p_status then
    return jsonb_build_object('status', p_status, 'changed', false);
  end if;
  if p_status = 'closed' then
    perform public.support_event(p_id, 'closed', jsonb_build_object('by', 'team'), p_actor, false);
  elsif t.status = 'closed' then
    perform public.support_event(p_id, 'reopened', jsonb_build_object('by', 'team', 'to', p_status), p_actor, false);
  else
    perform public.support_event(p_id, 'status', jsonb_build_object('from', t.status, 'to', p_status), p_actor, true);
  end if;
  update public.support_tickets set
    status = p_status,
    closed_at = case when p_status = 'closed' then now() end,
    last_activity_at = now(), updated_at = now()
  where id = p_id;
  perform public.admin_log(p_actor, 'support.status', 'ticket', p_id::text, jsonb_build_object(
    'number', t.number, 'from', t.status, 'to', p_status
  ));
  return jsonb_build_object('status', p_status, 'changed', true);
end $$;

-- Normal or high — the team's own mark (the customer doesn't see it). { priority, changed }.
create function public.admin_support_priority(p_actor uuid, p_id uuid, p_priority text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
begin
  perform public.admin_require(p_actor, 'support.reply');
  if p_priority is null or p_priority not in ('normal', 'high') then
    raise exception 'invalid_priority' using errcode = 'P0001';
  end if;
  select * into t from public.support_tickets where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if t.priority = p_priority then
    return jsonb_build_object('priority', p_priority, 'changed', false);
  end if;
  perform public.support_event(p_id, 'priority', jsonb_build_object('from', t.priority, 'to', p_priority), p_actor, true);
  update public.support_tickets set priority = p_priority, updated_at = now() where id = p_id;
  perform public.admin_log(p_actor, 'support.priority', 'ticket', p_id::text, jsonb_build_object(
    'number', t.number, 'from', t.priority, 'to', p_priority
  ));
  return jsonb_build_object('priority', p_priority, 'changed', true);
end $$;

-- Who handles it: a team member who may answer (null: nobody). The customer doesn't see it.
-- { assignee: { userId, email } | null, changed }.
create function public.admin_support_assign(p_actor uuid, p_id uuid, p_assignee uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
  v_role text;
  v_to text;
  v_from text;
begin
  perform public.admin_require(p_actor, 'support.reply');
  if p_assignee is not null then
    v_role := public.admin_role_of(p_assignee);
    if v_role is null or not public.admin_can(v_role, 'support.reply') then
      raise exception 'invalid_assignee' using errcode = 'P0001';
    end if;
    v_to := (select lower(email) from auth.users where id = p_assignee);
  end if;
  select * into t from public.support_tickets where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if t.assigned_to is not distinct from p_assignee then
    return jsonb_build_object(
      'assignee', case when p_assignee is not null then jsonb_build_object('userId', p_assignee, 'email', v_to) end,
      'changed', false
    );
  end if;
  v_from := (select lower(email) from auth.users where id = t.assigned_to);
  perform public.support_event(p_id, 'assigned', jsonb_build_object('from', v_from, 'to', v_to), p_actor, true);
  update public.support_tickets set assigned_to = p_assignee, updated_at = now() where id = p_id;
  perform public.admin_log(p_actor, 'support.assign', 'ticket', p_id::text, jsonb_build_object(
    'number', t.number, 'from', v_from, 'to', v_to
  ));
  return jsonb_build_object(
    'assignee', case when p_assignee is not null then jsonb_build_object('userId', p_assignee, 'email', v_to) end,
    'changed', true
  );
end $$;

-- Deletes a ticket (spam, abuse): gone from the inbox and the customer's list, erased 30 days later.
-- The reason goes to the record of actions. false: no such ticket.
create function public.admin_support_delete(p_actor uuid, p_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.admin_require(p_actor, 'support.reply');
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;
  select * into t from public.support_tickets where id = p_id and deleted_at is null for update;
  if not found then
    return false;
  end if;
  update public.support_tickets set deleted_at = now(), updated_at = now() where id = p_id;
  perform public.admin_log(p_actor, 'support.delete', 'ticket', p_id::text, jsonb_build_object(
    'number', t.number, 'status', t.status, 'source', t.source, 'reason', v_reason
  ));
  return true;
end $$;

-- The inbox in numbers (the console's overview and menu): waiting for the team, waiting for the
-- customer, open and unassigned, the oldest one waiting for the team, opened today (Israel time), and
-- the median time to the team's first answer over the last 30 days (minutes; null: none answered).
create function public.admin_support_summary(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  v_result jsonb;
begin
  perform public.admin_require(p_actor, 'support.view');
  select jsonb_build_object(
    'open', count(*) filter (where status = 'open'),
    'waiting', count(*) filter (where status = 'waiting'),
    'unassigned', count(*) filter (where status = 'open' and assigned_to is null),
    'highOpen', count(*) filter (where status = 'open' and priority = 'high'),
    'oldestOpenAt', min(coalesce(last_customer_at, created_at)) filter (where status = 'open'),
    'openedToday', count(*) filter (where created_at >= v_today)
  ) into v_result
  from public.support_tickets
  where deleted_at is null and (status <> 'closed' or created_at >= v_today);
  return v_result || jsonb_build_object('firstReplyMedianMinutes', (
    select round(percentile_cont(0.5) within group (
      order by extract(epoch from (f.first_at - t.created_at)) / 60
    ))::int
    from public.support_tickets t
    cross join lateral (
      select min(m.created_at) as first_at from public.support_messages m
      where m.ticket_id = t.id and m.author = 'staff' and not m.internal
    ) f
    where t.deleted_at is null and t.created_at > now() - interval '30 days' and f.first_at is not null
  ));
end $$;

-- The console's live feed: tickets opened and the team's answers, newest first — the subject and the
-- customer's first name only.
create function public.admin_support_activity(p_actor uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  perform public.admin_require(p_actor, 'support.view');
  return coalesce((
    select jsonb_agg(x.item order by x.at desc)
    from (
      select * from (
        select t.created_at as at, jsonb_build_object(
          'id', 'ticket_opened:' || t.id,
          'kind', 'ticket_opened',
          'at', t.created_at,
          'actor', nullif(split_part(trim(coalesce(nullif(trim(a.full_name), ''), t.name, '')), ' ', 1), ''),
          'subject', t.subject,
          'amount', null,
          'userId', t.user_id,
          'invitationId', t.invitation_id,
          'ticketId', t.id
        ) as item
        from public.support_tickets t
        left join public.accounts a on a.user_id = t.user_id
        where t.deleted_at is null
        order by t.created_at desc
        limit v_limit
      ) opened
      union all
      select * from (
        select m.created_at as at, jsonb_build_object(
          'id', 'ticket_reply:' || m.id,
          'kind', 'ticket_reply',
          'at', m.created_at,
          'actor', nullif(split_part(trim(coalesce(nullif(trim(a.full_name), ''), t.name, '')), ' ', 1), ''),
          'subject', t.subject,
          'amount', null,
          'userId', t.user_id,
          'invitationId', t.invitation_id,
          'ticketId', t.id
        ) as item
        from public.support_messages m
        join public.support_tickets t on t.id = m.ticket_id
        left join public.accounts a on a.user_id = t.user_id
        where m.author = 'staff' and not m.internal and t.deleted_at is null
        order by m.created_at desc
        limit v_limit
      ) answered
      order by at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end $$;

-- A user's tickets, on their page in the console (newest activity first).
create function public.admin_support_user_tickets(p_actor uuid, p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
begin
  return coalesce((
    select jsonb_agg(public.admin_support_item(t, v_pii) order by t.last_activity_at desc)
    from (
      select * from public.support_tickets
      where user_id = p_user_id and deleted_at is null
      order by last_activity_at desc
      limit 50
    ) t
  ), '[]'::jsonb);
end $$;

-- ─── housekeeping (the daily job) ──────────────────────────────────────────────────────────────

-- What the privacy policy promises: answered tickets the customer didn't come back to in 14 days
-- close by themselves; closed tickets and their messages are erased two years after closing; tickets
-- the team deleted, 30 days after. { autoClosed, erased, deleted }.
create function public.support_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_auto int;
  v_erased int;
  v_deleted int;
begin
  with auto as (
    update public.support_tickets
    set status = 'closed', closed_at = now(), last_activity_at = now(), updated_at = now()
    where status = 'waiting' and deleted_at is null and last_team_at < now() - interval '14 days'
    returning id
  )
  insert into public.support_messages (ticket_id, author, event, meta)
  select id, 'system', 'closed', jsonb_build_object('by', 'auto') from auto;
  get diagnostics v_auto = row_count;
  delete from public.support_tickets where status = 'closed' and closed_at < now() - interval '2 years';
  get diagnostics v_erased = row_count;
  delete from public.support_tickets where deleted_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('autoClosed', v_auto, 'erased', v_erased, 'deleted', v_deleted);
end $$;

-- ─── privileges: the server's role only; the helpers not even that ─────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.support_mask_email(text)',
    'public.support_mask_phone(text)',
    'public.support_invitation_title(public.invitations)',
    'public.support_ticket_view(public.support_tickets, boolean)',
    'public.admin_support_item(public.support_tickets, boolean)',
    'public.support_event(uuid, text, jsonb, uuid, boolean)',
    'public.support_check(text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.support_ticket_open(uuid, text, text, text, uuid, text, text, jsonb)',
    'public.support_contact_ticket(uuid, text, text, text, text, text, text, text)',
    'public.support_ticket_list(uuid)',
    'public.support_ticket_get(uuid, uuid, boolean)',
    'public.support_ticket_reply(uuid, uuid, text)',
    'public.support_ticket_close(uuid, uuid)',
    'public.support_unread(uuid)',
    'public.support_notify_target(uuid)',
    'public.support_message_emailed(bigint, boolean)',
    'public.admin_support_list(uuid, text, text, text, text, text, int, int)',
    'public.admin_support_get(uuid, uuid)',
    'public.admin_support_reply(uuid, uuid, text, boolean)',
    'public.admin_support_note(uuid, uuid, text)',
    'public.admin_support_status(uuid, uuid, text)',
    'public.admin_support_priority(uuid, uuid, text)',
    'public.admin_support_assign(uuid, uuid, uuid)',
    'public.admin_support_delete(uuid, uuid, text)',
    'public.admin_support_summary(uuid)',
    'public.admin_support_activity(uuid, int)',
    'public.admin_support_user_tickets(uuid, uuid)',
    'public.support_maintenance()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
