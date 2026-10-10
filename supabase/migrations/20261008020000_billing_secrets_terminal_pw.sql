-- The iframe terminal's TranzilaPW may be kept in the Vault too (the handshake that locks the card
-- form's sum: docs/billing-setup.md). Same function, two more allowed names.
create or replace function public.billing_secrets(p_names text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_allowed constant text[] := array[
    'INVITES_TRANZILA_APP_KEY', 'INVITES_TRANZILA_SECRET', 'TRANZILA_API_APP_KEY', 'TRANZILA_API_SECRET',
    'INVITES_TRANZILA_PW', 'TRANZILA_TERMINAL_PW'
  ];
  v_out jsonb;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return '{}'::jsonb;
  end if;
  execute 'select coalesce(jsonb_object_agg(s.name, s.decrypted_secret), ''{}''::jsonb)
           from vault.decrypted_secrets s
           where s.name = any($1) and s.name = any($2)'
    into v_out
    using p_names, v_allowed;
  return v_out;
end $$;

revoke all on function public.billing_secrets(text[]) from public, anon, authenticated;
grant execute on function public.billing_secrets(text[]) to service_role;
