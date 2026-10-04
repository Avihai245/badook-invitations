-- Event planning (feature `planning`): an event's tasks, budget, vendors and ideas, inside the
-- invitations system only — nothing here reads from or shares anything with another product.
--
-- Same rules as the rest of the app: row level security is on and there are no policies, so nothing
-- here is reachable from the browser. Every function is SECURITY DEFINER with an empty search_path,
-- checks the owner (the server passes the signed-in user's id) itself, and only service_role may run
-- it. Money is computed here (numeric, two decimals); the screens show what these functions return.
-- Additive only: no table, function or policy that exists is changed.
--
-- Data lives in its own tables keyed by the invitation, never on `invitations` (any update there moves
-- updated_at, which the editor's autosave compares against).

-- ─── storage ────────────────────────────────────────────────────────────────────────────────────

-- Quotes, contracts, receipts and the pictures of the ideas board: private (signed reads only), under
-- <owner id>/<invitation id>/… so deleting an account removes the folder like the other buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('plan-files', 'plan-files', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ─── tables ─────────────────────────────────────────────────────────────────────────────────────

-- The Business plan's own templates: a plan saved to start the next event from. The system's
-- templates are code (src/features/planning/templates), in this same shape.
create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  event_type text check (event_type is null or char_length(event_type) <= 40),
  -- { tasks: [...], categories: [...], requiredVendors: [...] }
  items jsonb not null
    check (jsonb_typeof(items) = 'object' and pg_column_size(items) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_templates_owner on public.plan_templates (owner_id, updated_at desc);
create trigger plan_templates_touch before update on public.plan_templates
  for each row execute function public.touch_updated_at();

-- One per event, created when the host sets the plan up.
create table public.plan_settings (
  invitation_id uuid primary key references public.invitations (id) on delete cascade,
  -- the template it started from: a system template's key, 'private:<id>' or 'blank'
  template_key text check (
    template_key is null or template_key ~ '^[a-z_]{2,40}$' or template_key ~ '^private:[0-9a-f-]{36}$'
  ),
  variant text not null default 'default' check (variant in ('default', 'two_brides', 'two_grooms')),
  total_budget numeric(12, 2) check (total_budget is null or (total_budget >= 0 and total_budget <= 1000000000)),
  -- how amounts are entered: no VAT, VAT included, VAT not included (an item may override)
  vat_mode text not null default 'included' check (vat_mode in ('none', 'included', 'excluded')),
  vat_pct numeric(5, 2) not null default 18 check (vat_pct between 0 and 100),
  -- the guest numbers a cost follows: the list's, the replies', or the host's own
  guest_basis text not null default 'invited' check (guest_basis in ('invited', 'confirmed', 'manual')),
  manual_adults int check (manual_adults is null or manual_adults between 0 and 100000),
  manual_children int check (manual_children is null or manual_children between 0 and 100000),
  manual_tables int check (manual_tables is null or manual_tables between 0 and 10000),
  -- which parts of the invitation system the budget follows, and the reminders (see features/planning)
  integrations jsonb not null default '{}' check (jsonb_typeof(integrations) = 'object'),
  reminders jsonb not null default '{}' check (jsonb_typeof(reminders) = 'object'),
  -- the vendor categories the event needs ("what is missing" lists those without a closed vendor)
  required_vendors text[] not null default '{}' check (cardinality(required_vendors) <= 40),
  onboarding_done boolean not null default false,
  -- the event's date the tasks' dates were last computed for: a different date now → "update the dates?"
  anchor_date date,
  -- the head-count the host last saw, to tell them when a cost changes with it
  headcount_seen jsonb check (headcount_seen is null or jsonb_typeof(headcount_seen) = 'object'),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plan_settings_touch before update on public.plan_settings
  for each row execute function public.touch_updated_at();

create table public.plan_vendors (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category_key text check (category_key is null or category_key ~ '^[a-z_]{2,40}$'),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 254),
  url text check (url is null or char_length(url) <= 500),
  status text not null default 'idea' check (status in ('idea', 'contacted', 'quote', 'booked', 'rejected')),
  quote_amount numeric(12, 2) check (quote_amount is null or (quote_amount >= 0 and quote_amount <= 1000000000)),
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 500),
  -- what the quote includes, for comparing quotes
  included text check (included is null or char_length(included) <= 1000),
  rating smallint check (rating is null or rating between 1 and 5),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- [{ path, name, size, type }] in plan-files
  attachments jsonb not null default '[]'
    check (jsonb_typeof(attachments) = 'array' and pg_column_size(attachments) <= 8192),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_vendors_invitation on public.plan_vendors (invitation_id, sort);
create trigger plan_vendors_touch before update on public.plan_vendors
  for each row execute function public.touch_updated_at();

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  -- one of the system's categories (named by the dictionary), or null for the host's own (named here)
  category_key text check (category_key is null or category_key ~ '^[a-z_]{2,40}$'),
  name text check (name is null or char_length(name) between 1 and 80),
  planned_amount numeric(12, 2) not null default 0
    check (planned_amount >= 0 and planned_amount <= 1000000000),
  cost_basis text not null default 'fixed'
    check (cost_basis in ('fixed', 'per_adult', 'per_child', 'per_guest', 'per_table')),
  -- the price of one adult / guest / table, and the supplement for a child
  unit_price numeric(12, 2) check (unit_price is null or (unit_price >= 0 and unit_price <= 10000000)),
  child_price numeric(12, 2) check (child_price is null or (child_price >= 0 and child_price <= 10000000)),
  is_required boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_categories_named check (category_key is not null or name is not null),
  constraint budget_categories_id_invitation unique (id, invitation_id)
);
create unique index budget_categories_key on public.budget_categories (invitation_id, category_key)
  where category_key is not null;
create index budget_categories_invitation on public.budget_categories (invitation_id, sort);
create trigger budget_categories_touch before update on public.budget_categories
  for each row execute function public.touch_updated_at();

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  category_id uuid not null,
  vendor_id uuid references public.plan_vendors (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  estimate numeric(12, 2) check (estimate is null or (estimate >= 0 and estimate <= 1000000000)),
  quoted numeric(12, 2) check (quoted is null or (quoted >= 0 and quoted <= 1000000000)),
  final numeric(12, 2) check (final is null or (final >= 0 and final <= 1000000000)),
  status text not null default 'estimate' check (status in ('estimate', 'quoted', 'booked', 'paid')),
  -- null: follows the plan's VAT mode
  vat_included boolean,
  attachments jsonb not null default '[]'
    check (jsonb_typeof(attachments) = 'array' and pg_column_size(attachments) <= 8192),
  notes text check (notes is null or char_length(notes) <= 1000),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_items_category foreign key (category_id, invitation_id)
    references public.budget_categories (id, invitation_id) on delete cascade,
  constraint budget_items_id_invitation unique (id, invitation_id)
);
create index budget_items_category on public.budget_items (category_id);
create index budget_items_invitation on public.budget_items (invitation_id, sort);
create index budget_items_vendor_id_idx on public.budget_items (vendor_id) where vendor_id is not null;
create trigger budget_items_touch before update on public.budget_items
  for each row execute function public.touch_updated_at();

create table public.budget_payments (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  item_id uuid not null,
  -- a deposit, a payment, the balance — as the host names it
  label text not null check (char_length(label) between 1 and 60),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 1000000000),
  due_date date,
  paid_at timestamptz,
  -- paid at the event itself (a cash balance to the DJ…): listed on the event day
  pay_on_event_day boolean not null default false,
  payer text check (payer is null or char_length(payer) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_payments_item foreign key (item_id, invitation_id)
    references public.budget_items (id, invitation_id) on delete cascade
);
create index budget_payments_item on public.budget_payments (item_id);
create index budget_payments_due on public.budget_payments (invitation_id, due_date) where paid_at is null;
create trigger budget_payments_touch before update on public.budget_payments
  for each row execute function public.touch_updated_at();

create table public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  -- null for a system task (the dictionary names it) and for a template's task nobody has renamed (its
  -- template names it): both follow the host's language. Once the host edits it, it is theirs, as typed.
  title text check (title is null or char_length(title) between 1 and 200),
  -- null: the template's note (when it has one); '' : none
  notes text check (notes is null or char_length(notes) <= 2000),
  due_date date,
  -- the host set the date: a change of the event's date leaves it alone
  due_is_manual boolean not null default false,
  -- days from the event's date, kept to move the date with the event
  offset_days int check (offset_days is null or offset_days between -1000 and 1000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skipped')),
  category_key text check (category_key is null or category_key ~ '^[a-z_]{2,40}$'),
  priority smallint not null default 0 check (priority between 0 and 1),
  -- 'me', or a name the host typed
  assignee text check (assignee is null or char_length(assignee) between 1 and 60),
  budget_item_id uuid references public.budget_items (id) on delete set null,
  vendor_id uuid references public.plan_vendors (id) on delete set null,
  system_key text check (system_key is null or system_key in (
    'invitation_designed', 'invitation_published', 'guests_uploaded', 'invites_sent', 'rsvp_tracked',
    'rsvp_deadline', 'final_headcount', 'seating_done', 'entry_station_ready'
  )),
  -- the task's key in the template it came from
  tpl_key text check (tpl_key is null or tpl_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  -- no longer meaningful with the time that was left when the plan was made: offered for hiding
  suggest_hide boolean not null default false,
  completed_at timestamptz,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_tasks_named check (system_key is not null or tpl_key is not null or title is not null)
);
create unique index plan_tasks_system on public.plan_tasks (invitation_id, system_key)
  where system_key is not null;
create index plan_tasks_invitation on public.plan_tasks (invitation_id, sort);
create index plan_tasks_due on public.plan_tasks (invitation_id, due_date) where status in ('todo', 'doing');
create index plan_tasks_budget_item_id_idx on public.plan_tasks (budget_item_id) where budget_item_id is not null;
create index plan_tasks_vendor_id_idx on public.plan_tasks (vendor_id) where vendor_id is not null;
create trigger plan_tasks_touch before update on public.plan_tasks
  for each row execute function public.touch_updated_at();

create table public.plan_ideas (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  type text not null default 'note' check (type in ('note', 'link', 'image', 'list')),
  title text check (title is null or char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 5000),
  url text check (url is null or char_length(url) <= 1000),
  -- { title, description, image, site } read once from the link's page
  og_preview jsonb check (og_preview is null or (jsonb_typeof(og_preview) = 'object' and pg_column_size(og_preview) <= 4096)),
  -- a file in plan-files
  image_path text check (image_path is null or char_length(image_path) <= 300),
  color text not null default 'default' check (color in ('default', 'brand', 'success', 'warning', 'info')),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  pinned boolean not null default false,
  -- a list card's lines: [{ text, done }]
  list_items jsonb not null default '[]'
    check (jsonb_typeof(list_items) = 'array' and pg_column_size(list_items) <= 16384),
  -- what the card became (and so what links back to it)
  linked_task_id uuid references public.plan_tasks (id) on delete set null,
  linked_vendor_id uuid references public.plan_vendors (id) on delete set null,
  linked_budget_item_id uuid references public.budget_items (id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_ideas_has_content check (title is not null or body is not null or url is not null or image_path is not null or jsonb_array_length(list_items) > 0)
);
create index plan_ideas_invitation on public.plan_ideas (invitation_id, pinned desc, sort);
create index plan_ideas_linked_task_id_idx on public.plan_ideas (linked_task_id) where linked_task_id is not null;
create index plan_ideas_linked_vendor_id_idx on public.plan_ideas (linked_vendor_id) where linked_vendor_id is not null;
create index plan_ideas_linked_item_id_idx on public.plan_ideas (linked_budget_item_id) where linked_budget_item_id is not null;
create trigger plan_ideas_touch before update on public.plan_ideas
  for each row execute function public.touch_updated_at();

-- closed to everyone but the functions below
alter table public.plan_templates enable row level security;
alter table public.plan_settings enable row level security;
alter table public.plan_vendors enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.budget_payments enable row level security;
alter table public.plan_tasks enable row level security;
alter table public.plan_ideas enable row level security;
revoke all on public.plan_templates, public.plan_settings, public.plan_vendors, public.budget_categories,
  public.budget_items, public.budget_payments, public.plan_tasks, public.plan_ideas
  from anon, authenticated;

-- ─── what a row looks like to the app (camelCase, like the other screens' functions) ────────────

create function public.planning_settings_json(s public.plan_settings) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'templateKey', s.template_key, 'variant', s.variant,
    'totalBudget', s.total_budget, 'vatMode', s.vat_mode, 'vatPct', s.vat_pct,
    'guestBasis', s.guest_basis, 'manualAdults', s.manual_adults, 'manualChildren', s.manual_children,
    'manualTables', s.manual_tables,
    'integrations', s.integrations, 'reminders', s.reminders,
    'requiredVendors', to_jsonb(s.required_vendors), 'onboardingDone', s.onboarding_done,
    'anchorDate', s.anchor_date, 'headcountSeen', s.headcount_seen
  )
$$;

create function public.planning_task_json(t public.plan_tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'title', t.title, 'notes', t.notes, 'dueDate', t.due_date,
    'dueIsManual', t.due_is_manual, 'offsetDays', t.offset_days, 'status', t.status,
    'category', t.category_key, 'priority', t.priority, 'assignee', t.assignee,
    'budgetItemId', t.budget_item_id, 'vendorId', t.vendor_id, 'systemKey', t.system_key,
    'tplKey', t.tpl_key, 'suggestHide', t.suggest_hide, 'completedAt', t.completed_at, 'sort', t.sort
  )
$$;

create function public.planning_category_json(c public.budget_categories) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'key', c.category_key, 'name', c.name, 'plannedAmount', c.planned_amount,
    'costBasis', c.cost_basis, 'unitPrice', c.unit_price, 'childPrice', c.child_price,
    'required', c.is_required, 'sort', c.sort
  )
$$;

create function public.planning_item_json(i public.budget_items) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'categoryId', i.category_id, 'vendorId', i.vendor_id, 'title', i.title,
    'estimate', i.estimate, 'quoted', i.quoted, 'final', i.final, 'status', i.status,
    'vatIncluded', i.vat_included, 'attachments', i.attachments, 'notes', i.notes, 'sort', i.sort
  )
$$;

create function public.planning_payment_json(p public.budget_payments) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'itemId', p.item_id, 'label', p.label, 'amount', p.amount, 'dueDate', p.due_date,
    'paidAt', p.paid_at, 'payOnEventDay', p.pay_on_event_day, 'payer', p.payer
  )
$$;

create function public.planning_vendor_json(v public.plan_vendors) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'name', v.name, 'category', v.category_key, 'phone', v.phone, 'email', v.email,
    'url', v.url, 'status', v.status, 'quoteAmount', v.quote_amount, 'paymentTerms', v.payment_terms,
    'included', v.included, 'rating', v.rating, 'notes', v.notes, 'attachments', v.attachments,
    'sort', v.sort
  )
$$;

create function public.planning_idea_json(d public.plan_ideas) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id, 'type', d.type, 'title', d.title, 'body', d.body, 'url', d.url,
    'ogPreview', d.og_preview, 'imagePath', d.image_path, 'color', d.color, 'tags', to_jsonb(d.tags),
    'pinned', d.pinned, 'items', d.list_items, 'linkedTaskId', d.linked_task_id,
    'linkedVendorId', d.linked_vendor_id, 'linkedBudgetItemId', d.linked_budget_item_id,
    'sort', d.sort, 'createdAt', d.created_at
  )
$$;

-- ─── the money ──────────────────────────────────────────────────────────────────────────────────

-- The guest numbers a cost follows. basis 'invited': everyone on the list (a record's party size, 1
-- when none) counted as an adult — the list doesn't say who is a child; 'confirmed': the "yes"
-- replies' adults and children; 'manual': the host's own numbers. Tables: the event's live tables. When
-- the host switched the guests' (or the seating's) integration off, the numbers are the host's own
-- and nothing is read from them — switching it back on brings the choice back, nothing was lost.
create function public.planning_headcount(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.plan_settings;
  v_basis text;
  v_invited int;
  v_ca int;
  v_cc int;
  v_tables int;
  v_adults int;
  v_children int;
begin
  select * into s from public.plan_settings where invitation_id = p_id;
  v_basis := coalesce(s.guest_basis, 'invited');
  if not coalesce((s.integrations ->> 'guests')::boolean, true) then v_basis := 'manual'; end if;
  select coalesce(sum(coalesce(party_size, 1)), 0)::int into v_invited
  from public.invitation_guests where invitation_id = p_id;
  select coalesce(sum(adults_count), 0)::int, coalesce(sum(children_count), 0)::int into v_ca, v_cc
  from public.rsvp_responses where invitation_id = p_id and attending;
  if coalesce((s.integrations ->> 'seating')::boolean, true) then
    select count(*)::int into v_tables
    from public.seating_tables where invitation_id = p_id and deleted_at is null;
  else
    v_tables := coalesce(s.manual_tables, 0);
  end if;
  if v_basis = 'confirmed' then
    v_adults := v_ca; v_children := v_cc;
  elsif v_basis = 'manual' then
    v_adults := coalesce(s.manual_adults, 0); v_children := coalesce(s.manual_children, 0);
  else
    v_adults := v_invited; v_children := 0;
  end if;
  return jsonb_build_object(
    'basis', v_basis, 'adults', v_adults, 'children', v_children, 'guests', v_adults + v_children,
    'tables', v_tables, 'invited', v_invited, 'confirmedAdults', v_ca, 'confirmedChildren', v_cc
  );
end $$;

-- What a category is planned to cost with these numbers. A category priced per head (or per table) with
-- no price yet stays at its planned amount; per_adult adds the child supplement for the children.
create function public.planning_category_planned(c public.budget_categories, p_adults int, p_children int, p_tables int)
returns numeric
language sql immutable set search_path = '' as $$
  select round(case
    when c.unit_price is null or c.cost_basis = 'fixed' then c.planned_amount
    when c.cost_basis = 'per_adult' then c.unit_price * p_adults + coalesce(c.child_price, 0) * p_children
    when c.cost_basis = 'per_child' then c.unit_price * p_children
    when c.cost_basis = 'per_guest' then c.unit_price * (p_adults + p_children)
    when c.cost_basis = 'per_table' then c.unit_price * p_tables
    else c.planned_amount
  end, 2)
$$;

-- One item's amount, with VAT on the plan's terms: the final price, else the quote, else the estimate;
-- amounts entered without VAT (the mode's, or the item's own override) are shown with it, so every
-- total is a total the host actually pays.
create function public.planning_item_amount(i public.budget_items, p_vat_mode text, p_vat_pct numeric)
returns numeric
language sql immutable set search_path = '' as $$
  select round(
    coalesce(i.final, i.quoted, i.estimate, 0) *
    case
      when p_vat_mode = 'none' then 1
      when coalesce(i.vat_included, p_vat_mode = 'included') then 1
      else 1 + p_vat_pct / 100
    end, 2)
$$;

-- The budget's numbers for one event. planned: the categories' targets with the guest numbers now;
-- expected: every item; committed: the booked and paid ones; paid: the payments made; unpaid: the
-- payments still to make; remaining: the total budget less what is committed (null without a total).
create function public.planning_totals(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.plan_settings;
  h jsonb;
  v_adults int;
  v_children int;
  v_tables int;
  v_planned numeric := 0;
  v_expected numeric := 0;
  v_committed numeric := 0;
  v_paid numeric := 0;
  v_unpaid numeric := 0;
  v_cats jsonb;
begin
  select * into s from public.plan_settings where invitation_id = p_id;
  h := public.planning_headcount(p_id);
  v_adults := (h->>'adults')::int; v_children := (h->>'children')::int; v_tables := (h->>'tables')::int;

  with cat as (
    select c.id,
      public.planning_category_planned(c, v_adults, v_children, v_tables) as planned
    from public.budget_categories c where c.invitation_id = p_id
  ), itm as (
    select i.category_id, i.status, public.planning_item_amount(i, coalesce(s.vat_mode, 'included'), coalesce(s.vat_pct, 18)) as amount
    from public.budget_items i where i.invitation_id = p_id
  ), pay as (
    select i.category_id, p.amount, p.paid_at
    from public.budget_payments p join public.budget_items i on i.id = p.item_id
    where p.invitation_id = p_id
  ), per_cat as (
    select cat.id,
      cat.planned,
      coalesce((select sum(amount) from itm where itm.category_id = cat.id), 0) as expected,
      coalesce((select sum(amount) from itm where itm.category_id = cat.id and itm.status in ('booked', 'paid')), 0) as committed,
      coalesce((select sum(amount) from pay where pay.category_id = cat.id and pay.paid_at is not null), 0) as paid
    from cat
  )
  select coalesce(sum(planned), 0), coalesce(sum(expected), 0), coalesce(sum(committed), 0), coalesce(sum(paid), 0),
    coalesce(jsonb_agg(jsonb_build_object('id', id, 'planned', planned, 'expected', expected,
      'committed', committed, 'paid', paid)), '[]'::jsonb)
  into v_planned, v_expected, v_committed, v_paid, v_cats
  from per_cat;

  select coalesce(sum(amount), 0) into v_unpaid
  from public.budget_payments where invitation_id = p_id and paid_at is null;

  return jsonb_build_object(
    'totalBudget', s.total_budget,
    'planned', v_planned, 'expected', v_expected, 'committed', v_committed, 'paid', v_paid,
    'unpaid', v_unpaid,
    'remaining', case when s.total_budget is null then null else s.total_budget - v_committed end,
    'perGuest', case when (v_adults + v_children) > 0 then round(v_committed / (v_adults + v_children), 2) else null end,
    'byCategory', v_cats
  );
end $$;

-- How the guest numbers moved since the host last looked, and what that does to the costs that follow
-- them ("12 more adults: +₪3,600"); null when nothing moved or there is nothing to compare.
create function public.planning_headcount_change(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.plan_settings;
  h jsonb;
  v_a int; v_c int; v_t int;
  v_sa int; v_sc int; v_st int;
  v_delta numeric;
begin
  select * into s from public.plan_settings where invitation_id = p_id;
  if s.invitation_id is null or s.headcount_seen is null then return null; end if;
  h := public.planning_headcount(p_id);
  v_a := (h->>'adults')::int; v_c := (h->>'children')::int; v_t := (h->>'tables')::int;
  v_sa := coalesce((s.headcount_seen->>'adults')::int, 0);
  v_sc := coalesce((s.headcount_seen->>'children')::int, 0);
  v_st := coalesce((s.headcount_seen->>'tables')::int, 0);
  if v_a = v_sa and v_c = v_sc and v_t = v_st then return null; end if;
  select coalesce(sum(
    public.planning_category_planned(c, v_a, v_c, v_t) - public.planning_category_planned(c, v_sa, v_sc, v_st)
  ), 0) into v_delta
  from public.budget_categories c
  where c.invitation_id = p_id and c.cost_basis <> 'fixed' and c.unit_price is not null;
  return jsonb_build_object(
    'adults', v_a - v_sa, 'children', v_c - v_sc, 'tables', v_t - v_st, 'cost', v_delta
  );
end $$;

-- ─── what the invitation system knows (the system tasks' facts that are not in the invitation's list) ──

create function public.planning_invitation_json(i public.invitations) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'slug', i.slug, 'status', i.status, 'eventType', i.event_type,
    'date', i.draft #>> '{event,date}', 'timezone', i.draft ->> 'timezone',
    -- the guests see the published document's deadline, so that is the one tasks follow
    'rsvpDeadline', coalesce(i.published, i.draft) #>> '{event,rsvpDeadline}'
  )
$$;

-- The RSVP deadline of the document the guests see, as a date (null: none, or not a date).
create function public.planning_deadline(i public.invitations) returns date
language sql stable security definer set search_path = '' as $$
  select case when d ~ '^\d{4}-\d{2}-\d{2}$' then d::date end
  from (select coalesce(i.published, i.draft) #>> '{event,rsvpDeadline}' as d) x
$$;

-- When a task is due: the two tasks that come from data follow the invitation's own deadline (the
-- head-count is due the day after it), the rest are as stored.
create function public.planning_effective_due(t public.plan_tasks, p_deadline date) returns date
language sql immutable set search_path = '' as $$
  select case t.system_key
    when 'rsvp_deadline' then coalesce(p_deadline, t.due_date)
    when 'final_headcount' then coalesce(p_deadline + 1, t.due_date)
    else t.due_date
  end
$$;

create function public.planning_facts(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tables', (select count(*) from public.seating_tables where invitation_id = p_id and deleted_at is null),
    'confirmedUnseated', (
      select count(*) from public.seating_unit_rows(p_id) u
      where u.status = 'confirmed'
        and not exists (select 1 from public.seat_assignments a where a.unit_id = u.id)
    ),
    'stationReady', exists (select 1 from public.event_days where invitation_id = p_id)
  )
$$;

-- ─── the planning screens ───────────────────────────────────────────────────────────────────────

-- Everything the planning screens need for one of the owner's events; null when it isn't theirs.
-- (the server resolves the signed-in user; each call checks the owner itself).
create function public.planning_state(p_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  s public.plan_settings;
  v_deadline date;
begin
  select * into inv from public.invitations where id = p_id and owner_id = p_owner;
  if not found then return null; end if;
  select * into s from public.plan_settings where invitation_id = p_id;
  v_deadline := public.planning_deadline(inv);
  return jsonb_build_object(
    'invitation', public.planning_invitation_json(inv),
    'settings', case when s.invitation_id is null then null else public.planning_settings_json(s) end,
    'tasks', coalesce((select jsonb_agg(
        public.planning_task_json(t) || jsonb_build_object('dueDate', public.planning_effective_due(t, v_deadline))
        order by t.sort, t.due_date nulls last, t.created_at)
      from public.plan_tasks t where t.invitation_id = p_id), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(public.planning_category_json(c) order by c.sort, c.created_at)
      from public.budget_categories c where c.invitation_id = p_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(public.planning_item_json(i) order by i.sort, i.created_at)
      from public.budget_items i where i.invitation_id = p_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(public.planning_payment_json(p) order by p.due_date nulls last, p.created_at)
      from public.budget_payments p where p.invitation_id = p_id), '[]'::jsonb),
    'vendors', coalesce((select jsonb_agg(public.planning_vendor_json(v) order by v.sort, v.created_at)
      from public.plan_vendors v where v.invitation_id = p_id), '[]'::jsonb),
    'ideas', coalesce((select jsonb_agg(public.planning_idea_json(d) order by d.pinned desc, d.sort, d.created_at desc)
      from public.plan_ideas d where d.invitation_id = p_id), '[]'::jsonb),
    'headcount', public.planning_headcount(p_id),
    'totals', public.planning_totals(p_id),
    'headcountChange', public.planning_headcount_change(p_id),
    'facts', public.planning_facts(p_id)
  );
end $$;

-- The overview's data in one call (the tab's badge and the invitation overview's card read it too): the
-- numbers, the tasks and payments that are due soon (the server drops the system tasks the app already
-- knows are done), how many vendors are closed and which required categories have none.
create function public.planning_overview(p_id uuid, p_owner uuid, p_today date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  s public.plan_settings;
  v_deadline date;
begin
  select * into inv from public.invitations where id = p_id and owner_id = p_owner;
  if not found then return null; end if;
  select * into s from public.plan_settings where invitation_id = p_id;
  if s.invitation_id is null then
    return jsonb_build_object('invitation', public.planning_invitation_json(inv), 'settings', null);
  end if;
  v_deadline := public.planning_deadline(inv);
  return jsonb_build_object(
    'invitation', public.planning_invitation_json(inv),
    'settings', public.planning_settings_json(s),
    'headcount', public.planning_headcount(p_id),
    'totals', public.planning_totals(p_id),
    'headcountChange', public.planning_headcount_change(p_id),
    'facts', public.planning_facts(p_id),
    'taskTotals', (
      select jsonb_build_object(
        'total', count(*), 'done', count(*) filter (where status = 'done'),
        'skipped', count(*) filter (where status = 'skipped'))
      from public.plan_tasks where invitation_id = p_id
    ),
    'tasks', coalesce((
      select jsonb_agg(t.j order by t.eff_due nulls last, t.priority desc, t.sort)
      from (
        select public.planning_task_json(x) || jsonb_build_object('dueDate', public.planning_effective_due(x, v_deadline)) as j,
          public.planning_effective_due(x, v_deadline) as eff_due, x.priority, x.sort
        from public.plan_tasks x
        where x.invitation_id = p_id and x.status in ('todo', 'doing') and not x.suggest_hide
      ) t
      where t.eff_due is null or t.eff_due <= p_today + 21
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'label', p.label, 'amount', p.amount, 'dueDate', p.due_date,
        'payOnEventDay', p.pay_on_event_day, 'itemTitle', i.title, 'vendorId', i.vendor_id
      ) order by p.due_date nulls last, p.created_at)
      from (
        select * from public.budget_payments
        where invitation_id = p_id and paid_at is null and (due_date is null or due_date <= p_today + 21)
        order by due_date nulls last, created_at
        limit 30
      ) p join public.budget_items i on i.id = p.item_id
    ), '[]'::jsonb),
    'vendors', jsonb_build_object(
      'total', (select count(*) from public.plan_vendors where invitation_id = p_id and status <> 'rejected'),
      'closed', (select count(*) from public.plan_vendors where invitation_id = p_id and status = 'booked'),
      'missing', coalesce((
        select jsonb_agg(k) from unnest(s.required_vendors) k
        where not exists (select 1 from public.plan_vendors v
          where v.invitation_id = p_id and v.category_key = k and v.status = 'booked')
      ), '[]'::jsonb)
    )
  );
end $$;

-- ─── setting the plan up ────────────────────────────────────────────────────────────────────────

-- Creates the plan from a draft the server prepared (its tasks with their dates, its budget categories):
-- once — answers { ok: false, code: 'exists' } when the event already has one. null: not the owner's.
create function public.planning_init(p_id uuid, p_owner uuid, p_settings jsonb, p_tasks jsonb, p_categories jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t jsonb;
  c jsonb;
  v_n int := 0;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  if exists (select 1 from public.plan_settings where invitation_id = p_id) then
    return jsonb_build_object('ok', false, 'code', 'exists');
  end if;
  if jsonb_array_length(coalesce(p_tasks, '[]')) > 400 or jsonb_array_length(coalesce(p_categories, '[]')) > 40 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;

  insert into public.plan_settings (
    invitation_id, template_key, variant, total_budget, vat_mode, vat_pct, guest_basis,
    manual_adults, manual_children, manual_tables, integrations, reminders, required_vendors, onboarding_done,
    anchor_date
  ) values (
    p_id, p_settings ->> 'templateKey', coalesce(p_settings ->> 'variant', 'default'),
    (p_settings ->> 'totalBudget')::numeric, coalesce(p_settings ->> 'vatMode', 'included'),
    coalesce((p_settings ->> 'vatPct')::numeric, 18), coalesce(p_settings ->> 'guestBasis', 'invited'),
    (p_settings ->> 'manualAdults')::int, (p_settings ->> 'manualChildren')::int,
    (p_settings ->> 'manualTables')::int, coalesce(p_settings -> 'integrations', '{}'), coalesce(p_settings -> 'reminders', '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_settings -> 'requiredVendors', '[]'))), '{}'),
    coalesce((p_settings ->> 'onboardingDone')::boolean, false), (p_settings ->> 'anchorDate')::date
  );

  for c in select * from jsonb_array_elements(coalesce(p_categories, '[]')) loop
    insert into public.budget_categories (
      invitation_id, category_key, name, planned_amount, cost_basis, unit_price, child_price, is_required, sort
    ) values (
      p_id, c ->> 'key', c ->> 'name', coalesce((c ->> 'plannedAmount')::numeric, 0),
      coalesce(c ->> 'costBasis', 'fixed'), (c ->> 'unitPrice')::numeric, (c ->> 'childPrice')::numeric,
      coalesce((c ->> 'required')::boolean, false), coalesce((c ->> 'sort')::int, 0)
    );
  end loop;

  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]')) loop
    insert into public.plan_tasks (
      invitation_id, title, notes, due_date, offset_days, category_key, priority, system_key, tpl_key,
      suggest_hide, sort
    ) values (
      p_id, t ->> 'title', t ->> 'notes', (t ->> 'dueDate')::date, (t ->> 'offsetDays')::int,
      t ->> 'category', coalesce((t ->> 'priority')::smallint, 0), t ->> 'systemKey', t ->> 'tplKey',
      coalesce((t ->> 'suggestHide')::boolean, false), coalesce((t ->> 'sort')::int, v_n)
    );
    v_n := v_n + 10;
  end loop;

  -- what the host sees first is the head-count as it is now: later moves are what gets flagged
  update public.plan_settings set headcount_seen = public.planning_headcount(p_id) where invitation_id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- Changes the plan's settings (only the keys present). Changing where the guest numbers come from
-- resets what "moved since" is measured against. null: not the owner's, or no plan yet.
create function public.planning_settings_save(p_id uuid, p_owner uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.plan_settings;
  v_basis_changed boolean;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  v_basis_changed := p_patch ? 'guestBasis' or p_patch ? 'manualAdults' or p_patch ? 'manualChildren'
    or p_patch ? 'manualTables' or p_patch ? 'integrations';
  update public.plan_settings set
    variant = case when p_patch ? 'variant' then p_patch ->> 'variant' else variant end,
    total_budget = case when p_patch ? 'totalBudget' then (p_patch ->> 'totalBudget')::numeric else total_budget end,
    vat_mode = case when p_patch ? 'vatMode' then p_patch ->> 'vatMode' else vat_mode end,
    vat_pct = case when p_patch ? 'vatPct' then (p_patch ->> 'vatPct')::numeric else vat_pct end,
    guest_basis = case when p_patch ? 'guestBasis' then p_patch ->> 'guestBasis' else guest_basis end,
    manual_adults = case when p_patch ? 'manualAdults' then (p_patch ->> 'manualAdults')::int else manual_adults end,
    manual_children = case when p_patch ? 'manualChildren' then (p_patch ->> 'manualChildren')::int else manual_children end,
    manual_tables = case when p_patch ? 'manualTables' then (p_patch ->> 'manualTables')::int else manual_tables end,
    integrations = case when p_patch ? 'integrations' then integrations || (p_patch -> 'integrations') else integrations end,
    reminders = case when p_patch ? 'reminders' then reminders || (p_patch -> 'reminders') else reminders end,
    required_vendors = case when p_patch ? 'requiredVendors'
      then coalesce(array(select jsonb_array_elements_text(p_patch -> 'requiredVendors')), '{}')
      else required_vendors end,
    onboarding_done = case when p_patch ? 'onboardingDone' then (p_patch ->> 'onboardingDone')::boolean else onboarding_done end
  where invitation_id = p_id
  returning * into s;
  if not found then return null; end if;
  if v_basis_changed then
    update public.plan_settings set headcount_seen = public.planning_headcount(p_id)
    where invitation_id = p_id returning * into s;
  end if;
  return public.planning_settings_json(s);
end $$;

-- "I've seen it": what the guest numbers moved since is measured from now on.
create function public.planning_headcount_ack(p_id uuid, p_owner uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return false;
  end if;
  update public.plan_settings set headcount_seen = public.planning_headcount(p_id) where invitation_id = p_id;
  return found;
end $$;

-- Moves the dates of the tasks the host never dated themselves (p_dates: [{ id, due }]) after the event's
-- date changed, and remembers the date they were computed for.
create function public.planning_dates_apply(p_id uuid, p_owner uuid, p_dates jsonb, p_anchor date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int := 0;
begin
  if not exists (select 1 from public.invitations where id = p_id and owner_id = p_owner) then
    return null;
  end if;
  if jsonb_array_length(coalesce(p_dates, '[]')) > 400 then return null; end if;
  with moved as (
    update public.plan_tasks t set due_date = (d ->> 'due')::date
    from jsonb_array_elements(coalesce(p_dates, '[]')) d
    where t.id = (d ->> 'id')::uuid and t.invitation_id = p_id and not t.due_is_manual
      and t.system_key is distinct from 'rsvp_deadline' and t.system_key is distinct from 'final_headcount'
    returning 1
  )
  select count(*)::int into v_n from moved;
  update public.plan_settings set anchor_date = p_anchor where invitation_id = p_id;
  return v_n;
end $$;

-- ─── privileges ─────────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  -- the screens' functions: the server only (service_role)
  foreach f in array array[
    'public.planning_state(uuid, uuid)',
    'public.planning_overview(uuid, uuid, date)',
    'public.planning_init(uuid, uuid, jsonb, jsonb, jsonb)',
    'public.planning_settings_save(uuid, uuid, jsonb)',
    'public.planning_headcount_ack(uuid, uuid)',
    'public.planning_dates_apply(uuid, uuid, jsonb, date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- helpers: only the functions above call them
  foreach f in array array[
    'public.planning_settings_json(public.plan_settings)',
    'public.planning_task_json(public.plan_tasks)',
    'public.planning_category_json(public.budget_categories)',
    'public.planning_item_json(public.budget_items)',
    'public.planning_payment_json(public.budget_payments)',
    'public.planning_vendor_json(public.plan_vendors)',
    'public.planning_idea_json(public.plan_ideas)',
    'public.planning_headcount(uuid)',
    'public.planning_category_planned(public.budget_categories, int, int, int)',
    'public.planning_item_amount(public.budget_items, text, numeric)',
    'public.planning_totals(uuid)',
    'public.planning_headcount_change(uuid)',
    'public.planning_invitation_json(public.invitations)',
    'public.planning_deadline(public.invitations)',
    'public.planning_effective_due(public.plan_tasks, date)',
    'public.planning_facts(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
