import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { filmView } from '@/features/film/server/api';
import { filmDeps, filmFontCss } from '@/features/film/server/deps';
import { FilmStudio } from '@/features/film/ui/FilmStudio';
import { deploymentFeatures } from '@/features/flags/server';
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
  return { title: fmt(t.film.metaTitle, { name: hostsLine(item.hosts, l) || t.eventTypes[item.eventType] }) };
}

/**
 * /app/invitations/[id]/gallery/film — the highlights film studio (feature auto_reel), under the
 * gallery tab: the film is chosen, previewed and made in the host's browser, then downloaded or added
 * to the gallery. The cards' fonts (the invitation's) are inlined for the canvas. Not offered by this
 * deployment: a 404.
 */
export default async function FilmPage({ params }: { params: Params }) {
  const { id } = await params;
  const offered = deploymentFeatures();
  if (!offered.has('live_gallery') || !offered.has('auto_reel')) notFound();
  const user = await requireUser(`/app/invitations/${id}/gallery/film`);
  const view = await filmView(user.id, id, filmDeps());
  if (!view) notFound();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: filmFontCss(view.event.fonts) }} />
      <FilmStudio initial={view} />
    </>
  );
}
