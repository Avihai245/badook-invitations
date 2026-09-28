-- Google sign-in also gives a profile photo (raw_user_meta_data->>'avatar_url'), stored alongside the
-- name — set once when the account is created (account_get), same as full_name.

alter table public.accounts
  add column avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048);

create or replace function public.account_json(a public.accounts) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'userId', a.user_id,
    'fullName', a.full_name,
    'avatarUrl', a.avatar_url,
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

-- The user's account (created with the name and, for Google users, avatar from sign-up the first
-- time). null for an unknown user.
create or replace function public.account_get(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    return null;
  end if;
  insert into public.accounts (user_id, full_name, avatar_url, source)
  select u.id,
         nullif(left(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), 120), ''),
         nullif(left(u.raw_user_meta_data->>'avatar_url', 2048), ''),
         case when u.raw_app_meta_data->>'provider' = 'google' then 'google' else 'signup' end
  from auth.users u where u.id = p_user_id
  on conflict (user_id) do nothing;
  select * into v from public.accounts where user_id = p_user_id;
  return public.account_json(v);
end $$;
