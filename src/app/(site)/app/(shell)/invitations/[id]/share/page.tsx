import { PencilLine } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, EmptyState } from '@/components/app';
import { InvitationNav } from '@/features/invitations/app/InvitationNav';
import { ShareScreen } from '@/features/invitations/app/share/ShareScreen';
import { formatEventDate } from '@/features/invitations/lib/dates';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { shareData } from '@/features/invitations/server/share';
import { getTemplate } from '@/features/invitations/templates/registry';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.list.menu.share };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return {
    title: fmt(t.share.metaTitle, { name: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType] }),
  };
}

/** /app/invitations/[id]/share — link, message, WhatsApp preview and QR of a published invitation. */
export default async function SharePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/share`);
  const inv = await hostDb.get(id, user.id);
  const entry = inv && getTemplate(inv.templateId);
  if (!inv || !entry) notFound();
  const [data, { t, locale }] = await Promise.all([shareData(inv, entry), getUi()]);
  const doc = inv.published ?? inv.draft;
  const l = doc.locales.includes(locale) ? locale : doc.defaultLocale;
  const nav = (
    <InvitationNav
      id={inv.id}
      title={hostsLine(doc.hosts, l) || t.eventTypes[inv.eventType]}
      dateLine={formatEventDate(doc, l)}
      published={inv.status === 'published'}
      current="share"
    />
  );
  if (!data) {
    return (
      <>
        {nav}
        <EmptyState
          className="py-24"
          titleAs="h1"
          title={t.share.notPublishedTitle}
          description={t.share.notPublishedBody}
          action={
            <Button icon={<PencilLine />} asChild>
              <Link href={`/app/invitations/${id}/edit`}>{t.share.toEditor}</Link>
            </Button>
          }
        />
      </>
    );
  }
  return (
    <>
      {nav}
      <ShareScreen id={inv.id} slug={inv.slug} data={data} />
    </>
  );
}
