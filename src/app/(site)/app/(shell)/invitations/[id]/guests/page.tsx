import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuestsScreen } from '@/features/invitations/app/guests/GuestsScreen';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { loadGuestsPage } from '@/features/invitations/server/guests';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.guests.title };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return {
    title: fmt(t.guests.metaTitle, { name: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType] }),
  };
}

/** /app/invitations/[id]/guests — the guest list: import, personal links, WhatsApp, statuses. */
export default async function GuestsPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/guests`);
  const { locale } = await getUi();
  const data = await loadGuestsPage(id, user, locale);
  if (!data) notFound();
  return <GuestsScreen data={data} />;
}
