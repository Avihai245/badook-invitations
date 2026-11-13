-- Security fixes (the 2026-11 review):
--   · gallery_rate_peek: how many hits a rate key had in its window, without adding one — the gallery's
--     access code refuses an address over its limit even with the right code (live-gallery/guest-api.ts
--     checkCode), so a brute force stops instead of only slowing down;
--   · update_guest: checks that the guest is the invitation's before reading their confirmed count.

create function public.gallery_rate_peek(p_key_hash text, p_window_seconds int) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.gallery_rate_events
  where key_hash = p_key_hash and created_at > now() - make_interval(secs => p_window_seconds)
$$;

revoke execute on function public.gallery_rate_peek(text, int) from public, anon, authenticated;
grant execute on function public.gallery_rate_peek(text, int) to service_role;


create or replace function public.update_guest(
  p_id uuid, p_owner_id uuid, p_guest_id uuid, p_name text, p_phone text, p_email text,
  p_party_size int, p_group text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitation_guests;
  v_confirmed int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  -- the guest must be this invitation's before anything about them is read (another event's guest id
  -- would otherwise tell its confirmed count)
  if not exists (select 1 from public.invitation_guests where id = p_guest_id and invitation_id = p_id) then
    return null;
  end if;
  v_confirmed := public.guest_confirmed(p_guest_id);
  if v_confirmed > 0 and (p_party_size is null or p_party_size < v_confirmed) then
    return jsonb_build_object('ok', false, 'code', 'below_confirmed', 'confirmed', v_confirmed);
  end if;
  begin
    update public.invitation_guests set
      name = p_name, phone = p_phone, email = p_email, party_size = p_party_size, group_name = p_group
    where id = p_guest_id and invitation_id = p_id
    returning * into v;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_phone');
  end;
  if not found then
    return null;
  end if;
  return jsonb_build_object('ok', true, 'guest', public.guest_json(v));
end $$;
