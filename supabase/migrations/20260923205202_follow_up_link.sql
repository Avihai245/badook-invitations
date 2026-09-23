-- Save-the-date → its full invitation (P4): the full invitation remembers the save-the-date it was
-- created from, and the save-the-date's public page links to it once it is published.

alter table public.invitations
  add column source_id uuid references public.invitations (id) on delete set null;

create index invitations_source_id_idx on public.invitations (source_id) where source_id is not null;

-- Owners can write their rows directly (RLS), so the rule lives in the table too: a source is always
-- the same owner's save-the-date — nobody can attach an invitation to someone else's page.
create function public.check_invitation_source() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source_id is not null and not exists (
    select 1 from public.invitations s
    where s.id = new.source_id and s.id <> new.id
      and s.owner_id = new.owner_id and s.event_type = 'save_the_date'
  ) then
    raise exception 'invitations.source_id must be the owner''s own save-the-date' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger invitations_source_check
  before insert or update of source_id, owner_id on public.invitations
  for each row execute function public.check_invitation_source();

revoke all on function public.check_invitation_source() from public, anon, authenticated;

-- ─── create: optional source (the owner's own save-the-date; anything else is refused) ───────────

drop function public.create_invitation(uuid, text, text, text, jsonb);

create function public.create_invitation(
  p_owner_id uuid,
  p_template_id text,
  p_event_type text,
  p_slug text,
  p_draft jsonb,
  p_source_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug text := p_slug;
  v_id uuid;
  n int := 1;
begin
  if p_source_id is not null and not exists (
    select 1 from public.invitations s
    where s.id = p_source_id and s.owner_id = p_owner_id and s.event_type = 'save_the_date'
  ) then
    raise exception 'create_invitation: the source must be the owner''s save-the-date'
      using errcode = '22023';
  end if;
  loop
    begin
      insert into public.invitations (owner_id, template_id, slug, event_type, draft, source_id)
      values (
        p_owner_id, p_template_id, v_slug, p_event_type,
        jsonb_set(jsonb_set(p_draft, '{share,slug}', to_jsonb(v_slug)), '{templateId}', to_jsonb(p_template_id)),
        p_source_id
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

revoke all on function public.create_invitation(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_invitation(uuid, text, text, text, jsonb, uuid) to service_role;

-- ─── the owner's view: + the save-the-date's slug (its page is refreshed on publish / archive) ────

create or replace function public.owner_invitation(p_id uuid, p_owner_id uuid) returns jsonb
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
    'createdAt', i.created_at,
    'sourceSlug', (select s.slug from public.invitations s where s.id = i.source_id)
  )
  from public.invitations i
  where i.id = p_id and i.owner_id = p_owner_id
$$;

-- ─── the public page: + the latest published invitation created from this one ──────────────────

create or replace function public.get_published_invitation(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id,
    'slug', i.slug,
    'document', i.published,
    'template', t.manifest,
    'followUp', (
      select jsonb_build_object('slug', f.slug, 'locales', f.published -> 'locales')
      from public.invitations f
      where f.source_id = i.id and f.owner_id = i.owner_id
        and f.status = 'published' and f.published is not null
      order by f.published_at desc nulls last, f.created_at desc
      limit 1
    )
  )
  from public.invitations i
  join public.invitation_templates t on t.id = i.template_id
  where i.slug = p_slug and i.status = 'published' and i.published is not null
$$;
