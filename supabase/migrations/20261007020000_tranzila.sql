-- Tranzila (docs/billing-setup.md): the card is typed in Tranzila's iframe, which hands back a token;
-- our server charges the token — the first payment, and each month of a plan (the daily run). So:
--   · billing_cards: the card a plan renews with — Tranzila's token and the expiry, never the number;
--   · billing_claims: each charge is made once (a purchase's notice can come twice, from the notify
--     address and from the page the iframe goes to; a renewal can be looked at by two runs);
--   · billing_renewals_due: the plans whose month is up, with their card.

create table public.billing_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (char_length(provider) <= 40),
  token text not null check (char_length(token) between 1 and 200),
  expire_month int not null check (expire_month between 1 and 12),
  expire_year int not null check (expire_year between 2000 and 2199),
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  updated_at timestamptz not null default now()
);
alter table public.billing_cards enable row level security;

create table public.billing_claims (
  id text primary key check (char_length(id) <= 200),
  created_at timestamptz not null default now()
);
alter table public.billing_claims enable row level security;

-- true once for an id: the caller makes that charge; false: it was made (or is being made) already.
create function public.billing_claim(p_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_claims (id) values (p_id) on conflict (id) do nothing;
  return found;
end $$;

-- The card the user's plan renews with (a newer purchase replaces it).
create function public.billing_card_save(
  p_user_id uuid, p_provider text, p_token text, p_month int, p_year int, p_last4 text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.billing_cards (user_id, provider, token, expire_month, expire_year, last4)
  values (p_user_id, p_provider, p_token, p_month, p_year, p_last4)
  on conflict (user_id) do update set
    provider = excluded.provider,
    token = excluded.token,
    expire_month = excluded.expire_month,
    expire_year = excluded.expire_year,
    last4 = excluded.last4,
    updated_at = now()
$$;

-- Paid plans charged by this provider whose month is up (and not past the grace days), with the card
-- to charge: running (active) or with a failed charge (past_due) — a canceled plan is never charged.
create function public.billing_renewals_due(p_provider text, p_grace_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'userId', a.user_id,
           'email', u.email,
           'fullName', a.full_name,
           'plan', a.plan,
           'planStatus', a.plan_status,
           'planRenewsAt', a.plan_renews_at,
           'planPrice', a.plan_price,
           'token', c.token,
           'expireMonth', c.expire_month,
           'expireYear', c.expire_year
         ) order by a.plan_renews_at), '[]'::jsonb)
  from public.accounts a
  join public.billing_cards c on c.user_id = a.user_id and c.provider = p_provider
  join auth.users u on u.id = a.user_id
  where a.billing_provider = p_provider
    and a.plan in ('pro', 'business')
    and a.plan_status in ('active', 'past_due')
    and a.plan_renews_at <= now()
    and a.plan_renews_at > now() - make_interval(days => p_grace_days)
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.billing_claim(text)',
    'public.billing_card_save(uuid, text, text, int, int, text)',
    'public.billing_renewals_due(text, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
