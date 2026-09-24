import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuestsScreen } from '@/features/invitations/app/guests/GuestsScreen';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { loadGuestsPage } from '@/features/invitations/server/guests';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.guests.title };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return {
    title: fmt(t.guests.metaTitle, { name: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType] }),
  };
}

/**
 * /app/invitations/[id]/guests — the guest list: upload, personal links, WhatsApp, statuses.
 * ?import=1 opens the upload dialog, ?send=1 the WhatsApp one (links from the invitation's pages).
 */
export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/app/invitations/${id}/guests`);
  const { locale } = await getUi();
  const data = await loadGuestsPage(id, user, locale, await requestBaseUrl());
  if (!data) notFound();
  const open = query.import ? 'import' : query.send ? 'send' : null;
  // the invitation's header and tabs come from the workspace layout ([id]/layout.tsx)
  return <GuestsScreen data={data} open={open} />;
}
