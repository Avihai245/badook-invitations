'use client';

import { CalendarClock, Download, FlaskConical, Layers, Percent, Plus, Users, Wallet } from 'lucide-react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Button, Card, EmptyState, Segmented } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { categoryRows } from '../model/budget-view';
import { isPast, PlanFrame, ToolHelp } from './PlanFrame';
import { usePlan } from './PlanProvider';
import { AddCategoryDialog } from './budget/AddCategoryDialog';
import { BudgetSetup } from './budget/BudgetSetup';
import { BudgetSummary, PastSummary } from './budget/BudgetSummary';
import { CategoryCard } from './budget/CategoryCard';
import { Charts } from './budget/Charts';
import { ExportButton, ExportLocked } from './budget/ExportBlock';
import { GuestsPanel } from './budget/GuestsPanel';
import { ItemDrawer } from './budget/ItemDrawer';
import { PaymentsBoard } from './budget/PaymentsBoard';
import { WhatIf } from './budget/WhatIf';

type Tab = 'categories' | 'payments';
type Target = { itemId: string | null; categoryId: string | null };

/** The host chose to go on without a total budget for now (remembered in this browser only). */
const skipKey = (id: string) => `planning:budget-skip:${id}`;
function readSkip(id: string): boolean {
  try {
    return window.localStorage.getItem(skipKey(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * The budget: a 30-second setup when there is no total yet; then the four numbers with one meter, the guest
 * numbers and VAT the costs follow, the categories (each opening into how its cost is set and its items), the
 * payment schedule, a "what if" that saves nothing, the chart by category and the Excel export.
 */
export function BudgetScreen() {
  const { t } = useUi();
  const T = t.planning.budget;
  const { view } = usePlan();
  const [target, setTarget] = useState<Target>({ itemId: null, categoryId: null });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const openItem = (itemId: string | null, categoryId: string | null = null) => {
    setTarget({ itemId, categoryId });
    setDrawerOpen(true);
  };
  const ready = !!view.settings;
  const noCategories = view.categories.length === 0;

  const help = (
    <ToolHelp
      title={T.help.title}
      items={[
        { icon: <Wallet />, ...T.help.items.numbers },
        { icon: <Layers />, ...T.help.items.categories },
        { icon: <CalendarClock />, ...T.help.items.payments },
        { icon: <Users />, ...T.help.items.guests },
        { icon: <Percent />, ...T.help.items.vat },
        { icon: <FlaskConical />, ...T.help.items.whatIf },
        { icon: <Download />, ...T.help.items.export },
      ]}
    />
  );

  return (
    <PlanFrame
      tool="budget"
      title={T.title}
      description={T.subtitle}
      help={help}
      actions={
        ready ? (
          noCategories ? (
            <Button icon={<Plus />} onClick={() => setAdding(true)}>
              {T.addCategory}
            </Button>
          ) : (
            <Button icon={<Plus />} onClick={() => openItem(null)}>
              {T.addExpense}
            </Button>
          )
        ) : undefined
      }
    >
      <BudgetBody open={open} setOpen={setOpen} onOpenItem={openItem} onAddCategory={() => setAdding(true)} />
      <ItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        itemId={target.itemId}
        categoryId={target.categoryId}
      />
      <AddCategoryDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={(id) => setOpen((cur) => new Set(cur).add(id))}
      />
    </PlanFrame>
  );
}

function BudgetBody({
  open,
  setOpen,
  onOpenItem,
  onAddCategory,
}: {
  /** the categories that are open */
  open: ReadonlySet<string>;
  setOpen: Dispatch<SetStateAction<ReadonlySet<string>>>;
  onOpenItem: (itemId: string | null, categoryId?: string | null) => void;
  onAddCategory: () => void;
}) {
  const { t } = useUi();
  const T = t.planning.budget;
  const plan = usePlan();
  const { view } = plan;
  const past = isPast(view);
  const [tab, setTab] = useState<Tab>('categories');
  const [skipped, setSkipped] = useState(false);
  useEffect(() => setSkipped(readSkip(plan.id)), [plan.id]);

  // no total yet: one card, one button (a past event goes straight to its summary)
  if (view.settings!.totalBudget === null && !skipped && !past)
    return (
      <BudgetSetup
        onSkip={() => {
          setSkipped(true);
          try {
            window.localStorage.setItem(skipKey(plan.id), '1');
          } catch {
            /* the choice only lasts for this visit */
          }
        }}
      />
    );

  const rows = categoryRows(view);
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {past ? <PastSummary /> : <BudgetSummary />}
      {!past ? <GuestsPanel /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Tab>
          label={T.views.label}
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'categories', label: T.views.categories },
            { value: 'payments', label: T.views.payments },
          ]}
        />
        <ExportButton />
      </div>

      {tab === 'payments' ? (
        <PaymentsBoard
          past={past}
          onOpenItem={(id) => onOpenItem(id)}
          onAddExpense={() => onOpenItem(null)}
        />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<Layers className="size-14 text-faint" strokeWidth={1.4} />}
            title={T.categories.empty.title}
            description={T.categories.empty.body}
            action={
              <Button icon={<Plus />} onClick={onAddCategory}>
                {T.addCategory}
              </Button>
            }
          />
        </Card>
      ) : (
        <section aria-label={T.views.categories} className="flex flex-col gap-3">
          {rows.map((row) => (
            <CategoryCard
              key={row.category.id}
              row={row}
              past={past}
              open={open.has(row.category.id)}
              onToggle={() => toggle(row.category.id)}
              onAddItem={(categoryId) => {
                setOpen((cur) => new Set(cur).add(categoryId));
                onOpenItem(null, categoryId);
              }}
              onOpenItem={(id) => onOpenItem(id)}
            />
          ))}
          {!past ? (
            <div>
              <Button variant="secondary" icon={<Plus />} onClick={onAddCategory}>
                {T.addCategory}
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {!past ? <WhatIf /> : null}
      <Charts past={past} />
      <ExportLocked />
    </div>
  );
}
