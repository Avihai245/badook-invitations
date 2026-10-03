-- Event planning, vendors: the host's own list of vendors for an event (managed entirely inside the
-- invitations system), and closing one: a booked vendor can open a budget item, its payment schedule and
-- follow-up tasks in one atomic step, which one call can take back. Same rules as planning_core: every
-- function checks the owner, is SECURITY DEFINER with an empty search_path, and is callable by
-- service_role only. null answers "not the owner's" (or something that isn't the event's); { ok: false,
-- code } is a refusal the screen explains.

-- Saves one vendor: with an id that exists on this event it changes the keys present; with a new id (the
-- client's: undoing a delete puts the same vendor back) or none it makes one (a name is then required).
-- Up to 300 vendors per event.
create function public.planning_vendor_save(p_id uuid, p_owner uuid, p_vendor jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce((p_vendor ->> 'id')::uuid, gen_random_uuid());
  v_old public.plan_vendors;
  v public.plan_vendors;
  v_name text;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into v_old from public.plan_vendors where id = v_id;
  if v_old.id is not null and v_old.invitation_id <> p_id then
    return null;
  end if;
  if p_vendor ? 'name' then
    v_name := btrim(coalesce(p_vendor ->> 'name', ''));
    if v_name = '' then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
  elsif v_old.id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if v_old.id is null then
    if (select count(*) from public.plan_vendors where invitation_id = p_id) >= 300 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    insert into public.plan_vendors (
      id, invitation_id, name, category_key, phone, email, url, status, quote_amount, payment_terms,
      included, rating, notes, attachments, sort
    ) values (
      v_id, p_id, v_name, p_vendor ->> 'category', nullif(btrim(p_vendor ->> 'phone'), ''),
      nullif(btrim(p_vendor ->> 'email'), ''), nullif(btrim(p_vendor ->> 'url'), ''),
      coalesce(p_vendor ->> 'status', 'idea'), (p_vendor ->> 'quoteAmount')::numeric,
      nullif(btrim(p_vendor ->> 'paymentTerms'), ''), nullif(btrim(p_vendor ->> 'included'), ''),
      (p_vendor ->> 'rating')::smallint, nullif(btrim(p_vendor ->> 'notes'), ''),
      coalesce(nullif(p_vendor -> 'attachments', 'null'::jsonb), '[]'::jsonb),
      coalesce((p_vendor ->> 'sort')::int,
        (select coalesce(max(sort), 0) + 10 from public.plan_vendors where invitation_id = p_id))
    ) returning * into v;
  else
    update public.plan_vendors set
      name = case when p_vendor ? 'name' then v_name else name end,
      category_key = case when p_vendor ? 'category' then p_vendor ->> 'category' else category_key end,
      phone = case when p_vendor ? 'phone' then nullif(btrim(p_vendor ->> 'phone'), '') else phone end,
      email = case when p_vendor ? 'email' then nullif(btrim(p_vendor ->> 'email'), '') else email end,
      url = case when p_vendor ? 'url' then nullif(btrim(p_vendor ->> 'url'), '') else url end,
      status = case when p_vendor ? 'status' then p_vendor ->> 'status' else status end,
      quote_amount = case when p_vendor ? 'quoteAmount' then (p_vendor ->> 'quoteAmount')::numeric else quote_amount end,
      payment_terms = case when p_vendor ? 'paymentTerms' then nullif(btrim(p_vendor ->> 'paymentTerms'), '') else payment_terms end,
      included = case when p_vendor ? 'included' then nullif(btrim(p_vendor ->> 'included'), '') else included end,
      rating = case when p_vendor ? 'rating' then (p_vendor ->> 'rating')::smallint else rating end,
      notes = case when p_vendor ? 'notes' then nullif(btrim(p_vendor ->> 'notes'), '') else notes end,
      attachments = case when p_vendor ? 'attachments'
        then coalesce(nullif(p_vendor -> 'attachments', 'null'::jsonb), '[]'::jsonb) else attachments end,
      sort = case when p_vendor ? 'sort' then (p_vendor ->> 'sort')::int else sort end
    where id = v_id
    returning * into v;
  end if;
  return public.planning_vendor_json(v);
exception
  -- a value the table refuses (a status that does not exist, a rating of 9, a text that is too long)
  when check_violation or invalid_text_representation or numeric_value_out_of_range
    or string_data_right_truncation or invalid_parameter_value then
    return jsonb_build_object('ok', false, 'code', 'invalid');
end $$;

-- Deletes vendors of this event. The tasks, budget items and ideas that pointed at one stay, with the
-- link cleared (their foreign keys). Answers how many went.
create function public.planning_vendor_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  with gone as (
    delete from public.plan_vendors where invitation_id = p_id and id = any (p_ids)
    returning 1
  )
  select count(*)::int into v_n from gone;
  return v_n;
end $$;

-- Closes a vendor: status booked (and the agreed price, when p_plan.amount or p_plan.item.amount is given),
-- and — everything or nothing — what the host chose to open with it:
--   p_plan.item     { categoryId | categoryKey, title, amount, status? }  a budget item linked to the vendor,
--                   booked, its final price the amount. With only a categoryKey the event's category of that
--                   key is used, and made (planned = the amount) when it has none. A categoryId must be one of
--                   this event's. Neither: the vendor's own category, else 'other'.
--   p_plan.payments [{ label, amount, dueDate, payOnEventDay }]  on that item (without an item: on the
--                   vendor's existing budget item, when it has one)
--   p_plan.tasks    [{ title, dueDate, category }]  new tasks linked to the vendor, dated by the host
-- Answers { vendor, previous: { status, quoteAmount }, created: { categoryId (only when made), itemId,
-- paymentIds, taskIds } } — what undo_close needs; null when the vendor is not this owner's event's;
-- { ok: false, code } when a link is foreign ('invalid_link'), there is nowhere for the payments
-- ('no_item'), there are too many ('too_many') or a value is refused ('invalid'): nothing is written then.
create function public.planning_vendor_close(p_id uuid, p_owner uuid, p_vendor uuid, p_plan jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plan jsonb := case when jsonb_typeof(p_plan) = 'object' then p_plan else '{}'::jsonb end;
  v_item jsonb := case when jsonb_typeof(v_plan -> 'item') = 'object' then v_plan -> 'item' end;
  v_pays jsonb := case when jsonb_typeof(v_plan -> 'payments') = 'array' then v_plan -> 'payments' else '[]'::jsonb end;
  v_tasks jsonb := case when jsonb_typeof(v_plan -> 'tasks') = 'array' then v_plan -> 'tasks' else '[]'::jsonb end;
  ven public.plan_vendors;
  v_previous jsonb;
  v_amount numeric;
  v_cat uuid;
  v_cat_key text;
  v_cat_made boolean := false;
  v_item_id uuid;
  v_item_made uuid;
  v_pay_item uuid;
  v_pay_ids uuid[] := '{}';
  v_task_ids uuid[] := '{}';
  v_new uuid;
  e jsonb;
  v_created jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into ven from public.plan_vendors where id = p_vendor and invitation_id = p_id for update;
  if not found then return null; end if;

  if jsonb_array_length(v_pays) > 20 or jsonb_array_length(v_tasks) > 20
    or (select count(*) from public.plan_tasks where invitation_id = p_id) + jsonb_array_length(v_tasks) > 600 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;

  v_previous := jsonb_build_object('status', ven.status, 'quoteAmount', ven.quote_amount);
  v_amount := coalesce((v_plan ->> 'amount')::numeric, (v_item ->> 'amount')::numeric);

  -- every link is checked before anything is written
  if v_item is not null then
    if (v_item ->> 'categoryId') is not null then
      v_cat := (v_item ->> 'categoryId')::uuid;
      if not exists (select 1 from public.budget_categories where id = v_cat and invitation_id = p_id) then
        return jsonb_build_object('ok', false, 'code', 'invalid_link');
      end if;
    else
      v_cat_key := coalesce(v_item ->> 'categoryKey', ven.category_key, 'other');
      if v_cat_key !~ '^[a-z_]{2,40}$' then
        return jsonb_build_object('ok', false, 'code', 'invalid_link');
      end if;
    end if;
  elsif jsonb_array_length(v_pays) > 0 then
    select id into v_pay_item from public.budget_items
    where invitation_id = p_id and vendor_id = p_vendor
    order by created_at desc, id limit 1;
    if v_pay_item is null then
      return jsonb_build_object('ok', false, 'code', 'no_item');
    end if;
  end if;

  update public.plan_vendors set
    status = 'booked',
    quote_amount = case when v_amount is not null then v_amount else quote_amount end
  where id = p_vendor
  returning * into ven;

  if v_item is not null then
    if v_cat is null then
      select id into v_cat from public.budget_categories where invitation_id = p_id and category_key = v_cat_key;
      if v_cat is null then
        insert into public.budget_categories (invitation_id, category_key, planned_amount, sort)
        values (p_id, v_cat_key, coalesce(v_amount, 0),
          (select coalesce(max(sort), 0) + 10 from public.budget_categories where invitation_id = p_id))
        returning id into v_cat;
        v_cat_made := true;
      end if;
    end if;
    insert into public.budget_items (invitation_id, category_id, vendor_id, title, final, status, sort)
    values (p_id, v_cat, p_vendor,
      coalesce(nullif(btrim(v_item ->> 'title'), ''), ven.name), v_amount,
      coalesce(v_item ->> 'status', 'booked'),
      (select coalesce(max(sort), 0) + 10 from public.budget_items where invitation_id = p_id))
    returning id into v_item_id;
    v_item_made := v_item_id;
    v_pay_item := v_item_id;
  end if;

  if v_pay_item is not null then
    for e in select * from jsonb_array_elements(v_pays) loop
      insert into public.budget_payments (invitation_id, item_id, label, amount, due_date, pay_on_event_day)
      values (p_id, v_pay_item, btrim(e ->> 'label'), (e ->> 'amount')::numeric, (e ->> 'dueDate')::date,
        coalesce((e ->> 'payOnEventDay')::boolean, false))
      returning id into v_new;
      v_pay_ids := v_pay_ids || v_new;
    end loop;
  end if;

  for e in select * from jsonb_array_elements(v_tasks) loop
    insert into public.plan_tasks (
      invitation_id, title, due_date, due_is_manual, category_key, vendor_id, sort
    ) values (
      p_id, btrim(e ->> 'title'), (e ->> 'dueDate')::date, true,
      coalesce(e ->> 'category', ven.category_key), p_vendor,
      (select coalesce(max(sort), 0) + 10 from public.plan_tasks where invitation_id = p_id)
    ) returning id into v_new;
    v_task_ids := v_task_ids || v_new;
  end loop;

  v_created := jsonb_build_object(
    'itemId', v_item_made, 'paymentIds', to_jsonb(v_pay_ids), 'taskIds', to_jsonb(v_task_ids)
  );
  if v_cat_made then
    v_created := v_created || jsonb_build_object('categoryId', v_cat);
  end if;
  return jsonb_build_object('vendor', public.planning_vendor_json(ven), 'previous', v_previous, 'created', v_created);
exception
  -- a value the tables refuse part-way (an empty title, an amount of 0): the whole close is undone
  when check_violation or invalid_text_representation or numeric_value_out_of_range
    or string_data_right_truncation or datetime_field_overflow or invalid_datetime_format
    or not_null_violation or foreign_key_violation or unique_violation then
    return jsonb_build_object('ok', false, 'code', 'invalid');
end $$;

-- Takes a close back: the vendor returns to its previous status and quote, and ONLY the rows the close
-- listed are removed — and only when they are still this vendor's and unchanged in the way that matters:
-- the tasks linked to the vendor; the payments of an item linked to the vendor that are not paid yet; the
-- item, if it has no payment left (one the host added since keeps it); the category, if it is empty and
-- was made within the day. Anything else is left alone. true when it was this owner's vendor.
create function public.planning_vendor_undo_close(
  p_id uuid, p_owner uuid, p_vendor uuid, p_previous jsonb, p_created jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_status text := p_previous ->> 'status';
  v_item uuid;
  v_cat uuid;
  v_pay_ids uuid[] := '{}';
  v_task_ids uuid[] := '{}';
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return false;
  end if;
  if not exists (select 1 from public.plan_vendors where id = p_vendor and invitation_id = p_id) then
    return false;
  end if;
  if v_status is null or v_status not in ('idea', 'contacted', 'quote', 'booked', 'rejected') then
    return false;
  end if;
  v_item := nullif(p_created ->> 'itemId', '')::uuid;
  v_cat := nullif(p_created ->> 'categoryId', '')::uuid;
  if jsonb_typeof(p_created -> 'paymentIds') = 'array' then
    v_pay_ids := array(select jsonb_array_elements_text(p_created -> 'paymentIds')::uuid);
  end if;
  if jsonb_typeof(p_created -> 'taskIds') = 'array' then
    v_task_ids := array(select jsonb_array_elements_text(p_created -> 'taskIds')::uuid);
  end if;

  update public.plan_vendors set
    status = v_status,
    quote_amount = (p_previous ->> 'quoteAmount')::numeric
  where id = p_vendor;

  delete from public.plan_tasks
  where invitation_id = p_id and id = any (v_task_ids) and vendor_id = p_vendor and system_key is null;

  delete from public.budget_payments
  where invitation_id = p_id and id = any (v_pay_ids) and paid_at is null
    and item_id in (select id from public.budget_items where invitation_id = p_id and vendor_id = p_vendor);

  if v_item is not null then
    delete from public.budget_items i
    where i.id = v_item and i.invitation_id = p_id and i.vendor_id = p_vendor
      and not exists (select 1 from public.budget_payments where item_id = i.id);
  end if;

  if v_cat is not null then
    delete from public.budget_categories c
    where c.id = v_cat and c.invitation_id = p_id and c.created_at > now() - interval '1 day'
      and not exists (select 1 from public.budget_items where category_id = c.id);
  end if;
  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.planning_vendor_save(uuid, uuid, jsonb)',
    'public.planning_vendor_delete(uuid, uuid, uuid[])',
    'public.planning_vendor_close(uuid, uuid, uuid, jsonb)',
    'public.planning_vendor_undo_close(uuid, uuid, uuid, jsonb, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
