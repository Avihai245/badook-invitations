import 'server-only';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import type { InvitationDocument, Locale, TemplateManifest } from '@/features/invitations/contracts/types';
import { buildRenderContext, type RenderOptions } from '@/features/invitations/renderer/context';
import type { TemplateEntry } from '@/features/invitations/templates/registry';
import { VOICE, voiceFor, voiceLang } from '../config';
import { voiceText } from '../text';
import { voiceHash, type SpeechResult } from './speech';

/**
 * The invitation read aloud (feature `voice`): at a publish, what each language says (its text and
 * hash) is queued — a language whose words are the same keeps its audio — and made in the background
 * (after the publish answered, and on the app's own clock): read by the speech service, stored in the
 * host's folder, and the guest's page refreshed. Failures are tried again later, three times at most.
 * Plain functions over injected dependencies (tests/unit/voice.test.ts).
 */

export interface VoiceItem {
  locale: Locale;
  voice: string;
  text: string;
  hash: string;
}

/** Each language of a published document with a voice: what it says and its hash. */
export function voiceItems(
  doc: InvitationDocument,
  template: TemplateManifest,
  options: Omit<RenderOptions, 'mode'>,
): VoiceItem[] {
  return doc.locales.flatMap((locale) => {
    const voice = voiceFor(locale);
    if (!voice) return [];
    const text = voiceText(buildRenderContext(doc, template, locale, { ...options, mode: 'live' }));
    return text ? [{ locale, voice, text, hash: voiceHash(voice, text) }] : [];
  });
}

export interface VoiceDeps {
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
  /** the event's `voice` feature */
  enabled(invitationId: string): Promise<boolean>;
  /** null: the speech service isn't set up (the guests' devices read it themselves) */
  synthesize: ((text: string, voice: string) => Promise<SpeechResult>) | null;
  upload(path: string, audio: Uint8Array): Promise<void>;
  remove(paths: string[]): Promise<void>;
  template(id: string): TemplateEntry | undefined;
  options(): Omit<RenderOptions, 'mode'>;
  /** the guest's page shows the new audio */
  revalidate(slug: string): void;
}

interface Claimed {
  invitationId: string;
  locale: Locale;
  textHash: string;
  voice: string;
  attempts: number;
  ownerId: string;
  slug: string;
  document: unknown;
}

/** Where a language's audio is kept: the host's folder of invitation-media. */
export const voicePath = (ownerId: string, invitationId: string, locale: string, hash: string) =>
  `${ownerId}/${invitationId}/voice/${locale}-${hash.slice(0, 16)}.mp3`;

/** After a publish: queue what changed (never throws — a publish never waits on its voice). */
export async function queueVoice(
  invitationId: string,
  ownerId: string,
  doc: InvitationDocument,
  deps: VoiceDeps,
): Promise<{ queued: number } | null> {
  try {
    if (!(await deps.enabled(invitationId))) return null;
    const entry = deps.template(doc.templateId);
    if (!entry) return null;
    const items = voiceItems(doc, entry.manifest, deps.options());
    const res = await deps.rpc<{ queued: number; remove: string[] } | null>('voice_queue', {
      p_id: invitationId,
      p_owner: ownerId,
      p_items: items.map(({ locale, hash, voice }) => ({ locale, hash, voice })),
    });
    if (!res) return null;
    // a language the invitation no longer has: its audio goes
    if (res.remove.length) await deps.remove(res.remove).catch(() => undefined);
    return { queued: res.queued };
  } catch (err) {
    console.error('[voice] queue failed', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Makes what is queued (of one invitation, or any): up to `limit` languages. Without the speech
 * service nothing is made — the page's "listen" uses the guest's device then.
 */
export async function processVoice(
  invitationId: string | null,
  deps: VoiceDeps,
  limit: number = VOICE.perRun,
): Promise<{ made: number; failed: number }> {
  const done = { made: 0, failed: 0 };
  if (!deps.synthesize) return done;
  const claimed = await deps.rpc<Claimed[]>('voice_claim', { p_id: invitationId, p_limit: limit });
  for (const job of claimed ?? []) {
    const fail = (error: string, retry: boolean) =>
      deps.rpc('voice_failed', {
        p_id: job.invitationId,
        p_locale: job.locale,
        p_hash: job.textHash,
        p_error: error,
        // no more tries for what won't work (the key, the voice): three attempts are the most anyway
        p_wait_seconds: retry ? VOICE.retrySeconds * job.attempts : 7 * 86_400,
      });
    try {
      const parsed = safeMigrateDocument(job.document);
      const entry = parsed.success ? deps.template(parsed.data.templateId) : undefined;
      if (!parsed.success || !entry) {
        await fail('unreadable document', false);
        done.failed++;
        continue;
      }
      const item = voiceItems(parsed.data, entry.manifest, deps.options()).find(
        (i) => i.locale === job.locale,
      );
      if (!item || item.hash !== job.textHash || item.voice !== job.voice) {
        // the words (or how they're read) changed since it was queued: queue what they are now
        await deps.rpc('voice_queue', {
          p_id: job.invitationId,
          p_owner: job.ownerId,
          p_items: voiceItems(parsed.data, entry.manifest, deps.options()).map(({ locale, hash, voice }) => ({
            locale,
            hash,
            voice,
          })),
        });
        continue;
      }
      const spoken = await deps.synthesize(item.text, item.voice);
      if (!spoken.ok) {
        await fail(spoken.error, spoken.retry);
        done.failed++;
        continue;
      }
      const path = voicePath(job.ownerId, job.invitationId, job.locale, item.hash);
      await deps.upload(path, spoken.audio);
      const res = await deps.rpc<{ ok: boolean; old?: string | null }>('voice_done', {
        p_id: job.invitationId,
        p_locale: job.locale,
        p_hash: item.hash,
        p_path: path,
        p_bytes: spoken.audio.length,
      });
      if (!res.ok) {
        // the words changed meanwhile: this file isn't wanted
        await deps.remove([path]).catch(() => undefined);
        continue;
      }
      if (res.old) await deps.remove([res.old]).catch(() => undefined);
      deps.revalidate(job.slug);
      done.made++;
    } catch (err) {
      console.error('[voice] making the audio failed', err instanceof Error ? err.message : err);
      await fail('server error', true).catch(() => undefined);
      done.failed++;
    }
  }
  return done;
}

/** What the guest's page gets for one language: the audio (when current) and the words for the device. */
export interface VoiceTrack {
  /** the audio's address — null: none for these words yet (the device reads them, if it can) */
  src: string | null;
  text: string;
  /** BCP 47, for the device's voice */
  lang: string;
}

/** The guest's page: each language's track (the stored audio only when made from these very words). */
export function pageTracks(
  items: readonly VoiceItem[],
  stored: readonly { locale: string; hash: string; path: string }[],
  publicUrl: (path: string) => string | null,
): Partial<Record<Locale, VoiceTrack>> {
  const out: Partial<Record<Locale, VoiceTrack>> = {};
  for (const item of items) {
    const audio = stored.find((s) => s.locale === item.locale && s.hash === item.hash);
    out[item.locale] = {
      src: audio ? publicUrl(audio.path) : null,
      text: item.text,
      lang: voiceLang(item.voice),
    };
  }
  return out;
}
