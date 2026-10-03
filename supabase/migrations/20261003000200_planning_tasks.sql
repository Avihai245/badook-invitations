-- Event planning, tasks: saving, deleting, ordering and bulk-changing an event's tasks. Same rules as
-- planning_core: every function checks the owner, is SECURITY DEFINER with an empty search_path, and is
-- callable by service_role only. null answers "not the owner's" (or a link to something that isn't the
-- event's); { ok: false, code } is a refusal the screen explains.

-- Saves one task: with an id that exists on this event it changes the keys present; with a new id (the
-- client's: undoing a delete puts the same task back) or none it makes one. A date the host sets makes
-- the task theirs (a later change of the event's date leaves it alone). A system task keeps its key and
-- cannot be deleted, only hidden (status skipped). Done sets the time it was done.
create function public.planning_task_save(p_id uuid, p_owner uuid, p_task jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce((p_task ->> 'id')::uuid, gen_random_uuid());
  v_old public.plan_tasks;
  t public.plan_tasks;
  v_status text;
  v_item uuid;
  v_vendor uuid;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  -- links must be to this event's own budget items and vendors
  if p_task ? 'budgetItemId' and (p_task ->> 'budgetItemId') is not null then
    v_item := (p_task ->> 'budgetItemId')::uuid;
    if not exists (select 1 from public.budget_items where id = v_item and invitation_id = p_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end if;
  end if;
  if p_task ? 'vendorId' and (p_task ->> 'vendorId') is not null then
    v_vendor := (p_task ->> 'vendorId')::uuid;
    if not exists (select 1 from public.plan_vendors where id = v_vendor and invitation_id = p_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end if;
  end if;

  select * into v_old from public.plan_tasks where id = v_id;
  if v_old.id is not null and v_old.invitation_id <> p_id then
    return null;
  end if;

  if v_old.id is null then
    if (select count(*) from public.plan_tasks where invitation_id = p_id) >= 600 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    v_status := coalesce(p_task ->> 'status', 'todo');
    insert into public.plan_tasks (
      id, invitation_id, title, notes, due_date, due_is_manual, offset_days, status, category_key,
      priority, assignee, budget_item_id, vendor_id, sort, completed_at
    ) values (
      v_id, p_id, p_task ->> 'title', p_task ->> 'notes', (p_task ->> 'dueDate')::date,
      -- a task the host adds with a date of their own is theirs
      coalesce((p_task ->> 'dueIsManual')::boolean, (p_task ->> 'dueDate') is not null),
      (p_task ->> 'offsetDays')::int, v_status, p_task ->> 'category',
      coalesce((p_task ->> 'priority')::smallint, 0), p_task ->> 'assignee', v_item, v_vendor,
      coalesce((p_task ->> 'sort')::int,
        (select coalesce(max(sort), 0) + 10 from public.plan_tasks where invitation_id = p_id)),
      case when v_status = 'done' then now() end
    ) returning * into t;
  else
    v_status := coalesce(p_task ->> 'status', v_old.status);
    update public.plan_tasks set
      title = case when p_task ? 'title' and v_old.system_key is null then p_task ->> 'title' else title end,
      notes = case when p_task ? 'notes' then p_task ->> 'notes' else notes end,
      due_date = case when p_task ? 'dueDate' then (p_task ->> 'dueDate')::date else due_date end,
      due_is_manual = case
        when p_task ? 'dueIsManual' then (p_task ->> 'dueIsManual')::boolean
        when p_task ? 'dueDate' then true
        else due_is_manual end,
      status = v_status,
      category_key = case when p_task ? 'category' then p_task ->> 'category' else category_key end,
      priority = case when p_task ? 'priority' then (p_task ->> 'priority')::smallint else priority end,
      assignee = case when p_task ? 'assignee' then p_task ->> 'assignee' else assignee end,
      budget_item_id = case when p_task ? 'budgetItemId' then v_item else budget_item_id end,
      vendor_id = case when p_task ? 'vendorId' then v_vendor else vendor_id end,
      suggest_hide = case when p_task ? 'suggestHide' then (p_task ->> 'suggestHide')::boolean else suggest_hide end,
      sort = case when p_task ? 'sort' then (p_task ->> 'sort')::int else sort end,
      completed_at = case
        when v_status = 'done' and v_old.status <> 'done' then now()
        when v_status <> 'done' then null
        else completed_at end
    where id = v_id
    returning * into t;
  end if;
  return public.planning_task_json(t);
end $$;

-- Deletes the host's own tasks (a system task can only be hidden). Answers how many went.
create function public.planning_task_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  with gone as (
    delete from public.plan_tasks where invitation_id = p_id and id = any (p_ids) and system_key is null
    returning 1
  )
  select count(*)::int into v_n from gone;
  return v_n;
end $$;

-- Puts the listed tasks in that order (the others keep theirs), after a drag.
create function public.planning_tasks_reorder(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  with ord as (
    select id, (ordinality * 10)::int as pos from unnest(p_ids) with ordinality as u (id, ordinality)
  ), moved as (
    update public.plan_tasks t set sort = ord.pos
    from ord where t.id = ord.id and t.invitation_id = p_id
    returning 1
  )
  select count(*)::int into v_n from moved;
  return v_n;
end $$;

-- The same change for several tasks at once (hide the ones offered for hiding, mark a group done):
-- status and suggestHide only. Answers the tasks as they are now.
create function public.planning_tasks_bulk(p_id uuid, p_owner uuid, p_ids uuid[], p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_out jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  with changed as (
    update public.plan_tasks set
      status = case when p_patch ? 'status' then p_patch ->> 'status' else status end,
      suggest_hide = case when p_patch ? 'suggestHide' then (p_patch ->> 'suggestHide')::boolean else suggest_hide end,
      completed_at = case
        when p_patch ? 'status' and p_patch ->> 'status' = 'done' and status <> 'done' then now()
        when p_patch ? 'status' and p_patch ->> 'status' <> 'done' then null
        else completed_at end
    where invitation_id = p_id and id = any (p_ids)
    returning *
  )
  select coalesce(jsonb_agg(public.planning_task_json(c) order by c.sort), '[]'::jsonb) into v_out from changed c;
  return v_out;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.planning_task_save(uuid, uuid, jsonb)',
    'public.planning_task_delete(uuid, uuid, uuid[])',
    'public.planning_tasks_reorder(uuid, uuid, uuid[])',
    'public.planning_tasks_bulk(uuid, uuid, uuid[], jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
