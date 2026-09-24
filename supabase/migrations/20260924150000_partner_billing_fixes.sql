-- Partner provisioning and billing fixes (same rules as before: service_role only, every function
-- checks what it may touch itself).

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

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.user_self_managed(uuid)',
    'public.account_link_partner(uuid, text, text, text, text, boolean)',
    'public.partner_account(text, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
