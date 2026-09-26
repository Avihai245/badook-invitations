import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { loadSeating } from '@/features/seating/api';
import type { SeatingState } from '@/features/seating/model';
import { planBaseUrl, seatingDeps } from '@/features/seating/server';
import { SeatingPrint } from '@/features/seating/ui/SeatingPrint';
import { fmt, intlLocale } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.seating.title };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.seating.printMetaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/seating/print — the seating to print or save as a PDF: the map, the guests A→Z
 * with their table numbers, and the tables with who sits at each (no app chrome around it).
 */
export default async function SeatingPrintPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/seating/print`);
  const [loaded, item, { t, locale }] = await Promise.all([
    loadSeating(user.id, id, seatingDeps),
    ownerInvitation(user.id, id),
    getUi(),
  ]);
  if (loaded.status !== 200 || !item) notFound();
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${item.date}T12:00:00Z`));
  return (
    <SeatingPrint
      id={id}
      state={loaded.body.state as SeatingState}
      title={hostsLine(item.hosts, l) || t.eventTypes[item.eventType]}
      subtitle={when}
      planBase={planBaseUrl()}
    />
  );
}
