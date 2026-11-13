-- Security fixes (the 2026-11 review):
--   · gallery_rate_peek: how many hits a rate key had in its window, without adding one — the gallery's
--     access code refuses an address over its limit even with the right code (live-gallery/guest-api.ts
--     checkCode), so a brute force stops instead of only slowing down;
--   · update_guest: checks that the guest is the invitation's before reading their confirmed count;
--   · gallery_reserve: a reservation whose upload never came stops counting toward the gallery's limit
--     once its upload URL is over (two hours), not after the 48-hour sweep — a few hundred requests
--     reserving files they never send no longer keep a gallery "full" for the whole event.

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

create or replace function public.gallery_reserve(
  p_invitation_id uuid, p_uploader_hash text, p_guest_id uuid, p_name text, p_items jsonb, p_max_items int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_guest uuid := p_guest_id;
begin
  perform 1 from public.galleries where invitation_id = p_invitation_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  -- what counts: every item but a reservation whose upload never came — once its signed upload URL
  -- (two hours) is over, it can't hold the gallery full for the rest of the event (the sweep deletes it
  -- after a couple of days)
  select count(*) into v_count from public.gallery_items
  where invitation_id = p_invitation_id and deleted_at is null
    and (status <> 'uploading' or created_at > now() - interval '2 hours');
  if v_count + jsonb_array_length(p_items) > p_max_items then
    return jsonb_build_object('ok', false, 'code', 'full', 'left', greatest(p_max_items - v_count, 0));
  end if;
  if v_guest is not null and not exists (
    select 1 from public.invitation_guests where id = v_guest and invitation_id = p_invitation_id
  ) then
    v_guest := null;
  end if;
  insert into public.gallery_items (
    id, invitation_id, kind, original_path, original_type, original_size, display_path, display_size,
    thumb_path, thumb_size, width, height, duration_ms, taken_at, uploader_hash, guest_id, uploader_name,
    placement, post_key, instagram
  )
  select (x->>'id')::uuid, p_invitation_id, x->>'kind', x->>'originalPath', x->>'originalType',
    (x->>'originalSize')::bigint, x->>'displayPath', (x->>'displaySize')::int, x->>'thumbPath',
    (x->>'thumbSize')::int, (x->>'width')::int, (x->>'height')::int, (x->>'durationMs')::int,
    (x->>'takenAt')::timestamptz, p_uploader_hash, v_guest, nullif(btrim(p_name), ''),
    coalesce(x->>'placement', 'feed'),
    case when coalesce(x->>'placement', 'feed') = 'feed' then nullif(x->>'post', '') end,
    nullif(x->>'instagram', '')
  from jsonb_array_elements(p_items) x;
  return jsonb_build_object('ok', true);
end $$;
