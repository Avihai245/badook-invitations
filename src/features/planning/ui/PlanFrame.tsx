'use client';

import {
  Check,
  CircleAlert,
  LayoutList,
  Lightbulb,
  ListChecks,
  Loader2,
  Settings,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AreaHelp, Button, cn, PageHeader, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { daysBetween } from '../model/schedule';
import { readIntegrations } from '../model/integrations';
import type { PlanView } from '../model/plan';
import { Money } from './Money';
import { PlanSettings } from './PlanSettings';
import { usePlan } from './PlanProvider';
import { Onboarding } from './Onboarding';
import { QuickAdd } from './QuickAdd';

export type PlanTool = 'overview' | 'tasks' | 'budget' | 'vendors' | 'ideas';

const TOOLS: { key: PlanTool; path: string; icon: LucideIcon }[] = [
  { key: 'overview', path: '', icon: LayoutList },
  { key: 'tasks', path: '/tasks', icon: ListChecks },
  { key: 'budget', path: '/budget', icon: Wallet },
  { key: 'vendors', path: '/vendors', icon: Store },
  { key: 'ideas', path: '/ideas', icon: Lightbulb },
];

/** The event is over: the plan turns into a summary and the reminders stop. */
export const isPast = (view: Pick<PlanView, 'today' | 'invitation'>) =>
  !!view.invitation.date && daysBetween(view.today, view.invitation.date) < 0;

/** The tools' own sub-navigation, in the style of the invitation's tabs: chips that scroll on a phone. */
function PlanNav({ tool, id }: { tool: PlanTool; id: string }) {
  const { t } = useUi();
  const N = t.planning.nav;
  const row = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = row.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return;
    const r = active.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    if (r.left < b.left || r.right > b.right)
      el.scrollBy({ left: r.left + r.width / 2 - (b.left + b.width / 2) });
  }, [tool]);
  return (
    <nav
      ref={row}
      aria-label={N.label}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {TOOLS.map(({ key, path, icon: Icon }) => {
          const active = key === tool;
          return (
            <li key={key}>
              <Link
                href={`/app/invitations/${id}/plan${path}`}
                aria-current={active ? 'page' : undefined}
                data-plan-tool={key}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap ring-1 transition-colors motion-reduce:transition-none',
                  active
                    ? 'bg-brand-soft text-brand-deep ring-brand-line'
                    : 'bg-surface text-ink/75 ring-line hover:bg-subtle hover:text-ink',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.9} />
                {N[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "All changes saved" — and, when a change did not go through, a way to try it again. */
function SaveLine() {
  const { t } = useUi();
  const C = t.planning.common;
  const { status, retry } = usePlan();
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex min-h-5 items-center gap-1.5 text-[12.5px] text-muted"
    >
      {status === 'saving' ? (
        <>
          <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
          {C.saving}
        </>
      ) : status === 'failed' ? (
        <>
          <CircleAlert aria-hidden className="size-3.5 text-danger" />
          <span className="text-danger">{C.failed}</span>
          <button type="button" onClick={retry} className="font-semibold text-brand-deep underline">
            {C.retry}
          </button>
        </>
      ) : (
        <>
          <Check aria-hidden className="size-3.5 text-success" />
          {C.saved}
        </>
      )}
    </p>
  );
}

function Banner({ title, children, actions }: { title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <section
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-info-line bg-info-bg p-4"
    >
      <div className="min-w-0 flex-1 basis-[260px]">
        <p className="text-[14px] font-bold text-info">{title}</p>
        {children ? <p className="mt-0.5 text-[13px] text-ink/80">{children}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div>
    </section>
  );
}

/** The event's date moved since the tasks were dated; the guest numbers moved since the host looked. */
function Banners() {
  const { t, plural, number } = useUi();
  const B = t.planning.banners;
  const { toast } = useToast();
  const plan = usePlan();
  const { view } = plan;
  const [busy, setBusy] = useState(false);
  const settings = view.settings;
  if (!settings) return null;

  const dates = async (keep: boolean) => {
    setBusy(true);
    const res = await plan.call<{ view?: PlanView }>('', { op: 'dates', keep });
    setBusy(false);
    if (!res.ok || !res.body?.view) return toast({ title: t.planning.common.failed, variant: 'danger' });
    plan.setView(res.body.view);
    if (!keep) toast({ title: B.dateDone, variant: 'success' });
  };

  const seen = async () => {
    plan.patch((v) => ({ ...v, headcountChange: null }));
    const res = await plan.call('', { op: 'ack_headcount' });
    if (!res.ok) void plan.refresh();
  };

  const change = view.headcountChange;
  const integrations = readIntegrations(settings.integrations);
  const follows = integrations.guests || integrations.seating;
  const parts: string[] = [];
  if (change && follows) {
    const part = (n: number, up: { one: string; other: string }, down: { one: string; other: string }) => {
      if (n) parts.push(plural(n > 0 ? up : down, Math.abs(n), { n: number(Math.abs(n)) }));
    };
    part(change.adults, B.adultsUp, B.adultsDown);
    part(change.children, B.childrenUp, B.childrenDown);
    part(change.tables, B.tablesUp, B.tablesDown);
  }

  return (
    <>
      {view.dateChanged && !isPast(view) ? (
        <Banner
          title={B.dateTitle}
          actions={
            <>
              <Button size="sm" disabled={busy} onClick={() => void dates(false)}>
                {B.dateApply}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void dates(true)}>
                {B.dateKeep}
              </Button>
            </>
          }
        >
          {B.dateBody}
        </Banner>
      ) : null}
      {change && follows && parts.length ? (
        <Banner
          title={B.headcountTitle}
          actions={
            <Button size="sm" variant="secondary" onClick={() => void seen()}>
              {B.headcountSeen}
            </Button>
          }
        >
          {parts.join(' · ')}
          {change.cost ? (
            <>
              {' · '}
              {B.headcountCost.split('{cost}')[0]}
              <Money value={change.cost} />
              {B.headcountCost.split('{cost}')[1]}
            </>
          ) : null}
        </Banner>
      ) : null}
    </>
  );
}

/**
 * The frame of every planning screen: the title and its one-line explanation, the tools' navigation,
 * the planning settings, what changed since the host last looked, the "all changes saved" line, and
 * (on a phone) the quick-add button.
 */
export function PlanFrame({
  tool,
  title,
  description,
  help,
  actions,
  hideBanners = false,
  children,
}: {
  tool: PlanTool;
  title: string;
  description: string;
  /** the screen's own "?" (its AreaHelp) */
  help?: ReactNode;
  /** the screen's one main action, in the header */
  actions?: ReactNode;
  hideBanners?: boolean;
  children: ReactNode;
}) {
  const { t } = useUi();
  const plan = usePlan();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const planned = !!plan.view.settings;
  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-28 sm:px-6 sm:pb-16">
      <PageHeader
        size="section"
        title={title}
        description={description}
        help={help}
        actions={
          <>
            {actions}
            {planned ? (
              <Button
                variant="secondary"
                icon={<Settings />}
                onClick={() => setSettingsOpen(true)}
                aria-haspopup="dialog"
              >
                {t.planning.settings.open}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mt-4 flex flex-col gap-4">
        {planned ? <PlanNav tool={tool} id={plan.id} /> : null}
        {planned ? <SaveLine /> : null}
        {planned && !hideBanners ? <Banners /> : null}
        {planned ? children : <Onboarding />}
      </div>
      {planned ? <PlanSettings open={settingsOpen} onOpenChange={setSettingsOpen} /> : null}
      {planned ? <QuickAdd /> : null}
    </div>
  );
}

/** The help button of a tool: its own dictionary's items with icons. */
export function ToolHelp({
  title,
  items,
}: {
  title: string;
  items: { icon: ReactNode; label: string; text: string }[];
}) {
  const { t } = useUi();
  return <AreaHelp label={t.common.helpLabel} title={title} items={items} />;
}
