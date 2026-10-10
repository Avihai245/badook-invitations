import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MessagesScreen } from '@/features/invitations/app/messages/MessagesScreen';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { loadGuestsPage } from '@/features/invitations/server/guests';
import { loadHub } from '@/features/whatsapp/hub';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.waMessages.title };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return {
    title: fmt(t.waMessages.metaTitle, {
      name: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType],
    }),
  };
}

/**
 * /app/invitations/[id]/guests/whatsapp — the guests' WhatsApp messages: send now, or smart
 * scheduling (?tab=smart); and what was sent. The same guest list, credits and templates as the
 * guests page.
 */
export default async function GuestsWhatsAppPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/app/invitations/${id}/guests/whatsapp`);
  const { locale } = await getUi();
  const [data, hub] = await Promise.all([
    loadGuestsPage(id, user, locale, await requestBaseUrl()),
    loadHub(id, user.id),
  ]);
  if (!data || !hub) notFound();
  return <MessagesScreen data={data} hub={hub} tab={query.tab === 'smart' ? 'smart' : 'manual'} />;
}
