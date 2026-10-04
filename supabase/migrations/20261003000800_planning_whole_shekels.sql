-- Budgets in whole shekels (UX report B1). A plan's budget split by percentages left agorot behind: a
-- per-head price was the share divided by the heads, rounded to agorot (₪24,000 / 126 = ₪190.48), so
-- price × heads came back as ₪24,000.48 and the plan as ₪100,000.98 of a ₪100,000 budget. New plans
-- are split in whole shekels with the remainder in "other" (features/planning/model/draft.ts,
-- splitBudget); this brings the plans made before it to the same: every price and amount to a whole
-- shekel, and — for a plan whose categories now miss its total by a rounding's worth (under 1%) — the
-- difference into its "other" category, so the plan equals the budget. Nothing else moves.

update public.budget_categories
set unit_price = round(unit_price)
where unit_price is not null and unit_price <> round(unit_price);

update public.budget_categories
set child_price = round(child_price)
where child_price is not null and child_price <> round(child_price);

update public.budget_categories
set planned_amount = round(planned_amount)
where planned_amount <> round(planned_amount);

do $$
declare
  s record;
  h jsonb;
  v_planned numeric;
  v_diff numeric;
  v_other uuid;
  v_other_planned numeric;
begin
  for s in select invitation_id, total_budget from public.plan_settings where coalesce(total_budget, 0) > 0 loop
    h := public.planning_headcount(s.invitation_id);
    select coalesce(sum(public.planning_category_planned(
      c, (h->>'adults')::int, (h->>'children')::int, (h->>'tables')::int)), 0)
    into v_planned
    from public.budget_categories c where c.invitation_id = s.invitation_id;
    v_diff := round(s.total_budget) - v_planned;
    if v_diff = 0 or abs(v_diff) >= s.total_budget * 0.01 then continue; end if;
    select id, planned_amount into v_other, v_other_planned
    from public.budget_categories
    where invitation_id = s.invitation_id and category_key = 'other'
      and (cost_basis = 'fixed' or unit_price is null)
    order by sort limit 1;
    if v_other is null or v_other_planned + v_diff < 0 then continue; end if;
    update public.budget_categories set planned_amount = planned_amount + v_diff where id = v_other;
  end loop;
end $$;
