import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResponsesDashboard } from '@/features/invitations/app/responses/ResponsesDashboard';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { loadDashboard } from '@/features/invitations/server/responses';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.errorPages.notFound.metaTitle };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return {
    title: fmt(t.responses.metaTitle, { name: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType] }),
  };
}

/** /app/invitations/[id]/responses — the RSVP dashboard (§9B.3-G). Refreshes itself while open. */
export default async function ResponsesPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/responses`);
  const { locale } = await getUi();
  const data = await loadDashboard(id, user.id, locale);
  if (!data) notFound();
  return <ResponsesDashboard data={data} />;
}
