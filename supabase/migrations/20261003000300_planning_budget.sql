-- Event planning, budget: saving and deleting an event's budget categories, items and payments, marking
-- a payment paid, and the payments due at the event itself. Same rules as planning_core / planning_tasks:
-- every function checks the owner, is SECURITY DEFINER with an empty search_path, and is callable by
-- service_role only. null answers "not the owner's" (or an id that is another event's); { ok: false, code }
-- is a refusal the screen explains ('duplicate', 'invalid', 'invalid_link', 'too_many'). Every check that
-- can refuse runs before the first write: a function that answers a refusal has changed nothing.
-- Money is computed in planning_totals (core); nothing here recomputes it.

-- ─── what a payment does to its item ────────────────────────────────────────────────────────────

-- An item with payments follows them: when none is left to pay it is "paid"; when it was "paid" and a
-- payment is open again (un-paid, added, changed) it goes back to "booked". An item without payments
-- keeps the status the host gave it. Answers the item's status (null: no such item).
create function public.planning_item_sync(p_item uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_total int;
  v_open int;
  v_status text;
begin
  select status into v_status from public.budget_items where id = p_item;
  if v_status is null then return null; end if;
  select count(*)::int, (count(*) filter (where paid_at is null))::int into v_total, v_open
  from public.budget_payments where item_id = p_item;
  if v_total > 0 and v_open = 0 and v_status <> 'paid' then
    update public.budget_items set status = 'paid' where id = p_item;
    v_status := 'paid';
  elsif v_open > 0 and v_status = 'paid' then
    update public.budget_items set status = 'booked' where id = p_item;
    v_status := 'booked';
  end if;
  return v_status;
end $$;

-- ─── categories ─────────────────────────────────────────────────────────────────────────────────

-- Saves one category: with an id that exists on this event it changes the keys present; with a new id (the
-- client's: undoing a delete puts the same one back) or none it makes one. The system's categories are
-- one per event ('duplicate' on a repeat); the host's own have a name and no key. At most 60.
create function public.planning_category_save(p_id uuid, p_owner uuid, p_category jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce((p_category ->> 'id')::uuid, gen_random_uuid());
  v_old public.budget_categories;
  c public.budget_categories;
  v_key text;
  v_name text;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into v_old from public.budget_categories where id = v_id;
  if v_old.id is not null and v_old.invitation_id <> p_id then
    return null;
  end if;

  v_key := case when p_category ? 'key' then p_category ->> 'key' else v_old.category_key end;
  v_name := case when p_category ? 'name' then p_category ->> 'name' else v_old.name end;
  if v_key is null and v_name is null then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_key is not null and exists (
    select 1 from public.budget_categories where invitation_id = p_id and category_key = v_key and id <> v_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate');
  end if;

  if v_old.id is null then
    if (select count(*) from public.budget_categories where invitation_id = p_id) >= 60 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    insert into public.budget_categories (
      id, invitation_id, category_key, name, planned_amount, cost_basis, unit_price, child_price, is_required, sort
    ) values (
      v_id, p_id, v_key, v_name, coalesce((p_category ->> 'plannedAmount')::numeric, 0),
      coalesce(p_category ->> 'costBasis', 'fixed'), (p_category ->> 'unitPrice')::numeric,
      (p_category ->> 'childPrice')::numeric, coalesce((p_category ->> 'required')::boolean, false),
      coalesce((p_category ->> 'sort')::int,
        (select coalesce(max(sort), 0) + 10 from public.budget_categories where invitation_id = p_id))
    ) returning * into c;
  else
    update public.budget_categories set
      category_key = v_key,
      name = v_name,
      planned_amount = case when p_category ? 'plannedAmount'
        then coalesce((p_category ->> 'plannedAmount')::numeric, planned_amount) else planned_amount end,
      cost_basis = case when p_category ? 'costBasis'
        then coalesce(p_category ->> 'costBasis', cost_basis) else cost_basis end,
      unit_price = case when p_category ? 'unitPrice' then (p_category ->> 'unitPrice')::numeric else unit_price end,
      child_price = case when p_category ? 'childPrice' then (p_category ->> 'childPrice')::numeric else child_price end,
      is_required = case when p_category ? 'required'
        then coalesce((p_category ->> 'required')::boolean, is_required) else is_required end,
      sort = case when p_category ? 'sort' then (p_category ->> 'sort')::int else sort end
    where id = v_id
    returning * into c;
  end if;
  return public.planning_category_json(c);
exception
  -- two saves of the same standard category at once: the second is the repeat
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate');
end $$;

-- Deletes categories with their items and the items' payments. Answers how many categories went.
create function public.planning_category_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  delete from public.budget_categories where invitation_id = p_id and id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ─── items (with their payment schedule) ────────────────────────────────────────────────────────

-- Saves one item: with an id that exists on this event it changes the keys present; with a new id (the
-- client's: undoing a delete puts the same item back) or none it makes one. Its category (and vendor,
-- when it has one) must be this event's. When p_payments (an array) is given it REPLACES the item's
-- payments, atomically: the rows listed are kept or made (a payment's id is the client's to choose; a
-- listed row without paidAt keeps the time it was paid), the others go; the item's status then follows
-- its payments (planning_item_sync). At most 600 items and 1200 payments per event.
-- Answers { item, payments }.
create function public.planning_item_save(p_id uuid, p_owner uuid, p_item jsonb, p_payments jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce((p_item ->> 'id')::uuid, gen_random_uuid());
  v_old public.budget_items;
  i public.budget_items;
  v_cat uuid;
  v_vendor uuid;
  v_title text;
  v_has_pay boolean := p_payments is not null and jsonb_typeof(p_payments) = 'array';
  v_ids uuid[] := '{}';
  v_n_new int := 0;
  v_pid uuid;
  v_pold public.budget_payments;
  pay jsonb;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into v_old from public.budget_items where id = v_id;
  if v_old.id is not null and v_old.invitation_id <> p_id then
    return null;
  end if;

  v_title := case when p_item ? 'title' then p_item ->> 'title' else v_old.title end;
  if v_title is null then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  -- the links: this event's own category and vendor
  if v_old.id is null or p_item ? 'categoryId' then
    v_cat := (p_item ->> 'categoryId')::uuid;
    if v_cat is null or not exists (
      select 1 from public.budget_categories where id = v_cat and invitation_id = p_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end if;
  else
    v_cat := v_old.category_id;
  end if;
  if p_item ? 'vendorId' then
    v_vendor := (p_item ->> 'vendorId')::uuid;
    if v_vendor is not null and not exists (
      select 1 from public.plan_vendors where id = v_vendor and invitation_id = p_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end if;
  else
    v_vendor := v_old.vendor_id;
  end if;

  if p_payments is not null and not v_has_pay then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if v_old.id is null and (select count(*) from public.budget_items where invitation_id = p_id) >= 600 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;

  if v_has_pay then
    for pay in select * from jsonb_array_elements(p_payments) loop
      if jsonb_typeof(pay) <> 'object' or (pay ->> 'label') is null or (pay ->> 'amount') is null then
        return jsonb_build_object('ok', false, 'code', 'invalid');
      end if;
      v_pid := (pay ->> 'id')::uuid;
      if v_pid is null then
        v_n_new := v_n_new + 1;
      else
        if v_pid = any (v_ids) then
          return jsonb_build_object('ok', false, 'code', 'invalid');
        end if;
        v_ids := v_ids || v_pid;
        select * into v_pold from public.budget_payments where id = v_pid;
        -- a payment id that is another event's, or another item's, is not ours to take
        if v_pold.id is not null and (v_pold.invitation_id <> p_id or v_pold.item_id <> v_id) then
          return jsonb_build_object('ok', false, 'code', 'invalid_link');
        end if;
      end if;
    end loop;
    if (select count(*) from public.budget_payments where invitation_id = p_id and item_id is distinct from v_id)
       + jsonb_array_length(p_payments) > 1200 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
  end if;

  -- every check has passed: write
  if v_old.id is null then
    insert into public.budget_items (
      id, invitation_id, category_id, vendor_id, title, estimate, quoted, final, status, vat_included,
      attachments, notes, sort
    ) values (
      v_id, p_id, v_cat, v_vendor, v_title, (p_item ->> 'estimate')::numeric, (p_item ->> 'quoted')::numeric,
      (p_item ->> 'final')::numeric, coalesce(p_item ->> 'status', 'estimate'),
      (p_item ->> 'vatIncluded')::boolean,
      case when jsonb_typeof(p_item -> 'attachments') = 'array' then p_item -> 'attachments' else '[]'::jsonb end,
      p_item ->> 'notes',
      coalesce((p_item ->> 'sort')::int,
        (select coalesce(max(sort), 0) + 10 from public.budget_items where invitation_id = p_id))
    );
  else
    update public.budget_items set
      category_id = v_cat,
      vendor_id = v_vendor,
      title = v_title,
      estimate = case when p_item ? 'estimate' then (p_item ->> 'estimate')::numeric else estimate end,
      quoted = case when p_item ? 'quoted' then (p_item ->> 'quoted')::numeric else quoted end,
      final = case when p_item ? 'final' then (p_item ->> 'final')::numeric else final end,
      status = case when p_item ? 'status' then coalesce(p_item ->> 'status', status) else status end,
      vat_included = case when p_item ? 'vatIncluded' then (p_item ->> 'vatIncluded')::boolean else vat_included end,
      attachments = case when p_item ? 'attachments'
        then (case when jsonb_typeof(p_item -> 'attachments') = 'array' then p_item -> 'attachments' else '[]'::jsonb end)
        else attachments end,
      notes = case when p_item ? 'notes' then p_item ->> 'notes' else notes end,
      sort = case when p_item ? 'sort' then (p_item ->> 'sort')::int else sort end
    where id = v_id;
  end if;

  if v_has_pay then
    delete from public.budget_payments
    where invitation_id = p_id and item_id = v_id and not (id = any (v_ids));
    for pay in select * from jsonb_array_elements(p_payments) loop
      v_pid := coalesce((pay ->> 'id')::uuid, gen_random_uuid());
      if exists (select 1 from public.budget_payments where id = v_pid) then
        update public.budget_payments set
          label = pay ->> 'label',
          amount = (pay ->> 'amount')::numeric,
          due_date = case when pay ? 'dueDate' then (pay ->> 'dueDate')::date else due_date end,
          paid_at = case when pay ? 'paidAt' then (pay ->> 'paidAt')::timestamptz else paid_at end,
          pay_on_event_day = case when pay ? 'payOnEventDay'
            then coalesce((pay ->> 'payOnEventDay')::boolean, false) else pay_on_event_day end,
          payer = case when pay ? 'payer' then pay ->> 'payer' else payer end
        where id = v_pid;
      else
        insert into public.budget_payments (id, invitation_id, item_id, label, amount, due_date, paid_at, pay_on_event_day, payer)
        values (
          v_pid, p_id, v_id, pay ->> 'label', (pay ->> 'amount')::numeric, (pay ->> 'dueDate')::date,
          (pay ->> 'paidAt')::timestamptz, coalesce((pay ->> 'payOnEventDay')::boolean, false), pay ->> 'payer'
        );
      end if;
    end loop;
    if jsonb_array_length(p_payments) > 0 then
      perform public.planning_item_sync(v_id);
    end if;
  end if;

  select * into i from public.budget_items where id = v_id;
  return jsonb_build_object(
    'item', public.planning_item_json(i),
    'payments', coalesce((
      select jsonb_agg(public.planning_payment_json(p) order by p.due_date nulls last, p.created_at)
      from public.budget_payments p where p.item_id = v_id
    ), '[]'::jsonb)
  );
end $$;

-- Deletes items with their payments. Answers how many items went.
create function public.planning_item_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  delete from public.budget_items where invitation_id = p_id and id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ─── payments ───────────────────────────────────────────────────────────────────────────────────

-- Saves one payment: with an id that exists on this event it changes the keys present; with a new id (the
-- client's: undoing a delete) or none it makes one. Its item must be this event's. At most 1200 per event.
-- The item's status follows its payments (planning_item_sync). Answers the payment.
create function public.planning_payment_save(p_id uuid, p_owner uuid, p_payment jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce((p_payment ->> 'id')::uuid, gen_random_uuid());
  v_old public.budget_payments;
  p public.budget_payments;
  v_item uuid;
  v_label text;
  v_amount numeric;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select * into v_old from public.budget_payments where id = v_id;
  if v_old.id is not null and v_old.invitation_id <> p_id then
    return null;
  end if;

  if v_old.id is null or p_payment ? 'itemId' then
    v_item := (p_payment ->> 'itemId')::uuid;
    if v_item is null or not exists (
      select 1 from public.budget_items where id = v_item and invitation_id = p_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_link');
    end if;
  else
    v_item := v_old.item_id;
  end if;
  v_label := case when p_payment ? 'label' then p_payment ->> 'label' else v_old.label end;
  v_amount := case when p_payment ? 'amount' then (p_payment ->> 'amount')::numeric else v_old.amount end;
  if v_label is null or v_amount is null then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  if v_old.id is null then
    if (select count(*) from public.budget_payments where invitation_id = p_id) >= 1200 then
      return jsonb_build_object('ok', false, 'code', 'too_many');
    end if;
    insert into public.budget_payments (id, invitation_id, item_id, label, amount, due_date, paid_at, pay_on_event_day, payer)
    values (
      v_id, p_id, v_item, v_label, v_amount, (p_payment ->> 'dueDate')::date,
      (p_payment ->> 'paidAt')::timestamptz, coalesce((p_payment ->> 'payOnEventDay')::boolean, false),
      p_payment ->> 'payer'
    );
  else
    update public.budget_payments set
      item_id = v_item,
      label = v_label,
      amount = v_amount,
      due_date = case when p_payment ? 'dueDate' then (p_payment ->> 'dueDate')::date else due_date end,
      paid_at = case when p_payment ? 'paidAt' then (p_payment ->> 'paidAt')::timestamptz else paid_at end,
      pay_on_event_day = case when p_payment ? 'payOnEventDay'
        then coalesce((p_payment ->> 'payOnEventDay')::boolean, false) else pay_on_event_day end,
      payer = case when p_payment ? 'payer' then p_payment ->> 'payer' else payer end
    where id = v_id;
    if v_old.item_id <> v_item then
      perform public.planning_item_sync(v_old.item_id);
    end if;
  end if;
  perform public.planning_item_sync(v_item);
  select * into p from public.budget_payments where id = v_id;
  return public.planning_payment_json(p);
end $$;

-- Deletes payments; their items follow what is left (an item whose last open payment went is paid).
-- Answers how many payments went.
create function public.planning_payment_delete(p_id uuid, p_owner uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
  v_items uuid[];
  v_item uuid;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  select coalesce(array_agg(distinct item_id), '{}') into v_items
  from public.budget_payments where invitation_id = p_id and id = any (p_ids);
  delete from public.budget_payments where invitation_id = p_id and id = any (p_ids);
  get diagnostics v_n = row_count;
  foreach v_item in array v_items loop
    perform public.planning_item_sync(v_item);
  end loop;
  return v_n;
end $$;

-- Marks a payment paid (now) or not paid, and — in the same step — moves its item: every payment paid
-- makes the item "paid"; a payment un-paid on a "paid" item puts it back to "booked".
-- Answers { payment, itemStatus }; null when the payment isn't this event's.
create function public.planning_payment_paid(p_id uuid, p_owner uuid, p_payment uuid, p_paid boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.budget_payments;
  v_status text;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  update public.budget_payments
  set paid_at = case when p_paid then coalesce(paid_at, now()) else null end
  where id = p_payment and invitation_id = p_id
  returning * into p;
  if not found then return null; end if;
  v_status := public.planning_item_sync(p.item_id);
  return jsonb_build_object('payment', public.planning_payment_json(p), 'itemStatus', v_status);
end $$;

-- The payments to make at the event itself (a cash balance to the DJ…), for the event day's screen: the
-- ones still open first. Each with its item's title and its vendor's name. null: not the owner's.
create function public.planning_event_day_payments(p_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'label', p.label, 'amount', p.amount, 'paidAt', p.paid_at,
      'itemTitle', i.title, 'vendorName', v.name
    ) order by (p.paid_at is not null), p.created_at)
    from public.budget_payments p
    join public.budget_items i on i.id = p.item_id
    left join public.plan_vendors v on v.id = i.vendor_id
    where p.invitation_id = p_id and p.pay_on_event_day
  ), '[]'::jsonb);
end $$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.planning_category_save(uuid, uuid, jsonb)',
    'public.planning_category_delete(uuid, uuid, uuid[])',
    'public.planning_item_save(uuid, uuid, jsonb, jsonb)',
    'public.planning_item_delete(uuid, uuid, uuid[])',
    'public.planning_payment_save(uuid, uuid, jsonb)',
    'public.planning_payment_delete(uuid, uuid, uuid[])',
    'public.planning_payment_paid(uuid, uuid, uuid, boolean)',
    'public.planning_event_day_payments(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- helper: only the functions above call it
  execute 'revoke all on function public.planning_item_sync(uuid) from public, anon, authenticated';
end $$;
