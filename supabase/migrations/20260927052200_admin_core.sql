-- The admin console's core (the foundation — staff, roles, the gate, the record of actions — is
-- *_admin_console.sql): the overview's numbers and its live feed, the users (a list, one user's page,
-- their credits, a plan given as a gift, a discount, sign-in suspended), the invitations (a list with
-- its counts, one invitation's page, features granted to it), the record of actions in words and the
-- system's state.
--
-- Same rules as the foundation: every function takes the acting staff member (p_actor) and checks
-- their role's permission first (admin_require); every change is recorded (admin_log) in its own
-- transaction; contact details (emails, phone numbers) come back masked to roles without users.pii, so
-- the browser never gets them. The site's sample invitations and their owner (the demo owner) are not
-- customers: they are left out of every number and list. "Today" and "this month" are Israel's.
--
-- Additive and safe on live data: indexes for the console's queries, and the credit ledger's reasons
-- gain 'support' (credits the team added or removed, with the record of the action as its ref). The
-- console's reads run with jit off: their queries are short, and compiling them would take longer
-- than running them.

-- ─── credits the team adds or removes ──────────────────────────────────────────────────────────

-- (one statement: the table is never without the rule; existing rows are checked without blocking
-- writes)
alter table public.credit_ledger
  drop constraint credit_ledger_reason_check,
  add constraint credit_ledger_reason_check check (
    reason in ('purchase', 'plan_grant', 'whatsapp_send', 'whatsapp_refund', 'admin', 'support')
  ) not valid;
alter table public.credit_ledger validate constraint credit_ledger_reason_check;

-- ─── indexes for the console's numbers, lists and feed ─────────────────────────────────────────

-- (the columns the numbers read ride along, so counting a period reads the index alone)
create index invitations_created on public.invitations (created_at desc) include (owner_id);
-- an invitation's first publish (it went live)
create index invitation_versions_first_publish on public.invitation_versions (created_at desc)
  include (invitation_id) where kind = 'publish' and version = 1;
create index rsvp_responses_created on public.rsvp_responses (created_at desc)
  include (invitation_id, attending, adults_count, children_count);
create index whatsapp_messages_created on public.whatsapp_messages (created_at desc) include (status);
create index whatsapp_messages_failed on public.whatsapp_messages (updated_at desc) where status = 'failed';
create index seating_notices_whatsapp on public.seating_notices (created_at desc) include (status)
  where channel = 'whatsapp';
create index seating_notices_failed on public.seating_notices (updated_at desc) where status = 'failed';
create index gallery_notices_whatsapp on public.gallery_notices (created_at desc) include (status)
  where channel = 'whatsapp';
create index gallery_notices_failed on public.gallery_notices (updated_at desc) where status = 'failed';
create index credit_ledger_created on public.credit_ledger (created_at desc);
create index billing_checkouts_paid on public.billing_checkouts (completed_at desc) where status = 'paid';
create index billing_events_renewals on public.billing_events (created_at desc) where type = 'renewal.paid';
create index admin_audit_action on public.admin_audit (action, id desc);

-- ─── helpers (internal: not even the server calls them) ────────────────────────────────────────

-- The owner of the site's sample invitations (features/invitations/templates/seed-data.ts): not a
-- customer.
create function public.admin_demo_owner() returns uuid
language sql immutable set search_path = '' as $$
  select '00000000-0000-4000-8000-00000000d3e0'::uuid
$$;

-- "d***@gmail.com": what roles without users.pii see of an email.
create function public.admin_mask_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_email is null or p_email = '' then p_email
    when position('@' in p_email) < 2 then '***'
    else left(p_email, 1) || '***@' || split_part(p_email, '@', 2)
  end
$$;

-- "+972 5X-XXX-X123": what roles without users.pii see of a phone number.
create function public.admin_mask_phone(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_phone is null or p_phone = '' then p_phone
    when p_phone ~ '^\+972[0-9]{8,9}$' then '+972 ' || substr(p_phone, 5, 1) || 'X-XXX-X' || right(p_phone, 3)
    when char_length(p_phone) > 6 then left(p_phone, 3) || ' ' || repeat('X', char_length(p_phone) - 6) || right(p_phone, 3)
    else '***'
  end
$$;

-- The email as the actor's role may see it.
create function public.admin_email_for(p_pii boolean, p_email text) returns text
language sql immutable set search_path = '' as $$
  select case when p_pii then p_email else public.admin_mask_email(p_email) end
$$;

-- The phone number as the actor's role may see it.
create function public.admin_phone_for(p_pii boolean, p_phone text) returns text
language sql immutable set search_path = '' as $$
  select case when p_pii then p_phone else public.admin_mask_phone(p_phone) end
$$;

-- A person's name as the console shows it: their account's, else the one they signed up with (null:
-- none — never their email).
create function public.admin_user_name(p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif(btrim(a.full_name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
  )
  from auth.users u
  left join public.accounts a on a.user_id = u.id
  where u.id = p_user_id
$$;

-- How the account came to be: 'signup', 'google' or 'partner:<name>' — accounts.source (made on the
-- account's first use), else from how the user signed up.
create function public.admin_user_source(p_account_source text, p_app_meta jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    p_account_source,
    nullif(p_app_meta ->> 'provisioned_by', ''),
    case when p_app_meta ->> 'provider' = 'google' then 'google' else 'signup' end
  )
$$;

-- "Noa & Itay": an invitation's hosts in its default language (else the first name it has).
create function public.admin_invitation_title(p_doc jsonb) returns text
language sql immutable set search_path = '' as $$
  with l as (
    select coalesce(p_doc ->> 'defaultLocale', 'he') as loc,
           case when jsonb_typeof(p_doc #> '{hosts,primary}') = 'object'
                then p_doc #> '{hosts,primary}' else '{}'::jsonb end as primary_names
  ), n as (
    select
      coalesce(
        nullif(btrim(l.primary_names ->> l.loc), ''),
        (select nullif(btrim(e.value), '') from jsonb_each_text(l.primary_names) e
         where nullif(btrim(e.value), '') is not null order by e.key limit 1)
      ) as first_name,
      nullif(btrim(p_doc #>> array['hosts', 'secondary', l.loc]), '') as second_name,
      coalesce(nullif(btrim(p_doc #>> array['hosts', 'joiner', l.loc]), ''), '&') as joiner
    from l
  )
  select case
    when n.first_name is null then n.second_name
    when n.second_name is null then n.first_name
    else n.first_name || ' ' || n.joiner || ' ' || n.second_name
  end
  from n
$$;

-- The plan in force (features/billing/plans.ts effectivePlan, the same rules — tests/db holds them
-- equal): the platform's owners always have the top plan; a gift and a canceled plan last until their
-- date; a renewal that never came keeps the plan for 14 days.
create function public.admin_effective_plan(
  p_plan text, p_status text, p_renews timestamptz, p_provider text, p_owner boolean
) returns text
language sql stable set search_path = '' as $$
  select case
    when p_owner then 'business'
    when p_plan is null or p_plan = 'free' then 'free'
    when p_provider = 'gift' or p_status = 'canceled' then
      case when p_renews is not null and p_renews > now() then p_plan else 'free' end
    when p_renews is not null and p_renews + interval '14 days' < now() then 'free'
    else p_plan
  end
$$;

-- One of the platform's owners (INVITES_ADMIN_EMAILS, kept on the staff list by admin_whoami).
create function public.admin_env_owner(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_staff s
    where s.email = lower(p_email) and s.source = 'env' and s.removed_at is null
  )
$$;

-- A staff role's rank: no one acts on a member of their own rank or above.
create function public.admin_role_rank(p_role text) returns int
language sql immutable set search_path = '' as $$
  select case p_role when 'owner' then 4 when 'admin' then 3 when 'support' then 2 when 'finance' then 2
                     when 'viewer' then 1 else 0 end
$$;

-- A reason the team typed for an action on credits, a plan or access: 3–200 characters.
create function public.admin_reason(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v) < 3 or char_length(v) > 200 then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;
  return v;
end $$;

-- A customer the console may act on: an account that exists (not the demo owner). Raises not_found.
create function public.admin_customer(p_user_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id is null or p_user_id = public.admin_demo_owner() or not exists (
    select 1 from auth.users u where u.id = p_user_id and u.deleted_at is null
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end $$;

-- WhatsApp messages a user sent that left (the invitations, the table numbers, the gallery links).
create function public.admin_user_sent(p_user_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    (select count(*) from public.whatsapp_messages m
     where m.owner_id = p_user_id and m.status in ('sent', 'delivered', 'read'))
    + (select count(*) from public.seating_notices n
       where n.owner_id = p_user_id and n.channel = 'whatsapp' and n.status in ('sent', 'delivered', 'read'))
    + (select count(*) from public.gallery_notices n
       where n.owner_id = p_user_id and n.channel = 'whatsapp' and n.status in ('sent', 'delivered', 'read'))
  )::int
$$;

-- An invitation's WhatsApp messages that left, of the three kinds.
create function public.admin_invitation_sent(p_invitation_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    (select count(*) from public.whatsapp_messages m
     where m.invitation_id = p_invitation_id and m.status in ('sent', 'delivered', 'read'))
    + (select count(*) from public.seating_notices n
       where n.invitation_id = p_invitation_id and n.channel = 'whatsapp' and n.status in ('sent', 'delivered', 'read'))
    + (select count(*) from public.gallery_notices n
       where n.invitation_id = p_invitation_id and n.channel = 'whatsapp' and n.status in ('sent', 'delivered', 'read'))
  )::int
$$;

-- An invitation's replies: { yes, no, people } (people: who is coming, adults and children).
create function public.admin_invitation_rsvps(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'yes', count(*) filter (where r.attending),
    'no', count(*) filter (where not r.attending),
    'people', coalesce(sum(r.adults_count + r.children_count) filter (where r.attending), 0)
  )
  from public.rsvp_responses r
  where r.invitation_id = p_invitation_id
$$;

-- Numbers of several objects added up key by key ({ a: 1 } + { a: 2, b: 1 } = { a: 3, b: 1 }).
create function public.admin_sum_numbers(p_objects jsonb[]) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(x.key, x.total), '{}'::jsonb)
  from (
    select e.key, sum(e.value::numeric) as total
    from unnest(p_objects) o(obj)
    cross join lateral jsonb_each_text(coalesce(o.obj, '{}'::jsonb)) e
    group by e.key
  ) x
$$;

-- How messages of one kind stand now, by status (queued, sending, sent, delivered, read, failed).
create function public.admin_status_counts(p_rows jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'queued', coalesce((p_rows ->> 'queued')::int, 0),
    'sending', coalesce((p_rows ->> 'sending')::int, 0),
    'sent', coalesce((p_rows ->> 'sent')::int, 0),
    'delivered', coalesce((p_rows ->> 'delivered')::int, 0),
    'read', coalesce((p_rows ->> 'read')::int, 0),
    'failed', coalesce((p_rows ->> 'failed')::int, 0)
  )
$$;

-- The newest WhatsApp batches (the messages queued for one invitation within one minute), of each
-- kind — up to p_limit of each. Walks the newest messages a minute at a time (each minute's counts are
-- exact, however large the batch), so it reads no more than it shows.
create function public.admin_whatsapp_batches(p_limit int)
returns table (kind text, invitation_id uuid, at timestamptz, n int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cursor timestamptz;
  v_minute timestamptz;
  v_found int;
  v_rows int;
begin
  -- the invitations
  v_cursor := 'infinity';
  v_found := 0;
  loop
    select date_trunc('minute', m.created_at) into v_minute
    from public.whatsapp_messages m where m.created_at < v_cursor order by m.created_at desc limit 1;
    exit when v_minute is null;
    return query
      select 'invitation'::text, m.invitation_id, max(m.created_at), count(*)::int
      from public.whatsapp_messages m
      where m.created_at >= v_minute and m.created_at < v_minute + interval '1 minute'
      group by m.invitation_id;
    get diagnostics v_rows = row_count;
    v_found := v_found + v_rows;
    exit when v_found >= p_limit;
    v_cursor := v_minute;
  end loop;
  -- the table numbers (features/event-day)
  v_cursor := 'infinity';
  v_found := 0;
  loop
    select date_trunc('minute', m.created_at) into v_minute
    from public.seating_notices m
    where m.channel = 'whatsapp' and m.created_at < v_cursor order by m.created_at desc limit 1;
    exit when v_minute is null;
    return query
      select 'table'::text, m.invitation_id, max(m.created_at), count(*)::int
      from public.seating_notices m
      where m.channel = 'whatsapp' and m.created_at >= v_minute and m.created_at < v_minute + interval '1 minute'
      group by m.invitation_id;
    get diagnostics v_rows = row_count;
    v_found := v_found + v_rows;
    exit when v_found >= p_limit;
    v_cursor := v_minute;
  end loop;
  -- the gallery links (features/live-gallery)
  v_cursor := 'infinity';
  v_found := 0;
  loop
    select date_trunc('minute', m.created_at) into v_minute
    from public.gallery_notices m
    where m.channel = 'whatsapp' and m.created_at < v_cursor order by m.created_at desc limit 1;
    exit when v_minute is null;
    return query
      select 'gallery'::text, m.invitation_id, max(m.created_at), count(*)::int
      from public.gallery_notices m
      where m.channel = 'whatsapp' and m.created_at >= v_minute and m.created_at < v_minute + interval '1 minute'
      group by m.invitation_id;
    get diagnostics v_rows = row_count;
    v_found := v_found + v_rows;
    exit when v_found >= p_limit;
    v_cursor := v_minute;
  end loop;
end $$;

-- ─── the overview: the numbers ─────────────────────────────────────────────────────────────────

-- The business now: users, invitations, RSVPs, WhatsApp messages and credits — each with today (since
-- midnight in Israel; yesterday: the same hours a day before), the last 7 and 30 days and the 7 and 30
-- days before them — and the last 30 days day by day (Israel's days). Money and tickets come from the
-- finance and support areas.
create function public.admin_overview(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_day0 timestamptz := (v_today)::timestamp at time zone 'Asia/Jerusalem';
  v_yday0 timestamptz := (v_today - 1)::timestamp at time zone 'Asia/Jerusalem';
  v_month0 timestamptz := (date_trunc('month', v_today::timestamp))::timestamp at time zone 'Asia/Jerusalem';
  v_series0 timestamptz := (v_today - 29)::timestamp at time zone 'Asia/Jerusalem';
  v_d7 timestamptz := now() - interval '7 days';
  v_d14 timestamptz := now() - interval '14 days';
  v_d30 timestamptz := now() - interval '30 days';
  v_d60 timestamptz := now() - interval '60 days';
  v_demo uuid := public.admin_demo_owner();
  v_users jsonb;
  v_invitations jsonb;
  v_rsvps jsonb;
  v_wa_invitation jsonb;
  v_wa_table jsonb;
  v_wa_gallery jsonb;
  v_wa jsonb;
  v_whatsapp jsonb;
  v_credits jsonb;
  v_series jsonb;
begin
  perform public.admin_require(p_actor, 'dashboard.view');

  -- users: new accounts (by when they were opened) and where they came from; active: signed in lately
  select jsonb_build_object(
    'total', count(*),
    'new', jsonb_build_object(
      'today', count(*) filter (where u.created_at >= v_day0),
      'yesterday', count(*) filter (where u.created_at >= v_yday0 and u.created_at < v_now - interval '1 day'),
      'd7', count(*) filter (where u.created_at >= v_d7),
      'prev7', count(*) filter (where u.created_at >= v_d14 and u.created_at < v_d7),
      'd30', count(*) filter (where u.created_at >= v_d30),
      'prev30', count(*) filter (where u.created_at >= v_d60 and u.created_at < v_d30)
    ),
    'bySource', jsonb_build_object(
      'signup', count(*) filter (where u.created_at >= v_d30 and u.src = 'signup'),
      'google', count(*) filter (where u.created_at >= v_d30 and u.src = 'google'),
      'partner', count(*) filter (where u.created_at >= v_d30 and u.src like 'partner:%')
    ),
    'bySourceTotal', jsonb_build_object(
      'signup', count(*) filter (where u.src = 'signup'),
      'google', count(*) filter (where u.src = 'google'),
      'partner', count(*) filter (where u.src like 'partner:%')
    ),
    'active7', count(*) filter (where u.last_sign_in_at >= v_d7),
    'active30', count(*) filter (where u.last_sign_in_at >= v_d30)
  ) into v_users
  from (
    select x.created_at, x.last_sign_in_at, public.admin_user_source(a.source, x.raw_app_meta_data) as src
    from auth.users x
    left join public.accounts a on a.user_id = x.id
    where x.id <> v_demo and x.deleted_at is null
  ) u;

  -- invitations: created, and first published (they went live); how they stand now
  select jsonb_build_object(
    'total', (select count(*) from public.invitations i where i.owner_id <> v_demo),
    'status', (
      select jsonb_build_object(
        'draft', count(*) filter (where i.status = 'draft'),
        'published', count(*) filter (where i.status = 'published'),
        'archived', count(*) filter (where i.status = 'archived')
      )
      from public.invitations i where i.owner_id <> v_demo
    ),
    'created', (
      select jsonb_build_object(
        'today', count(*) filter (where i.created_at >= v_day0),
        'yesterday', count(*) filter (where i.created_at >= v_yday0 and i.created_at < v_now - interval '1 day'),
        'd7', count(*) filter (where i.created_at >= v_d7),
        'prev7', count(*) filter (where i.created_at >= v_d14 and i.created_at < v_d7),
        'd30', count(*) filter (where i.created_at >= v_d30),
        'prev30', count(*) filter (where i.created_at < v_d30)
      )
      from public.invitations i
      where i.created_at >= v_d60 and i.owner_id <> v_demo
    ),
    'published', (
      select jsonb_build_object(
        'today', count(*) filter (where v.created_at >= v_day0),
        'yesterday', count(*) filter (where v.created_at >= v_yday0 and v.created_at < v_now - interval '1 day'),
        'd7', count(*) filter (where v.created_at >= v_d7),
        'prev7', count(*) filter (where v.created_at >= v_d14 and v.created_at < v_d7),
        'd30', count(*) filter (where v.created_at >= v_d30),
        'prev30', count(*) filter (where v.created_at < v_d30)
      )
      from public.invitation_versions v
      join public.invitations i on i.id = v.invitation_id
      where v.kind = 'publish' and v.version = 1 and v.created_at >= v_d60 and i.owner_id <> v_demo
    )
  ) into v_invitations;

  -- RSVPs: replies (by when they first came) and the people coming with them
  select jsonb_build_object(
    'responses', jsonb_build_object(
      'today', count(*) filter (where r.created_at >= v_day0),
      'yesterday', count(*) filter (where r.created_at >= v_yday0 and r.created_at < v_now - interval '1 day'),
      'd7', count(*) filter (where r.created_at >= v_d7),
      'prev7', count(*) filter (where r.created_at >= v_d14 and r.created_at < v_d7),
      'd30', count(*) filter (where r.created_at >= v_d30),
      'prev30', count(*) filter (where r.created_at < v_d30)
    ),
    'people', jsonb_build_object(
      'today', coalesce(sum(r.people) filter (where r.created_at >= v_day0), 0),
      'yesterday', coalesce(sum(r.people) filter (
        where r.created_at >= v_yday0 and r.created_at < v_now - interval '1 day'), 0),
      'd7', coalesce(sum(r.people) filter (where r.created_at >= v_d7), 0),
      'prev7', coalesce(sum(r.people) filter (where r.created_at >= v_d14 and r.created_at < v_d7), 0),
      'd30', coalesce(sum(r.people) filter (where r.created_at >= v_d30), 0),
      'prev30', coalesce(sum(r.people) filter (where r.created_at < v_d30), 0)
    ),
    'declined', jsonb_build_object(
      'd7', count(*) filter (where r.created_at >= v_d7 and not r.attending),
      'd30', count(*) filter (where r.created_at >= v_d30 and not r.attending)
    )
  ) into v_rsvps
  from (
    select x.created_at, x.attending,
           case when x.attending then x.adults_count + x.children_count else 0 end as people
    from public.rsvp_responses x
    where x.created_at >= v_d60
      and x.invitation_id not in (select d.id from public.invitations d where d.owner_id = v_demo)
  ) r;

  -- WhatsApp: the messages that left (of the three kinds), delivered of those, failures in the last
  -- 24 hours, and what waits in the queues now — one pass over each kind's last 60 days
  select jsonb_build_object(
    'today', count(*) filter (where x.created_at >= v_day0 and x.status in ('sent', 'delivered', 'read')),
    'yesterday', count(*) filter (
      where x.created_at >= v_yday0 and x.created_at < v_now - interval '1 day' and x.status in ('sent', 'delivered', 'read')),
    'd7', count(*) filter (where x.created_at >= v_d7 and x.status in ('sent', 'delivered', 'read')),
    'prev7', count(*) filter (
      where x.created_at >= v_d14 and x.created_at < v_d7 and x.status in ('sent', 'delivered', 'read')),
    'd30', count(*) filter (where x.created_at >= v_d30 and x.status in ('sent', 'delivered', 'read')),
    'prev30', count(*) filter (where x.created_at < v_d30 and x.status in ('sent', 'delivered', 'read')),
    'delivered', count(*) filter (where x.created_at >= v_d30 and x.status in ('delivered', 'read')),
    'read', count(*) filter (where x.created_at >= v_d30 and x.status = 'read'),
    'settled', count(*) filter (where x.created_at >= v_d30 and x.status in ('sent', 'delivered', 'read', 'failed'))
  ) into v_wa_invitation
  from public.whatsapp_messages x
  where x.created_at >= v_d60;
  select jsonb_build_object(
    'today', count(*) filter (where x.created_at >= v_day0 and x.status in ('sent', 'delivered', 'read')),
    'yesterday', count(*) filter (
      where x.created_at >= v_yday0 and x.created_at < v_now - interval '1 day' and x.status in ('sent', 'delivered', 'read')),
    'd7', count(*) filter (where x.created_at >= v_d7 and x.status in ('sent', 'delivered', 'read')),
    'prev7', count(*) filter (
      where x.created_at >= v_d14 and x.created_at < v_d7 and x.status in ('sent', 'delivered', 'read')),
    'd30', count(*) filter (where x.created_at >= v_d30 and x.status in ('sent', 'delivered', 'read')),
    'prev30', count(*) filter (where x.created_at < v_d30 and x.status in ('sent', 'delivered', 'read')),
    'delivered', count(*) filter (where x.created_at >= v_d30 and x.status in ('delivered', 'read')),
    'read', count(*) filter (where x.created_at >= v_d30 and x.status = 'read'),
    'settled', count(*) filter (where x.created_at >= v_d30 and x.status in ('sent', 'delivered', 'read', 'failed'))
  ) into v_wa_table
  from public.seating_notices x
  where x.channel = 'whatsapp' and x.created_at >= v_d60;
  select jsonb_build_object(
    'today', count(*) filter (where x.created_at >= v_day0 and x.status in ('sent', 'delivered', 'read')),
    'yesterday', count(*) filter (
      where x.created_at >= v_yday0 and x.created_at < v_now - interval '1 day' and x.status in ('sent', 'delivered', 'read')),
    'd7', count(*) filter (where x.created_at >= v_d7 and x.status in ('sent', 'delivered', 'read')),
    'prev7', count(*) filter (
      where x.created_at >= v_d14 and x.created_at < v_d7 and x.status in ('sent', 'delivered', 'read')),
    'd30', count(*) filter (where x.created_at >= v_d30 and x.status in ('sent', 'delivered', 'read')),
    'prev30', count(*) filter (where x.created_at < v_d30 and x.status in ('sent', 'delivered', 'read')),
    'delivered', count(*) filter (where x.created_at >= v_d30 and x.status in ('delivered', 'read')),
    'read', count(*) filter (where x.created_at >= v_d30 and x.status = 'read'),
    'settled', count(*) filter (where x.created_at >= v_d30 and x.status in ('sent', 'delivered', 'read', 'failed'))
  ) into v_wa_gallery
  from public.gallery_notices x
  where x.channel = 'whatsapp' and x.created_at >= v_d60;
  v_wa := public.admin_sum_numbers(array[v_wa_invitation, v_wa_table, v_wa_gallery]);
  select jsonb_build_object(
    'sent', jsonb_build_object(
      'today', v_wa -> 'today', 'yesterday', v_wa -> 'yesterday', 'd7', v_wa -> 'd7', 'prev7', v_wa -> 'prev7',
      'd30', v_wa -> 'd30', 'prev30', v_wa -> 'prev30'
    ),
    'byKind', jsonb_build_object(
      'invitation', v_wa_invitation -> 'd30', 'table', v_wa_table -> 'd30', 'gallery', v_wa_gallery -> 'd30'
    ),
    'delivery', jsonb_build_object(
      'delivered', v_wa -> 'delivered', 'read', v_wa -> 'read', 'settled', v_wa -> 'settled'
    ),
    'failed24h', (
      (select count(*) from public.whatsapp_messages x where x.status = 'failed' and x.updated_at >= v_now - interval '24 hours')
      + (select count(*) from public.seating_notices x where x.status = 'failed' and x.updated_at >= v_now - interval '24 hours')
      + (select count(*) from public.gallery_notices x where x.status = 'failed' and x.updated_at >= v_now - interval '24 hours')
    ),
    'queued', jsonb_build_object(
      'invitation', (select count(*) from public.whatsapp_messages x where x.status in ('queued', 'sending')),
      'table', (select count(*) from public.seating_notices x where x.status in ('queued', 'sending')),
      'gallery', (select count(*) from public.gallery_notices x where x.status in ('queued', 'sending'))
    )
  ) into v_whatsapp;

  -- credits: what the customers hold, what this month's messages used (net of refunds), what was added
  select jsonb_build_object(
    'inSystem', (
      select coalesce(sum(a.message_credits), 0) from public.accounts a where a.user_id <> v_demo
    ),
    'usedMonth', coalesce(-sum(l.delta) filter (where l.reason in ('whatsapp_send', 'whatsapp_refund')), 0),
    'boughtMonth', coalesce(sum(l.delta) filter (where l.reason in ('purchase', 'plan_grant')), 0),
    'teamMonth', coalesce(sum(l.delta) filter (where l.reason = 'support'), 0)
  ) into v_credits
  from public.credit_ledger l
  where l.created_at >= v_month0;

  -- the last 30 days, day by day
  with days as (
    select d::date as day
    from generate_series((v_today - 29)::timestamp, v_today::timestamp, interval '1 day') d
  ), signups as (
    select (u.created_at at time zone 'Asia/Jerusalem')::date as day, count(*) as n
    from auth.users u
    where u.created_at >= v_series0 and u.id <> v_demo and u.deleted_at is null
    group by 1
  ), invs as (
    select (i.created_at at time zone 'Asia/Jerusalem')::date as day, count(*) as n
    from public.invitations i
    where i.created_at >= v_series0 and i.owner_id <> v_demo
    group by 1
  ), replies as (
    select (r.created_at at time zone 'Asia/Jerusalem')::date as day, count(*) as n
    from public.rsvp_responses r
    where r.created_at >= v_series0
      and r.invitation_id not in (select d.id from public.invitations d where d.owner_id = v_demo)
    group by 1
  ), msgs as (
    select (x.created_at at time zone 'Asia/Jerusalem')::date as day, count(*) as n
    from (
      select m.created_at from public.whatsapp_messages m
      where m.created_at >= v_series0 and m.status in ('sent', 'delivered', 'read')
      union all
      select m.created_at from public.seating_notices m
      where m.channel = 'whatsapp' and m.created_at >= v_series0 and m.status in ('sent', 'delivered', 'read')
      union all
      select m.created_at from public.gallery_notices m
      where m.channel = 'whatsapp' and m.created_at >= v_series0 and m.status in ('sent', 'delivered', 'read')
    ) x
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
      'day', days.day,
      'signups', coalesce(signups.n, 0),
      'invitations', coalesce(invs.n, 0),
      'rsvps', coalesce(replies.n, 0),
      'messages', coalesce(msgs.n, 0)
    ) order by days.day)
  into v_series
  from days
  left join signups on signups.day = days.day
  left join invs on invs.day = days.day
  left join replies on replies.day = days.day
  left join msgs on msgs.day = days.day;

  return jsonb_build_object(
    'now', v_now,
    'today', v_today,
    'users', v_users,
    'invitations', v_invitations,
    'rsvps', v_rsvps,
    'whatsapp', v_whatsapp,
    'credits', v_credits,
    'series', v_series
  );
end $$;

-- ─── the overview: the live feed ───────────────────────────────────────────────────────────────

-- The newest events, newest first (features/admin/activity.ts ActivityItem): accounts opened (and
-- how), invitations created and gone live, RSVPs (the people coming), WhatsApp batches (per invitation
-- and minute), payments (the amount only for finance.view), and what the team did — credits, plans,
-- discounts, suspensions, features, the staff. Names only: no emails or phone numbers (a staff member
-- without a name shows as a masked email).
create function public.admin_activity(p_actor uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_role text := public.admin_require(p_actor, 'dashboard.view');
  v_money boolean := public.admin_can(v_role, 'finance.view');
  v_n int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_demo uuid := public.admin_demo_owner();
begin
  return coalesce((
    select jsonb_agg(f.item order by f.at desc, f.key desc)
    from (
      select e.at, e.key, e.item
      from (
        -- accounts opened
        select u.created_at as at, 'signup:' || u.id as key, jsonb_build_object(
          'id', 'signup:' || u.id, 'kind', 'signup', 'at', u.created_at,
          'actor', public.admin_user_name(u.id), 'subject', null, 'amount', null,
          'userId', u.id, 'invitationId', null, 'ticketId', null,
          'detail', jsonb_build_object('source', public.admin_user_source(a.source, u.raw_app_meta_data))
        ) as item
        from (
          select x.id, x.created_at, x.raw_app_meta_data from auth.users x
          where x.id <> v_demo and x.deleted_at is null
          order by x.created_at desc limit v_n
        ) u
        left join public.accounts a on a.user_id = u.id

        union all
        -- invitations created
        select i.created_at, 'invitation:' || i.id, jsonb_build_object(
          'id', 'invitation:' || i.id, 'kind', 'invitation_created', 'at', i.created_at,
          'actor', public.admin_user_name(i.owner_id), 'subject', public.admin_invitation_title(i.draft),
          'amount', null, 'userId', i.owner_id, 'invitationId', i.id, 'ticketId', null,
          'detail', jsonb_build_object('eventType', i.event_type)
        )
        from (
          select x.* from public.invitations x
          where x.owner_id <> v_demo order by x.created_at desc limit v_n
        ) i

        union all
        -- invitations gone live (their first publish)
        select v.created_at, 'published:' || i.id, jsonb_build_object(
          'id', 'published:' || i.id, 'kind', 'invitation_published', 'at', v.created_at,
          'actor', public.admin_user_name(i.owner_id), 'subject', public.admin_invitation_title(i.draft),
          'amount', null, 'userId', i.owner_id, 'invitationId', i.id, 'ticketId', null,
          'detail', jsonb_build_object('eventType', i.event_type)
        )
        from (
          select x.invitation_id, x.created_at from public.invitation_versions x
          where x.kind = 'publish' and x.version = 1
            and x.invitation_id not in (select d.id from public.invitations d where d.owner_id = v_demo)
          order by x.created_at desc limit v_n
        ) v
        join public.invitations i on i.id = v.invitation_id

        union all
        -- RSVPs (the guest isn't named: the host's guests are the host's)
        select r.created_at, 'rsvp:' || r.id, jsonb_build_object(
          'id', 'rsvp:' || r.id, 'kind', 'rsvp', 'at', r.created_at,
          'actor', null, 'subject', public.admin_invitation_title(i.draft),
          'amount', case when r.attending then r.adults_count + r.children_count else 0 end,
          'userId', i.owner_id, 'invitationId', i.id, 'ticketId', null,
          'detail', jsonb_build_object('attending', r.attending)
        )
        from (
          select x.* from public.rsvp_responses x
          where x.invitation_id not in (select d.id from public.invitations d where d.owner_id = v_demo)
          order by x.created_at desc limit v_n
        ) r
        join public.invitations i on i.id = r.invitation_id

        union all
        -- WhatsApp batches
        select b.at, 'wa:' || b.kind || ':' || b.invitation_id || ':' || extract(epoch from date_trunc('minute', b.at))::bigint,
          jsonb_build_object(
            'id', 'wa:' || b.kind || ':' || b.invitation_id || ':' || extract(epoch from date_trunc('minute', b.at))::bigint,
            'kind', 'whatsapp_batch', 'at', b.at,
            'actor', public.admin_user_name(i.owner_id), 'subject', public.admin_invitation_title(i.draft),
            'amount', b.n, 'userId', i.owner_id, 'invitationId', i.id, 'ticketId', null,
            'detail', jsonb_build_object('channel', b.kind)
          )
        from public.admin_whatsapp_batches(v_n) b
        join public.invitations i on i.id = b.invitation_id

        union all
        -- payments: purchases
        select k.completed_at, 'payment:' || k.id, jsonb_build_object(
          'id', 'payment:' || k.id, 'kind', 'payment', 'at', k.completed_at,
          'actor', public.admin_user_name(k.user_id), 'subject', k.product,
          'amount', case when v_money then k.amount end,
          'userId', k.user_id, 'invitationId', null, 'ticketId', null,
          'detail', jsonb_build_object('renewal', false)
        )
        from (
          select x.* from public.billing_checkouts x
          where x.status = 'paid' and x.completed_at is not null
          order by x.completed_at desc limit v_n
        ) k

        union all
        -- payments: monthly renewals
        select e.created_at, 'renewal:' || e.id, jsonb_build_object(
          'id', 'renewal:' || e.id, 'kind', 'payment', 'at', e.created_at,
          'actor', public.admin_user_name(e.user_id), 'subject', e.product,
          'amount', case when v_money then e.amount end,
          'userId', e.user_id, 'invitationId', null, 'ticketId', null,
          'detail', jsonb_build_object('renewal', true)
        )
        from (
          select x.* from public.billing_events x
          where x.type = 'renewal.paid'
          order by x.created_at desc limit v_n
        ) e

        union all
        -- what the team did
        select t.created_at, 'audit:' || t.id, jsonb_build_object(
          'id', 'audit:' || t.id,
          'kind', case
            when t.action = 'users.credits' then 'credits'
            when t.action like 'staff.%' then 'staff'
            else 'team_action' end,
          'at', t.created_at,
          'actor', coalesce(public.admin_user_name(t.actor_id), public.admin_mask_email(t.actor_email)),
          'subject', case
            when t.target_type = 'user' and t.target_id ~ '^[0-9a-f-]{36}$'
              then public.admin_user_name(t.target_id::uuid)
            when t.target_type = 'invitation' and t.target_id ~ '^[0-9a-f-]{36}$'
              then (select public.admin_invitation_title(x.draft) from public.invitations x where x.id = t.target_id::uuid)
            when t.target_type = 'staff'
              then coalesce(
                (select public.admin_user_name(x.id) from auth.users x where lower(x.email) = t.target_id limit 1),
                public.admin_mask_email(t.target_id))
          end,
          'amount', case when t.action = 'users.credits' then (t.details ->> 'delta')::int end,
          'userId', case when t.target_type = 'user' and t.target_id ~ '^[0-9a-f-]{36}$' then t.target_id end,
          'invitationId', case when t.target_type = 'invitation' and t.target_id ~ '^[0-9a-f-]{36}$' then t.target_id end,
          'ticketId', null,
          'detail', jsonb_strip_nulls(jsonb_build_object(
            'action', t.action,
            'role', t.details ->> 'role',
            'before', case when t.action like 'staff.%' then t.details ->> 'before' end,
            'plan', t.details ->> 'plan',
            'percent', t.details -> 'percent',
            'feature', t.details ->> 'feature',
            'grant', t.details -> 'grant'
          ))
        )
        from (
          select x.* from public.admin_audit x
          where x.action in (
            'users.credits', 'users.plan_gift', 'users.discount', 'users.suspend', 'users.restore',
            'invitations.feature', 'staff.set', 'staff.remove'
          )
          order by x.id desc limit v_n
        ) t
      ) e
      order by e.at desc, e.key desc
      limit v_n
    ) f
  ), '[]'::jsonb);
end $$;

-- ─── users ─────────────────────────────────────────────────────────────────────────────────────

-- Users, 50 a page: p_query { q, source ('signup' | 'google' | 'partner'), plan (the plan in force),
-- discount, staff, suspended (booleans), sort ('newest' | 'invitations' | 'messages' | 'credits' |
-- 'last_sign_in'), page }. Search: the name (and, for roles with users.pii, the email and the phone).
-- { total, page, pageSize, rows }.
create function public.admin_users(p_actor uuid, p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_role text := public.admin_require(p_actor, 'users.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  v_q text := nullif(btrim(coalesce(p_query ->> 'q', '')), '');
  v_like text;
  v_digits text;
  v_digits_intl text;
  v_source text := nullif(p_query ->> 'source', '');
  v_plan text := nullif(p_query ->> 'plan', '');
  v_discount boolean := coalesce((p_query ->> 'discount')::boolean, false);
  v_staff boolean := coalesce((p_query ->> 'staff')::boolean, false);
  v_suspended boolean := coalesce((p_query ->> 'suspended')::boolean, false);
  v_sort text := coalesce(nullif(p_query ->> 'sort', ''), 'newest');
  v_page int := least(greatest(coalesce((p_query ->> 'page')::int, 1), 1), 10000);
  v_size constant int := 50;
  v_result jsonb;
begin
  if v_sort not in ('newest', 'invitations', 'messages', 'credits', 'last_sign_in') then
    v_sort := 'newest';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_digits := nullif(regexp_replace(v_q, '[^0-9]', '', 'g'), '');
    if char_length(coalesce(v_digits, '')) < 4 then
      v_digits := null;
    elsif v_digits like '0%' then
      v_digits_intl := '972' || substr(v_digits, 2);
    end if;
  end if;

  with base as (
    select u.id, lower(u.email) as email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
           a.phone, coalesce(a.plan, 'free') as plan, coalesce(a.plan_status, 'active') as plan_status,
           a.plan_renews_at, a.billing_provider, coalesce(a.message_credits, 0) as credits,
           a.discount_percent, a.discount_until, a.discount_source,
           public.admin_user_source(a.source, u.raw_app_meta_data) as source,
           coalesce(
             nullif(btrim(a.full_name), ''),
             nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
             nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
           ) as name,
           s.role as staff_role,
           coalesce(s.source = 'env', false) as env_owner
    from auth.users u
    left join public.accounts a on a.user_id = u.id
    left join public.admin_staff s on s.email = lower(u.email) and s.removed_at is null
    where u.id <> public.admin_demo_owner() and u.deleted_at is null
  ), filtered as (
    select b.*, public.admin_effective_plan(b.plan, b.plan_status, b.plan_renews_at, b.billing_provider, b.env_owner)
             as effective
    from base b
    where (
        v_q is null
        or b.id::text = lower(v_q)
        or lower(coalesce(b.name, '')) like v_like
        or (v_pii and (
          b.email like v_like
          or (v_digits is not null and regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g') like '%' || v_digits || '%')
          or (v_digits_intl is not null
              and regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g') like '%' || v_digits_intl || '%')
        ))
      )
      and (v_source is null or (v_source = 'partner' and b.source like 'partner:%') or b.source = v_source)
      and (not v_discount or (b.discount_percent is not null and (b.discount_until is null or b.discount_until > now())))
      and (not v_staff or b.staff_role is not null)
      and (not v_suspended or b.banned_until > now())
  ), chosen as (
    select f.* from filtered f where v_plan is null or f.effective = v_plan
  ), invitation_counts as (
    -- (only when sorting by them: one pass, not one count per user)
    select i.owner_id, count(*) as n from public.invitations i where v_sort = 'invitations' group by i.owner_id
  ), message_counts as (
    select x.owner_id, count(*) as n
    from (
      select m.owner_id from public.whatsapp_messages m where m.status in ('sent', 'delivered', 'read')
      union all
      select m.owner_id from public.seating_notices m
      where m.channel = 'whatsapp' and m.status in ('sent', 'delivered', 'read')
      union all
      select m.owner_id from public.gallery_notices m
      where m.channel = 'whatsapp' and m.status in ('sent', 'delivered', 'read')
    ) x
    where v_sort = 'messages'
    group by x.owner_id
  ), ranked as (
    select c.*,
      row_number() over (order by
        case when v_sort = 'invitations' then coalesce(ic.n, 0) end desc nulls last,
        case when v_sort = 'messages' then coalesce(mc.n, 0) end desc nulls last,
        case when v_sort = 'credits' then c.credits end desc nulls last,
        case when v_sort = 'last_sign_in' then c.last_sign_in_at end desc nulls last,
        c.created_at desc, c.id
      ) as ord
    from chosen c
    left join invitation_counts ic on ic.owner_id = c.id
    left join message_counts mc on mc.owner_id = c.id
  ), page as (
    select r.* from ranked r
    where r.ord > (v_page - 1) * v_size and r.ord <= v_page * v_size
  )
  select jsonb_build_object(
    'total', (select count(*) from chosen),
    'page', v_page,
    'pageSize', v_size,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', public.admin_email_for(v_pii, p.email),
        'phone', public.admin_phone_for(v_pii, p.phone),
        'source', p.source,
        'venue', (
          select v.name from public.partner_venue_users pu
          join public.partner_venues v on v.id = pu.venue_id
          where pu.user_id = p.id
        ),
        'plan', p.plan,
        'planStatus', p.plan_status,
        'planRenewsAt', p.plan_renews_at,
        'effectivePlan', p.effective,
        'gift', coalesce(p.billing_provider = 'gift', false),
        'credits', p.credits,
        'invitations', (
          select jsonb_build_object(
            'active', count(*) filter (where i.status <> 'archived' and i.source_id is null),
            'total', count(*)
          )
          from public.invitations i where i.owner_id = p.id
        ),
        'messagesSent', public.admin_user_sent(p.id),
        'createdAt', p.created_at,
        'lastSignInAt', p.last_sign_in_at,
        'confirmed', p.email_confirmed_at is not null,
        'staffRole', p.staff_role,
        'suspended', coalesce(p.banned_until > now(), false),
        'discount', case when p.discount_percent is null then null else jsonb_build_object(
          'percent', p.discount_percent,
          'until', p.discount_until,
          'source', p.discount_source,
          'active', p.discount_until is null or p.discount_until > now()
        ) end
      ) order by p.ord)
      from page p
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

-- One user's page: who they are, their plan and billing (the provider's name, never its ids), their
-- credits and the ledger (a team member's change says who and why), their invitations, their
-- messages by kind and status, their payments (amounts for finance.view) and — for audit.view — the
-- record of what the team did about them. null: no such user.
create function public.admin_user(p_actor uuid, p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_role text := public.admin_require(p_actor, 'users.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  v_money boolean := public.admin_can(v_role, 'finance.view');
  v_audit boolean := public.admin_can(v_role, 'audit.view');
  u auth.users;
  a public.accounts;
  s public.admin_staff;
  v_owner boolean;
begin
  if p_user_id is null or p_user_id = public.admin_demo_owner() then
    return null;
  end if;
  select * into u from auth.users x where x.id = p_user_id and x.deleted_at is null;
  if not found then
    return null;
  end if;
  select * into a from public.accounts x where x.user_id = p_user_id;
  select * into s from public.admin_staff x where x.email = lower(u.email) and x.removed_at is null;
  v_owner := coalesce(s.source = 'env', false);
  return jsonb_build_object(
    'id', u.id,
    'name', public.admin_user_name(u.id),
    'email', public.admin_email_for(v_pii, lower(u.email)),
    'phone', public.admin_phone_for(v_pii, a.phone),
    'masked', not v_pii,
    'source', public.admin_user_source(a.source, u.raw_app_meta_data),
    'externalId', case when v_pii then a.external_id end,
    'venue', (
      select jsonb_build_object('name', v.name, 'address', v.address)
      from public.partner_venue_users pu join public.partner_venues v on v.id = pu.venue_id
      where pu.user_id = u.id
    ),
    'providers', coalesce(
      case when jsonb_typeof(u.raw_app_meta_data -> 'providers') = 'array'
           then u.raw_app_meta_data -> 'providers' end,
      '["email"]'::jsonb
    ),
    'createdAt', u.created_at,
    'lastSignInAt', u.last_sign_in_at,
    'confirmedAt', u.email_confirmed_at,
    'bannedUntil', case when u.banned_until > now() then u.banned_until end,
    'suspended', coalesce(u.banned_until > now(), false),
    'staff', case when s.email is null then null else jsonb_build_object('role', s.role, 'source', s.source) end,
    'platformOwner', v_owner,
    'plan', jsonb_build_object(
      'plan', coalesce(a.plan, 'free'),
      'status', coalesce(a.plan_status, 'active'),
      'renewsAt', a.plan_renews_at,
      'effective', public.admin_effective_plan(
        coalesce(a.plan, 'free'), coalesce(a.plan_status, 'active'), a.plan_renews_at, a.billing_provider, v_owner),
      'price', case when v_money then a.plan_price end,
      'provider', a.billing_provider,
      'gift', coalesce(a.billing_provider = 'gift', false),
      'hasSubscription', a.billing_subscription_id is not null,
      -- a plan the customer pays for now (a gift waits until it ends)
      'running', coalesce(a.plan, 'free') <> 'free' and coalesce(a.billing_provider, '') <> 'gift'
        and coalesce(a.plan_status, 'active') in ('active', 'trialing', 'past_due')
        and public.admin_effective_plan(a.plan, a.plan_status, a.plan_renews_at, a.billing_provider, false) <> 'free'
    ),
    'discount', case when a.discount_percent is null then null else jsonb_build_object(
      'percent', a.discount_percent,
      'until', a.discount_until,
      'note', a.discount_note,
      'source', a.discount_source,
      'setAt', a.discount_set_at,
      'active', a.discount_until is null or a.discount_until > now()
    ) end,
    'credits', jsonb_build_object(
      'balance', coalesce(a.message_credits, 0),
      'ledger', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'delta', l.delta,
          'reason', l.reason,
          'at', l.created_at,
          'invitationId', case when l.reason = 'whatsapp_send' and l.ref ~ '^[0-9a-f-]{36}$' then l.ref end,
          'by', case when t.id is null then null else jsonb_build_object(
            'name', public.admin_user_name(t.actor_id),
            'email', public.admin_email_for(v_pii or v_audit, t.actor_email),
            'reason', t.details ->> 'reason'
          ) end
        ) order by l.created_at desc, l.id desc)
        from (
          select x.* from public.credit_ledger x where x.user_id = u.id
          order by x.created_at desc, x.id desc limit 100
        ) l
        -- (a case: the ref is cast only once it is known to be one)
        left join public.admin_audit t
          on t.id = case when l.reason = 'support' and l.ref ~ '^admin:[0-9]{1,18}$'
                         then substr(l.ref, 7)::bigint end
      ), '[]'::jsonb)
    ),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'slug', i.slug,
        'title', public.admin_invitation_title(i.draft),
        'status', i.status,
        'eventType', i.event_type,
        'eventDate', i.draft #>> '{event,date}',
        'createdAt', i.created_at,
        'publishedAt', i.published_at,
        'guests', (select count(*) from public.invitation_guests g where g.invitation_id = i.id),
        'rsvps', public.admin_invitation_rsvps(i.id),
        'messages', public.admin_invitation_sent(i.id)
      ) order by i.created_at desc)
      from (
        select x.* from public.invitations x where x.owner_id = u.id order by x.created_at desc limit 200
      ) i
    ), '[]'::jsonb),
    'messages', jsonb_build_object(
      'invitation', public.admin_status_counts((
        select jsonb_object_agg(x.status, x.n) from (
          select m.status, count(*) as n from public.whatsapp_messages m where m.owner_id = u.id group by m.status
        ) x
      )),
      'table', public.admin_status_counts((
        select jsonb_object_agg(x.status, x.n) from (
          select m.status, count(*) as n from public.seating_notices m
          where m.owner_id = u.id and m.channel = 'whatsapp' group by m.status
        ) x
      )),
      'gallery', public.admin_status_counts((
        select jsonb_object_agg(x.status, x.n) from (
          select m.status, count(*) as n from public.gallery_notices m
          where m.owner_id = u.id and m.channel = 'whatsapp' group by m.status
        ) x
      ))
    ),
    'payments', jsonb_build_object(
      'checkouts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', k.id,
          'product', k.product,
          'amount', case when v_money then k.amount end,
          'provider', k.provider,
          'status', k.status,
          'createdAt', k.created_at,
          'completedAt', k.completed_at
        ) order by k.created_at desc)
        from (
          select x.* from public.billing_checkouts x
          where x.user_id = u.id and x.status <> 'pending'
          order by x.created_at desc limit 50
        ) k
      ), '[]'::jsonb),
      'renewals', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product', e.product,
          'amount', case when v_money then e.amount end,
          'status', case when e.type = 'renewal.paid' then 'paid' else 'failed' end,
          'at', e.created_at
        ) order by e.created_at desc)
        from (
          select x.* from public.billing_events x
          where x.user_id = u.id and x.type in ('renewal.paid', 'renewal.failed')
          order by x.created_at desc limit 50
        ) e
      ), '[]'::jsonb)
    ),
    'audit', case when v_audit then public.admin_audit_rows(null, null, 'user', u.id::text, null, 50) end
  );
end $$;

-- ─── the record of actions, in words ───────────────────────────────────────────────────────────

-- Rows of the record of actions, newest first (p_before: the last id seen), with the names the screen
-- puts them in words with: the staff member's, and the user's, the invitation's or the staff
-- member's they were about. Internal (admin_audit_search and admin_user check the role).
create function public.admin_audit_rows(
  p_actor_id uuid, p_action text, p_target_type text, p_target_id text, p_before bigint, p_limit int
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'at', t.created_at,
      'actorId', t.actor_id,
      'actorEmail', t.actor_email,
      'actorName', public.admin_user_name(t.actor_id),
      'action', t.action,
      'targetType', t.target_type,
      'targetId', t.target_id,
      'targetName', case
        when t.target_type = 'user' and t.target_id ~ '^[0-9a-f-]{36}$'
          then public.admin_user_name(t.target_id::uuid)
        when t.target_type = 'invitation' and t.target_id ~ '^[0-9a-f-]{36}$'
          then (select public.admin_invitation_title(x.draft) from public.invitations x where x.id = t.target_id::uuid)
        when t.target_type = 'staff'
          then (select public.admin_user_name(x.id) from auth.users x where lower(x.email) = t.target_id limit 1)
      end,
      'details', t.details
    ) order by t.id desc), '[]'::jsonb)
  from (
    select x.* from public.admin_audit x
    where (p_actor_id is null or x.actor_id = p_actor_id)
      and (p_action is null or x.action = p_action or x.action like p_action || '.%')
      and (p_target_type is null or x.target_type = p_target_type)
      and (p_target_id is null or x.target_id = p_target_id)
      and (p_before is null or x.id < p_before)
    order by x.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) t
$$;

-- The record of actions, a page at a time: p_query { actor (a staff member's user id), action (an
-- action or its area: 'users', 'users.credits'), targetType, targetId, before (the last id seen),
-- limit }. { rows, next (the id to continue before; null: no more), actors, actions } — actors and
-- actions: every one on record, for the filters.
create function public.admin_audit_search(p_actor uuid, p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_limit int := least(greatest(coalesce((p_query ->> 'limit')::int, 50), 1), 200);
  v_rows jsonb;
begin
  perform public.admin_require(p_actor, 'audit.view');
  v_rows := public.admin_audit_rows(
    nullif(p_query ->> 'actor', '')::uuid,
    nullif(p_query ->> 'action', ''),
    nullif(p_query ->> 'targetType', ''),
    nullif(p_query ->> 'targetId', ''),
    nullif(p_query ->> 'before', '')::bigint,
    v_limit + 1
  );
  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(r.value order by r.ord) from jsonb_array_elements(v_rows) with ordinality r(value, ord)
      where r.ord <= v_limit
    ), '[]'::jsonb),
    'next', case when jsonb_array_length(v_rows) > v_limit then (v_rows -> (v_limit - 1) ->> 'id')::bigint end,
    'actors', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.actor_id, 'email', x.actor_email,
                                          'name', public.admin_user_name(x.actor_id)) order by x.actor_email)
      from (select distinct on (a.actor_email) a.actor_id, a.actor_email from public.admin_audit a
            where a.actor_id is not null order by a.actor_email, a.id desc) x
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(x.action order by x.action) from (select distinct a.action from public.admin_audit a) x
    ), '[]'::jsonb)
  );
end $$;

-- ─── the team's actions on a user ──────────────────────────────────────────────────────────────

-- Adds credits to a user's balance or removes them (p_delta, never below 0), within the actor's
-- role's cap per action: support 100, finance 1,000, admins and owners 100,000. The ledger says
-- 'support' with the record of the action as its ref (who and why). { balance, auditId }.
create function public.admin_user_credits(p_actor uuid, p_user_id uuid, p_delta int, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'users.credits');
  v_cap int := case v_role when 'support' then 100 when 'finance' then 1000 else 100000 end;
  v_reason text;
  v_before int;
  v_after int;
  v_audit bigint;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta' using errcode = 'P0001';
  end if;
  if abs(p_delta) > v_cap then
    raise exception 'over_cap' using errcode = 'P0001';
  end if;
  v_reason := public.admin_reason(p_reason);
  perform public.admin_customer(p_user_id);
  perform public.account_get(p_user_id);
  select message_credits into v_before from public.accounts where user_id = p_user_id for update;
  v_after := v_before + p_delta;
  if v_after < 0 then
    raise exception 'below_zero' using errcode = 'P0001';
  end if;
  update public.accounts set message_credits = v_after where user_id = p_user_id;
  v_audit := public.admin_log(p_actor, 'users.credits', 'user', p_user_id::text, jsonb_build_object(
    'delta', p_delta, 'before', v_before, 'after', v_after, 'reason', v_reason
  ));
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_user_id, p_delta, 'support', 'admin:' || v_audit);
  return jsonb_build_object('balance', v_after, 'auditId', v_audit);
end $$;

-- Gives a user a plan as a gift (p_plan 'pro' | 'business') through p_last_day (Israel's date, at
-- most a year from today): it ends by itself at the end of that day — no charge, no renewal — and the
-- account goes back to free (the plan's status is 'canceled', its provider 'gift'). Not while the
-- customer pays for a plan (has_subscription). p_plan null takes a gift back. Returns the plan.
create function public.admin_user_gift(
  p_actor uuid, p_user_id uuid, p_plan text, p_last_day date, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_old public.accounts;
  v_new public.accounts;
begin
  perform public.admin_require(p_actor, 'users.plan');
  v_reason := public.admin_reason(p_reason);
  perform public.admin_customer(p_user_id);
  perform public.account_get(p_user_id);
  select * into v_old from public.accounts where user_id = p_user_id for update;
  if p_plan is null then
    if v_old.billing_provider is distinct from 'gift' then
      raise exception 'not_gift' using errcode = 'P0001';
    end if;
    update public.accounts set
      plan = 'free', plan_status = 'active', plan_renews_at = null, billing_provider = null, plan_price = null
    where user_id = p_user_id
    returning * into v_new;
  else
    if p_plan not in ('pro', 'business') then
      raise exception 'invalid_plan' using errcode = 'P0001';
    end if;
    if p_last_day is null or p_last_day < v_today or p_last_day > (v_today + interval '1 year')::date then
      raise exception 'invalid_until' using errcode = 'P0001';
    end if;
    if v_old.plan <> 'free' and coalesce(v_old.billing_provider, '') <> 'gift'
       and v_old.plan_status in ('active', 'trialing', 'past_due')
       and public.admin_effective_plan(v_old.plan, v_old.plan_status, v_old.plan_renews_at, v_old.billing_provider, false)
           <> 'free' then
      raise exception 'has_subscription' using errcode = 'P0001';
    end if;
    update public.accounts set
      plan = p_plan,
      plan_status = 'canceled',
      plan_renews_at = (p_last_day + 1)::timestamp at time zone 'Asia/Jerusalem',
      billing_provider = 'gift',
      billing_subscription_id = null,
      plan_price = 0
    where user_id = p_user_id
    returning * into v_new;
  end if;
  perform public.admin_log(p_actor, 'users.plan_gift', 'user', p_user_id::text, jsonb_build_object(
    'plan', p_plan,
    'lastDay', p_last_day,
    'reason', v_reason,
    'before', jsonb_build_object(
      'plan', v_old.plan, 'status', v_old.plan_status, 'renewsAt', v_old.plan_renews_at,
      'provider', v_old.billing_provider
    )
  ));
  return jsonb_build_object(
    'plan', v_new.plan, 'planStatus', v_new.plan_status, 'planRenewsAt', v_new.plan_renews_at,
    'billingProvider', v_new.billing_provider
  );
end $$;

-- A discount on a user's plans from the team (source 'admin'), replacing the one they had (a
-- partner's too): p_percent 1–90, through p_last_day (Israel's date; null: no end), an internal note.
-- p_percent null removes the discount. Returns the discount (null: none).
create function public.admin_user_discount(
  p_actor uuid, p_user_id uuid, p_percent int, p_last_day date, p_note text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_old public.accounts;
  v_new public.accounts;
begin
  perform public.admin_require(p_actor, 'users.plan');
  v_reason := public.admin_reason(p_reason);
  perform public.admin_customer(p_user_id);
  perform public.account_get(p_user_id);
  select * into v_old from public.accounts where user_id = p_user_id for update;
  if p_percent is null then
    if v_old.discount_percent is null then
      raise exception 'no_discount' using errcode = 'P0001';
    end if;
    update public.accounts set
      discount_percent = null, discount_until = null, discount_note = null, discount_source = null,
      discount_set_at = null
    where user_id = p_user_id
    returning * into v_new;
  else
    if p_percent < 1 or p_percent > 90 then
      raise exception 'invalid_percent' using errcode = 'P0001';
    end if;
    if p_last_day is not null and p_last_day < v_today then
      raise exception 'invalid_until' using errcode = 'P0001';
    end if;
    if char_length(coalesce(v_note, '')) > 200 then
      raise exception 'invalid_note' using errcode = 'P0001';
    end if;
    update public.accounts set
      discount_percent = p_percent,
      discount_until = case when p_last_day is null then null
                            else (p_last_day + 1)::timestamp at time zone 'Asia/Jerusalem' end,
      discount_note = v_note,
      discount_source = 'admin',
      discount_set_at = now()
    where user_id = p_user_id
    returning * into v_new;
  end if;
  perform public.admin_log(p_actor, 'users.discount', 'user', p_user_id::text, jsonb_build_object(
    'percent', p_percent,
    'lastDay', p_last_day,
    'note', v_note,
    'reason', v_reason,
    'before', case when v_old.discount_percent is null then null else jsonb_build_object(
      'percent', v_old.discount_percent, 'until', v_old.discount_until, 'source', v_old.discount_source
    ) end
  ));
  return case when v_new.discount_percent is null then null else jsonb_build_object(
    'percent', v_new.discount_percent, 'until', v_new.discount_until, 'note', v_new.discount_note,
    'source', v_new.discount_source, 'setAt', v_new.discount_set_at
  ) end;
end $$;

-- Before the server suspends a user's sign-in (or restores it) through Supabase Auth — which records
-- it after (admin_audit_add): the role may, the reason is one, and the user may be acted on — never
-- oneself, never a staff member of one's own rank or above. { email, suspended } (the email for the
-- server only).
create function public.admin_user_suspend_check(p_actor uuid, p_user_id uuid, p_suspend boolean, p_reason text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'users.suspend');
  v_target text;
  u auth.users;
begin
  perform public.admin_reason(p_reason);
  perform public.admin_customer(p_user_id);
  if p_user_id = p_actor then
    raise exception 'self' using errcode = 'P0001';
  end if;
  select * into u from auth.users x where x.id = p_user_id;
  select s.role into v_target from public.admin_staff s where s.email = lower(u.email) and s.removed_at is null;
  if v_target is not null and public.admin_role_rank(v_target) >= public.admin_role_rank(v_role) then
    raise exception 'staff_rank' using errcode = 'P0001';
  end if;
  if coalesce(p_suspend, true) and u.banned_until > now() then
    raise exception 'already_suspended' using errcode = 'P0001';
  end if;
  if not coalesce(p_suspend, true) and (u.banned_until is null or u.banned_until <= now()) then
    raise exception 'not_suspended' using errcode = 'P0001';
  end if;
  return jsonb_build_object('email', lower(u.email), 'suspended', coalesce(u.banned_until > now(), false));
end $$;

-- ─── the staff, with the reason ────────────────────────────────────────────────────────────────

-- Adds a staff member or changes their role (admin_staff_set: its rules and its record) — with why,
-- like every change of access: the reason goes into that same record.
create function public.admin_staff_change(
  p_actor uuid, p_email text, p_role text, p_note text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
  v jsonb;
begin
  perform public.admin_require(p_actor, 'staff.manage');
  v_reason := public.admin_reason(p_reason);
  v := public.admin_staff_set(p_actor, p_email, p_role, p_note);
  -- (the row admin_staff_set just wrote: this session's last id)
  update public.admin_audit set details = details || jsonb_build_object('reason', v_reason)
  where id = currval(pg_get_serial_sequence('public.admin_audit', 'id'));
  return v;
end $$;

-- Removes a staff member (admin_staff_remove), with why. false: no such member.
create function public.admin_staff_drop(p_actor uuid, p_email text, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
begin
  perform public.admin_require(p_actor, 'staff.manage');
  v_reason := public.admin_reason(p_reason);
  if not public.admin_staff_remove(p_actor, p_email) then
    return false;
  end if;
  update public.admin_audit set details = details || jsonb_build_object('reason', v_reason)
  where id = currval(pg_get_serial_sequence('public.admin_audit', 'id'));
  return true;
end $$;

-- ─── invitations ───────────────────────────────────────────────────────────────────────────────

-- Invitations, 50 a page: p_query { q (the hosts, the title, the address, the owner's name — and, for
-- users.pii, their email), status, eventType, template, lang, from, to (created, Israel's dates), sort
-- ('newest' | 'oldest' | 'event' (upcoming first) | 'rsvps'), page }. { total, page, pageSize, counts
-- (all invitations by status, event type and design), rows }.
create function public.admin_invitations(p_actor uuid, p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_role text := public.admin_require(p_actor, 'invitations.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  v_q text := nullif(btrim(coalesce(p_query ->> 'q', '')), '');
  v_like text;
  v_status text := nullif(p_query ->> 'status', '');
  v_event text := nullif(p_query ->> 'eventType', '');
  v_template text := nullif(p_query ->> 'template', '');
  v_lang text := nullif(p_query ->> 'lang', '');
  v_from date := nullif(p_query ->> 'from', '')::date;
  v_to date := nullif(p_query ->> 'to', '')::date;
  v_sort text := coalesce(nullif(p_query ->> 'sort', ''), 'newest');
  v_page int := least(greatest(coalesce((p_query ->> 'page')::int, 1), 1), 10000);
  v_size constant int := 50;
  v_today text := to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD');
  v_result jsonb;
begin
  if v_sort not in ('newest', 'oldest', 'event', 'rsvps') then
    v_sort := 'newest';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select i.id, i.slug, i.status, i.event_type, i.template_id, i.created_at, i.published_at, i.owner_id,
           i.draft, i.draft #>> '{event,date}' as event_date, i.draft -> 'locales' as locales,
           lower(u.email) as owner_email,
           coalesce(
             nullif(btrim(a.full_name), ''),
             nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
             nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
           ) as owner_name
    from public.invitations i
    join auth.users u on u.id = i.owner_id
    left join public.accounts a on a.user_id = i.owner_id
    where i.owner_id <> public.admin_demo_owner()
  ), filtered as (
    select b.* from base b
    where (v_status is null or b.status = v_status)
      and (v_event is null or b.event_type = v_event)
      and (v_template is null or b.template_id = v_template)
      and (v_lang is null or (jsonb_typeof(b.locales) = 'array' and b.locales ? v_lang))
      and (v_from is null or b.created_at >= v_from::timestamp at time zone 'Asia/Jerusalem')
      and (v_to is null or b.created_at < (v_to + 1)::timestamp at time zone 'Asia/Jerusalem')
      and (
        v_q is null
        or b.id::text = lower(v_q)
        or b.slug like v_like
        or lower((b.draft -> 'hosts')::text) like v_like
        or lower(coalesce(b.owner_name, '')) like v_like
        or (v_pii and b.owner_email like v_like)
      )
  ), reply_counts as (
    -- (only when sorting by them: one pass, not one count per invitation)
    select r.invitation_id, count(*) as n from public.rsvp_responses r where v_sort = 'rsvps' group by r.invitation_id
  ), ranked as (
    select f.*,
      row_number() over (order by
        case when v_sort = 'rsvps' then coalesce(rc.n, 0) end desc nulls last,
        case when v_sort = 'event' then f.event_date >= v_today end desc nulls last,
        case when v_sort = 'event' and f.event_date >= v_today then f.event_date end asc nulls last,
        case when v_sort = 'event' then f.event_date end desc nulls last,
        case when v_sort = 'oldest' then f.created_at end asc,
        f.created_at desc, f.id
      ) as ord
    from filtered f
    left join reply_counts rc on rc.invitation_id = f.id
  ), page as (
    select r.* from ranked r where r.ord > (v_page - 1) * v_size and r.ord <= v_page * v_size
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'page', v_page,
    'pageSize', v_size,
    'counts', jsonb_build_object(
      'total', (select count(*) from base),
      'status', coalesce((select jsonb_object_agg(x.status, x.n) from (
        select b.status, count(*) as n from base b group by b.status) x), '{}'::jsonb),
      'eventType', coalesce((select jsonb_object_agg(x.event_type, x.n) from (
        select b.event_type, count(*) as n from base b group by b.event_type) x), '{}'::jsonb),
      'template', coalesce((select jsonb_object_agg(x.template_id, x.n) from (
        select b.template_id, count(*) as n from base b group by b.template_id) x), '{}'::jsonb)
    ),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'title', public.admin_invitation_title(p.draft),
        'status', p.status,
        'eventType', p.event_type,
        'templateId', p.template_id,
        'eventDate', p.event_date,
        'locales', p.locales,
        'createdAt', p.created_at,
        'publishedAt', coalesce((
          select v.created_at from public.invitation_versions v
          where v.invitation_id = p.id and v.kind = 'publish' and v.version = 1
        ), p.published_at),
        'owner', jsonb_build_object(
          'id', p.owner_id, 'name', p.owner_name, 'email', public.admin_email_for(v_pii, p.owner_email)
        ),
        'guests', (select count(*) from public.invitation_guests g where g.invitation_id = p.id),
        'rsvps', public.admin_invitation_rsvps(p.id),
        'messages', public.admin_invitation_sent(p.id),
        'visits', (select coalesce(sum(d.visits), 0) from public.insight_daily d where d.invitation_id = p.id)
      ) order by p.ord)
      from page p
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

-- One invitation's page: what it is, its owner (their email masked without users.pii), its features'
-- overrides (the server works out what is in force: features/flags), and its numbers — guests, RSVPs,
-- messages by kind and status, the gallery's items, its versions and visits. Read only: it's the
-- customer's. null: no such invitation (or one of the site's samples).
create function public.admin_invitation(p_actor uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_role text := public.admin_require(p_actor, 'invitations.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  i public.invitations;
  u auth.users;
begin
  select * into i from public.invitations x where x.id = p_id and x.owner_id <> public.admin_demo_owner();
  if not found then
    return null;
  end if;
  select * into u from auth.users x where x.id = i.owner_id;
  return jsonb_build_object(
    'id', i.id,
    'slug', i.slug,
    'title', public.admin_invitation_title(i.draft),
    'status', i.status,
    'eventType', i.event_type,
    'templateId', i.template_id,
    'eventDate', i.draft #>> '{event,date}',
    'startTime', i.draft #>> '{event,startTime}',
    'timezone', i.draft ->> 'timezone',
    'locales', i.draft -> 'locales',
    'defaultLocale', i.draft ->> 'defaultLocale',
    'version', i.version,
    'createdAt', i.created_at,
    'updatedAt', i.updated_at,
    'publishedAt', i.published_at,
    'firstPublishedAt', (
      select v.created_at from public.invitation_versions v
      where v.invitation_id = i.id and v.kind = 'publish' and v.version = 1
    ),
    'unpublishedChanges', i.published is not null and i.draft is distinct from i.published,
    'source', case when i.source_id is null then null else jsonb_build_object(
      'id', i.source_id,
      'title', (select public.admin_invitation_title(x.draft) from public.invitations x where x.id = i.source_id)
    ) end,
    'owner', jsonb_build_object(
      'id', u.id,
      'name', public.admin_user_name(u.id),
      'email', public.admin_email_for(v_pii, lower(u.email))
    ),
    'features', i.features,
    'counts', jsonb_build_object(
      'guests', (select count(*) from public.invitation_guests g where g.invitation_id = i.id),
      'guestsWithPhone', (
        select count(*) from public.invitation_guests g where g.invitation_id = i.id and g.phone is not null
      ),
      'rsvps', public.admin_invitation_rsvps(i.id),
      'messages', jsonb_build_object(
        'invitation', public.admin_status_counts((
          select jsonb_object_agg(x.status, x.n) from (
            select m.status, count(*) as n from public.whatsapp_messages m where m.invitation_id = i.id group by m.status
          ) x
        )),
        'table', public.admin_status_counts((
          select jsonb_object_agg(x.status, x.n) from (
            select m.status, count(*) as n from public.seating_notices m
            where m.invitation_id = i.id and m.channel = 'whatsapp' group by m.status
          ) x
        )),
        'gallery', public.admin_status_counts((
          select jsonb_object_agg(x.status, x.n) from (
            select m.status, count(*) as n from public.gallery_notices m
            where m.invitation_id = i.id and m.channel = 'whatsapp' group by m.status
          ) x
        ))
      ),
      'gallery', jsonb_build_object(
        'enabled', (select g.enabled from public.galleries g where g.invitation_id = i.id),
        'items', (
          select count(*) from public.gallery_items g
          where g.invitation_id = i.id and g.deleted_at is null and g.status <> 'uploading'
        ),
        'published', (
          select count(*) from public.gallery_items g
          where g.invitation_id = i.id and g.deleted_at is null and g.status = 'published'
        )
      ),
      'versions', jsonb_build_object(
        'publishes', (
          select count(*) from public.invitation_versions v where v.invitation_id = i.id and v.kind = 'publish'
        ),
        'saves', (select count(*) from public.invitation_versions v where v.invitation_id = i.id and v.kind = 'save')
      ),
      'visits', jsonb_build_object(
        'total', (select coalesce(sum(d.visits), 0) from public.insight_daily d where d.invitation_id = i.id),
        'd30', (
          select coalesce(sum(d.visits), 0) from public.insight_daily d
          where d.invitation_id = i.id and d.day >= (now() at time zone 'Asia/Jerusalem')::date - 29
        )
      )
    )
  );
end $$;

-- Grants a feature to one invitation beyond its owner's plan, or takes the grant back
-- (invitation_feature_grant), and records it. Returns the invitation's overrides; nothing changes
-- (and nothing is recorded) when it already was so.
create function public.admin_invitation_feature(
  p_actor uuid, p_id uuid, p_feature text, p_grant boolean, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
  v_before jsonb;
  v_owner uuid;
  v_after jsonb;
begin
  perform public.admin_require(p_actor, 'invitations.features');
  v_reason := public.admin_reason(p_reason);
  if p_feature is null or p_feature !~ '^[a-z_]{2,40}$' or p_grant is null then
    raise exception 'invalid_feature' using errcode = 'P0001';
  end if;
  select features, owner_id into v_before, v_owner from public.invitations
  where id = p_id and owner_id <> public.admin_demo_owner()
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if coalesce(jsonb_typeof(v_before -> 'grant') = 'array' and (v_before -> 'grant') ? p_feature, false) = p_grant then
    return v_before;
  end if;
  v_after := public.invitation_feature_grant(p_id, p_feature, p_grant);
  perform public.admin_log(p_actor, 'invitations.feature', 'invitation', p_id::text, jsonb_build_object(
    'feature', p_feature, 'grant', p_grant, 'reason', v_reason, 'owner', v_owner
  ));
  return v_after;
end $$;

-- ─── the system ────────────────────────────────────────────────────────────────────────────────

-- The system's state from the database: the recurring jobs (when each last finished, when it was last
-- taken: running when taken after it finished), the WhatsApp queues of the three kinds (waiting,
-- being sent, failed in the last 24 hours, the oldest waiting), the templates' seed version and when
-- the console's live channel was last named (never the name).
create function public.admin_system(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
begin
  perform public.admin_require(p_actor, 'system.view');
  return jsonb_build_object(
    'now', now(),
    'jobs', jsonb_build_object(
      'daily', (select jsonb_build_object('finished', m.value, 'taken', m.updated_at)
                from public.app_meta m where m.key = 'job:daily'),
      'whatsapp', (select jsonb_build_object('finished', m.value, 'taken', m.updated_at)
                   from public.app_meta m where m.key = 'job:whatsapp')
    ),
    'queues', jsonb_build_object(
      'invitation', (
        select jsonb_build_object(
          'queued', count(*) filter (where x.status = 'queued'),
          'sending', count(*) filter (where x.status = 'sending'),
          'oldest', min(x.created_at) filter (where x.status = 'queued'),
          'failed24h', (select count(*) from public.whatsapp_messages f
                        where f.status = 'failed' and f.updated_at >= now() - interval '24 hours')
        )
        from public.whatsapp_messages x where x.status in ('queued', 'sending')
      ),
      'table', (
        select jsonb_build_object(
          'queued', count(*) filter (where x.status = 'queued'),
          'sending', count(*) filter (where x.status = 'sending'),
          'oldest', min(x.created_at) filter (where x.status = 'queued'),
          'failed24h', (select count(*) from public.seating_notices f
                        where f.status = 'failed' and f.updated_at >= now() - interval '24 hours')
        )
        from public.seating_notices x where x.status in ('queued', 'sending')
      ),
      'gallery', (
        select jsonb_build_object(
          'queued', count(*) filter (where x.status = 'queued'),
          'sending', count(*) filter (where x.status = 'sending'),
          'oldest', min(x.created_at) filter (where x.status = 'queued'),
          'failed24h', (select count(*) from public.gallery_notices f
                        where f.status = 'failed' and f.updated_at >= now() - interval '24 hours')
        )
        from public.gallery_notices x where x.status in ('queued', 'sending')
      )
    ),
    'seedVersion', (select jsonb_build_object('value', m.value, 'updatedAt', m.updated_at)
                    from public.app_meta m where m.key = 'seed_version'),
    'channel', (select jsonb_build_object('namedAt', m.updated_at)
                from public.app_meta m where m.key = 'admin:channel')
  );
end $$;

-- ─── privileges: the server's role only; the helpers not even that ─────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_demo_owner()',
    'public.admin_mask_email(text)',
    'public.admin_mask_phone(text)',
    'public.admin_email_for(boolean, text)',
    'public.admin_phone_for(boolean, text)',
    'public.admin_user_name(uuid)',
    'public.admin_user_source(text, jsonb)',
    'public.admin_invitation_title(jsonb)',
    'public.admin_effective_plan(text, text, timestamptz, text, boolean)',
    'public.admin_env_owner(text)',
    'public.admin_role_rank(text)',
    'public.admin_reason(text)',
    'public.admin_customer(uuid)',
    'public.admin_user_sent(uuid)',
    'public.admin_invitation_sent(uuid)',
    'public.admin_invitation_rsvps(uuid)',
    'public.admin_sum_numbers(jsonb[])',
    'public.admin_status_counts(jsonb)',
    'public.admin_whatsapp_batches(int)',
    'public.admin_audit_rows(uuid, text, text, text, bigint, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.admin_overview(uuid)',
    'public.admin_activity(uuid, int)',
    'public.admin_users(uuid, jsonb)',
    'public.admin_user(uuid, uuid)',
    'public.admin_audit_search(uuid, jsonb)',
    'public.admin_user_credits(uuid, uuid, int, text)',
    'public.admin_user_gift(uuid, uuid, text, date, text)',
    'public.admin_user_discount(uuid, uuid, int, date, text, text)',
    'public.admin_user_suspend_check(uuid, uuid, boolean, text)',
    'public.admin_staff_change(uuid, text, text, text, text)',
    'public.admin_staff_drop(uuid, text, text)',
    'public.admin_invitations(uuid, jsonb)',
    'public.admin_invitation(uuid, uuid)',
    'public.admin_invitation_feature(uuid, uuid, text, boolean, text)',
    'public.admin_system(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
