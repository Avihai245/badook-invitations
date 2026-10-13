-- Legal compliance, version 2 of the legal documents (docs/legal/README.md). Additive only: nothing that
-- exists is changed in meaning, nothing is deleted, no data is backfilled — in particular no past
-- acceptance of any terms is invented. Everything here is dormant until the application code that uses it
-- is switched on (INVITES_LEGAL_V2).
--
--   legal_acceptances          evidence that an account accepted a version of a document (sign-up, checkout)
--   gallery_acknowledgements   evidence that a device acknowledged the gallery notice (first upload)
--   media_reports              "Report content / request removal": from anyone, with or without an account
--   media_report_events        the audit trail of each report
--   privacy_requests           access / correction / deletion / restriction / child / biometric requests
--   privacy_request_events     the audit trail of each request
--
-- Same rules as the rest of the app: row level security on, no policies, nothing reachable from the
-- browser; every function is SECURITY DEFINER with an empty search_path and service_role only. The console's
-- functions take the acting staff member (p_actor) and check the role first (admin_require): support.view
-- to read, support.reply to handle, and users.suspend (owners and admins) to remove an item for good.

-- ─── hardening found by the isolation tests (tests/db/gallery-isolation.test.ts) ─────────────────
-- Three older tables have row level security on and no policy, so the browser's roles read nothing — but
-- they still hold table grants, unlike every other server-only table. A payment token table should not
-- depend on "no policy yet" alone: take the grants away (the server uses the service role and
-- security-definer functions, which are unaffected).
revoke all on public.billing_cards, public.billing_claims, public.rsvp_rate_events from anon, authenticated;

-- ─── what a hidden-because-of-a-report item looks like ──────────────────────────────────────────

do $$
declare
  c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.gallery_items'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%status_reason%' and pg_get_constraintdef(oid) like '%unchecked%';
  if c is not null then
    execute format('alter table public.gallery_items drop constraint %I', c);
  end if;
  alter table public.gallery_items add constraint gallery_items_status_reason_check check (status_reason in (
    'ok', 'approval', 'nsfw', 'unsafe', 'quality', 'blurry', 'dark', 'duplicate', 'unchecked',
    'no_preview', 'host', 'report'
  ));
  select conname into c from pg_constraint
  where conrelid = 'public.gallery_moderation'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%check_name%' and pg_get_constraintdef(oid) like '%blur%';
  if c is not null then
    execute format('alter table public.gallery_moderation drop constraint %I', c);
  end if;
  alter table public.gallery_moderation add constraint gallery_moderation_check_name_check
    check (check_name in ('blur', 'dark', 'duplicate', 'ai', 'mode', 'host', 'guest', 'report'));
  select conname into c from pg_constraint
  where conrelid = 'public.gallery_moderation'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%decided_by%' and pg_get_constraintdef(oid) like '%browser%';
  if c is not null then
    execute format('alter table public.gallery_moderation drop constraint %I', c);
  end if;
  alter table public.gallery_moderation add constraint gallery_moderation_decided_by_check
    check (decided_by in ('browser', 'server', 'ai', 'host', 'guest', 'staff'));
end $$;

-- ─── tables ─────────────────────────────────────────────────────────────────────────────────────

-- A host's acceptance of a version of a document. Written when they accept it (sign-up, a purchase);
-- never backfilled. Deleted with the account.
create table public.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_key text not null check (doc_key in ('terms', 'privacy', 'refunds', 'gallery-rules')),
  version text not null check (version ~ '^[0-9]{1,3}$'),
  source text not null check (source in ('signup', 'checkout')),
  -- what was bought, for a checkout ('pro', 'credits_100', …); nothing else
  context text check (context is null or char_length(context) <= 60),
  accepted_at timestamptz not null default now()
);
create index legal_acceptances_user on public.legal_acceptances (user_id, doc_key, accepted_at desc);

-- A device's acknowledgement of the gallery notice before its first upload to an event's gallery. The
-- uploader is the same per-event one-way hash gallery_items keeps; no name, no address.
create table public.gallery_acknowledgements (
  invitation_id uuid not null references public.galleries (invitation_id) on delete cascade,
  uploader_hash text not null check (uploader_hash ~ '^[0-9a-f]{64}$'),
  rules_version text not null check (rules_version ~ '^[0-9]{1,3}$'),
  acknowledged_at timestamptz not null default now(),
  primary key (invitation_id, uploader_hash, rules_version)
);

-- A report about an item: anyone may send one, with or without an account. The reporter's details are
-- optional (the outcome can only be sent when they gave a way to reach them) except for a copyright
-- complaint. The item reference is resolved by the server from the gallery link the reporter holds, so a
-- reporter can only point at what they can see.
create table public.media_reports (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 5001) unique,
  invitation_id uuid references public.invitations (id) on delete set null,
  item_id uuid references public.gallery_items (id) on delete set null,
  -- where the report came from: the gallery page, the album page, a form with only a link, or the invitation
  surface text not null check (surface in ('gallery', 'album', 'link', 'invitation', 'ai_photo')),
  category text not null check (category in ('privacy', 'copyright', 'child_safety', 'harmful', 'other')),
  -- an intimate or sexual image shared without consent (a harmful-content flag that makes it urgent)
  intimate boolean not null default false,
  role text not null check (role in ('uploader', 'depicted', 'guardian', 'copyright_owner', 'other')),
  description text not null check (char_length(description) between 10 and 2000),
  -- what the reporter typed to point at the item when the server could not resolve it
  reference text check (reference is null or char_length(reference) <= 500),
  reporter_name text check (reporter_name is null or char_length(reporter_name) between 1 and 120),
  reporter_email text check (reporter_email is null or (char_length(reporter_email) between 3 and 254 and reporter_email ~ '^[^@\s]+@[^@\s]+$')),
  reporter_phone text check (reporter_phone is null or char_length(reporter_phone) between 5 and 30),
  locale text check (locale is null or char_length(locale) <= 8),
  -- urgent reports (a child, an intimate image) are looked at first
  urgent boolean not null default false,
  status text not null default 'new' check (status in ('new', 'in_review', 'actioned', 'dismissed', 'closed')),
  resolution text check (resolution in ('hidden', 'removed', 'kept', 'host_handled', 'not_applicable')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  -- the item was hidden by the report itself (urgent reports) or by staff; what it was before
  hidden_by_report boolean not null default false,
  prior_status text check (prior_status is null or prior_status in ('pending', 'published', 'hidden', 'rejected')),
  handled_by uuid references auth.users (id) on delete set null,
  -- delivery of the notices: null = not sent (yet); the console shows which are outstanding
  team_notified_at timestamptz,
  host_notified_at timestamptz,
  reporter_notified_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (category <> 'copyright' or (reporter_name is not null and reporter_email is not null))
);
create index media_reports_open on public.media_reports (urgent desc, created_at)
  where status in ('new', 'in_review');
create index media_reports_item on public.media_reports (item_id) where item_id is not null;
create index media_reports_invitation on public.media_reports (invitation_id, created_at desc);
create index media_reports_ip on public.media_reports (ip_hash, created_at desc) where ip_hash is not null;
create trigger media_reports_touch before update on public.media_reports
  for each row execute function public.touch_updated_at();

create table public.media_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.media_reports (id) on delete cascade,
  actor text not null check (actor in ('reporter', 'system', 'staff', 'host')),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+$'),
  -- (room for a staff note of 2000 characters, which a report's trail keeps: staff only)
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 10240),
  created_at timestamptz not null default now()
);
create index media_report_events_report on public.media_report_events (report_id, created_at);

-- A request about personal information: from anyone — a host, a guest, a parent, a person in a photo —
-- with or without an account. The Privacy Protection Law's replies are due within 30 days
-- (docs/legal/decision-records.md, DR-06): due_at is set when it arrives.
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 7001) unique,
  kind text not null check (kind in (
    'access', 'correction', 'deletion', 'restriction', 'gallery_removal', 'child_photo',
    'biometric_exclusion', 'other'
  )),
  relation text not null check (relation in ('host', 'guest', 'guardian', 'depicted', 'other')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  phone text check (phone is null or char_length(phone) between 5 and 30),
  details text not null check (char_length(details) between 10 and 4000),
  reference text check (reference is null or char_length(reference) <= 500),
  locale text check (locale is null or char_length(locale) <= 8),
  status text not null default 'new'
    check (status in ('new', 'verifying', 'in_progress', 'fulfilled', 'partly', 'declined', 'closed')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 4000),
  handled_by uuid references auth.users (id) on delete set null,
  team_notified_at timestamptz,
  requester_notified_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz
);
create index privacy_requests_open on public.privacy_requests (due_at)
  where status in ('new', 'verifying', 'in_progress');
create index privacy_requests_ip on public.privacy_requests (ip_hash, created_at desc) where ip_hash is not null;
create trigger privacy_requests_touch before update on public.privacy_requests
  for each row execute function public.touch_updated_at();

create table public.privacy_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.privacy_requests (id) on delete cascade,
  actor text not null check (actor in ('requester', 'system', 'staff')),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+$'),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4096),
  created_at timestamptz not null default now()
);
create index privacy_request_events_request on public.privacy_request_events (request_id, created_at);

alter table public.legal_acceptances enable row level security;
alter table public.gallery_acknowledgements enable row level security;
alter table public.media_reports enable row level security;
alter table public.media_report_events enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.privacy_request_events enable row level security;
revoke all on public.legal_acceptances, public.gallery_acknowledgements, public.media_reports,
  public.media_report_events, public.privacy_requests, public.privacy_request_events
  from anon, authenticated;

-- ─── acceptance evidence ────────────────────────────────────────────────────────────────────────

create function public.legal_accept(p_user_id uuid, p_docs text[], p_version text, p_source text, p_context text)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  d text;
  n int := 0;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'unknown user' using errcode = 'P0001';
  end if;
  foreach d in array p_docs loop
    insert into public.legal_acceptances (user_id, doc_key, version, source, context)
    values (p_user_id, d, p_version, p_source, p_context);
    n := n + 1;
  end loop;
  return n;
end $$;

-- What the account accepted, newest first (for the account's own record and for the console).
create function public.legal_acceptances_of(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'doc', a.doc_key, 'version', a.version, 'source', a.source, 'context', a.context, 'at', a.accepted_at
  ) order by a.accepted_at desc), '[]'::jsonb)
  from public.legal_acceptances a where a.user_id = p_user_id
$$;

create function public.gallery_acknowledge(p_invitation_id uuid, p_uploader_hash text, p_version text)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v timestamptz;
begin
  if not exists (select 1 from public.galleries where invitation_id = p_invitation_id) then
    raise exception 'unknown gallery' using errcode = 'P0001';
  end if;
  insert into public.gallery_acknowledgements (invitation_id, uploader_hash, rules_version)
  values (p_invitation_id, p_uploader_hash, p_version)
  on conflict do nothing;
  select acknowledged_at into v from public.gallery_acknowledgements
  where invitation_id = p_invitation_id and uploader_hash = p_uploader_hash and rules_version = p_version;
  return v;
end $$;

-- ─── media reports ──────────────────────────────────────────────────────────────────────────────

-- Whether the item the reporter points at exists in that invitation's gallery and is not deleted
-- (the server resolved the invitation from the reporter's link).
create function public.media_report_item_visible(p_invitation_id uuid, p_item_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gallery_items i
    where i.id = p_item_id and i.invitation_id = p_invitation_id and i.deleted_at is null
      and i.status = 'published'
  )
$$;

-- Stores a report and, when it is urgent and points at a published item, hides that item at once —
-- reversibly: staff decide afterwards. Urgent: a child (category child_safety, or the reporter is the
-- child's parent or guardian), an intimate image. The automatic hiding is capped at 5 items per
-- invitation per rolling hour (a stranger with a link must not be able to blank a gallery): beyond it the
-- report is still stored as urgent, the item is left as it is and the trail says 'hide_capped'. The item
-- is locked and checked again (published, not deleted, of that invitation) before anything is written.
-- Returns { id, number, urgent, hidden }.
create function public.media_report_submit(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_inv uuid := nullif(p_data ->> 'invitation_id', '')::uuid;
  v_item uuid := nullif(p_data ->> 'item_id', '')::uuid;
  v_category text := p_data ->> 'category';
  v_intimate boolean := coalesce((p_data ->> 'intimate')::boolean, false);
  v_urgent boolean := v_category = 'child_safety' or v_intimate or (p_data ->> 'role') = 'guardian';
  v_prior text;
  v_hide boolean := false;
  v_capped boolean := false;
  v_it public.gallery_items;
  r public.media_reports;
begin
  if v_item is not null then
    if v_inv is null then
      raise exception 'item not found' using errcode = 'P0001';
    end if;
    if v_urgent then
      -- one urgent report at a time per invitation, so the cap below counts them all
      perform pg_advisory_xact_lock(hashtextextended('media_report_hide:' || v_inv::text, 0));
    end if;
    select * into v_it from public.gallery_items where id = v_item for update;
    if not found or v_it.invitation_id <> v_inv or v_it.deleted_at is not null or v_it.status <> 'published' then
      raise exception 'item not found' using errcode = 'P0001';
    end if;
    if v_urgent then
      v_prior := v_it.status;
      if (select count(*) from public.media_report_events e
          join public.media_reports x on x.id = e.report_id
          where e.action = 'hidden_urgent' and x.invitation_id = v_inv
            and e.created_at > now() - interval '1 hour') >= 5 then
        v_capped := true;
      else
        v_hide := true;
        update public.gallery_items set status = 'hidden', status_reason = 'report' where id = v_item;
        insert into public.gallery_moderation (item_id, check_name, result, detail, decided_by)
        values (v_item, 'report', 'hidden', jsonb_build_object('category', v_category), 'server');
      end if;
    end if;
  end if;
  insert into public.media_reports (
    invitation_id, item_id, surface, category, intimate, role, description, reference,
    reporter_name, reporter_email, reporter_phone, locale, urgent, hidden_by_report, prior_status, ip_hash
  ) values (
    v_inv, v_item, p_data ->> 'surface', v_category, v_intimate, p_data ->> 'role', p_data ->> 'description',
    nullif(p_data ->> 'reference', ''), nullif(p_data ->> 'reporter_name', ''), nullif(p_data ->> 'reporter_email', ''),
    nullif(p_data ->> 'reporter_phone', ''), nullif(p_data ->> 'locale', ''), v_urgent, v_hide,
    case when v_hide then v_prior end, nullif(p_data ->> 'ip_hash', '')
  ) returning * into r;
  insert into public.media_report_events (report_id, actor, action, detail)
  values (r.id, 'reporter', 'submitted',
          jsonb_build_object('category', v_category, 'urgent', v_urgent, 'hasItem', v_item is not null));
  if v_hide then
    insert into public.media_report_events (report_id, actor, action, detail)
    values (r.id, 'system', 'hidden_urgent', jsonb_build_object('priorStatus', v_prior));
  elsif v_capped then
    insert into public.media_report_events (report_id, actor, action, detail)
    values (r.id, 'system', 'hide_capped', jsonb_build_object('cap', 5, 'perHour', true));
  end if;
  return jsonb_build_object('id', r.id, 'number', r.number, 'urgent', v_urgent, 'hidden', v_hide);
end $$;

-- The server records that a notice went out (or failed): team, host or reporter.
create function public.media_report_mark_notified(p_id uuid, p_who text, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_who not in ('team', 'host', 'reporter') then
    raise exception 'bad notice' using errcode = 'P0001';
  end if;
  if p_ok then
    update public.media_reports set
      team_notified_at = case when p_who = 'team' then now() else team_notified_at end,
      host_notified_at = case when p_who = 'host' then now() else host_notified_at end,
      reporter_notified_at = case when p_who = 'reporter' then now() else reporter_notified_at end
    where id = p_id;
  end if;
  insert into public.media_report_events (report_id, actor, action, detail)
  values (p_id, 'system', 'notice_' || p_who, jsonb_build_object('sent', p_ok));
end $$;

-- The console's list: open first (urgent first), then the rest by date. Contact details only for roles
-- with users.pii. p_status: 'open' (new + in review), or one status, or null for all.
create function public.media_report_admin_list(p_actor uuid, p_status text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
begin
  return coalesce((
    select jsonb_agg(public.media_report_json(y.m, v_pii) order by (y.m).urgent desc, (y.m).created_at desc)
    from (
      select m from public.media_reports m
      where case coalesce(p_status, 'all')
              when 'open' then m.status in ('new', 'in_review')
              when 'all' then true
              else m.status = p_status end
      order by m.urgent desc, m.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) y
  ), '[]'::jsonb);
end $$;

create function public.media_report_json(m public.media_reports, p_pii boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'number', m.number, 'surface', m.surface, 'category', m.category, 'intimate', m.intimate,
    'role', m.role, 'urgent', m.urgent, 'status', m.status, 'resolution', m.resolution,
    'resolutionNote', m.resolution_note, 'description', m.description, 'reference', m.reference,
    'invitationId', m.invitation_id, 'itemId', m.item_id, 'hiddenByReport', m.hidden_by_report,
    'priorStatus', m.prior_status,
    'item', (select jsonb_build_object('status', i.status, 'reason', i.status_reason, 'kind', i.kind,
                                       'deleted', i.deleted_at is not null)
             from public.gallery_items i where i.id = m.item_id),
    'reporterName', case when p_pii then m.reporter_name end,
    'reporterEmail', case when p_pii then m.reporter_email end,
    'reporterPhone', case when p_pii then m.reporter_phone end,
    'canReply', m.reporter_email is not null,
    'teamNotifiedAt', m.team_notified_at, 'hostNotifiedAt', m.host_notified_at,
    'reporterNotifiedAt', m.reporter_notified_at,
    'createdAt', m.created_at, 'resolvedAt', m.resolved_at
  )
$$;

create function public.media_report_admin_get(p_actor uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  m public.media_reports;
begin
  select * into m from public.media_reports where id = p_id;
  if not found then
    return null;
  end if;
  return public.media_report_json(m, v_pii) || jsonb_build_object('events', coalesce((
    select jsonb_agg(jsonb_build_object('actor', e.actor, 'action', e.action, 'detail', e.detail, 'at', e.created_at)
                     order by e.created_at, e.id)
    from public.media_report_events e where e.report_id = p_id), '[]'::jsonb));
end $$;

-- A staff decision on a report. p_action: review (start looking), hide, restore (back to what it was),
-- remove (the item is deleted for good — owners and admins only), keep (the report is not upheld: an item
-- that this report hid goes back), dismiss (not applicable: spam, unreadable; the same), close, note. Every
-- action is recorded twice: in the report's own trail (with the staff's note, for staff only) and in the
-- console's audit log. A removed item's files go to the trash like any deletion. While an item is held
-- (hidden, reason 'report') the host cannot show it again (gallery_owner_moderate): staff are the way back.
create function public.media_report_admin_act(p_actor uuid, p_id uuid, p_action text, p_note text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.reply');
  m public.media_reports;
  v_note text := nullif(btrim(left(coalesce(p_note, ''), 2000)), '');
  v_item public.gallery_items;
  v_held boolean := false;
begin
  select * into m from public.media_reports where id = p_id for update;
  if not found then
    raise exception 'not found' using errcode = 'P0001';
  end if;
  if p_action not in ('review', 'hide', 'restore', 'remove', 'keep', 'dismiss', 'close', 'note') then
    raise exception 'bad action' using errcode = 'P0001';
  end if;
  if p_action in ('hide', 'restore', 'remove') and m.item_id is null then
    raise exception 'no item' using errcode = 'P0001';
  end if;
  if p_action = 'remove' then
    perform public.admin_require(p_actor, 'users.suspend');
  end if;
  if p_action in ('keep', 'dismiss', 'close', 'remove') and v_note is null then
    raise exception 'note required' using errcode = 'P0001';
  end if;

  if m.item_id is not null and p_action in ('hide', 'restore', 'remove', 'keep', 'dismiss', 'close') then
    select * into v_item from public.gallery_items where id = m.item_id for update;
    -- still held: hidden, and by a report (this one or a staff member's hide)
    v_held := found and v_item.deleted_at is null and v_item.status = 'hidden' and v_item.status_reason = 'report';
  end if;

  if p_action = 'review' then
    update public.media_reports set status = 'in_review', handled_by = p_actor
    where id = p_id and status = 'new';
  elsif p_action = 'hide' then
    if v_item.deleted_at is null and v_item.status <> 'hidden' then
      update public.media_reports
      set prior_status = coalesce(prior_status, v_item.status), hidden_by_report = true,
          status = case when status = 'new' then 'in_review' else status end, handled_by = p_actor
      where id = p_id;
      update public.gallery_items set status = 'hidden', status_reason = 'report' where id = v_item.id;
      insert into public.gallery_moderation (item_id, check_name, result, detail, decided_by, actor_id)
      values (v_item.id, 'report', 'hidden', jsonb_build_object('report', m.number), 'staff', p_actor);
    end if;
  elsif p_action = 'remove' then
    if v_item.deleted_at is null then
      update public.gallery_items set deleted_at = now(), deleted_by = 'system' where id = v_item.id;
      insert into public.gallery_moderation (item_id, check_name, result, detail, decided_by, actor_id)
      values (v_item.id, 'report', 'deleted', jsonb_build_object('report', m.number), 'staff', p_actor);
    end if;
    update public.media_reports
    set status = 'actioned', resolution = 'removed', resolution_note = v_note, resolved_at = now(),
        handled_by = p_actor
    where id = p_id;
  end if;

  -- put an item that is still held back where it was: staff's restore, and a report that is not upheld
  if p_action in ('restore', 'keep', 'dismiss') and v_held and m.prior_status is not null then
    update public.gallery_items
    set status = m.prior_status, status_reason = 'host',
        published_at = case when m.prior_status = 'published' then now() else published_at end
    where id = v_item.id;
    insert into public.gallery_moderation (item_id, check_name, result, detail, decided_by, actor_id)
    values (v_item.id, 'report', m.prior_status,
            jsonb_build_object('report', m.number, 'restored', true, 'by', p_action), 'staff', p_actor);
    update public.media_reports set hidden_by_report = false, handled_by = p_actor where id = p_id;
  end if;

  if p_action = 'keep' then
    update public.media_reports
    set status = 'dismissed', resolution = 'kept', resolution_note = v_note, resolved_at = now(),
        handled_by = p_actor
    where id = p_id;
  elsif p_action = 'dismiss' then
    update public.media_reports
    set status = 'dismissed', resolution = 'not_applicable', resolution_note = v_note,
        resolved_at = now(), handled_by = p_actor
    where id = p_id;
  elsif p_action = 'close' then
    update public.media_reports
    set status = case when status in ('actioned', 'dismissed') then status else 'closed' end,
        -- 'hidden' only while the item really is held; else the host's own decision stands
        resolution = coalesce(resolution, case when v_held then 'hidden' else 'host_handled' end),
        resolution_note = coalesce(v_note, resolution_note), resolved_at = coalesce(resolved_at, now()),
        handled_by = p_actor
    where id = p_id;
  end if;

  insert into public.media_report_events (report_id, actor, actor_id, action, detail)
  values (p_id, 'staff', p_actor, p_action,
          jsonb_build_object('hasNote', v_note is not null)
          || case when v_note is not null then jsonb_build_object('note', v_note) else '{}'::jsonb end);
  perform public.admin_log(p_actor, 'report.' || p_action, 'system', 'media_report:' || m.number,
                           jsonb_build_object('role', v_role));
  return public.media_report_admin_get(p_actor, p_id);
end $$;

-- ─── privacy requests ───────────────────────────────────────────────────────────────────────────

create function public.privacy_request_submit(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.privacy_requests;
begin
  insert into public.privacy_requests (kind, relation, name, email, phone, details, reference, locale, ip_hash)
  values (p_data ->> 'kind', p_data ->> 'relation', p_data ->> 'name', p_data ->> 'email', nullif(p_data ->> 'phone', ''),
          p_data ->> 'details', nullif(p_data ->> 'reference', ''), nullif(p_data ->> 'locale', ''), nullif(p_data ->> 'ip_hash', ''))
  returning * into r;
  insert into public.privacy_request_events (request_id, actor, action, detail)
  values (r.id, 'requester', 'submitted', jsonb_build_object('kind', r.kind));
  return jsonb_build_object('id', r.id, 'number', r.number, 'dueAt', r.due_at);
end $$;

create function public.privacy_request_mark_notified(p_id uuid, p_who text, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_who not in ('team', 'requester') then
    raise exception 'bad notice' using errcode = 'P0001';
  end if;
  if p_ok then
    update public.privacy_requests set
      team_notified_at = case when p_who = 'team' then now() else team_notified_at end,
      requester_notified_at = case when p_who = 'requester' then now() else requester_notified_at end
    where id = p_id;
  end if;
  insert into public.privacy_request_events (request_id, actor, action, detail)
  values (p_id, 'system', 'notice_' || p_who, jsonb_build_object('sent', p_ok));
end $$;

create function public.privacy_request_json(m public.privacy_requests, p_pii boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'number', m.number, 'kind', m.kind, 'relation', m.relation, 'status', m.status,
    'details', m.details, 'reference', m.reference, 'decisionNote', m.decision_note,
    'name', case when p_pii then m.name end,
    'email', case when p_pii then m.email end,
    'phone', case when p_pii then m.phone end,
    'teamNotifiedAt', m.team_notified_at, 'requesterNotifiedAt', m.requester_notified_at,
    'createdAt', m.created_at, 'dueAt', m.due_at, 'resolvedAt', m.resolved_at,
    'overdue', m.status in ('new', 'verifying', 'in_progress') and m.due_at < now()
  )
$$;

create function public.privacy_request_admin_list(p_actor uuid, p_status text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
begin
  return coalesce((
    select jsonb_agg(public.privacy_request_json(y.m, v_pii) order by (y.m).due_at)
    from (
      select m from public.privacy_requests m
      where case coalesce(p_status, 'all')
              when 'open' then m.status in ('new', 'verifying', 'in_progress')
              when 'all' then true
              else m.status = p_status end
      order by case when m.status in ('new', 'verifying', 'in_progress') then 0 else 1 end, m.due_at
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) y
  ), '[]'::jsonb);
end $$;

create function public.privacy_request_admin_get(p_actor uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.view');
  v_pii boolean := public.admin_can(v_role, 'users.pii');
  m public.privacy_requests;
begin
  select * into m from public.privacy_requests where id = p_id;
  if not found then
    return null;
  end if;
  return public.privacy_request_json(m, v_pii) || jsonb_build_object('events', coalesce((
    select jsonb_agg(jsonb_build_object('actor', e.actor, 'action', e.action, 'detail', e.detail, 'at', e.created_at)
                     order by e.created_at, e.id)
    from public.privacy_request_events e where e.request_id = p_id), '[]'::jsonb));
end $$;

-- p_status: the new status (verifying, in_progress, fulfilled, partly, declined, closed); a final one needs a
-- note saying what was done or why not.
create function public.privacy_request_admin_set(p_actor uuid, p_id uuid, p_status text, p_note text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.admin_require(p_actor, 'support.reply');
  v_note text := nullif(btrim(left(coalesce(p_note, ''), 4000)), '');
  m public.privacy_requests;
  v_final boolean := p_status in ('fulfilled', 'partly', 'declined', 'closed');
begin
  select * into m from public.privacy_requests where id = p_id for update;
  if not found then
    raise exception 'not found' using errcode = 'P0001';
  end if;
  if p_status not in ('verifying', 'in_progress', 'fulfilled', 'partly', 'declined', 'closed') then
    raise exception 'bad status' using errcode = 'P0001';
  end if;
  if v_final and v_note is null then
    raise exception 'note required' using errcode = 'P0001';
  end if;
  update public.privacy_requests
  set status = p_status, handled_by = p_actor,
      decision_note = coalesce(v_note, decision_note),
      resolved_at = case when v_final then coalesce(resolved_at, now()) else null end
  where id = p_id;
  insert into public.privacy_request_events (request_id, actor, actor_id, action, detail)
  values (p_id, 'staff', p_actor, 'status_' || p_status, jsonb_build_object('hasNote', v_note is not null));
  perform public.admin_log(p_actor, 'privacy_request.status', 'system', 'privacy_request:' || m.number,
                           jsonb_build_object('role', v_role, 'status', p_status));
  return public.privacy_request_admin_get(p_actor, p_id);
end $$;

-- ─── the host and a held item ───────────────────────────────────────────────────────────────────

-- gallery_owner_moderate (live gallery) with one rule more: an item that a report holds (hidden, reason
-- 'report') cannot be published, hidden or rejected by the host — they may only delete it; staff's
-- 'restore' (media_report_admin_act) is the way back. Returns { count, ids } — what it changed — and, only
-- when there were any, { held }: the held items it left alone (so nothing changes for a host without any).
create or replace function public.gallery_owner_moderate(p_id uuid, p_owner_id uuid, p_item_ids uuid[], p_action text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_held uuid[];
begin
  if p_action not in ('publish', 'hide', 'reject', 'delete') then
    raise exception 'gallery_owner_moderate: bad action';
  end if;
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner_id) then
    return null;
  end if;
  select coalesce(array_agg(i.id), '{}') into v_held
  from public.gallery_items i
  where p_action <> 'delete' and i.invitation_id = p_id and i.id = any(p_item_ids)
    and i.deleted_at is null and i.status = 'hidden' and i.status_reason = 'report';
  with changed as (
    update public.gallery_items i set
      status = case p_action
        when 'publish' then 'published' when 'hide' then 'hidden' when 'reject' then 'rejected' else i.status end,
      status_reason = case when p_action = 'delete' then i.status_reason else 'host' end,
      published_at = case when p_action = 'publish' and i.status <> 'published' then now() else i.published_at end,
      deleted_at = case when p_action = 'delete' then now() else i.deleted_at end,
      deleted_by = case when p_action = 'delete' then 'host' else i.deleted_by end
    where i.invitation_id = p_id
      and i.id = any(p_item_ids)
      and i.deleted_at is null
      and i.status <> 'uploading'
      and not (i.id = any(v_held))
    returning i.id
  )
  select coalesce(array_agg(id), '{}') into v_ids from changed;
  insert into public.gallery_moderation (item_id, check_name, result, decided_by, actor_id)
  select id, 'host',
    case p_action when 'publish' then 'published' when 'hide' then 'hidden' when 'reject' then 'rejected' else 'deleted' end,
    'host', p_owner_id
  from unnest(v_ids) id;
  return jsonb_build_object('count', cardinality(v_ids), 'ids', to_jsonb(v_ids))
    || case when cardinality(v_held) > 0 then jsonb_build_object('held', to_jsonb(v_held)) else '{}'::jsonb end;
end $$;

-- ─── housekeeping ───────────────────────────────────────────────────────────────────────────────

-- The daily run: closed reports and finished requests are erased two years after they were resolved
-- (a record to answer a complaint or a regulator with; the privacy policy says so), the ip hashes used
-- against abuse after 30 days. { reports, requests, hashes }.
create function public.legal_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
  c int;
begin
  delete from public.media_reports
  where status in ('actioned', 'dismissed', 'closed') and resolved_at < now() - interval '2 years';
  get diagnostics a = row_count;
  delete from public.privacy_requests
  where status in ('fulfilled', 'partly', 'declined', 'closed') and resolved_at < now() - interval '2 years';
  get diagnostics b = row_count;
  update public.media_reports set ip_hash = null
  where ip_hash is not null and created_at < now() - interval '30 days';
  get diagnostics c = row_count;
  update public.privacy_requests set ip_hash = null
  where ip_hash is not null and created_at < now() - interval '30 days';
  return jsonb_build_object('reports', a, 'requests', b, 'hashes', c);
end $$;

-- ─── privileges: the server's role only ─────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.media_report_json(public.media_reports, boolean)',
    'public.privacy_request_json(public.privacy_requests, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.legal_accept(uuid, text[], text, text, text)',
    'public.legal_acceptances_of(uuid)',
    'public.gallery_acknowledge(uuid, text, text)',
    'public.media_report_item_visible(uuid, uuid)',
    'public.media_report_submit(jsonb)',
    'public.media_report_mark_notified(uuid, text, boolean)',
    'public.media_report_admin_list(uuid, text, int)',
    'public.media_report_admin_get(uuid, uuid)',
    'public.media_report_admin_act(uuid, uuid, text, text)',
    'public.privacy_request_submit(jsonb)',
    'public.privacy_request_mark_notified(uuid, text, boolean)',
    'public.privacy_request_admin_list(uuid, text, int)',
    'public.privacy_request_admin_get(uuid, uuid)',
    'public.privacy_request_admin_set(uuid, uuid, text, text)',
    'public.legal_maintenance()',
    'public.gallery_owner_moderate(uuid, uuid, uuid[], text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
