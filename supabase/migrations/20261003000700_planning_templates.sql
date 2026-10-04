-- Event planning, the host's own templates (the Business plan's `planning_templates`): a plan saved to
-- start the next event from. Same rules as the rest: SECURITY DEFINER, empty search_path, service_role
-- only, the owner checked inside. A template belongs to its owner alone.

-- Saves a template (at most 20 a host). p_items: { tasks, categories, requiredVendors } as the server
-- built it from a plan. Answers the template's summary, or { ok:false, code:'too_many' }.
create function public.planning_template_save(p_owner uuid, p_name text, p_event_type text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.plan_templates;
begin
  if not exists (select 1 from auth.users where id = p_owner) then return null; end if;
  if (select count(*) from public.plan_templates where owner_id = p_owner) >= 20 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  insert into public.plan_templates (owner_id, name, event_type, items)
  values (p_owner, p_name, p_event_type, p_items)
  returning * into t;
  return jsonb_build_object(
    'id', t.id, 'name', t.name, 'eventType', t.event_type, 'updatedAt', t.updated_at,
    'tasks', jsonb_array_length(coalesce(t.items -> 'tasks', '[]'))
  );
end $$;

-- The owner's templates, newest first.
create function public.planning_templates_list(p_owner uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'eventType', t.event_type, 'updatedAt', t.updated_at,
    'tasks', jsonb_array_length(coalesce(t.items -> 'tasks', '[]'))
  ) order by t.updated_at desc), '[]'::jsonb)
  from public.plan_templates t where t.owner_id = p_owner
$$;

-- One of the owner's templates' content (null: not theirs).
create function public.planning_template_get(p_owner uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select t.items from public.plan_templates t where t.id = p_id and t.owner_id = p_owner
$$;

create function public.planning_template_delete(p_owner uuid, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.plan_templates where id = p_id and owner_id = p_owner;
  return found;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.planning_template_save(uuid, text, text, jsonb)',
    'public.planning_templates_list(uuid)',
    'public.planning_template_get(uuid, uuid)',
    'public.planning_template_delete(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
