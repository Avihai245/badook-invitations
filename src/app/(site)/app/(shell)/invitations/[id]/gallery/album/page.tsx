import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { albumHostView } from '@/features/album/server/api';
import { albumDeps } from '@/features/album/server/deps';
import { AlbumStudio } from '@/features/album/ui/AlbumStudio';
import { deploymentFeatures } from '@/features/flags/server';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { hostsLine } from '@/features/invitations/lib/text';
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
    title: fmt(t.album.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }),
  };
}

/**
 * /app/invitations/[id]/gallery/album — the album's studio (feature album), under the gallery tab: when
 * it opens, its words, its cover and the photos left out, its link and the thank-you to guests. Without
 * an album yet (no gallery, or the feature off) the gallery tab's card says why: back there. Not
 * offered by this deployment: a 404.
 */
export default async function AlbumStudioPage({ params }: { params: Params }) {
  const { id } = await params;
  const offered = deploymentFeatures();
  if (!offered.has('live_gallery') || !offered.has('album')) notFound();
  const user = await requireUser(`/app/invitations/${id}/gallery/album`);
  const view = await albumHostView(user.id, id, await requestBaseUrl(), albumDeps());
  if (!view) notFound();
  if (!view.album || !view.feature.on) redirect(`/app/invitations/${id}/gallery`);
  return <AlbumStudio initial={view} />;
}
