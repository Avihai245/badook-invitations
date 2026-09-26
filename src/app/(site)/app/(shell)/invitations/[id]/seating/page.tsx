import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { seatingDayInfo } from '@/features/event-day/server/pages';
import { packageFor, planForPackage, whyOff } from '@/features/flags/features';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
import { readState } from '@/features/seating/model';
import { planBaseUrl, seatingDeps } from '@/features/seating/server';
import { SeatingOff } from '@/features/seating/ui/SeatingOff';
import { SeatingScreen } from '@/features/seating/ui/SeatingScreen';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.seating.title };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.seating.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/seating — the seating editor (feature `seating`; the automatic seating is
 * `seating_auto`). Off for the event: switched off by the host → a way to switch it back on; not in the
 * owner's package → the package that has it; not offered here at all → 404 (the tab isn't shown either).
 */
export default async function SeatingPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/seating`);
  const [input, { t }] = await Promise.all([seatingDeps.access(id), getUi()]);
  if (!input || input.ownerId !== user.id) notFound();
  const names = (feature: 'seating' | 'seating_auto') => {
    const pkg = packageFor(feature);
    return { name: t.seating.packages[pkg], plan: t.seating.plans[planForPackage(pkg)] };
  };
  const why = whyOff('seating', input);
  if (why === 'unavailable') notFound();
  if (why) {
    const { name, plan } = names('seating');
    return <SeatingOff id={id} reason={why} packageName={name} planName={plan} />;
  }
  const [raw, day] = await Promise.all([seatingDeps.state(id, user.id), seatingDayInfo(user.id, id)]);
  if (!raw) notFound();
  const autoWhy = whyOff('seating_auto', input);
  return (
    <SeatingScreen
      id={id}
      initial={readState(raw)}
      auto={autoWhy === null ? 'on' : autoWhy === 'plan' ? 'plan' : 'off'}
      autoPackage={names('seating_auto')}
      planBase={planBaseUrl()}
      day={day}
    />
  );
}
