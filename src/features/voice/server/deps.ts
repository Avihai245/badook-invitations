import 'server-only';
import { revalidatePath } from 'next/cache';
import { featuresFor } from '@/features/flags/server';
import { LOCALES } from '@/features/invitations/contracts/types';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { speechConfigured, synthesize, type SpeechConfig } from './speech';
import type { VoiceDeps } from './voice';

const BUCKET = 'invitation-media';

export function speechConfig(): SpeechConfig {
  const env = serverEnv();
  return {
    key: env.INVITES_TTS_AZURE_KEY,
    region: env.INVITES_TTS_AZURE_REGION,
    endpoint: env.INVITES_TTS_AZURE_ENDPOINT,
  };
}

/** The render options the voice's text is read with (the guest's page uses the same). */
export function voiceRenderOptions() {
  const env = serverEnv();
  return {
    brand: env.INVITES_BRAND_NAME,
    publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
    bases: assetBasesFromEnv({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
    }),
  };
}

/** The real dependencies of the voice (tests pass their own). */
export function voiceDeps(): VoiceDeps {
  const speech = speechConfig();
  return {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await serviceDb().rpc(fn, args);
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data as T;
    },
    enabled: async (id) => (await featuresFor(id)).has('voice'),
    synthesize: speechConfigured(speech) ? (text, voice) => synthesize(text, voice, speech) : null,
    async upload(path, audio) {
      const { error } = await serviceDb()
        .storage.from(BUCKET)
        .upload(path, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' });
      if (error) throw new Error(`storage upload: ${error.message}`);
    },
    async remove(paths) {
      const { error } = await serviceDb().storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`storage remove: ${error.message}`);
    },
    template: getTemplate,
    options: voiceRenderOptions,
    revalidate(slug) {
      try {
        revalidatePath(`/i/${slug}`);
        for (const lang of [...LOCALES, 'default']) revalidatePath(`/i/${slug}/${lang}`);
      } catch {
        // not from here (a page's own render): the page refreshes itself within a minute (ISR)
      }
    },
  };
}
