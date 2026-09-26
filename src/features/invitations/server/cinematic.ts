import 'server-only';
import { cache } from 'react';
import { deploymentFeatures, featuresFor } from '@/features/flags/server';
import type { InvitationDocument, TemplateManifest } from '../contracts/types';
import { usesCinematic } from '../renderer/cinematic/presentation';

/**
 * Whether an event shows the v2 presentation — sections' media, layouts, motion and colors, the
 * cinematic openings (feature `cinematic`, features/flags). Without it the invitation renders plain.
 * When the event's features can't be read (a database hiccup), what this deployment offers decides:
 * the invitation still renders, in the look it most likely has.
 */
export async function cinematicFor(invitationId: string): Promise<boolean> {
  try {
    return (await featuresFor(invitationId)).has('cinematic');
  } catch (err) {
    console.error('cinematic: the event’s features are unavailable', err);
    return deploymentFeatures().has('cinematic');
  }
}

/**
 * The same for a guest's page, asking only when the invitation has something the feature gates (its
 * sections' presentation, the host's opening or tokens, the template's opening): most invitations need
 * no query. Once per request — the page's layout (the host's tokens on <html>) and the page share it.
 */
export const cinematicForPage = cache(
  async (
    invitationId: string,
    doc: InvitationDocument,
    template: Pick<TemplateManifest, 'cover'>,
  ): Promise<boolean> => {
    if (!usesCinematic(doc) && !template.cover.opening) return false;
    return cinematicFor(invitationId);
  },
);
