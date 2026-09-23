-- Host app (P2): owner-scoped functions for the server routes of the editor, the invitations list and
-- the publish flow. The routes resolve the signed-in user with Supabase Auth and pass its id; every
-- function checks ownership itself and returns null for an invitation the owner doesn't have.
-- Executable by service_role only, like publish_invitation / restore_invitation_version (P1).

-- ─── list & read ────────────────────────────────────────────────────────────────────────────────

-- An owner's invitations, most recently edited first, with what a list card needs (not the documents).
create function public.owner_invitations(p_owner_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'status', i.status,
      'templateId', i.template_id,
      'eventType', i.event_type,
      'hosts', i.draft->'hosts',
      'date', i.draft#>>'{event,date}',
      'locales', i.draft->'locales',
      'defaultLocale', i.draft->>'defaultLocale',
      'palette', i.draft#>'{theme,palette}',
      'monogram', i.draft#>'{cover,monogram}',
      'sealColor', i.draft#>>'{cover,sealColor}',
      'version', i.version,
      'unpublishedChanges', i.published is not null and i.draft is distinct from i.published,
      'publishedAt', i.published_at,
      'updatedAt', i.updated_at,
      'responses', coalesce(r.responses, 0),
      'attending', coalesce(r.attending, 0)
    ) order by i.updated_at desc), '[]'::jsonb)
  from public.invitations i
  left join lateral (
    select count(*) as responses,
           sum(case when x.attending then x.adults_count + x.children_count else 0 end) as attending
    from public.rsvp_responses x
    where x.invitation_id = i.id
  ) r on true
  where i.owner_id = p_owner_id
$$;

-- One invitation for the editor: draft, published document and the updatedAt autosave compares against.
create function public.owner_invitation(p_id uuid, p_owner_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id,
    'slug', i.slug,
    'status', i.status,
    'templateId', i.template_id,
    'eventType', i.event_type,
    'draft', i.draft,
    'published', i.published,
    'version', i.version,
    'publishedAt', i.published_at,
    'updatedAt', i.updated_at,
    'createdAt', i.created_at
  )
  from public.invitations i
  where i.id = p_id and i.owner_id = p_owner_id
$$;

-- ─── create ─────────────────────────────────────────────────────────────────────────────────────

-- New draft with the first free slug among p_slug, p_slug-2 … p_slug-9, then p_slug-<4 random hex>
-- (popular name pairs keep coming). Returns { id, slug }. The document's share.slug and templateId
-- always follow the row.
create function public.create_invitation(
  p_owner_id uuid,
  p_template_id text,
  p_event_type text,
  p_slug text,
  p_draft jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug text := p_slug;
  v_id uuid;
  n int := 1;
begin
  loop
    begin
      insert into public.invitations (owner_id, template_id, slug, event_type, draft)
      values (
        p_owner_id, p_template_id, v_slug, p_event_type,
        jsonb_set(jsonb_set(p_draft, '{share,slug}', to_jsonb(v_slug)), '{templateId}', to_jsonb(p_template_id))
      )
      returning id into v_id;
      return jsonb_build_object('id', v_id, 'slug', v_slug);
    exception when unique_violation then
      n := n + 1;
      if n > 40 then
        raise;
      end if;
      v_slug := case
        when n <= 9 then rtrim(left(p_slug, 58), '-') || '-' || n
        else rtrim(left(p_slug, 55), '-') || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4)
      end;
    end;
  end loop;
end $$;

-- ─── autosave ───────────────────────────────────────────────────────────────────────────────────

-- Saves the draft only if nobody saved since p_expected_updated_at (another tab, a publish, a restore).
-- Returns { ok: true, updatedAt } | { ok: false, code: 'conflict', updatedAt, draft } | null (not found).
create function public.save_invitation_draft(
  p_id uuid,
  p_owner_id uuid,
  p_draft jsonb,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  update public.invitations i set
    draft = jsonb_set(jsonb_set(p_draft, '{share,slug}', to_jsonb(i.slug)), '{templateId}', to_jsonb(i.template_id)),
    event_type = coalesce(p_draft->>'eventType', i.event_type)
  where i.id = p_id and i.owner_id = p_owner_id and i.updated_at = p_expected_updated_at
  returning * into v;
  if found then
    return jsonb_build_object('ok', true, 'updatedAt', v.updated_at);
  end if;
  select * into v from public.invitations where id = p_id and owner_id = p_owner_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object('ok', false, 'code', 'conflict', 'updatedAt', v.updated_at, 'draft', v.draft);
end $$;

-- ─── slug ───────────────────────────────────────────────────────────────────────────────────────

create function public.slug_available(p_slug text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_slug ~ '^[a-z0-9-]{3,60}$'
     and not exists (select 1 from public.invitations where slug = p_slug and id is distinct from p_id)
$$;

-- Changes the slug (column + draft.share.slug); the publish route calls it right before publishing so
-- the published document carries the new slug. Returns { ok, slug, updatedAt } | { ok: false, code }.
create function public.set_invitation_slug(p_id uuid, p_owner_id uuid, p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  if p_slug !~ '^[a-z0-9-]{3,60}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  update public.invitations set slug = p_slug, draft = jsonb_set(draft, '{share,slug}', to_jsonb(p_slug))
  where id = p_id and owner_id = p_owner_id
  returning * into v;
  if not found then
    return null;
  end if;
  return jsonb_build_object('ok', true, 'slug', v.slug, 'updatedAt', v.updated_at);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'taken');
end $$;

-- ─── publish: also report the new updatedAt, so the editor's next autosave doesn't conflict ─────

create or replace function public.publish_invitation(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  update public.invitations set
    published = draft, status = 'published', version = version + 1, published_at = now()
  where id = p_id and owner_id = p_owner_id
  returning * into v;
  if not found then
    return null;
  end if;
  insert into public.invitation_versions (invitation_id, version, document) values (v.id, v.version, v.published);
  return jsonb_build_object('slug', v.slug, 'version', v.version, 'publishedAt', v.published_at, 'updatedAt', v.updated_at);
end $$;

-- ─── versions ───────────────────────────────────────────────────────────────────────────────────

create function public.owner_invitation_versions(p_id uuid, p_owner_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'createdAt', v.created_at)
                  order by v.version desc), '[]'::jsonb)
  from public.invitation_versions v
  join public.invitations i on i.id = v.invitation_id
  where i.id = p_id and i.owner_id = p_owner_id
$$;

create function public.owner_invitation_version(p_id uuid, p_owner_id uuid, p_version int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select v.document
  from public.invitation_versions v
  join public.invitations i on i.id = v.invitation_id
  where i.id = p_id and i.owner_id = p_owner_id and v.version = p_version
$$;

-- ─── duplicate / archive ────────────────────────────────────────────────────────────────────────

-- A new draft from the source's draft, slug '<slug>-copy' (-2, -3… when taken). Returns { id, slug }.
create function public.duplicate_invitation(p_id uuid, p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  src public.invitations;
begin
  select * into src from public.invitations where id = p_id and owner_id = p_owner_id;
  if not found then
    return null;
  end if;
  return public.create_invitation(
    p_owner_id, src.template_id, src.event_type, rtrim(left(src.slug, 55), '-') || '-copy', src.draft
  );
end $$;

-- Archived invitations stop being served (get_published_invitation needs status 'published');
-- unarchiving returns to 'published' when there is a published document, else 'draft'.
create function public.set_invitation_archived(p_id uuid, p_owner_id uuid, p_archived boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  update public.invitations set status = case
      when p_archived then 'archived'
      when published is not null then 'published'
      else 'draft'
    end
  where id = p_id and owner_id = p_owner_id
  returning * into v;
  if not found then
    return null;
  end if;
  return jsonb_build_object('slug', v.slug, 'status', v.status, 'updatedAt', v.updated_at);
end $$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

revoke all on function public.owner_invitations(uuid) from public, anon, authenticated;
revoke all on function public.owner_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_invitation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.save_invitation_draft(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.slug_available(text, uuid) from public, anon, authenticated;
revoke all on function public.set_invitation_slug(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.publish_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.owner_invitation_versions(uuid, uuid) from public, anon, authenticated;
revoke all on function public.owner_invitation_version(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.duplicate_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_invitation_archived(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.owner_invitations(uuid) to service_role;
grant execute on function public.owner_invitation(uuid, uuid) to service_role;
grant execute on function public.create_invitation(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.save_invitation_draft(uuid, uuid, jsonb, timestamptz) to service_role;
grant execute on function public.slug_available(text, uuid) to service_role;
grant execute on function public.set_invitation_slug(uuid, uuid, text) to service_role;
grant execute on function public.publish_invitation(uuid, uuid) to service_role;
grant execute on function public.owner_invitation_versions(uuid, uuid) to service_role;
grant execute on function public.owner_invitation_version(uuid, uuid, int) to service_role;
grant execute on function public.duplicate_invitation(uuid, uuid) to service_role;
grant execute on function public.set_invitation_archived(uuid, uuid, boolean) to service_role;
