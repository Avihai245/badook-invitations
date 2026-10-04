import 'server-only';
import type { LiveBody } from '../renderer/live/payload';
import { cinematicForPage } from './cinematic';
import { pageExtras } from './page-extras';
import { getPublishedInvitation } from './published';
import { renderOptions } from './render-options';

/** Where a published invitation's live language switch fetches what renders its other languages. */
export const liveBodyPath = (slug: string) => `/i/${slug}/live.json`;

/**
 * What renders a published invitation in another language in the browser (the live switch,
 * renderer/live): the document, the template and the render options — exactly what the page renders its
 * own language with. Served as a cached file (app/(invitation)/i/[slug]/live.json) instead of riding in
 * every guest's page: it is the whole document in every language, only needed once a guest switches.
 * null: unknown, unpublished or archived.
 */
export async function liveBodyFor(slug: string): Promise<LiveBody | null> {
  const invitation = await getPublishedInvitation(slug);
  if (!invitation || invitation.doc.locales.length < 2) return null;
  const [cinematic, extras] = await Promise.all([
    cinematicForPage(invitation.id, invitation.doc, invitation.entry.manifest),
    pageExtras(invitation.id, invitation.doc),
  ]);
  return {
    doc: invitation.doc,
    template: invitation.entry.manifest,
    options: renderOptions(invitation, cinematic, extras),
  };
}
