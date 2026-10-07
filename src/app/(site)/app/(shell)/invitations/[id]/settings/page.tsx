import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { EventSettingsScreen } from '@/features/invitations/app/workspace/EventSettings';
import { hostsLine } from '@/features/invitations/lib/text';
import { toolsView } from '@/features/invitations/server/tools';
import { planPageData } from '@/features/planning/server/page';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.errorPages.notFound.metaTitle };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.eventSettings.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/** /app/invitations/[id]/settings — the event's settings: details, its tools, planning, package, duplicate, archive. */
export default async function EventSettingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/settings`);
  const item = await ownerInvitation(user.id, id);
  if (!item) notFound();
  const input = await featureInput(id).catch(() => null);
  const planning = !!input && item.eventType !== 'save_the_date' && whyOff('planning', input) === null;
  const data = planning ? await planPageData(id, '') : null;
  const planned = !!data && !data.off && !!data.view.settings;
  const screen = (
    <EventSettingsScreen item={item} planning={planned} tools={toolsView(item, input, planned)} />
  );
  return data && !data.off ? (
    <PlanProvider id={id} initial={data.view}>
      {screen}
    </PlanProvider>
  ) : (
    screen
  );
}
