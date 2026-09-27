-- The admin console's cash flow, messages and Badook Events areas (/app/admin/finance, /messages,
-- /partners), and the small log of the emails the system sends.
--
-- Money, as the billing code records it (features/billing/server/billing.ts):
--   · a purchase is a billing_checkouts row — a plan (pro, business: the first month) or a message pack
--     (credits_100/300/1000) — paid, failed, canceled or still open; paid when completed_at is set;
--   · a monthly renewal of a plan is a billing_events row of type renewal.paid / renewal.failed, with
--     the plan (product) and the amount charged;
--   · a cancellation is a billing_events row of type plan.canceled;
--   · prices are shekels including VAT (18%); a plan renews at accounts.plan_price, the price it was
--     bought at (a partner's discount included), else its list price (INVITES_PRICE_*, passed in).
-- WhatsApp's cost: price_usd of the messages Meta charges for (sent, delivered, read — not failed) of
-- the three kinds: the invitations (whatsapp_messages), the table numbers (seating_notices) and the
-- gallery links (gallery_notices) — the notices' WhatsApp ones only. "This month" and days are Israel's.
--
-- Every console function takes the acting staff member first and checks their role's permission
-- (admin_require); contact details come masked for roles without users.pii (admin_view_email /
-- admin_view_phone); the export is recorded (admin_log). email_log: each email's kind and whether it
-- went (no address, no content), 90 days — like the partner API's calls (admin_logs_maintenance).

-- ─── the emails the system sends ───────────────────────────────────────────────────────────────

create table public.email_log (
  id bigint generated always as identity primary key,
  -- what it was (rsvp_reply, rsvp_digest, review, billing_alert, contact, support, other…)
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  -- sent; failed (the provider refused it, or no answer); skipped (email isn't set up: only logged)
  status text not null check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);
create index email_log_created on public.email_log (created_at);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- One email (features/invitations/server/email.ts, after it went or didn't).
create function public.email_log_add(p_kind text, p_status text) returns void
language sql security definer set search_path = '' as $$
  insert into public.email_log (kind, status)
  values (
    case when p_kind ~ '^[a-z_]{1,40}$' then p_kind else 'other' end,
    case when p_status in ('sent', 'failed', 'skipped') then p_status else 'failed' end
  )
$$;

-- ─── indexes for the console's time ranges ─────────────────────────────────────────────────────

create index billing_checkouts_settled on public.billing_checkouts ((coalesce(completed_at, created_at)));
create index billing_events_type_created on public.billing_events (type, created_at);
create index credit_ledger_created on public.credit_ledger (created_at);
create index whatsapp_messages_created on public.whatsapp_messages (created_at);
create index seating_notices_created on public.seating_notices (created_at) where channel = 'whatsapp';
create index gallery_notices_created on public.gallery_notices (created_at) where channel = 'whatsapp';
create index whatsapp_messages_failed on public.whatsapp_messages (updated_at) where status = 'failed';
create index seating_notices_failed on public.seating_notices (updated_at)
  where status = 'failed' and channel = 'whatsapp';
create index gallery_notices_failed on public.gallery_notices (updated_at)
  where status = 'failed' and channel = 'whatsapp';

-- ─── helpers (the functions below only) ────────────────────────────────────────────────────────

-- An email as a role may see it: whole with users.pii, else its first letter and domain (d***@gmail.com).
create function public.admin_view_email(p_email text, p_role text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_email is null then null
    when public.admin_can(p_role, 'users.pii') then p_email
    when strpos(p_email, '@') > 1 then left(p_email, 1) || '***' || substr(p_email, strpos(p_email, '@'))
    else '***'
  end
$$;

-- A phone as a role may see it: whole with users.pii, else only its last three digits (+972 5X-XXX-X123).
create function public.admin_view_phone(p_phone text, p_role text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_phone is null then null
    when public.admin_can(p_role, 'users.pii') then p_phone
    when p_phone ~ '^\+972[0-9]{8,9}$' then '+972 ' || substr(p_phone, 5, 1) || 'X-XXX-X' || right(p_phone, 3)
    else left(p_phone, 3) || ' XXX-X' || right(p_phone, 3)
  end
$$;

-- Every payment between p_from and p_to (null: no bound): a purchase (billing_checkouts) when it was
-- settled (an open one: when it was opened), a monthly renewal (billing_events) when its notice came.
-- ref: the provider's reference (a purchase's payment page, a renewal's event id).
create function public.admin_payments_between(p_from timestamptz, p_to timestamptz)
returns table (
  id text, kind text, user_id uuid, product text, amount numeric, status text, provider text, ref text,
  at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select k.id::text, 'purchase', k.user_id, k.product, k.amount, k.status, k.provider, k.provider_ref,
         coalesce(k.completed_at, k.created_at)
  from public.billing_checkouts k
  where (p_from is null or coalesce(k.completed_at, k.created_at) >= p_from)
    and (p_to is null or coalesce(k.completed_at, k.created_at) < p_to)
  union all
  select e.id, 'renewal', e.user_id, e.product, e.amount,
         case when e.type = 'renewal.paid' then 'paid' else 'failed' end, e.provider, e.id, e.created_at
  from public.billing_events e
  where e.type in ('renewal.paid', 'renewal.failed')
    and (p_from is null or e.created_at >= p_from)
    and (p_to is null or e.created_at < p_to)
$$;

-- Every WhatsApp message of the three kinds queued between p_from and p_to: the invitations, the table
-- numbers and the gallery links (the notices sent from the system's number only).
create function public.admin_whatsapp_between(p_from timestamptz, p_to timestamptz)
returns table (
  kind text, id uuid, invitation_id uuid, owner_id uuid, status text, error text, price_usd numeric,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select 'invitation', m.id, m.invitation_id, m.owner_id, m.status, m.error, m.price_usd, m.created_at,
         m.updated_at
  from public.whatsapp_messages m
  where m.created_at >= p_from and m.created_at < p_to
  union all
  select 'table', n.id, n.invitation_id, n.owner_id, n.status, n.error, n.price_usd, n.created_at, n.updated_at
  from public.seating_notices n
  where n.channel = 'whatsapp' and n.created_at >= p_from and n.created_at < p_to
  union all
  select 'gallery', g.id, g.invitation_id, g.owner_id, g.status, g.error, g.price_usd, g.created_at,
         g.updated_at
  from public.gallery_notices g
  where g.channel = 'whatsapp' and g.created_at >= p_from and g.created_at < p_to
$$;

-- A plan that renews through the provider: paid (pro, business), running (active, or a trial), with a
-- provider subscription, and not lapsed (a renewal that never came keeps the plan 14 days).
create function public.admin_subscription_live(a public.accounts, p_now timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select a.plan in ('pro', 'business') and a.plan_status in ('active', 'trialing')
     and a.billing_subscription_id is not null
     and (a.plan_renews_at is null or a.plan_renews_at + interval '14 days' >= p_now)
$$;

-- What the plan is charged each month: the price it was bought at, else its list price.
create function public.admin_plan_price(a public.accounts, p_prices jsonb) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(a.plan_price, (p_prices ->> a.plan)::numeric, 0)
$$;

-- ─── cash flow ─────────────────────────────────────────────────────────────────────────────────

-- The cash-flow area: income (this month, last month, 12 months by kind, 90 days by day), WhatsApp's
-- cost by month (USD), the subscriptions renewing and their MRR, what renews in the next 30 days and
-- what is at risk, cancellations, and the credits economy by month. p_prices: the plans' list prices
-- ({ "pro": 49, "business": 149 }). Every amount in shekels including VAT, except whatsappUsd.
create function public.admin_finance_overview(p_actor uuid, p_prices jsonb, p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'finance.view');
  v_month timestamp := date_trunc('month', p_now at time zone 'Asia/Jerusalem');
  v_month_start timestamptz := v_month at time zone 'Asia/Jerusalem';
  v_prev_start timestamptz := (v_month - interval '1 month') at time zone 'Asia/Jerusalem';
  v_next_start timestamptz := (v_month + interval '1 month') at time zone 'Asia/Jerusalem';
  v_year_start timestamptz := (v_month - interval '11 months') at time zone 'Asia/Jerusalem';
  v_today date := (p_now at time zone 'Asia/Jerusalem')::date;
  v_prev_same timestamptz;
  v jsonb;
begin
  -- the same point of last month (for a fair "so far" comparison)
  v_prev_same := least(v_prev_start + (p_now - v_month_start), v_month_start);
  with paid as (
    select p.*,
           case when p.kind = 'renewal' then 'renewals'
                when p.product in ('pro', 'business') then 'newPlans'
                else 'packs' end as cat,
           to_char(p.at at time zone 'Asia/Jerusalem', 'YYYY-MM') as month,
           (p.at at time zone 'Asia/Jerusalem')::date as day
    from public.admin_payments_between(v_year_start, v_next_start) p
    where p.status = 'paid'
  ),
  wa as (
    select to_char(w.created_at at time zone 'Asia/Jerusalem', 'YYYY-MM') as month, sum(w.price_usd) as usd
    from public.admin_whatsapp_between(v_year_start, v_next_start) w
    where w.status in ('sent', 'delivered', 'read')
    group by 1
  ),
  credits as (
    select to_char(l.created_at at time zone 'Asia/Jerusalem', 'YYYY-MM') as month,
           coalesce(sum(l.delta) filter (where l.reason = 'purchase'), 0) as bought,
           coalesce(sum(l.delta) filter (where l.reason = 'plan_grant'), 0) as plans,
           coalesce(sum(l.delta) filter (where l.reason in ('admin', 'support') and l.delta > 0), 0) as team_added,
           coalesce(-sum(l.delta) filter (where l.reason in ('admin', 'support') and l.delta < 0), 0) as team_removed,
           coalesce(-sum(l.delta) filter (where l.reason = 'whatsapp_send'), 0) as consumed,
           coalesce(sum(l.delta) filter (where l.reason = 'whatsapp_refund'), 0) as refunded
    from public.credit_ledger l
    where l.created_at >= v_year_start and l.created_at < v_next_start
    group by 1
  ),
  months as (
    select to_char(m, 'YYYY-MM') as month
    from generate_series(v_month - interval '11 months', v_month, interval '1 month') m
  ),
  live as (
    select a.*, public.admin_plan_price(a, p_prices) as price
    from public.accounts a
    where public.admin_subscription_live(a, p_now)
  ),
  at_risk as (
    select a.user_id, a.full_name, a.plan, a.plan_renews_at, public.admin_plan_price(a, p_prices) as price,
           case when a.plan_status = 'past_due' then 'past_due' else 'late' end as why
    from public.accounts a
    where a.plan in ('pro', 'business')
      and (a.plan_renews_at is null or a.plan_renews_at + interval '14 days' >= p_now)
      and (a.plan_status = 'past_due'
        or (a.plan_status = 'active' and a.billing_subscription_id is not null
            and a.plan_renews_at < p_now - interval '3 days'))
  )
  select jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'today', v_today,
    'thisMonth', (
      select jsonb_build_object(
        'newPlans', coalesce(sum(amount) filter (where cat = 'newPlans'), 0),
        'renewals', coalesce(sum(amount) filter (where cat = 'renewals'), 0),
        'packs', coalesce(sum(amount) filter (where cat = 'packs'), 0),
        'total', coalesce(sum(amount), 0),
        'payments', count(*),
        'customers', count(distinct user_id))
      from paid where at >= v_month_start
    ),
    'lastMonth', (
      select jsonb_build_object(
        'newPlans', coalesce(sum(amount) filter (where cat = 'newPlans'), 0),
        'renewals', coalesce(sum(amount) filter (where cat = 'renewals'), 0),
        'packs', coalesce(sum(amount) filter (where cat = 'packs'), 0),
        'total', coalesce(sum(amount), 0),
        'toDate', coalesce(sum(amount) filter (where at < v_prev_same), 0),
        'payments', count(*),
        'customers', count(distinct user_id))
      from paid where at >= v_prev_start and at < v_month_start
    ),
    'months', (
      select jsonb_agg(jsonb_build_object(
        'month', ms.month,
        'newPlans', coalesce(p.new_plans, 0),
        'renewals', coalesce(p.renewals, 0),
        'packs', coalesce(p.packs, 0),
        'total', coalesce(p.total, 0),
        'payments', coalesce(p.payments, 0),
        'whatsappUsd', coalesce(wa.usd, 0)
      ) order by ms.month)
      from months ms
      left join (
        select month,
               sum(amount) filter (where cat = 'newPlans') as new_plans,
               sum(amount) filter (where cat = 'renewals') as renewals,
               sum(amount) filter (where cat = 'packs') as packs,
               sum(amount) as total,
               count(*) as payments
        from paid group by month
      ) p on p.month = ms.month
      left join wa on wa.month = ms.month
    ),
    'days', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'total', coalesce(p.total, 0)) order by d.day)
      from (select (v_today - g)::date as day from generate_series(0, 89) g) d
      left join (select day, sum(amount) as total from paid group by day) p on p.day = d.day
    ),
    'whatsappUsdMonth', coalesce((select usd from wa where month = to_char(v_month, 'YYYY-MM')), 0),
    'subscriptions', jsonb_build_object(
      'pro', (select jsonb_build_object('count', count(*), 'mrr', coalesce(sum(price), 0),
                                        'listPriced', count(*) filter (where plan_price is null))
              from live where plan = 'pro'),
      'business', (select jsonb_build_object('count', count(*), 'mrr', coalesce(sum(price), 0),
                                             'listPriced', count(*) filter (where plan_price is null))
                   from live where plan = 'business')
    ),
    'creditsSoldMonth', coalesce((select bought from credits where month = to_char(v_month, 'YYYY-MM')), 0),
    'pastDue', (select jsonb_build_object('count', count(*), 'monthly', coalesce(sum(price), 0))
                from at_risk where why = 'past_due'),
    'late', (select jsonb_build_object('count', count(*), 'monthly', coalesce(sum(price), 0))
             from at_risk where why = 'late'),
    'cancellationsMonth', (
      select count(distinct e.user_id) from public.billing_events e
      where e.type = 'plan.canceled' and e.created_at >= v_month_start and e.created_at < v_next_start
    ),
    'forecast', (
      select jsonb_build_object(
        'count', count(*),
        'amount', coalesce(sum(price), 0),
        'weeks', jsonb_build_array(
          jsonb_build_object('count', count(*) filter (where w = 0), 'amount', coalesce(sum(price) filter (where w = 0), 0)),
          jsonb_build_object('count', count(*) filter (where w = 1), 'amount', coalesce(sum(price) filter (where w = 1), 0)),
          jsonb_build_object('count', count(*) filter (where w = 2), 'amount', coalesce(sum(price) filter (where w = 2), 0)),
          jsonb_build_object('count', count(*) filter (where w = 3), 'amount', coalesce(sum(price) filter (where w = 3), 0))
        ))
      from (
        select price, least(floor(extract(epoch from (plan_renews_at - p_now)) / (7 * 86400))::int, 3) as w
        from live
        where plan_renews_at >= p_now and plan_renews_at < p_now + interval '30 days'
      ) f
    ),
    'atRisk', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', r.user_id,
        'name', r.full_name,
        'email', public.admin_view_email(u.email, v_role),
        'plan', r.plan,
        'why', r.why,
        'monthly', r.price,
        'renewsAt', r.plan_renews_at
      ) order by r.plan_renews_at nulls last)
      from (select * from at_risk order by plan_renews_at nulls last limit 50) r
      left join auth.users u on u.id = r.user_id
    ), '[]'::jsonb),
    'credits', (
      select jsonb_agg(jsonb_build_object(
        'month', ms.month,
        'bought', coalesce(c.bought, 0),
        'plans', coalesce(c.plans, 0),
        'teamAdded', coalesce(c.team_added, 0),
        'teamRemoved', coalesce(c.team_removed, 0),
        'consumed', coalesce(c.consumed, 0),
        'refunded', coalesce(c.refunded, 0)
      ) order by ms.month)
      from months ms left join credits c on c.month = ms.month
    )
  ) into v;
  return v;
end $$;

-- The payments, filtered — p_filters: { kind: purchase | renewal, status: paid | failed | canceled |
-- pending (none: all but the open ones), product, provider, from, to (Israel days, inclusive), q (a
-- name, a reference, or an email for roles with users.pii) } — newest first, contact details as the role
-- may see them.
create function public.admin_payments_rows(p_role text, p_filters jsonb)
returns table (
  id text, kind text, at timestamptz, user_id uuid, name text, email text, product text, amount numeric,
  status text, provider text, ref text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_kind text := nullif(p_filters ->> 'kind', '');
  v_status text := nullif(p_filters ->> 'status', '');
  v_product text := nullif(p_filters ->> 'product', '');
  v_provider text := nullif(p_filters ->> 'provider', '');
  v_from timestamptz := (nullif(p_filters ->> 'from', '')::date)::timestamp at time zone 'Asia/Jerusalem';
  v_to timestamptz := (nullif(p_filters ->> 'to', '')::date + 1)::timestamp at time zone 'Asia/Jerusalem';
  v_q text := lower(nullif(btrim(p_filters ->> 'q'), ''));
  v_pii boolean := public.admin_can(p_role, 'users.pii');
begin
  return query
  select p.id, p.kind, p.at, p.user_id, a.full_name, public.admin_view_email(u.email, p_role), p.product,
         p.amount, p.status, p.provider, p.ref
  from public.admin_payments_between(v_from, v_to) p
  left join public.accounts a on a.user_id = p.user_id
  left join auth.users u on u.id = p.user_id
  where (v_kind is null or p.kind = v_kind)
    and (case when v_status is null then p.status <> 'pending' else p.status = v_status end)
    and (v_product is null or p.product = v_product)
    and (v_provider is null or p.provider = v_provider)
    and (v_q is null
      or strpos(lower(coalesce(a.full_name, '')), v_q) > 0
      or strpos(lower(coalesce(p.ref, '')), v_q) > 0
      or (v_pii and strpos(lower(coalesce(u.email, '')), v_q) > 0))
  order by p.at desc, p.id desc;
end $$;

create function public.admin_payment_json(
  p_id text, p_kind text, p_at timestamptz, p_user_id uuid, p_name text, p_email text, p_product text,
  p_amount numeric, p_status text, p_provider text, p_ref text
) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', p_id, 'kind', p_kind, 'at', p_at, 'userId', p_user_id, 'name', p_name, 'email', p_email,
    'product', p_product, 'amount', p_amount, 'status', p_status, 'provider', p_provider, 'ref', p_ref
  )
$$;

-- A page of the payments (p_limit up to 200), with how many match, what the paid ones among them add
-- up to, and the providers there are (for the filter).
create function public.admin_finance_payments(p_actor uuid, p_filters jsonb, p_limit int, p_offset int)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'finance.view');
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v jsonb;
begin
  with matching as (select * from public.admin_payments_rows(v_role, coalesce(p_filters, '{}'::jsonb)))
  select jsonb_build_object(
    'total', (select count(*) from matching),
    'paidSum', (select coalesce(sum(amount), 0) from matching where status = 'paid'),
    'rows', coalesce((
      select jsonb_agg(public.admin_payment_json(r.id, r.kind, r.at, r.user_id, r.name, r.email, r.product,
                                                 r.amount, r.status, r.provider, r.ref) order by r.at desc, r.id desc)
      from (select * from matching order by at desc, id desc limit v_limit offset v_offset) r
    ), '[]'::jsonb),
    'providers', coalesce((
      select jsonb_agg(distinct x.provider order by x.provider)
      from (select provider from public.billing_checkouts union select provider from public.billing_events
            where type in ('renewal.paid', 'renewal.failed')) x
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- The payments for a spreadsheet (finance.export; at most 10,000, newest first) — recorded in the
-- record of actions with the filters and how many rows went out.
create function public.admin_finance_export(p_actor uuid, p_filters jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'finance.export');
  v jsonb;
begin
  select coalesce(jsonb_agg(public.admin_payment_json(r.id, r.kind, r.at, r.user_id, r.name, r.email,
                                                      r.product, r.amount, r.status, r.provider, r.ref)
                            order by r.at desc, r.id desc), '[]'::jsonb)
  into v
  from (select * from public.admin_payments_rows(v_role, coalesce(p_filters, '{}'::jsonb)) x
        order by x.at desc, x.id desc limit 10000) r;
  perform public.admin_log(p_actor, 'finance.export', 'payment', null, jsonb_build_object(
    'filters', coalesce(p_filters, '{}'::jsonb),
    'rows', jsonb_array_length(v)
  ));
  return v;
end $$;

-- The money on the console's overview: this month's and last month's income, the MRR and the
-- subscriptions it comes from, WhatsApp's cost this month (USD).
create function public.admin_finance_summary(p_actor uuid, p_prices jsonb, p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'finance.view');
  v_month timestamp := date_trunc('month', p_now at time zone 'Asia/Jerusalem');
  v_month_start timestamptz := v_month at time zone 'Asia/Jerusalem';
  v_prev_start timestamptz := (v_month - interval '1 month') at time zone 'Asia/Jerusalem';
  v_next_start timestamptz := (v_month + interval '1 month') at time zone 'Asia/Jerusalem';
begin
  return jsonb_build_object(
    'revenueMonth', (select coalesce(sum(amount), 0) from public.admin_payments_between(v_month_start, v_next_start)
                     where status = 'paid'),
    'revenuePrevMonth', (select coalesce(sum(amount), 0)
                         from public.admin_payments_between(v_prev_start, v_month_start) where status = 'paid'),
    'mrr', (select coalesce(sum(public.admin_plan_price(a, p_prices)), 0) from public.accounts a
            where public.admin_subscription_live(a, p_now)),
    'activeSubscriptions', (select count(*) from public.accounts a where public.admin_subscription_live(a, p_now)),
    'whatsappUsdMonth', (select coalesce(sum(price_usd), 0)
                         from public.admin_whatsapp_between(v_month_start, v_next_start)
                         where status in ('sent', 'delivered', 'read'))
  );
end $$;

-- ─── messages ──────────────────────────────────────────────────────────────────────────────────

-- The messages area: WhatsApp's three kinds over the last 30 days (Israel) — by day, kind and status as
-- they are now, with their cost — this month's cost, the queues now, failures by error (top 10) and
-- the latest 50 (the invitation and its owner; no guest details), the numbers that asked to stop, and
-- the emails by day and kind.
create function public.admin_messages_overview(p_actor uuid, p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'messages.view');
  v_today date := (p_now at time zone 'Asia/Jerusalem')::date;
  v_from timestamptz := (v_today - 29)::timestamp at time zone 'Asia/Jerusalem';
  v_to timestamptz := (v_today + 1)::timestamp at time zone 'Asia/Jerusalem';
  v_month_start timestamptz := date_trunc('month', p_now at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  v jsonb;
begin
  with w as (select * from public.admin_whatsapp_between(v_from, v_to))
  select jsonb_build_object(
    'from', v_today - 29,
    'to', v_today,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.day, 'kind', x.kind, 'status', x.status, 'n', x.n)
                       order by x.day, x.kind, x.status)
      from (select (w.created_at at time zone 'Asia/Jerusalem')::date as day, w.kind, w.status, count(*) as n
            from w group by 1, 2, 3) x
    ), '[]'::jsonb),
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object('kind', x.kind, 'status', x.status, 'n', x.n, 'usd', x.usd)
                       order by x.kind, x.status)
      from (select w.kind, w.status, count(*) as n, coalesce(sum(w.price_usd), 0) as usd from w group by 1, 2) x
    ), '[]'::jsonb),
    'monthUsd', (
      select coalesce(sum(m.price_usd), 0)
      from public.admin_whatsapp_between(v_month_start, v_to) m
      where m.status in ('sent', 'delivered', 'read')
    ),
    'queue', (
      select jsonb_agg(jsonb_build_object('kind', q.kind, 'queued', q.queued, 'retrying', q.retrying,
                                          'sending', q.sending, 'stuck', q.stuck, 'oldestAt', q.oldest)
                       order by q.ord)
      from (
        select 1 as ord, 'invitation' as kind,
               count(*) filter (where status = 'queued') as queued,
               count(*) filter (where status = 'queued' and next_attempt_at > p_now) as retrying,
               count(*) filter (where status = 'sending') as sending,
               count(*) filter (where status = 'sending' and claimed_at < p_now - interval '10 minutes') as stuck,
               min(created_at) as oldest
        from public.whatsapp_messages where status in ('queued', 'sending')
        union all
        select 2, 'table',
               count(*) filter (where status = 'queued'),
               count(*) filter (where status = 'queued' and next_attempt_at > p_now),
               count(*) filter (where status = 'sending'),
               count(*) filter (where status = 'sending' and claimed_at < p_now - interval '10 minutes'),
               min(created_at)
        from public.seating_notices where status in ('queued', 'sending') and channel = 'whatsapp'
        union all
        select 3, 'gallery',
               count(*) filter (where status = 'queued'),
               count(*) filter (where status = 'queued' and next_attempt_at > p_now),
               count(*) filter (where status = 'sending'),
               count(*) filter (where status = 'sending' and claimed_at < p_now - interval '10 minutes'),
               min(created_at)
        from public.gallery_notices where status in ('queued', 'sending') and channel = 'whatsapp'
      ) q
    ),
    'errors', coalesce((
      select jsonb_agg(jsonb_build_object('error', x.error, 'n', x.n, 'invitation', x.invitation,
                                          'table', x.tables, 'gallery', x.gallery, 'lastAt', x.last_at)
                       order by x.n desc, x.last_at desc)
      from (
        select coalesce(nullif(btrim(w.error), ''), '') as error, count(*) as n,
               count(*) filter (where w.kind = 'invitation') as invitation,
               count(*) filter (where w.kind = 'table') as tables,
               count(*) filter (where w.kind = 'gallery') as gallery,
               max(w.updated_at) as last_at
        from w where w.status = 'failed'
        group by 1 order by 2 desc, 6 desc limit 10
      ) x
    ), '[]'::jsonb),
    'failures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'kind', f.kind,
        'at', f.updated_at,
        'error', f.error,
        'invitationId', f.invitation_id,
        'slug', i.slug,
        'hosts', i.draft -> 'hosts',
        'locale', i.draft ->> 'defaultLocale',
        'ownerId', f.owner_id,
        'ownerName', a.full_name,
        'ownerEmail', public.admin_view_email(u.email, v_role)
      ) order by f.updated_at desc, f.id)
      from (
        select * from (
          select 'invitation' as kind, m.id, m.invitation_id, m.owner_id, m.error, m.updated_at
          from public.whatsapp_messages m where m.status = 'failed'
          order by m.updated_at desc limit 50
        ) a1
        union all
        select * from (
          select 'table', n.id, n.invitation_id, n.owner_id, n.error, n.updated_at
          from public.seating_notices n where n.status = 'failed' and n.channel = 'whatsapp'
          order by n.updated_at desc limit 50
        ) a2
        union all
        select * from (
          select 'gallery', g.id, g.invitation_id, g.owner_id, g.error, g.updated_at
          from public.gallery_notices g where g.status = 'failed' and g.channel = 'whatsapp'
          order by g.updated_at desc limit 50
        ) a3
        order by updated_at desc, id limit 50
      ) f
      left join public.invitations i on i.id = f.invitation_id
      left join public.accounts a on a.user_id = f.owner_id
      left join auth.users u on u.id = f.owner_id
    ), '[]'::jsonb),
    'optOuts', (
      select jsonb_build_object(
        'total', count(*),
        'last30', count(*) filter (where o.created_at >= v_from),
        'reply', count(*) filter (where o.source = 'reply'),
        'meta', count(*) filter (where o.source = 'meta'))
      from public.whatsapp_opt_outs o
    ),
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.day, 'kind', x.kind, 'status', x.status, 'n', x.n)
                       order by x.day, x.kind, x.status)
      from (select (e.created_at at time zone 'Asia/Jerusalem')::date as day, e.kind, e.status, count(*) as n
            from public.email_log e where e.created_at >= v_from and e.created_at < v_to
            group by 1, 2, 3) x
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ─── Badook Events ─────────────────────────────────────────────────────────────────────────────

-- Who in Badook Events opened one of its accounts, as a role may see it: the creator of the call that
-- opened it (via 'call'), else the owner of the venue that call named, else the owner of the account's
-- venue now (via 'venue'). null: nobody said (an account opened before the calls said who).
create function public.admin_partner_opener(p_user_id uuid, p_role text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with opening as (
    select p.* from public.partner_provisions p
    where p.user_id = p_user_id and p.action in ('created', 'linked')
    order by p.id limit 1
  ),
  candidates as (
    select 1 as ord, o.created_by_id as id, o.created_by_name as name, o.created_by_email as email,
           o.created_by_role as role, 'call' as via
    from opening o where o.created_by_id is not null
    union all
    select 2, v.owner_id, v.owner_name, v.owner_email, v.owner_role, 'venue'
    from opening o join public.partner_venues v on v.id = o.venue_id where v.owner_id is not null
    union all
    select 3, v.owner_id, v.owner_name, v.owner_email, v.owner_role, 'venue'
    from public.partner_venue_users pu join public.partner_venues v on v.id = pu.venue_id
    where pu.user_id = p_user_id and v.owner_id is not null
  )
  select jsonb_build_object('id', c.id, 'name', c.name, 'email', public.admin_view_email(c.email, p_role),
                            'role', c.role, 'via', c.via)
  from candidates c order by c.ord limit 1
$$;

-- The partner's accounts, one row each: who they are (contact details as the role may see them), when
-- and by whom in Badook Events they were opened, their venue, plan, invitations, what they paid (all
-- of it, and this month) and whether they were active in the last 30 days (signed in, or edited an
-- invitation).
create function public.admin_partner_rows(p_role text, p_source text, p_now timestamptz)
returns table (
  user_id uuid, name text, email text, phone text, external_id text, opened_at timestamptz, opener jsonb,
  venue_id text, venue_name text, plan text, plan_status text, paid_plan boolean, active boolean,
  invitations int, revenue numeric, revenue_month numeric, last_sign_in_at timestamptz, user_managed boolean
)
language sql stable security definer set search_path = '' as $$
  with money as (
    select p.user_id,
           sum(p.amount) filter (where p.status = 'paid') as revenue,
           sum(p.amount) filter (where p.status = 'paid'
             and p.at >= date_trunc('month', p_now at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem')
             as revenue_month
    from public.admin_payments_between(null, null) p
    where p.user_id in (select a.user_id from public.accounts a where a.source = p_source)
    group by p.user_id
  )
  select a.user_id, a.full_name, public.admin_view_email(u.email, p_role), public.admin_view_phone(a.phone, p_role),
         a.external_id, a.created_at, public.admin_partner_opener(a.user_id, p_role), v.external_id, v.name,
         a.plan, a.plan_status,
         a.plan <> 'free' and case when a.plan_status = 'canceled' then coalesce(a.plan_renews_at > p_now, false)
                                   else a.plan_renews_at is null or a.plan_renews_at + interval '14 days' >= p_now end,
         coalesce(u.last_sign_in_at >= p_now - interval '30 days', false)
           or exists (select 1 from public.invitations i
                      where i.owner_id = a.user_id and i.updated_at >= p_now - interval '30 days'),
         (select count(*)::int from public.invitations i
          where i.owner_id = a.user_id and i.status <> 'archived' and i.source_id is null),
         coalesce(m.revenue, 0), coalesce(m.revenue_month, 0), u.last_sign_in_at,
         public.user_self_managed(a.user_id)
  from public.accounts a
  join auth.users u on u.id = a.user_id
  left join public.partner_venue_users pu on pu.user_id = a.user_id
  left join public.partner_venues v on v.id = pu.venue_id and v.source = p_source
  left join money m on m.user_id = a.user_id
  where a.source = p_source
$$;

-- The Badook Events area: its accounts (how many, new in 30 days, active in 30 days, on a paid plan,
-- what they paid), grouped by the Badook Events user who opened them and by venue, and the API's health
-- (calls a day for 30 days: answered, refused (4xx), failed (5xx); the last 24 hours; the last call and
-- the last error; by endpoint).
create function public.admin_partners_overview(p_actor uuid, p_source text, p_now timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'partners.view');
  v_today date := (p_now at time zone 'Asia/Jerusalem')::date;
  v_from timestamptz := (v_today - 29)::timestamp at time zone 'Asia/Jerusalem';
  v jsonb;
begin
  with r as (select * from public.admin_partner_rows(v_role, p_source, p_now)),
  calls as (select * from public.partner_api_calls c where c.source = p_source and c.created_at >= v_from)
  select jsonb_build_object(
    'accounts', (
      select jsonb_build_object(
        'total', count(*),
        'last30', count(*) filter (where opened_at >= p_now - interval '30 days'),
        'active30', count(*) filter (where active),
        'paid', count(*) filter (where paid_plan),
        'revenue', coalesce(sum(revenue), 0),
        'revenueMonth', coalesce(sum(revenue_month), 0),
        'unknownOpener', count(*) filter (where opener is null))
      from r
    ),
    'openers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'role', x.role, 'email', x.email, 'via', x.via, 'accounts', x.accounts,
        'paid', x.paid, 'venues', x.venues, 'lastAt', x.last_at
      ) order by x.accounts desc, x.last_at desc)
      from (
        -- (each detail as the latest call that gave it said it; 'call' when any account's call named them)
        select opener ->> 'id' as id,
               (array_agg(opener ->> 'name' order by opened_at desc) filter (where opener ->> 'name' is not null))[1] as name,
               (array_agg(opener ->> 'role' order by opened_at desc) filter (where opener ->> 'role' is not null))[1] as role,
               (array_agg(opener ->> 'email' order by opened_at desc) filter (where opener ->> 'email' is not null))[1] as email,
               case when bool_or(opener ->> 'via' = 'call') then 'call' else 'venue' end as via,
               count(*) as accounts,
               count(*) filter (where paid_plan) as paid,
               coalesce(jsonb_agg(distinct venue_name) filter (where venue_name is not null), '[]'::jsonb) as venues,
               max(opened_at) as last_at
        from r where opener is not null
        group by opener ->> 'id'
        order by count(*) desc, max(opened_at) desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.external_id, 'name', v.name, 'address', v.address, 'floorPlan', v.plan_path is not null,
        'planType', v.plan_type, 'widthMeters', v.width_meters,
        'accounts', (select count(*) from public.partner_venue_users pu where pu.venue_id = v.id),
        'owner', case when v.owner_id is null then null else jsonb_build_object(
          'id', v.owner_id, 'name', v.owner_name, 'role', v.owner_role,
          'email', public.admin_view_email(v.owner_email, v_role)) end,
        'createdAt', v.created_at, 'updatedAt', v.updated_at
      ) order by (select count(*) from public.partner_venue_users pu where pu.venue_id = v.id) desc, v.name)
      from public.partner_venues v where v.source = p_source
    ), '[]'::jsonb),
    'api', jsonb_build_object(
      'days', (
        select jsonb_agg(jsonb_build_object('day', d.day, 'ok', coalesce(c.ok, 0), 'refused', coalesce(c.refused, 0),
                                            'failed', coalesce(c.failed, 0)) order by d.day)
        from (select (v_today - g)::date as day from generate_series(0, 29) g) d
        left join (
          select (created_at at time zone 'Asia/Jerusalem')::date as day,
                 count(*) filter (where status < 400) as ok,
                 count(*) filter (where status between 400 and 499) as refused,
                 count(*) filter (where status >= 500) as failed
          from calls group by 1
        ) c on c.day = d.day
      ),
      'last24h', (
        select jsonb_build_object(
          'calls', count(*),
          'refused', count(*) filter (where status between 400 and 499),
          'failed', count(*) filter (where status >= 500),
          'avgMs', coalesce(round(avg(duration_ms)), 0))
        from public.partner_api_calls
        where source = p_source and created_at >= p_now - interval '24 hours'
      ),
      'lastCall', (
        select jsonb_build_object('at', c.created_at, 'method', c.method, 'endpoint', c.endpoint,
                                  'status', c.status, 'code', c.code, 'durationMs', c.duration_ms)
        from public.partner_api_calls c where c.source = p_source
        order by c.created_at desc, c.id desc limit 1
      ),
      'lastError', (
        select jsonb_build_object('at', c.created_at, 'method', c.method, 'endpoint', c.endpoint,
                                  'status', c.status, 'code', c.code, 'durationMs', c.duration_ms)
        from public.partner_api_calls c where c.source = p_source and c.status >= 400
        order by c.created_at desc, c.id desc limit 1
      ),
      'endpoints', coalesce((
        select jsonb_agg(jsonb_build_object('method', x.method, 'endpoint', x.endpoint, 'calls', x.calls,
                                            'refused', x.refused, 'failed', x.failed, 'avgMs', x.avg_ms)
                         order by x.calls desc, x.endpoint, x.method)
        from (
          select method, endpoint, count(*) as calls,
                 count(*) filter (where status between 400 and 499) as refused,
                 count(*) filter (where status >= 500) as failed,
                 round(avg(duration_ms)) as avg_ms
          from calls group by 1, 2
        ) x
      ), '[]'::jsonb)
    )
  ) into v;
  return v;
end $$;

-- A page of the partner's accounts, newest first (p_query: a name, the partner's id of the account, of
-- the user who opened it or of the venue, the venue's or the opener's name — or an email, for roles
-- with users.pii), with how many match.
create function public.admin_partners_accounts(
  p_actor uuid, p_source text, p_query text, p_limit int, p_offset int, p_now timestamptz default now()
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'partners.view');
  v_q text := lower(nullif(btrim(p_query), ''));
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  v jsonb;
begin
  with r as (
    select * from public.admin_partner_rows(v_role, p_source, p_now) x
    where v_q is null
       or strpos(lower(coalesce(x.name, '')), v_q) > 0
       or strpos(lower(coalesce(x.external_id, '')), v_q) > 0
       or strpos(lower(coalesce(x.venue_name, '')), v_q) > 0
       or strpos(lower(coalesce(x.venue_id, '')), v_q) > 0
       or strpos(lower(coalesce(x.opener ->> 'name', '')), v_q) > 0
       or strpos(lower(coalesce(x.opener ->> 'id', '')), v_q) > 0
       or (v_pii and strpos(lower(coalesce(x.email, '')), v_q) > 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from r),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', p.user_id, 'name', p.name, 'email', p.email, 'phone', p.phone, 'externalId', p.external_id,
        'openedAt', p.opened_at, 'opener', p.opener,
        'venue', case when p.venue_id is null then null else jsonb_build_object('id', p.venue_id, 'name', p.venue_name) end,
        'plan', p.plan, 'planStatus', p.plan_status, 'paidPlan', p.paid_plan, 'active', p.active,
        'invitations', p.invitations, 'revenue', p.revenue, 'lastSignInAt', p.last_sign_in_at,
        'userManaged', p.user_managed
      ) order by p.opened_at desc, p.user_id)
      from (select * from r order by opened_at desc, user_id
            limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) p
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- On a user's page in the console: where the account came from when Badook Events opened it — its id
-- there, when, who opened it, its venue, whether it signs in by itself, and the calls about it (the
-- latest 20). null for an account opened some other way.
create function public.admin_partners_user_source(p_actor uuid, p_source text, p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'partners.view');
  a public.accounts;
begin
  select * into a from public.accounts where user_id = p_user_id and source = p_source;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'source', a.source,
    'externalId', a.external_id,
    'openedAt', a.created_at,
    'opener', public.admin_partner_opener(p_user_id, v_role),
    'venue', (
      select jsonb_build_object('id', v.external_id, 'name', v.name, 'address', v.address)
      from public.partner_venue_users pu join public.partner_venues v on v.id = pu.venue_id
      where pu.user_id = p_user_id and v.source = p_source
    ),
    'userManaged', public.user_self_managed(p_user_id),
    'provisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', p.action,
        'at', p.created_at,
        'by', case when p.created_by_id is null then null else jsonb_build_object(
          'id', p.created_by_id, 'name', p.created_by_name, 'role', p.created_by_role,
          'email', public.admin_view_email(p.created_by_email, v_role)) end,
        'venue', v.name
      ) order by p.id desc)
      from (select * from public.partner_provisions where user_id = p_user_id order by id desc limit 20) p
      left join public.partner_venues v on v.id = p.venue_id
    ), '[]'::jsonb)
  );
end $$;

-- The overview's activity feed: accounts opened through Badook Events, newest first — the account's
-- name, who opened it (the call's creator, else the venue's owner) and the venue. Names only.
create function public.admin_partners_activity(p_actor uuid, p_source text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_require(p_actor, 'partners.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'at', x.created_at, 'userId', x.user_id, 'name', x.full_name, 'action', x.action,
      'byName', x.by_name, 'byRole', x.by_role, 'venue', x.venue
    ) order by x.created_at desc, x.id desc)
    from (
      select p.id, p.created_at, p.user_id, a.full_name, p.action,
             coalesce(p.created_by_name, case when p.created_by_id is null then v.owner_name end) as by_name,
             coalesce(p.created_by_role, case when p.created_by_id is null then v.owner_role end) as by_role,
             v.name as venue
      from public.partner_provisions p
      join public.accounts a on a.user_id = p.user_id
      left join public.partner_venues v on v.id = p.venue_id
      where p.source = p_source and p.action in ('created', 'linked')
      order by p.created_at desc, p.id desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) x
  ), '[]'::jsonb);
end $$;

-- ─── housekeeping (the daily job) ──────────────────────────────────────────────────────────────

-- The partner API's calls and the emails' log are kept 90 days (the privacy policy says so).
create function public.admin_logs_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_calls int;
  v_emails int;
begin
  delete from public.partner_api_calls where created_at < now() - interval '90 days';
  get diagnostics v_calls = row_count;
  delete from public.email_log where created_at < now() - interval '90 days';
  get diagnostics v_emails = row_count;
  return jsonb_build_object('partnerCalls', v_calls, 'emails', v_emails);
end $$;

-- ─── privileges: the server's role only; the helpers not even that ─────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_view_email(text, text)',
    'public.admin_view_phone(text, text)',
    'public.admin_payments_between(timestamptz, timestamptz)',
    'public.admin_whatsapp_between(timestamptz, timestamptz)',
    'public.admin_subscription_live(public.accounts, timestamptz)',
    'public.admin_plan_price(public.accounts, jsonb)',
    'public.admin_payments_rows(text, jsonb)',
    'public.admin_payment_json(text, text, timestamptz, uuid, text, text, text, numeric, text, text, text)',
    'public.admin_partner_opener(uuid, text)',
    'public.admin_partner_rows(text, text, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.email_log_add(text, text)',
    'public.admin_finance_overview(uuid, jsonb, timestamptz)',
    'public.admin_finance_payments(uuid, jsonb, int, int)',
    'public.admin_finance_export(uuid, jsonb)',
    'public.admin_finance_summary(uuid, jsonb, timestamptz)',
    'public.admin_messages_overview(uuid, timestamptz)',
    'public.admin_partners_overview(uuid, text, timestamptz)',
    'public.admin_partners_accounts(uuid, text, text, int, int, timestamptz)',
    'public.admin_partners_user_source(uuid, text, uuid)',
    'public.admin_partners_activity(uuid, text, int)',
    'public.admin_logs_maintenance()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
