import type { Metadata } from 'next';
import { loadAccount } from '@/features/billing/server/account';
import { redirect } from 'next/navigation';
import {
  InvitationsList,
  type CardBudget,
  type CardPlanning,
} from '@/features/invitations/app/list/InvitationsList';
import type { ToolKey } from '@/features/invitations/lib/tools';
import { toolsView } from '@/features/invitations/server/tools';
import { daysBetween, todayIn } from '@/features/planning/model/schedule';
import { dueWithin } from '@/features/planning/model/week';
import { DEFAULT_ZONE } from '@/features/planning/server/view';
import { whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import { planningOverview } from '@/features/planning/server/badge';
import { POSTER_FONT_CSS } from '@/features/invitations/app/poster-fonts';
import { ItemPoster } from '@/features/invitations/app/ItemPoster';
import { ownerInvitations } from '@/features/invitations/app/workspace/data';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';
import type { InvitationSummary } from '@/features/invitations/server/host-db';

/**
 * The host's first name in the screen's language: a name typed in English ("Avihai") greets a Hebrew
 * screen as the Hebrew one the host wrote on their own invitation ("אביחי"), when one of their
 * invitations has both — else as it is.
 */
function localFirstName(first: string, locale: 'he' | 'en', items: InvitationSummary[]): string {
  const key = first.toLowerCase();
  const other = locale === 'he' ? 'en' : 'he';
  const firstWord = (s: string | undefined) => s?.trim().split(/\s+/)[0] ?? '';
  for (const item of items)
    for (const person of [item.hosts.primary, item.hosts.secondary])
      if (person && firstWord(person[other]).toLowerCase() === key && firstWord(person[locale]))
        return firstWord(person[locale]);
  return first;
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.list.title };
}

/**
 * What each active event's card shows beyond its counts (a few events at most per host; a failure only
 * leaves a card plainer): the tools the host chose (invitations/lib/tools), the plan's numbers for the
 * card's path, and the budget for its tiny gauge — only for events that plan.
 */
async function cardFacts(ownerId: string, items: InvitationSummary[]) {
  const active = items.filter((i) => i.status !== 'archived').slice(0, 12);
  const rows = await Promise.all(
    active.map(async (item) => {
      const input = await featureInput(item.id).catch(() => null);
      const planningOn = !!input && item.eventType !== 'save_the_date' && whyOff('planning', input) === null;
      // a host who chose their tools without planning: no plan to read
      const wantsPlan = !input?.tools || input.tools.includes('plan');
      const o =
        planningOn && wantsPlan
          ? await planningOverview(ownerId, item.id, {
              eventType: item.eventType,
              status: item.status,
              unpublishedChanges: item.unpublishedChanges,
              guests: item.guests,
              sent: item.sent,
              responses: item.responses,
            }).catch(() => null)
          : null;
      const planned = !!o?.raw.settings;
      const totals = o?.raw.taskTotals;
      const planning: CardPlanning | null = o
        ? {
            planned,
            totalBudget: o.raw.totals?.totalBudget ?? null,
            week: planned ? dueWithin(o.tasks, o.today, 7).length : 0,
            open: totals ? Math.max(0, totals.total - totals.done - totals.skipped) : 0,
          }
        : null;
      const { tools } = toolsView(item, input, planned);
      const t = o?.raw.totals;
      const budget: CardBudget | null =
        tools.includes('plan') && t && t.totalBudget
          ? { total: t.totalBudget, committed: t.committed, paid: t.paid, planned: t.planned }
          : null;
      return { id: item.id, tools, planning, budget };
    }),
  );
  return {
    tools: Object.fromEntries(rows.map((r) => [r.id, r.tools])) as Record<string, ToolKey[]>,
    planning: Object.fromEntries(rows.map((r) => [r.id, r.planning])) as Record<string, CardPlanning | null>,
    budgets: Object.fromEntries(rows.flatMap((r) => (r.budget ? [[r.id, r.budget]] : []))) as Record<
      string,
      CardBudget
    >,
  };
}

/**
 * /app/invitations — the host's invitations (§9B.3-A). A host with exactly one event goes straight into
 * it (its home: the path, the next step) — the list is one tap away ("all events", `?all=1`).
 */
export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser('/app/invitations');
  const [items, account, query] = await Promise.all([
    ownerInvitations(user.id),
    loadAccount(user),
    searchParams,
  ]);
  const active = items.filter((i) => i.status !== 'archived');
  if (active.length === 1 && query.all === undefined)
    redirect(`/app/invitations/${active[0]!.id}?via=single`);
  const { tools, planning, budgets } = await cardFacts(user.id, items);
  // the days to each event as the server sees them (the cards move to the visitor's own day once known)
  const today = todayIn(DEFAULT_ZONE);
  const days = Object.fromEntries(items.map((i) => [i.id, daysBetween(today, i.date)]));
  // the greeting: the first name from the account, else from sign-up / Google
  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const full =
    account.fullName ??
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null);
  const first = full?.trim().split(/\s+/)[0] || null;
  const { locale, t } = await getUi();
  const name = first ? localFirstName(first, locale, items) : null;
  return (
    <>
      {/* the cards' posters write the names in their designs' fonts */}
      <style dangerouslySetInnerHTML={{ __html: POSTER_FONT_CSS }} />
      <InvitationsList
        items={items}
        name={name}
        budgets={budgets}
        tools={tools}
        planning={planning}
        days={days}
        posters={Object.fromEntries(
          items.map((item) => [
            item.id,
            // the invitation's own names and date on its design (the event type as the opening line)
            <ItemPoster
              key={item.id}
              item={item}
              uiLocale={locale}
              eyebrow={t.eventTypes[item.eventType]}
              fallbackName={t.eventTypes[item.eventType]}
              className="rounded-[14px]! transition-transform duration-300 group-hover/card:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/card:translate-y-0 sm:rounded-[16px]!"
            />,
          ]),
        )}
      />
    </>
  );
}
