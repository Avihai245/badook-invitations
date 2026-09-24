-- Partner provisioning and billing fixes, and the plan's limit on active invitations enforced on the
-- write itself (same rules as before: service_role only, every function checks what it may touch).

-- ─── partner provisioning ───────────────────────────────────────────────────────────────────────

-- Does the user sign in by themselves — a password of their own, or another sign-in method (Google)?
-- Then a partner gets no more one-time sign-in links for them, and can't claim them.
create function public.user_self_managed(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(u.encrypted_password, '') <> ''
      or exists (
        select 1
        from jsonb_array_elements_text(
          case when jsonb_typeof(u.raw_app_meta_data->'providers') = 'array'
               then u.raw_app_meta_data->'providers' else '[]'::jsonb end
        ) p
        where p <> 'email'
      )
  from auth.users u where u.id = p_user_id
$$;

-- Links a user to the partner, with the name / phone / id it sent. A partner claims only a user it
-- provisioned itself (Auth app_metadata.provisioned_by = p_source, set when it created the user) and
-- that doesn't sign in by itself yet — an account that was opened some other way, even one created
-- by its owner at the same moment, is never taken over (null). One that is already the partner's gets
-- updated. The answer says whether the user now signs in by themselves (userManaged).
create or replace function public.account_link_partner(
  p_user_id uuid, p_source text, p_external_id text, p_full_name text, p_phone text, p_claim boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  perform public.account_get(p_user_id);
  update public.accounts a set
    source = p_source,
    external_id = coalesce(p_external_id, a.external_id),
    full_name = coalesce(nullif(left(trim(p_full_name), 120), ''), a.full_name),
    phone = coalesce(p_phone, a.phone)
  where a.user_id = p_user_id
    and (a.source = p_source
      or (p_claim and a.source = 'signup'
          and exists (select 1 from auth.users u
                      where u.id = p_user_id and u.raw_app_meta_data->>'provisioned_by' = p_source)
          and not public.user_self_managed(p_user_id)))
  returning * into v;
  if not found then
    return null;
  end if;
  return public.account_json(v) || jsonb_build_object('userManaged', public.user_self_managed(p_user_id));
end $$;

-- The partner's own user, by our id or by the partner's id, with its email and whether they sign in by
-- themselves (null when it isn't one of the partner's users).
create or replace function public.partner_account(p_source text, p_user_id uuid, p_external_id text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  select * into v from public.accounts
  where source = p_source
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_external_id is not null and external_id = p_external_id))
  limit 1;
  if not found then
    return null;
  end if;
  return public.account_json(v) || jsonb_build_object(
    'email', (select email from auth.users where id = v.user_id),
    'userManaged', public.user_self_managed(v.user_id)
  );
end $$;

-- ─── billing ────────────────────────────────────────────────────────────────────────────────────

-- What a payment event was for and how much it was: monthly renewals show in the billing history.
alter table public.billing_events
  add column product text check (product is null or char_length(product) <= 40),
  add column amount numeric(10, 2) check (amount is null or amount >= 0);
create index billing_events_user on public.billing_events (user_id, created_at desc);

-- Applies one payment-provider event exactly once: the plan fields present in p_patch, and
-- p_credits (a credit pack or a plan's monthly grant); p_product / p_amount say what it paid for.
-- false = already applied.
drop function public.billing_apply(text, text, text, uuid, jsonb, int, jsonb);
create function public.billing_apply(
  p_event_id text,
  p_provider text,
  p_type text,
  p_user_id uuid,
  p_patch jsonb,
  p_credits int,
  p_payload jsonb,
  p_product text default null,
  p_amount numeric default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_events (id, provider, type, user_id, payload, product, amount)
  values (p_event_id, p_provider, p_type, p_user_id, coalesce(p_payload, '{}'), p_product, p_amount)
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

-- Settles a purchase once: paid → the account gets the plan / credits (billing_apply); failed or
-- canceled → just recorded. A failed purchase can still turn out paid (paid on the same payment page
-- after all, or the provider's confirmation came late) — never the other way. { settled: false }
-- when there was nothing to settle.
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
  else
    insert into public.billing_events (id, provider, type, user_id, payload, product, amount)
    values (p_event_id, k.provider, 'checkout.' || p_status, k.user_id, coalesce(p_payload, '{}'), k.product,
            k.amount)
    on conflict (id) do nothing;
  end if;
  return jsonb_build_object('settled', true, 'userId', k.user_id, 'product', k.product);
end $$;

-- The billing screen's history: purchases, monthly renewals (paid or failed) and credit movements,
-- newest first.
create or replace function public.billing_history(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'checkouts', coalesce((
      select jsonb_agg(public.checkout_json(k) order by k.created_at desc)
      from (select * from public.billing_checkouts where user_id = p_user_id and status <> 'pending'
            order by created_at desc limit 50) k
    ), '[]'::jsonb),
    'renewals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product', e.product,
               'amount', e.amount,
               'status', case when e.type = 'renewal.paid' then 'paid' else 'failed' end,
               'at', e.created_at
             ) order by e.created_at desc)
      from (select * from public.billing_events
            where user_id = p_user_id and type in ('renewal.paid', 'renewal.failed')
            order by created_at desc limit 50) e
    ), '[]'::jsonb),
    'credits', coalesce((
      select jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'at', l.created_at)
                       order by l.created_at desc)
      from (select * from public.credit_ledger where user_id = p_user_id order by created_at desc limit 50) l
    ), '[]'::jsonb)
  )
$$;

-- Purchases still waiting for the provider's notice (older than p_min_minutes, newer than p_max_days,
-- oldest first, at most 100): the daily check asks the provider about them — a notice can be late,
-- lost, or not confirmable yet when it came.
create function public.billing_pending_checkouts(p_provider text, p_min_minutes int, p_max_days int)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.checkout_json(k) order by k.created_at), '[]'::jsonb)
  from (select * from public.billing_checkouts
        where provider = p_provider and status = 'pending' and provider_ref is not null
          and created_at < now() - make_interval(mins => p_min_minutes)
          and created_at > now() - make_interval(days => p_max_days)
        order by created_at limit 100) k
$$;

-- ─── the plan's limit on active invitations ─────────────────────────────────────────────────────

-- The limit the app last checked the owner's plan against (null: unlimited, or never checked).
alter table public.accounts add column active_invitation_limit int
  check (active_invitation_limit is null or active_invitation_limit >= 0);

-- Before it checks whether there is room for one more invitation, the app records the limit it checks
-- against (a write only when it changed): the insert itself enforces the same number (below).
create function public.account_note_limit(p_user_id uuid, p_limit int) returns void
language sql security definer set search_path = '' as $$
  update public.accounts set active_invitation_limit = p_limit
  where user_id = p_user_id and active_invitation_limit is distinct from p_limit
$$;

-- One more active invitation (a new one, a copy, or one back from the archive) only while the owner
-- is under that limit — counted under a lock per owner in the same transaction as the write, so two
-- creates at the same moment can't both take the last place (the app's own check can't see that).
-- What counts: not archived, and not the full invitation of a save-the-date (account_json).
create function public.invitations_active_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  n int;
begin
  if new.status = 'archived' or new.source_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'archived' and old.source_id is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invitations_active:' || new.owner_id::text, 0));
  select active_invitation_limit into v_limit from public.accounts where user_id = new.owner_id;
  if v_limit is null then
    return new;
  end if;
  select count(*) into n from public.invitations
  where owner_id = new.owner_id and status <> 'archived' and source_id is null and id <> new.id;
  if n >= v_limit then
    raise exception 'plan_limit' using errcode = 'P0001', detail = format('limit %s', v_limit);
  end if;
  return new;
end $$;

create trigger invitations_active_limit before insert or update of status, source_id on public.invitations
  for each row execute function public.invitations_active_limit();

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.user_self_managed(uuid)',
    'public.account_link_partner(uuid, text, text, text, text, boolean)',
    'public.partner_account(text, uuid, text)',
    'public.billing_apply(text, text, text, uuid, jsonb, int, jsonb, text, numeric)',
    'public.checkout_complete(uuid, text, text, jsonb, int, jsonb)',
    'public.billing_history(uuid)',
    'public.billing_pending_checkouts(text, int, int)',
    'public.account_note_limit(uuid, int)',
    'public.invitations_active_limit()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
