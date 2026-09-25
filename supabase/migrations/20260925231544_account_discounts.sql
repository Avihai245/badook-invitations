-- A discount on a user's plans, granted through the partner API by the partner that opened the account
-- (Badook Events): a percentage off the monthly price of a plan bought while it is in force (until
-- discount_until, or with no end). A plan bought with it keeps renewing at the price it was bought at
-- (plan_price) until it is canceled or replaced. Message packs are sold at cost and never discounted.
-- Same rules as before: service_role only, every function checks what it may touch.

alter table public.accounts
  add column discount_percent smallint
    check (discount_percent is null or discount_percent between 1 and 90),
  add column discount_until timestamptz,
  add column discount_note text check (discount_note is null or char_length(discount_note) <= 200),
  -- who granted it ('partner:badook-events')
  add column discount_source text check (discount_source is null or char_length(discount_source) <= 60),
  add column discount_set_at timestamptz,
  -- what the plan in force is charged each month: the price it was bought at (a discount included)
  add column plan_price numeric(10, 2) check (plan_price is null or plan_price >= 0),
  add constraint accounts_discount_whole check ((discount_percent is null) = (discount_source is null));

-- The account as the app reads it, now with its discount (as stored: the app decides whether it is
-- still in force) and the monthly price of the plan in force.
create or replace function public.account_json(a public.accounts) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'userId', a.user_id,
    'fullName', a.full_name,
    'phone', a.phone,
    'plan', a.plan,
    'planStatus', a.plan_status,
    'planRenewsAt', a.plan_renews_at,
    'billingProvider', a.billing_provider,
    'billingSubscriptionId', a.billing_subscription_id,
    'hasSubscription', a.billing_subscription_id is not null,
    'credits', a.message_credits,
    'source', a.source,
    'createdAt', a.created_at,
    -- what the plan's limit counts: not archived, and not the full invitation of a save-the-date
    -- (the two are one event)
    'activeInvitations', (
      select count(*) from public.invitations i
      where i.owner_id = a.user_id and i.status <> 'archived' and i.source_id is null
    ),
    'discount', case when a.discount_percent is null then null else jsonb_build_object(
      'percent', a.discount_percent,
      'until', a.discount_until,
      'note', a.discount_note,
      'source', a.discount_source,
      'setAt', a.discount_set_at
    ) end,
    'planPrice', a.plan_price
  )
$$;

-- The partner's discount for one of its own users — by our id or by the partner's, one of the two —
-- replacing the one they had; p_percent null removes it. null when it isn't one of the partner's
-- users. The answer is partner_account's.
create function public.account_set_discount(
  p_source text, p_user_id uuid, p_external_id text, p_percent int, p_until timestamptz, p_note text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  if (p_user_id is null) = (p_external_id is null) then
    raise exception 'account_set_discount: p_user_id or p_external_id, one of them';
  end if;
  update public.accounts a set
    discount_percent = p_percent,
    discount_until = case when p_percent is null then null else p_until end,
    discount_note = case when p_percent is null then null else nullif(left(trim(p_note), 200), '') end,
    discount_source = case when p_percent is null then null else p_source end,
    discount_set_at = case when p_percent is null then null else now() end
  where a.source = p_source
    and (a.user_id = p_user_id or a.external_id = p_external_id)
  returning * into v;
  if not found then
    return null;
  end if;
  return public.account_json(v) || jsonb_build_object(
    'email', (select email from auth.users where id = v.user_id),
    'userManaged', public.user_self_managed(v.user_id)
  );
end $$;

-- Settles a purchase once (as before), and a plan paid for renews at the price it was bought at.
create or replace function public.checkout_complete(
  p_id uuid, p_status text, p_event_id text, p_patch jsonb, p_credits int, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.billing_checkouts;
begin
  if p_status not in ('paid', 'failed', 'canceled') then
    raise exception 'bad status %', p_status;
  end if;
  update public.billing_checkouts set status = p_status, completed_at = now()
  where id = p_id and (status = 'pending' or (status = 'failed' and p_status = 'paid'))
  returning * into k;
  if not found then
    return jsonb_build_object('settled', false);
  end if;
  if p_status = 'paid' then
    perform public.billing_apply(p_event_id, k.provider, 'checkout.' || k.product, k.user_id, p_patch, p_credits,
                                 p_payload, k.product, k.amount);
    if k.product in ('pro', 'business') then
      update public.accounts set plan_price = k.amount where user_id = k.user_id;
    end if;
  else
    insert into public.billing_events (id, provider, type, user_id, payload, product, amount)
    values (p_event_id, k.provider, 'checkout.' || p_status, k.user_id, coalesce(p_payload, '{}'), k.product,
            k.amount)
    on conflict (id) do nothing;
  end if;
  return jsonb_build_object('settled', true, 'userId', k.user_id, 'product', k.product);
end $$;

revoke all on function public.account_set_discount(text, uuid, text, int, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.account_set_discount(text, uuid, text, int, timestamptz, text) to service_role;
