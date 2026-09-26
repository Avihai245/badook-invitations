import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import { featureState, insightsView, isResult } from '@/features/insights/server/api';
import { reportDeps } from '@/features/insights/server/deps';
import { InsightsScreen } from '@/features/insights/ui/InsightsScreen';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
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
    title: fmt(t.insights.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/insights — how guests use the invitation (feature analytics): visits, the
 * funnel to the RSVP, time on the page, languages, sources, devices, per day, the personal links and
 * the gallery. Switched off by the host → a way to switch it back on; not offered here → 404 (the tab
 * isn't shown either).
 */
export default async function InsightsPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/insights`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const input = await featureInput(id);
  if (!input || input.ownerId !== user.id) notFound();
  const why = whyOff('analytics', input);
  if (why === 'unavailable') notFound();
  if (why) {
    const f = featureState(input);
    return <InsightsScreen initial={{ id, view: null, off: { why, package: f.package, plan: f.plan } }} />;
  }
  const view = await insightsView(user.id, id, { range: 30 }, reportDeps());
  if (!view || isResult(view)) notFound();
  return <InsightsScreen initial={{ id, view, off: null }} />;
}
