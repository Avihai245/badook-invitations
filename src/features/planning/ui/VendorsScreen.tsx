'use client';

import {
  Columns3,
  ExternalLink,
  ListTodo,
  CircleCheck,
  MapPinned,
  Paperclip,
  Plus,
  Scale,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, cn } from '@/components/app';
import { BADOOK_EVENTS_URL } from '@/features/site/links';
import { useUi } from '@/lib/i18n/client';
import type { CategoryKey, VendorStatus } from '../model/categories';
import type { PlanVendor } from '../model/plan';
import { isPast, PlanFrame, ToolHelp } from './PlanFrame';
import { usePlan } from './PlanProvider';
import { CloseVendorDialog } from './vendors/CloseVendorDialog';
import { CompareDialog } from './vendors/CompareDialog';
import { countByStatus, missingCategories, STATUSES, toggleCompare } from './vendors/helpers';
import { MissingCard } from './vendors/MissingCard';
import { QuickAddVendor } from './vendors/QuickAddVendor';
import { SummaryCard } from './vendors/SummaryCard';
import { useVendorActions } from './vendors/useVendorActions';
import { VendorBoard, type StatusFilter } from './vendors/VendorBoard';
import { VendorDrawer } from './vendors/VendorDrawer';

/**
 * The Vendors tool: the host's own list of vendors for the event, from an idea to a booked vendor.
 * The counters on top filter; from a desktop's width the vendors are columns a card is dragged (or
 * moved by its menu) between, on a phone a list grouped by status; "what is missing" lists the
 * categories still to close, each with a quick add; two or more vendors of one category can be compared;
 * closing a vendor can open its budget item, payment schedule and tasks in one step (undoable). After
 * the event the screen turns into a summary that asks for a rating of each booked vendor.
 */
export function VendorsScreen() {
  const { t, fmt, number } = useUi();
  const T = t.planning.vendors;
  const plan = usePlan();
  const { view } = plan;
  const past = isPast(view);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ category: CategoryKey | null } | null>(null);
  const [closing, setClosing] = useState<PlanVendor | null>(null);
  const actions = useVendorActions({ askClose: setClosing });
  const { vendors } = actions;

  const counts = countByStatus(vendors);
  const shown = filter === 'all' ? vendors : vendors.filter((v) => v.status === filter);
  const open = openId ? (vendors.find((v) => v.id === openId) ?? null) : null;
  // a vendor deleted meanwhile leaves the selection
  const picked = selected.map((id) => vendors.find((v) => v.id === id)).filter((v): v is PlanVendor => !!v);
  const missing = missingCategories(vendors, view.settings?.requiredVendors ?? []);
  const booked = vendors.filter((v) => v.status === 'booked');

  const chips: { value: StatusFilter; label: string; n: number }[] = [
    { value: 'all', label: T.filters.all, n: vendors.length },
    ...STATUSES.map((s: VendorStatus) => ({ value: s, label: T.statuses[s], n: counts[s] })),
  ];

  const help = (
    <ToolHelp
      title={T.help.title}
      items={[
        { icon: <Columns3 />, ...T.help.items.pipeline },
        { icon: <ListTodo />, ...T.help.items.missing },
        { icon: <Scale />, ...T.help.items.compare },
        { icon: <CircleCheck />, ...T.help.items.close },
        { icon: <Paperclip />, ...T.help.items.files },
      ]}
    />
  );

  return (
    <PlanFrame
      tool="vendors"
      title={T.title}
      description={T.subtitle}
      help={help}
      actions={
        <Button icon={<Plus />} onClick={() => setAdding({ category: null })}>
          {T.add}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* said aloud after a move by the menu */}
        <p role="status" aria-live="polite" className="sr-only">
          {actions.announcement}
        </p>

        {past ? (
          <SummaryCard
            booked={booked}
            items={view.items}
            onRate={actions.rate}
            onOpen={(v) => setOpenId(v.id)}
          />
        ) : view.settings && (view.settings.requiredVendors.length > 0 || missing.length > 0) ? (
          <MissingCard rows={missing} onAdd={(category) => setAdding({ category })} />
        ) : null}

        {/* no venue closed yet: where to find one (Badook Events, another site) */}
        {!past && !booked.some((v) => v.category === 'venue') ? (
          <a
            href={BADOOK_EVENTS_URL}
            target="_blank"
            rel="noopener"
            data-testid="vendors-venues"
            className="group flex items-center gap-4 rounded-card border border-brand-line bg-linear-to-l from-brand-soft via-surface to-surface p-4 transition-shadow hover:shadow-md sm:p-5"
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-brand text-white shadow-[0_10px_22px_-12px_rgba(122,82,48,0.9)]"
            >
              <MapPinned className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{t.shell.nav.venues}</span>
              <span className="block text-[13px] text-muted">{t.shell.nav.venuesHelp}</span>
            </span>
            <ExternalLink aria-hidden className="icon-dir size-4 shrink-0 text-brand-deep" />
            <span className="sr-only">{t.shell.nav.newTab}</span>
          </a>
        ) : null}

        {vendors.length === 0 ? (
          <Card>
            <EmptyState
              title={T.empty.title}
              description={T.empty.body}
              action={
                <Button variant="secondary" icon={<Plus />} onClick={() => setAdding({ category: null })}>
                  {T.add}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <div
              role="group"
              aria-label={T.filters.label}
              className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
                {chips.map((chip) => {
                  const active = filter === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      aria-pressed={active}
                      aria-label={fmt(T.filters.chip, { label: chip.label, n: number(chip.n) })}
                      onClick={() => setFilter(chip.value)}
                      className={cn(
                        'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap ring-1 transition-colors motion-reduce:transition-none',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                        active
                          ? 'bg-brand-soft text-brand-deep ring-brand-line'
                          : 'bg-surface text-ink/75 ring-line hover:bg-subtle hover:text-ink',
                      )}
                    >
                      {chip.label}
                      <span aria-hidden className="tabular-nums opacity-80">
                        {number(chip.n)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {picked.length > 0 ? (
              <CompareBar
                count={picked.length}
                onOpen={() => setComparing(true)}
                onClear={() => setSelected([])}
              />
            ) : null}

            {shown.length === 0 ? (
              <Card>
                <EmptyState
                  title={T.empty.filtered}
                  action={
                    <Button variant="secondary" onClick={() => setFilter('all')}>
                      {T.empty.showAll}
                    </Button>
                  }
                />
              </Card>
            ) : (
              <VendorBoard
                vendors={vendors}
                filter={filter}
                selected={selected}
                onToggleCompare={(id) => setSelected((s) => toggleCompare(s, vendors, id))}
                onOpen={(v) => setOpenId(v.id)}
                onMove={actions.move}
                onClose={actions.requestClose}
                onDelete={(v) => void actions.remove(v)}
              />
            )}
          </>
        )}
      </div>

      <QuickAddVendor
        open={adding !== null}
        onOpenChange={(o) => {
          if (!o) setAdding(null);
        }}
        category={adding?.category ?? null}
        onAdd={actions.add}
      />
      <VendorDrawer
        vendor={open}
        exportEnabled={view.features.export}
        onDismiss={() => setOpenId(null)}
        onSave={(id, fields) => void actions.update(id, fields)}
        onDelete={(v) => void actions.remove(v)}
      />
      <CloseVendorDialog
        vendor={closing}
        onCancel={() => setClosing(null)}
        onConfirm={(vendor, closePlan, terms) => {
          setClosing(null);
          void actions.closeVendor(vendor, closePlan).then((done) => {
            // the terms the host wrote or fixed while closing belong to the vendor
            if (done && terms !== undefined) void actions.update(vendor.id, { paymentTerms: terms });
          });
        }}
      />
      <CompareDialog
        open={comparing && picked.length >= 2}
        onOpenChange={setComparing}
        vendors={picked}
        onOpenVendor={(v) => {
          setComparing(false);
          setOpenId(v.id);
        }}
      />
    </PlanFrame>
  );
}

/** What is chosen for comparing, and the way to compare (two or more of one category). */
function CompareBar({ count, onOpen, onClear }: { count: number; onOpen: () => void; onClear: () => void }) {
  const { t, plural, number } = useUi();
  const C = t.planning.vendors.compare;
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-brand-line bg-brand-soft p-3"
      role="group"
      aria-label={C.title}
    >
      <div className="min-w-0 flex-1 basis-[220px]">
        <p role="status" aria-live="polite" className="text-[14px] font-semibold text-brand-deep">
          {plural(C.bar, count, { n: number(count) })}
        </p>
        {count < 2 ? <p className="text-[12.5px] text-ink/80">{C.hint}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
        <Button
          variant="secondary"
          icon={<Scale />}
          className="min-h-11"
          disabled={count < 2}
          onClick={onOpen}
        >
          {C.open}
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={onClear}>
          {C.clear}
        </Button>
      </div>
    </div>
  );
}
