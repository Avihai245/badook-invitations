-- A partner could never link a user it created.
--
-- Supabase Auth gives every user created through the admin API a random password when none is sent
-- (auth: internal/api/admin.go, adminUserCreate), and user_self_managed counts any password as the
-- user signing in by themselves. So each user Badook Events opened looked self-managed from the moment
-- it existed: account_link_partner refused the claim, the partner API deleted the new user again and
-- answered 409 account_exists, whatever the email.
--
-- A user the partner created who has never signed in cannot have chosen that password: setting one
-- (the reset link) signs in first. So when the partner claims such a user, the generated password is
-- cleared, and the claim goes ahead. A user who later sets a password or connects Google signs in by
-- themselves exactly as before; an account opened any other way is never touched.
create or replace function public.account_link_partner(
  p_user_id uuid, p_source text, p_external_id text, p_full_name text, p_phone text, p_claim boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.accounts;
begin
  perform public.account_get(p_user_id);
  if p_claim then
    update auth.users u set encrypted_password = ''
    where u.id = p_user_id
      and u.raw_app_meta_data->>'provisioned_by' = p_source
      and u.last_sign_in_at is null
      and coalesce(u.encrypted_password, '') <> ''
      and exists (select 1 from public.accounts a where a.user_id = p_user_id and a.source = 'signup');
  end if;
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
