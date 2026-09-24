-- Supabase's event trigger function that switches row level security on for every new table
-- (event trigger ensure_rls) is created executable by everyone; only the database runs it. Visitors
-- and signed-in users get no EXECUTE on it (the security advisor's warning). Projects without it are
-- left alone.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
