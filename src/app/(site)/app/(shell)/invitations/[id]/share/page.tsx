import { PencilLine, Send } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, EmptyState } from '@/components/app';
import { ShareScreen } from '@/features/invitations/app/share/ShareScreen';
import { publishHref } from '@/features/invitations/app/workspace/paths';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { shareData } from '@/features/invitations/server/share';
import { getTemplate } from '@/features/invitations/templates/registry';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { requestBaseUrl } from '@/lib/request-url';
import { getSessionUser, requireUser } from '@/lib/supabase/session';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, { t, locale }, user] = await Promise.all([params, getUi(), getSessionUser()]);
  const inv = user ? await hostDb.get(id, user.id) : null;
  if (!inv) return { title: t.errorPages.notFound.metaTitle };
  const l = inv.draft.locales.includes(locale) ? locale : inv.draft.defaultLocale;
  return {
    title: fmt(t.share.metaTitle, { name: hostsLine(inv.draft.hosts, l) || t.eventTypes[inv.eventType] }),
  };
}

/**
 * /app/invitations/[id]/share — link, message, WhatsApp preview and QR of a published invitation (the
 * invitation's header and tabs come from its workspace layout).
 */
export default async function SharePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/app/invitations/${id}/share`);
  const inv = await hostDb.get(id, user.id);
  const entry = inv && getTemplate(inv.templateId);
  if (!inv || !entry) notFound();
  // the address the host sees and sends (the site's own domain, not a placeholder)
  const [data, { t }] = await Promise.all([shareData(inv, entry, await requestBaseUrl()), getUi()]);
  if (!data) {
    return (
      <EmptyState
        className="py-20"
        titleAs="h1"
        illustration={<ShareArt />}
        title={t.share.notPublishedTitle}
        description={t.share.notPublishedBody}
        action={
          <>
            <Button icon={<Send className="icon-dir" />} asChild>
              <Link href={publishHref(id)}>{t.share.toPublish}</Link>
            </Button>
            <Button variant="secondary" icon={<PencilLine />} asChild>
              <Link href={`/app/invitations/${id}/edit`}>{t.share.toEditor}</Link>
            </Button>
          </>
        }
      />
    );
  }
  return <ShareScreen id={inv.id} slug={inv.slug} data={data} />;
}

/** Empty-state illustration: a paper plane on its way (decorative). */
function ShareArt() {
  return (
    <svg viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="44" fill="#F6EDE1" />
      <path
        d="M26 58 92 32 76 90 58 70 26 58Z"
        fill="#fff"
        stroke="#A0703F"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M58 70 92 32 50 64" stroke="#A0703F" strokeWidth="2" strokeLinejoin="round" />
      <path d="M58 70v14l8-9" stroke="#A0703F" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M20 86c8-2 14-6 18-12"
        stroke="#EAD8C0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 5"
      />
    </svg>
  );
}
