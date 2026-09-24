-- The app keeps the database in step with its code: the template rows and the published demo
-- invitations (features/invitations/templates/seed-data.ts). At startup the server compares the
-- stored fingerprint with its own and, when they differ, writes the rows through seed_upsert.

create table public.app_meta (
  key text primary key check (char_length(key) <= 60),
  value text not null check (char_length(value) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.app_meta enable row level security;
revoke all on public.app_meta from anon, authenticated;

create function public.app_meta_get(p_key text) returns text
language sql stable security definer set search_path = '' as $$
  select value from public.app_meta where key = p_key
$$;

-- p_templates: [{ id, manifest, sort }]; p_invitations: [{ id, slug, templateId, eventType, doc }]
-- (the demo owner's, published as version 1); p_version (optional): recorded once all is written.
-- A slug that belongs to someone else is never touched. Returns how many rows of each it wrote.
create function public.seed_upsert(p_templates jsonb, p_invitations jsonb, p_owner uuid, p_version text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  t int := 0;
  i int := 0;
begin
  if p_templates is not null then
    insert into public.invitation_templates (id, manifest, is_active, sort)
    select x.id, x.manifest, true, x.sort
    from jsonb_to_recordset(p_templates) as x(id text, manifest jsonb, sort int)
    on conflict (id) do update set manifest = excluded.manifest, sort = excluded.sort;
    get diagnostics t = row_count;
  end if;
  if p_invitations is not null and exists (select 1 from auth.users where id = p_owner) then
    for r in
      select * from jsonb_to_recordset(p_invitations)
        as x(id uuid, slug text, "templateId" text, "eventType" text, doc jsonb)
    loop
      insert into public.invitations (
        id, owner_id, template_id, slug, status, event_type, draft, published, version, published_at
      ) values (r.id, p_owner, r."templateId", r.slug, 'published', r."eventType", r.doc, r.doc, 1, now())
      on conflict (slug) do update set template_id = excluded.template_id, event_type = excluded.event_type,
        draft = excluded.draft, published = excluded.published, status = 'published', published_at = now()
      where public.invitations.owner_id = p_owner;
      if found then
        i := i + 1;
        insert into public.invitation_versions (invitation_id, version, document)
        select id, version, published from public.invitations where slug = r.slug and owner_id = p_owner
        on conflict (invitation_id, version) do update set document = excluded.document;
      end if;
    end loop;
  end if;
  if p_version is not null then
    insert into public.app_meta (key, value) values ('seed_version', p_version)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return jsonb_build_object('templates', t, 'invitations', i);
end $$;

revoke all on function public.app_meta_get(text) from public, anon, authenticated;
revoke all on function public.seed_upsert(jsonb, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.app_meta_get(text) to service_role;
grant execute on function public.seed_upsert(jsonb, jsonb, uuid, text) to service_role;
