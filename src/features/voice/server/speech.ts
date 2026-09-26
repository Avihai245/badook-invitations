import { createHash } from 'node:crypto';
import { VOICE, voiceLang } from '../config';

/**
 * The speech itself (feature `voice`): the hash that says whether a language's audio is current, the
 * SSML the service reads, and one request to Azure AI Speech's text-to-speech REST API. Nothing here
 * logs the text; errors say only what failed.
 */

/** A language's audio is current when it was made from this: the voice and the exact text. */
export const voiceHash = (voice: string, text: string): string =>
  createHash('sha256').update(`${voice}\n${text}`).digest('hex');

const xml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** The text as SSML: the voice, a slightly slower pace, a pause between paragraphs. */
export function ssml(text: string, voice: string): string {
  const lang = voiceLang(voice);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${xml(p)}</p>`)
    .join('<break time="450ms"/>');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${xml(voice)}"><prosody rate="${VOICE.rate}">${paragraphs}</prosody></voice></speak>`
  );
}

export interface SpeechConfig {
  key: string;
  region: string;
  /** another address (the tests' stand-in); '' → the region's */
  endpoint: string;
}

export type SpeechResult =
  | { ok: true; audio: Uint8Array }
  | { ok: false; error: string; /** worth trying again later */ retry: boolean };

/** The service is set up (a key and a region, or a stand-in's address). */
export const speechConfigured = (c: SpeechConfig) => !!c.key && (!!c.region || !!c.endpoint);

/** One text in one voice → MP3 bytes. */
export async function synthesize(
  text: string,
  voice: string,
  config: SpeechConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SpeechResult> {
  const base = config.endpoint || `https://${config.region}.tts.speech.microsoft.com`;
  let res: Response;
  try {
    res = await fetchImpl(`${base}/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': VOICE.outputFormat,
        'User-Agent': 'badook-invitations',
      },
      body: ssml(text, voice),
      signal: AbortSignal.timeout(VOICE.timeoutMs),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.name || 'request failed' : 'request failed',
      retry: true,
    };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    // 400: the SSML or the voice; 401/403: the key; 429 and 5xx: later
    return { ok: false, error: `speech ${res.status}`, retry: res.status === 429 || res.status >= 500 };
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  if (!audio.length) return { ok: false, error: 'speech: empty audio', retry: true };
  return { ok: true, audio };
}
