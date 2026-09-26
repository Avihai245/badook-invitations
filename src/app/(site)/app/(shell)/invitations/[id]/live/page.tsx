import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dayHostDeps } from '@/features/event-day/server/deps';
import { dayView } from '@/features/event-day/server/host-api';
import { EventDayOff } from '@/features/event-day/ui/EventDayOff';
import { LiveHall } from '@/features/event-day/ui/live/LiveHall';
import { packageFor, planForPackage, whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { planBaseUrl } from '@/features/seating/server';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.eventDay.title };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.eventDay.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/live — the event day (feature `checkin`): who arrived, the hall filling up
 * live, the entrance stations' link, re-seating with its history. Not in the owner's package → the
 * package that has it; switched off by the host → a way to switch it back on; not offered here → 404
 * (the tab isn't shown either).
 */
export default async function LivePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/live`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const [input, { t }] = await Promise.all([featureInput(id), getUi()]);
  if (!input || input.ownerId !== user.id) notFound();
  const why = whyOff('checkin', input);
  if (why === 'unavailable') notFound();
  if (why) {
    const pkg = packageFor('checkin');
    return (
      <EventDayOff id={id} reason={why} packageName={t.seating.packages[pkg]} plan={planForPackage(pkg)} />
    );
  }
  const view = await dayView(user.id, id, await requestBaseUrl(), dayHostDeps());
  if (!('hall' in view)) notFound();
  return <LiveHall initial={view} planBase={planBaseUrl()} />;
}
