import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InvitationOverview } from '@/features/invitations/app/overview/InvitationOverview';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { guestStats } from '@/features/invitations/lib/guest-status';
import { responseStats } from '@/features/invitations/lib/responses';
import { hostsLine } from '@/features/invitations/lib/text';
import { guestsDb } from '@/features/invitations/server/guests';
import { hostDb } from '@/features/invitations/server/host-db';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const item = user ? await ownerInvitation(user.id, id) : null;
  if (!item) return { title: t.errorPages.notFound.metaTitle };
  const l = item.locales.includes(locale) ? locale : item.defaultLocale;
  return {
    title: fmt(t.overview.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id] — the invitation's overview: its numbers, uploading the guest list and
 * sending on WhatsApp, the steps to a finished invitation and its link (the header and tabs come
 * from the layout).
 */
export default async function InvitationOverviewPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}`);
  const [item, guests, replies, publicBase] = await Promise.all([
    ownerInvitation(user.id, id),
    guestsDb.list(id, user.id),
    hostDb.responses(id, user.id),
    requestBaseUrl(),
  ]);
  if (!item || !replies) notFound();
  const base = publicBase.replace(/\/+$/, '');
  return (
    <InvitationOverview
      item={item}
      guests={guestStats(guests ?? [])}
      replies={responseStats(replies.responses, Date.now())}
      url={`${base}/i/${item.slug}`}
    />
  );
}
