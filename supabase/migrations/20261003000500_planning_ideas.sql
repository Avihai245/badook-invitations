-- Event planning, notes & ideas: the board of cards (a note, a link with its preview, a picture, a
-- checklist) and turning a card into a task, a vendor or a budget line. Same rules as planning_core:
-- every function checks the owner, is SECURITY DEFINER with an empty search_path, and is callable by
-- service_role only. null answers "not the owner's" (or an idea that isn't the event's); { ok: false,
-- code } is a refusal the screen explains.

-- Saves one card: with an id that exists on this event it changes the keys present; with a new id (the
-- client's: undoing a delete puts the same card back) or none it makes one, at the top of the board.
-- A picture must be one of this event's own files (<owner>/<invitation>/<file> in plan-files). Refusals:
-- 'empty' (a card needs some content), 'too_many' (500 cards, 12 tags, 100 checklist lines), 'too_large'
-- (a checklist beyond what the table holds), 'invalid_image', 'invalid' (anything else the table's own
-- checks refuse).
create function public.planning_idea_save(p_id uuid, p_owner uuid, p_idea jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce((p_idea ->> 'id')::uuid, gen_random_uuid());
  v_old public.plan_ideas;
  d public.plan_ideas;
  v_prefix text := p_owner::text || '/' || p_id::text || '/';
  v_path text;
  v_tags text[];
  v_items jsonb;
  v_og jsonb;
  v_constraint text;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into v_old from public.plan_ideas where id = v_id;
  if v_old.id is not null and v_old.invitation_id <> p_id then
    return null;
  end if;

  -- a picture is one of this event's own files, directly in its folder
  if p_idea ? 'imagePath' and (p_idea ->> 'imagePath') is not null then
    v_path := p_idea ->> 'imagePath';
    if char_length(v_path) > 300 or char_length(v_path) <= char_length(v_prefix)
      or left(v_path, char_length(v_prefix)) <> v_prefix
      or position('..' in v_path) > 0
      or position('/' in substr(v_path, char_length(v_prefix) + 1)) > 0 then
      return jsonb_build_object('ok', false, 'code', 'invalid_image');
    end if;
  end if;

  -- tags: trimmed, no empty ones, no repeats, in the order given
  if p_idea ? 'tags' then
    if jsonb_typeof(p_idea -> 'tags') <> 'array' then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    select coalesce(array_agg(s.t order by s.ord), '{}') into v_tags
    from (
      select btrim(e.x) as t, min(e.ord) as ord
      from jsonb_array_elements_text(p_idea -> 'tags') with ordinality as e (x, ord)
      where btrim(e.x) <> ''
      group by btrim(e.x)
    ) s;
    if cardinality(v_tags) > 12 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    if exists (select 1 from unnest(v_tags) t where char_length(t) > 30) then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
  end if;

  -- a checklist's lines: [{ text, done }], empty lines dropped
  if p_idea ? 'items' then
    if jsonb_typeof(p_idea -> 'items') <> 'array' then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if jsonb_array_length(p_idea -> 'items') > 100 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    select coalesce(jsonb_agg(
      jsonb_build_object('text', btrim(e.x ->> 'text'), 'done', coalesce((e.x ->> 'done')::boolean, false))
      order by e.ord), '[]'::jsonb) into v_items
    from jsonb_array_elements(p_idea -> 'items') with ordinality as e (x, ord)
    where btrim(coalesce(e.x ->> 'text', '')) <> '';
    if exists (select 1 from jsonb_array_elements(v_items) l where char_length(l ->> 'text') > 200) then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if pg_column_size(v_items) > 16384 then
      return jsonb_build_object('ok', false, 'code', 'too_large');
    end if;
  end if;

  -- the link's preview: an object, or none
  if p_idea ? 'ogPreview' then
    if jsonb_typeof(p_idea -> 'ogPreview') = 'object' then
      v_og := p_idea -> 'ogPreview';
    elsif jsonb_typeof(p_idea -> 'ogPreview') = 'null' then
      v_og := null;
    else
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
  end if;

  begin
    if v_old.id is null then
      if (select count(*) from public.plan_ideas where invitation_id = p_id) >= 500 then
        return jsonb_build_object('ok', false, 'code', 'too_many');
      end if;
      insert into public.plan_ideas (
        id, invitation_id, type, title, body, url, og_preview, image_path, color, tags, pinned,
        list_items, sort
      ) values (
        v_id, p_id, coalesce(p_idea ->> 'type', 'note'), nullif(btrim(p_idea ->> 'title'), ''),
        nullif(btrim(p_idea ->> 'body'), ''), nullif(btrim(p_idea ->> 'url'), ''), v_og, v_path,
        coalesce(p_idea ->> 'color', 'default'), coalesce(v_tags, '{}'),
        coalesce((p_idea ->> 'pinned')::boolean, false), coalesce(v_items, '[]'::jsonb),
        -- a new card goes to the top of the board (the screen's order is pinned first, then sort)
        coalesce((p_idea ->> 'sort')::int,
          (select coalesce(min(sort), 0) - 10 from public.plan_ideas where invitation_id = p_id))
      ) returning * into d;
    else
      update public.plan_ideas set
        type = case when p_idea ? 'type' then coalesce(p_idea ->> 'type', type) else type end,
        title = case when p_idea ? 'title' then nullif(btrim(p_idea ->> 'title'), '') else title end,
        body = case when p_idea ? 'body' then nullif(btrim(p_idea ->> 'body'), '') else body end,
        url = case when p_idea ? 'url' then nullif(btrim(p_idea ->> 'url'), '') else url end,
        og_preview = case when p_idea ? 'ogPreview' then v_og else og_preview end,
        image_path = case when p_idea ? 'imagePath' then v_path else image_path end,
        color = case when p_idea ? 'color' then coalesce(p_idea ->> 'color', color) else color end,
        tags = case when p_idea ? 'tags' then v_tags else tags end,
        pinned = case when p_idea ? 'pinned' then coalesce((p_idea ->> 'pinned')::boolean, pinned) else pinned end,
        list_items = case when p_idea ? 'items' then v_items else list_items end,
        sort = case when p_idea ? 'sort' then coalesce((p_idea ->> 'sort')::int, sort) else sort end
      where id = v_id
      returning * into d;
    end if;
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    return jsonb_build_object('ok', false,
      'code', case when v_constraint = 'plan_ideas_has_content' then 'empty' else 'invalid' end);
  end;
  return public.planning_idea_json(d);
end $$;

-- Deletes cards (a task, vendor or budget line made from one stays: only the card goes). Answers how
-- many went.
create function public.planning_idea_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  with gone as (
    delete from public.plan_ideas where invitation_id = p_id and id = any (p_ids) returning 1
  )
  select count(*)::int into v_n from gone;
  return v_n;
end $$;

-- Makes a task (title, dueDate?, category?, notes?), a vendor (name, category?, url?, notes?) or a
-- budget line (categoryId, title, estimate?) from a card, and links the card to it — all or nothing:
-- the new row and the card's link are one transaction. Answers { idea, created: { taskId | vendorId |
-- itemId } }; null when the event or the card isn't the owner's. Refusals: 'invalid_link' (a budget
-- category that isn't this event's), 'too_many' (600 tasks, 300 vendors, 600 budget lines), 'invalid'.
create function public.planning_idea_convert(p_id uuid, p_owner uuid, p_idea uuid, p_kind text, p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.plan_ideas;
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_title text;
  v_name text;
  v_notes text := nullif(btrim(coalesce(p_data ->> 'notes', '')), '');
  v_url text := nullif(btrim(coalesce(p_data ->> 'url', '')), '');
  v_cat text := nullif(btrim(coalesce(p_data ->> 'category', '')), '');
  v_due date;
  v_category uuid;
  v_estimate numeric;
  v_new uuid;
  v_created jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into d from public.plan_ideas where id = p_idea and invitation_id = p_id;
  if d.id is null then
    return null;
  end if;
  if jsonb_typeof(v_data) <> 'object' or (v_cat is not null and v_cat !~ '^[a-z_]{2,40}$') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if p_kind = 'task' then
    v_title := nullif(btrim(coalesce(v_data ->> 'title', '')), '');
    if v_title is null or char_length(v_title) > 200 or char_length(coalesce(v_notes, '')) > 2000 then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    -- a calendar day as YYYY-MM-DD (Postgres would also take 'tomorrow' or 'epoch')
    if coalesce(v_data ->> 'dueDate', '') !~ '^(\d{4}-\d{2}-\d{2})?$' then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    begin
      v_due := nullif(v_data ->> 'dueDate', '')::date;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end;
    if (select count(*) from public.plan_tasks where invitation_id = p_id) >= 600 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    -- a date the host sets makes the task theirs; a task they name is named (no template key)
    insert into public.plan_tasks (invitation_id, title, notes, due_date, due_is_manual, tpl_key, category_key, sort)
    values (
      p_id, v_title, v_notes, v_due, v_due is not null, null, v_cat,
      (select coalesce(max(sort), 0) + 10 from public.plan_tasks where invitation_id = p_id)
    ) returning id into v_new;
    update public.plan_ideas set linked_task_id = v_new where id = d.id returning * into d;
    v_created := jsonb_build_object('taskId', v_new);

  elsif p_kind = 'vendor' then
    v_name := nullif(btrim(coalesce(v_data ->> 'name', '')), '');
    if v_name is null or char_length(v_name) > 120 or char_length(coalesce(v_url, '')) > 500
      or char_length(coalesce(v_notes, '')) > 2000 then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if (select count(*) from public.plan_vendors where invitation_id = p_id) >= 300 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    insert into public.plan_vendors (invitation_id, name, category_key, url, notes, sort)
    values (
      p_id, v_name, v_cat, v_url, v_notes,
      (select coalesce(max(sort), 0) + 10 from public.plan_vendors where invitation_id = p_id)
    ) returning id into v_new;
    update public.plan_ideas set linked_vendor_id = v_new where id = d.id returning * into d;
    v_created := jsonb_build_object('vendorId', v_new);

  elsif p_kind = 'item' then
    begin
      v_category := (v_data ->> 'categoryId')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end;
    -- the line goes in one of this event's own categories
    if v_category is null or not exists (
      select 1 from public.budget_categories where id = v_category and invitation_id = p_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end if;
    v_title := nullif(btrim(coalesce(v_data ->> 'title', '')), '');
    if v_title is null or char_length(v_title) > 120 then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    begin
      v_estimate := nullif(v_data ->> 'estimate', '')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end;
    if v_estimate is not null and (v_estimate < 0 or v_estimate > 1000000000) then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if (select count(*) from public.budget_items where invitation_id = p_id) >= 600 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    insert into public.budget_items (invitation_id, category_id, title, estimate, sort)
    values (
      p_id, v_category, v_title, v_estimate,
      (select coalesce(max(sort), 0) + 10 from public.budget_items where invitation_id = p_id)
    ) returning id into v_new;
    update public.plan_ideas set linked_budget_item_id = v_new where id = d.id returning * into d;
    v_created := jsonb_build_object('itemId', v_new);

  else
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  return jsonb_build_object('idea', public.planning_idea_json(d), 'created', v_created);
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.planning_idea_save(uuid, uuid, jsonb)',
    'public.planning_idea_delete(uuid, uuid, uuid[])',
    'public.planning_idea_convert(uuid, uuid, uuid, text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
