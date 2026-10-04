import 'server-only';
import { serverEnv } from '@/lib/env';
import { assetBasesFromEnv } from '../renderer/assets';
import type { RenderOptions } from '../renderer/context';
import type { PageExtras } from './page-extras';
import type { PublishedInvitation } from './published';

/**
 * How the public page renders an invitation, from the server's environment and what the event has
 * (its presentation, its live gallery, its insights beacon). The page and the live language switch's
 * data (live-body.ts) render with the same options — the other languages must look as the first one.
 */
export function renderOptions(
  invitation: PublishedInvitation,
  cinematic: boolean,
  extras?: PageExtras,
): Omit<RenderOptions, 'mode'> {
  const env = serverEnv();
  return {
    cinematic,
    // the event's live gallery (the gallery section's link) and its insights beacon
    liveGallery: extras?.liveGallery ?? null,
    insights: extras?.insights ?? false,
    followUp: invitation.followUp,
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    icsViaRoute: true,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
  };
}
