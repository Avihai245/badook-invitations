import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { qrPayload } from '@/features/event-day/codes';
import { eventDayDb } from '@/features/event-day/server/db';
import { qrSvg } from '@/features/event-day/server/deps';
import { checkinCode } from '@/features/event-day/server/tokens';
import { TableCards, type TableCard } from '@/features/event-day/ui/TableCards';
import { whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { fmt, intlLocale } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user && UUID.test(id) ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.eventDay.cards.title };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.eventDay.cardsMetaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/seating/cards — a card per seated family with its table number, to print
 * (feature `seating_guide`, like telling guests their table); with `checkin`, the family's entrance
 * code can go on each card (only families on the guest list have one).
 */
export default async function TableCardsPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/seating/cards`);
  if (!UUID.test(id)) notFound();
  const [input, item, state, { t, locale }] = await Promise.all([
    featureInput(id),
    ownerInvitation(user.id, id),
    eventDayDb.notices(id, user.id),
    getUi(),
  ]);
  if (!input || input.ownerId !== user.id || !item || !state || whyOff('seating_guide', input)) notFound();
  const codes = whyOff('checkin', input) === null;
  const cards: TableCard[] = await Promise.all(
    state.rows
      .filter((r) => r.table && r.status !== 'declined')
      .map(async (r) => ({
        unitId: r.unitId,
        name: r.name,
        seats: r.seats,
        table: { number: r.table!.number, label: r.table!.label },
        qr: codes && r.token ? await qrSvg(qrPayload(checkinCode(r.token))) : null,
      })),
  );
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${item.date}T12:00:00Z`));
  return (
    <TableCards
      id={id}
      title={hostsLine(item.hosts, l) || t.eventTypes[item.eventType]}
      subtitle={when}
      cards={cards}
      codes={codes}
    />
  );
}
