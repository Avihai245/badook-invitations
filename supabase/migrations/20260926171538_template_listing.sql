-- A design's manifest may say `"listed": false` (the flagship photographic design until its real
-- photos arrive): it stays out of the public gallery. The seed now writes a template row active only
-- when its manifest is listed (a manifest without the flag is listed), so the public policy "active
-- templates are public" hides an unlisted design too. Nothing else changes: published invitations are
-- read through get_published_invitation (security definer, any template), and creating an invitation
-- never looked at is_active. Additive: the same function, the same arguments.

create or replace function public.seed_upsert(p_templates jsonb, p_invitations jsonb, p_owner uuid, p_version text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  t int := 0;
  i int := 0;
begin
  if p_templates is not null then
    insert into public.invitation_templates (id, manifest, is_active, sort)
    select x.id, x.manifest, coalesce((x.manifest ->> 'listed')::boolean, true), x.sort
    from jsonb_to_recordset(p_templates) as x(id text, manifest jsonb, sort int)
    on conflict (id) do update
      set manifest = excluded.manifest, sort = excluded.sort, is_active = excluded.is_active;
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

revoke all on function public.seed_upsert(jsonb, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.seed_upsert(jsonb, jsonb, uuid, text) to service_role;
