import 'server-only';
import { cache } from 'react';
import { featuresFor } from '@/features/flags/server';
import type { Locale } from '@/features/invitations/contracts/types';
import type { PublishedInvitation } from '@/features/invitations/server/published';
import { serviceDb } from '@/lib/supabase/server';
import { voiceRenderOptions } from './deps';
import { pageTracks, voiceItems, type VoiceTrack } from './voice';

/**
 * The guest's "listen" for a published invitation (feature `voice`): each language's words and its
 * audio when it was made from these very words. null: the event doesn't have the feature (nothing
 * shows). Once per request — cached with the page (ISR), refreshed when new audio is made.
 */
export const voiceForPage = cache(
  async (invitation: PublishedInvitation): Promise<Partial<Record<Locale, VoiceTrack>> | null> => {
    try {
      if (!(await featuresFor(invitation.id)).has('voice')) return null;
      const options = voiceRenderOptions();
      const items = voiceItems(invitation.doc, invitation.entry.manifest, options);
      if (!items.length) return null;
      const { data, error } = await serviceDb().rpc('voice_tracks', { p_slug: invitation.slug });
      if (error) throw new Error(`voice_tracks: ${error.message}`);
      const uploads = options.bases.uploads;
      return pageTracks(items, (data ?? []) as { locale: string; hash: string; path: string }[], (path) =>
        uploads ? `${uploads}/${path}` : null,
      );
    } catch (err) {
      console.error('[voice] the page’s tracks are unavailable', err instanceof Error ? err.message : err);
      return null;
    }
  },
);
