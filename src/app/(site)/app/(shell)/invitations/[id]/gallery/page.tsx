import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { deploymentFeatures } from '@/features/flags/server';
import { hostsLine } from '@/features/invitations/lib/text';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostPage } from '@/features/live-gallery/server/pages';
import { GalleryScreen } from '@/features/live-gallery/ui/host/GalleryScreen';
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
    title: fmt(t.liveGallery.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/gallery — the live gallery of an invitation (feature live_gallery): its
 * links, settings, the venue screen, the review queue, every photo and video, download everything
 * (the invitation's header and tabs come from its workspace layout). Not offered by this deployment:
 * a 404, like the tab that isn't there.
 */
export default async function GalleryPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!deploymentFeatures().has('live_gallery')) notFound();
  const user = await requireUser(`/app/invitations/${id}/gallery`);
  const data = await hostPage(user.id, id, await requestBaseUrl());
  if (!data) notFound();
  return <GalleryScreen initial={data} />;
}
