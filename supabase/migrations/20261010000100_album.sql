-- The album (feature album): the morning after the event, the photos and videos guests shared in the
-- live gallery become a designed album with a link of its own, for the hosts to share with everyone —
-- the link itself, or a "thank you for celebrating with us" with the link to each guest of the list,
-- from the system's WhatsApp number (a fourth Meta template, docs/whatsapp-setup.md §10: a credit
-- each, refunded when it isn't delivered) or from the host's own WhatsApp, marked by hand. Queued and
-- sent like the gallery link (*_gallery_link.sql). The hosts get an email when it is ready.
--
-- Same rules as the rest of the app: row level security on and no policies, SECURITY DEFINER functions
-- with an empty search_path that check the owner or a link's hash, service_role only. Additive only.

-- ─── the album ──────────────────────────────────────────────────────────────────────────────────

-- One album per gallery (it is made from the gallery's published items, and goes with it). Its link is
-- derived by the server from the nonce with its own key, like the gallery's: the database keeps the
-- nonce and the token's SHA-256 hash, never the token.
create table public.gallery_albums (
  invitation_id uuid primary key references public.galleries(invitation_id) on delete cascade,
  -- off: the link opens nothing (the photos stay in the gallery)
  enabled boolean not null default true,
  -- guests can open it from then on; null: the morning after the event (the server computes it from
  -- the event's date and time zone)
  opens_at timestamptz,
  -- the hosts' own words, per language ({ "he": "…" }); null: the event type's
  title jsonb check (title is null or jsonb_typeof(title) = 'object'),
  message jsonb check (message is null or jsonb_typeof(message) = 'object'),
  -- the cover's photo; null: the best one (sharpness, light, size, the automatic check's quality)
  cover_item_id uuid references public.gallery_items(id) on delete set null,
  -- photos and videos the hosts left out of the album (they stay in the gallery)
  hidden_items uuid[] not null default '{}' check (cardinality(hidden_items) <= 3000),
  show_videos boolean not null default true,
  -- grouped in chapters (the invitation's timeline, or the gaps in time); off: one flow
  chapters boolean not null default true,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_nonce text not null check (token_nonce ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- the hosts were told by email that the album is ready (once)
  ready_mailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_albums_cover_idx on public.gallery_albums (cover_item_id) where cover_item_id is not null;
create trigger gallery_albums_touch before update on public.gallery_albums
  for each row execute function public.touch_updated_at();

alter table public.gallery_albums enable row level security;
revoke all on public.gallery_albums from anon, authenticated;

-- The album's settings as the server reads them (the token's hash and nonce stay on the server).
create function public.album_json(a public.gallery_albums) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'enabled', a.enabled,
    'opensAt', a.opens_at,
    'title', a.title,
    'message', a.message,
    'coverItemId', a.cover_item_id,
    'hiddenItems', to_jsonb(a.hidden_items),
    'showVideos', a.show_videos,
    'chapters', a.chapters,
    'tokenHash', a.token_hash,
    'tokenNonce', a.token_nonce,
    'readyMailedAt', a.ready_mailed_at,
    'createdAt', a.created_at,
    'updatedAt', a.updated_at
  )
$$;

-- ─── the host ───────────────────────────────────────────────────────────────────────────────────

-- The album's state for the host: the invitation (its slug, status and document — the event's date,
-- time zone, names and timeline), whether the gallery is there and on, the album (null before it was
-- made) and what the album would show (published photos and videos). null when it isn't the owner's.
create function public.album_owner_get(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.invitations;
  g public.galleries;
  a public.gallery_albums;
begin
  select * into i from public.invitations where id = p_id and owner_id = p_owner;
  if not found then
    return null;
  end if;
  select * into g from public.galleries where invitation_id = p_id;
  select * into a from public.gallery_albums where invitation_id = p_id;
  return jsonb_build_object(
    'slug', i.slug,
    'status', i.status,
    'document', coalesce(i.published, i.draft),
    'gallery', case when g.invitation_id is null then null
      else jsonb_build_object('enabled', g.enabled) end,
    'album', case when a.invitation_id is null then null else public.album_json(a) end,
    'counts', jsonb_build_object(
      'images', (select count(*) from public.gallery_items x
        where x.invitation_id = p_id and x.deleted_at is null and x.status = 'published' and x.kind = 'image'),
      'videos', (select count(*) from public.gallery_items x
        where x.invitation_id = p_id and x.deleted_at is null and x.status = 'published' and x.kind = 'video')
    )
  );
end $$;

-- Makes the album when there isn't one yet (the gallery must exist), with the link the server made.
-- Returns album_owner_get, or null when it isn't the owner's.
create function public.album_owner_ensure(p_id uuid, p_owner uuid, p_hash text, p_nonce text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.gallery_albums (invitation_id, token_hash, token_nonce)
  select p_id, p_hash, p_nonce
  where exists (select 1 from public.galleries where invitation_id = p_id)
  on conflict (invitation_id) do nothing;
  return public.album_owner_get(p_id, p_owner);
end $$;

-- The host's settings (only the keys sent change): enabled, opensAt (null: the morning after), title,
-- message, coverItemId, hiddenItems, showVideos, chapters. A cover or hidden item must be one of the
-- gallery's own. Returns album_owner_get, or null (not the owner's, or no album).
create function public.album_owner_update(p_id uuid, p_owner uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cover uuid;
  v_hidden uuid[];
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  perform 1 from public.gallery_albums where invitation_id = p_id for update;
  if not found then
    return null;
  end if;
  if p_patch ? 'coverItemId' and p_patch->>'coverItemId' is not null then
    select x.id into v_cover from public.gallery_items x
    where x.id = (p_patch->>'coverItemId')::uuid and x.invitation_id = p_id and x.deleted_at is null;
  end if;
  if p_patch ? 'hiddenItems' then
    select coalesce(array_agg(x.id), '{}') into v_hidden
    from public.gallery_items x
    where x.invitation_id = p_id
      and x.id in (select (e #>> '{}')::uuid from jsonb_array_elements(coalesce(p_patch->'hiddenItems', '[]')) e);
  end if;
  update public.gallery_albums set
    enabled = case when p_patch ? 'enabled' then (p_patch->>'enabled')::boolean else enabled end,
    opens_at = case when p_patch ? 'opensAt' then (p_patch->>'opensAt')::timestamptz else opens_at end,
    title = case when p_patch ? 'title' then nullif(p_patch->'title', 'null'::jsonb) else title end,
    message = case when p_patch ? 'message' then nullif(p_patch->'message', 'null'::jsonb) else message end,
    cover_item_id = case when p_patch ? 'coverItemId' then v_cover else cover_item_id end,
    hidden_items = case when p_patch ? 'hiddenItems' then v_hidden else hidden_items end,
    show_videos = case when p_patch ? 'showVideos' then (p_patch->>'showVideos')::boolean else show_videos end,
    chapters = case when p_patch ? 'chapters' then (p_patch->>'chapters')::boolean else chapters end
  where invitation_id = p_id;
  return public.album_owner_get(p_id, p_owner);
end $$;

-- A new link for the album; the old one stops at once. Returns album_owner_get, or null.
create function public.album_owner_rotate(p_id uuid, p_owner uuid, p_hash text, p_nonce text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  update public.gallery_albums set token_hash = p_hash, token_nonce = p_nonce where invitation_id = p_id;
  if not found then
    return null;
  end if;
  return public.album_owner_get(p_id, p_owner);
end $$;

-- What the album shows: the gallery's published photos (and videos, when the album shows them) that
-- have a display version, but those the hosts left out — oldest first (when they were taken, else when
-- they entered the gallery). With p_all the hosts' studio gets the ones they left out too.
create function public.album_items(p_invitation_id uuid, p_all boolean, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.gallery_item_json(x.item)
      || jsonb_build_object('hidden', (x.item).id = any(coalesce(a.hidden_items, '{}')))
    order by coalesce((x.item).taken_at, (x.item).published_at), (x.item).id), '[]'::jsonb)
  from (
    select i as item from public.gallery_items i
    where i.invitation_id = p_invitation_id and i.deleted_at is null and i.status = 'published'
      and i.display_path is not null
    order by coalesce(i.taken_at, i.published_at), i.id
    limit least(greatest(p_limit, 1), 3000)
  ) x
  left join public.gallery_albums a on a.invitation_id = p_invitation_id
  where p_all or (
    not ((x.item).id = any(coalesce(a.hidden_items, '{}')))
    and (coalesce(a.show_videos, true) or (x.item).kind = 'image')
  )
$$;

-- The host's studio: the album's items, each with whether it is left out. null when not the owner's.
create function public.album_owner_items(p_id uuid, p_owner uuid, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return public.album_items(p_id, true, p_limit);
end $$;

-- ─── guests (by the link's hash) ────────────────────────────────────────────────────────────────

-- The album a link opens, the gallery it comes from (on or not) and the invitation (as guests read
-- it: its document). null for an unknown link.
create function public.album_by_token(p_token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'album', public.album_json(a),
    'gallery', jsonb_build_object('enabled', g.enabled),
    'invitation', jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'status', i.status,
      'document', coalesce(i.published, i.draft)
    )
  )
  from public.gallery_albums a
  join public.galleries g on g.invitation_id = a.invitation_id
  join public.invitations i on i.id = a.invitation_id
  where a.token_hash = p_token_hash
$$;

-- The languages of the invitation behind a slug that has an album (the album page's <html lang>).
create function public.album_slug_locale(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'defaultLocale', coalesce(i.published, i.draft)->>'defaultLocale',
    'locales', coalesce(i.published, i.draft)->'locales'
  )
  from public.invitations i
  join public.gallery_albums a on a.invitation_id = i.id
  where i.slug = p_slug
$$;

-- The invitation's own page: its gallery section leads to the album after the event (null: no album,
-- or it is off).
create function public.album_invitation_link(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tokenHash', a.token_hash, 'tokenNonce', a.token_nonce, 'opensAt', a.opens_at)
  from public.gallery_albums a
  join public.galleries g on g.invitation_id = a.invitation_id
  where a.invitation_id = p_invitation_id and a.enabled and g.enabled
$$;

-- ─── "your album is ready" (the daily run) ──────────────────────────────────────────────────────

-- Events whose album may have become ready: the event was between p_from and p_to (dates, in the
-- event's own calendar), the gallery is on and has published photos, and the hosts weren't told yet
-- (no album yet, or one that is on and not mailed). With the owner's email and what the email says.
create function public.album_ready_candidates(p_from date, p_to date, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'invitationId', i.id,
      'ownerId', i.owner_id,
      'email', u.email,
      'slug', i.slug,
      'document', coalesce(i.published, i.draft),
      'album', case when a.invitation_id is null then null else public.album_json(a) end,
      'photos', (select count(*) from public.gallery_items x
        where x.invitation_id = i.id and x.deleted_at is null and x.status = 'published')
    )), '[]'::jsonb)
  from (
    select i.* from public.invitations i
    join public.galleries g on g.invitation_id = i.id and g.enabled
    left join public.gallery_albums a on a.invitation_id = i.id
    where i.status = 'published'
      and (coalesce(i.published, i.draft)->'event'->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      and (coalesce(i.published, i.draft)->'event'->>'date')::date between p_from and p_to
      and (a.invitation_id is null or (a.enabled and a.ready_mailed_at is null))
      and exists (select 1 from public.gallery_items x
        where x.invitation_id = i.id and x.deleted_at is null and x.status = 'published')
    order by i.id
    limit least(greatest(p_limit, 1), 500)
  ) i
  join auth.users u on u.id = i.owner_id
  left join public.gallery_albums a on a.invitation_id = i.id
$$;

-- The hosts were told (once).
create function public.album_ready_mark(p_invitation_id uuid) returns boolean
language sql security definer set search_path = '' as $$
  update public.gallery_albums set ready_mailed_at = now()
  where invitation_id = p_invitation_id and ready_mailed_at is null
  returning true
$$;

-- ─── the thank-you to guests (like the gallery link) ────────────────────────────────────────────

-- One thank-you with the album's link to one guest: from the system's WhatsApp number (queued and sent
-- like the gallery link, with its own template) or the host's note that they sent it themselves.
create table public.album_notices (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id uuid references public.invitation_guests(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'manual')),
  status text not null default 'sent'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
  to_phone text check (to_phone is null or to_phone ~ '^\+[1-9][0-9]{6,14}$'),
  wa_message_id text unique,
  error text check (error is null or char_length(error) <= 300),
  price_usd numeric(10, 4) not null default 0,
  attempts int not null default 0,
  claimed_at timestamptz,
  next_attempt_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel = 'whatsapp') = (to_phone is not null))
);
create index album_notices_guest on public.album_notices (guest_id, created_at desc) where guest_id is not null;
create index album_notices_invitation on public.album_notices (invitation_id, created_at desc);
create index album_notices_pending on public.album_notices (created_at) where status in ('queued', 'sending');
create index album_notices_owner_id_idx on public.album_notices (owner_id);
create trigger album_notices_touch before update on public.album_notices
  for each row execute function public.touch_updated_at();

alter table public.album_notices enable row level security;
revoke all on public.album_notices from anon, authenticated;

-- The dialog: every guest of the list, whether the system's number can reach them, their personal
-- link's token, and the last thank-you they got; `album`: the event's album is there and on. null when
-- the event isn't the owner's.
create function public.album_notices_state(p_id uuid, p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return jsonb_build_object(
    'album', exists (select 1 from public.gallery_albums where invitation_id = p_id and enabled),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'guestId', g.id,
          'name', g.name,
          'phone', g.phone,
          'token', g.token,
          'group', g.group_name,
          'reach', case
            when g.phone is null then 'none'
            when not public.whatsapp_capable(g.phone) then 'landline'
            when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'opted_out'
            else 'ok' end,
          'last', (
            select jsonb_build_object('channel', n.channel, 'status', n.status, 'at', n.created_at)
            from public.album_notices n
            where n.guest_id = g.id
            order by (n.status = 'failed'), n.created_at desc
            limit 1
          ),
          'queued', exists (
            select 1 from public.album_notices n where n.guest_id = g.id and n.status in ('queued', 'sending'))
        ) order by g.seq)
      from public.invitation_guests g
      where g.invitation_id = p_id
    ), '[]'::jsonb)
  );
end $$;

-- The chosen guests as a message would find them, and why one can't get a WhatsApp now (null: it can).
create function public.album_notice_candidates(p_id uuid, p_guest_ids uuid[])
returns table (guest_id uuid, phone text, reason text)
language sql stable set search_path = '' as $$
  select g.id, g.phone,
    case
      when g.phone is null then 'noPhone'
      when not public.whatsapp_capable(g.phone) then 'landline'
      when exists (select 1 from public.whatsapp_opt_outs o where o.phone = g.phone) then 'optedOut'
      when exists (
        select 1 from public.album_notices n where n.guest_id = g.id and n.status in ('queued', 'sending')
      ) then 'queued'
    end
  from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids)
$$;

-- Queues the thank-you to each chosen guest the system's number can reach, one credit each (as
-- gallery_notice_queue). { ok: true, queued, balance } | { ok: false, code: 'credits', needed, balance }
-- | { ok: false, code: 'nobody' | 'no_album' } — with skipped when any was left out — or null.
create function public.album_notice_queue(p_id uuid, p_owner uuid, p_guest_ids uuid[], p_price_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  v_balance int;
  v_skipped jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  if not exists (select 1 from public.gallery_albums where invitation_id = p_id and enabled) then
    return jsonb_build_object('ok', false, 'code', 'no_album');
  end if;
  perform public.account_get(p_owner);
  perform 1 from public.invitation_guests where invitation_id = p_id and id = any(p_guest_ids) for update;
  select count(*) filter (where c.reason is null),
         case when count(*) filter (where c.reason is not null) = 0 then '{}'::jsonb
              else jsonb_build_object('skipped', jsonb_build_object(
                'noPhone', count(*) filter (where c.reason = 'noPhone'),
                'landline', count(*) filter (where c.reason = 'landline'),
                'optedOut', count(*) filter (where c.reason = 'optedOut'),
                'queued', count(*) filter (where c.reason = 'queued'))) end
  into n, v_skipped
  from public.album_notice_candidates(p_id, p_guest_ids) c;
  if n = 0 then
    return jsonb_build_object('ok', false, 'code', 'nobody') || v_skipped;
  end if;
  update public.accounts set message_credits = message_credits - n
  where user_id = p_owner and message_credits >= n
  returning message_credits into v_balance;
  if not found then
    select message_credits into v_balance from public.accounts where user_id = p_owner;
    return jsonb_build_object('ok', false, 'code', 'credits', 'needed', n, 'balance', coalesce(v_balance, 0))
      || v_skipped;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_owner, -n, 'whatsapp_send', p_id::text);
  insert into public.album_notices (invitation_id, guest_id, owner_id, channel, status, to_phone, price_usd)
  select p_id, c.guest_id, p_owner, 'whatsapp', 'queued', c.phone, p_price_usd
  from public.album_notice_candidates(p_id, p_guest_ids) c
  where c.reason is null;
  return jsonb_build_object('ok', true, 'queued', n, 'balance', v_balance) || v_skipped;
end $$;

-- The host sent these guests the thank-you themselves. Returns how many, or null.
create function public.album_notice_mark(p_id uuid, p_owner uuid, p_guest_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  insert into public.album_notices (invitation_id, guest_id, owner_id, channel, status)
  select p_id, g.id, p_owner, 'manual', 'sent'
  from public.invitation_guests g
  where g.invitation_id = p_id and g.id = any(p_guest_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- Gives a message's credit back to its host — once.
create function public.album_notice_refund(p_notice_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  update public.album_notices set refunded_at = now()
  where id = p_notice_id and channel = 'whatsapp' and refunded_at is null
  returning owner_id into v_owner;
  if not found then
    return false;
  end if;
  update public.accounts set message_credits = message_credits + 1 where user_id = v_owner;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (v_owner, 1, 'whatsapp_refund', p_notice_id::text);
  return true;
end $$;

-- The API's answer for a message being sent: its WhatsApp id (sent) or the error (failed: refunded;
-- 131050 → the do-not-send list).
create function public.album_notice_result(p_notice_id uuid, p_wa_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.album_notices;
begin
  update public.album_notices set
    wa_message_id = p_wa_id,
    status = case when p_wa_id is null then 'failed' else 'sent' end,
    error = left(p_error, 300),
    next_attempt_at = null
  where id = p_notice_id and status = 'sending'
  returning * into m;
  if not found then
    return;
  end if;
  if p_wa_id is null then
    perform public.album_notice_refund(m.id);
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
end $$;

-- Claims up to p_limit messages that are due (one invitation's, or any when p_id is null), with what
-- the template needs: the guest's name, language and token, the invitation's slug and document, and
-- the album's link nonce and hash. Stuck and opted-out messages fail (refunded), like the gallery's.
create function public.album_notice_claim(p_id uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_msg uuid;
begin
  for v_msg in
    select n.id from public.album_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.album_notice_result(v_msg, null, 'timeout');
  end loop;
  for v_msg in
    select n.id from public.album_notices n
    where (p_id is null or n.invitation_id = p_id) and n.status = 'queued'
      and exists (select 1 from public.whatsapp_opt_outs o where o.phone = n.to_phone)
    for update skip locked
  loop
    update public.album_notices set status = 'sending', claimed_at = now() where id = v_msg;
    perform public.album_notice_result(v_msg, null, 'opted_out');
  end loop;
  with picked as (
    select n.id from public.album_notices n
    where (p_id is null or n.invitation_id = p_id)
      and n.status = 'queued' and (n.next_attempt_at is null or n.next_attempt_at <= now())
    order by coalesce(n.next_attempt_at, n.created_at), n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.album_notices n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'invitationId', c.invitation_id,
      'toPhone', c.to_phone,
      'attempts', c.attempts,
      'guestName', g.name,
      'guestToken', g.token,
      'guestLanguage', g.preferred_language,
      'slug', i.slug,
      'document', coalesce(i.published, i.draft),
      'albumTokenHash', a.token_hash,
      'albumTokenNonce', a.token_nonce,
      'albumEnabled', coalesce(a.enabled, false)
    )), '[]'::jsonb) into v
  from claimed c
  join public.invitations i on i.id = c.invitation_id
  left join public.invitation_guests g on g.id = c.guest_id
  left join public.gallery_albums a on a.invitation_id = c.invitation_id;
  return v;
end $$;

-- A temporary failure: back in the queue p_wait_seconds later — at most 3 tries, then it fails
-- (refunded). false when it won't be tried again.
create function public.album_notice_requeue(p_notice_id uuid, p_error text, p_wait_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  select attempts into n from public.album_notices where id = p_notice_id and status = 'sending' for update;
  if not found then
    return false;
  end if;
  if n >= 3 then
    perform public.album_notice_result(p_notice_id, null, p_error);
    return false;
  end if;
  update public.album_notices set
    status = 'queued', claimed_at = null, error = left(p_error, 300),
    next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_wait_seconds, 0), 0))
  where id = p_notice_id;
  return true;
end $$;

-- A status from Meta's webhook for a thank-you (false: not one of them, or out of order).
create function public.album_notice_status(p_wa_id text, p_status text, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m public.album_notices;
  rank_of constant jsonb := '{"queued":0,"sending":1,"sent":2,"delivered":3,"read":4,"failed":1}';
begin
  select * into m from public.album_notices where wa_message_id = p_wa_id for update;
  if not found or p_status not in ('sent', 'delivered', 'read', 'failed') then
    return false;
  end if;
  if p_status = 'failed' then
    if m.status = 'read' then
      return false;
    end if;
  elsif (rank_of->>p_status)::int <= (rank_of->>m.status)::int and m.status <> 'failed' then
    return false;
  end if;
  update public.album_notices set status = p_status, error = left(p_error, 300) where id = m.id;
  if p_status = 'failed' then
    if m.status not in ('delivered', 'read') then
      perform public.album_notice_refund(m.id);
    end if;
    if p_error like '131050%' then
      perform public.whatsapp_opt_out(m.to_phone, 'meta');
    end if;
  end if;
  return true;
end $$;

-- How many of an invitation's thank-yous the page can still send now (due, or being sent).
create function public.album_notice_pending(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.album_notices
  where invitation_id = p_id
    and (status = 'sending' or (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())))
$$;

-- ─── privileges: service_role only ──────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.album_json(public.gallery_albums)',
    'public.album_notice_candidates(uuid, uuid[])',
    'public.album_notice_refund(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.album_owner_get(uuid, uuid)',
    'public.album_owner_ensure(uuid, uuid, text, text)',
    'public.album_owner_update(uuid, uuid, jsonb)',
    'public.album_owner_rotate(uuid, uuid, text, text)',
    'public.album_owner_items(uuid, uuid, int)',
    'public.album_items(uuid, boolean, int)',
    'public.album_by_token(text)',
    'public.album_slug_locale(text)',
    'public.album_invitation_link(uuid)',
    'public.album_ready_candidates(date, date, int)',
    'public.album_ready_mark(uuid)',
    'public.album_notices_state(uuid, uuid)',
    'public.album_notice_queue(uuid, uuid, uuid[], numeric)',
    'public.album_notice_mark(uuid, uuid, uuid[])',
    'public.album_notice_result(uuid, text, text)',
    'public.album_notice_claim(uuid, int)',
    'public.album_notice_requeue(uuid, text, int)',
    'public.album_notice_status(text, text, text)',
    'public.album_notice_pending(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
