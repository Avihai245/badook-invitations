import type { Metadata } from 'next';
import { loadAccount } from '@/features/billing/server/account';
import { InvitationsList, type CardBudget } from '@/features/invitations/app/list/InvitationsList';
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
 * Each active event's budget for its card's tiny gauge: the events with planning and a total budget (a
 * few at most per host; a failure only leaves a card without its gauge).
 */
async function cardBudgets(ownerId: string, items: InvitationSummary[]): Promise<Record<string, CardBudget>> {
  const active = items.filter((i) => i.status !== 'archived' && i.eventType !== 'save_the_date').slice(0, 12);
  const rows = await Promise.all(
    active.map(async (item) => {
      const input = await featureInput(item.id).catch(() => null);
      if (!input || whyOff('planning', input) !== null) return null;
      const o = await planningOverview(ownerId, item.id, {
        eventType: item.eventType,
        status: item.status,
        unpublishedChanges: item.unpublishedChanges,
        guests: item.guests,
        sent: item.sent,
        responses: item.responses,
      }).catch(() => null);
      const totals = o?.raw.totals;
      if (!totals || !totals.totalBudget) return null;
      return [
        item.id,
        {
          total: totals.totalBudget,
          committed: totals.committed,
          paid: totals.paid,
          planned: totals.planned,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(rows.filter((r) => r !== null));
}

/** /app/invitations — the host's invitations (§9B.3-A). */
export default async function InvitationsPage() {
  const user = await requireUser('/app/invitations');
  const [items, account] = await Promise.all([ownerInvitations(user.id), loadAccount(user)]);
  const budgets = await cardBudgets(user.id, items);
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
