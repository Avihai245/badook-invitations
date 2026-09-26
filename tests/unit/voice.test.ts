import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type FeatureInput } from '@/features/flags/features';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { getTemplate, requireTemplate } from '@/features/invitations/templates/registry';
import { VOICE, voiceFor, voiceLang } from '@/features/voice/config';
import { voiceText } from '@/features/voice/text';

/**
 * The invitation read aloud (Phase 5C, feature `voice`): what each language says (its text and hash —
 * the audio is made again only when they change), the SSML and the speech service's request, the
 * queue after a publish and the background run (made, stored, the page refreshed; retried; queued
 * again when the words changed), what the guest's page plays, and the host's view.
 */

vi.mock('server-only', () => ({}));
const { voiceHash, ssml, synthesize, speechConfigured } = await import('@/features/voice/server/speech');
const { voiceItems, queueVoice, processVoice, pageTracks, voicePath } =
  await import('@/features/voice/server/voice');
const { getVoice } = await import('@/features/voice/server/host-api');

const OPTIONS = {
  brand: 'Badook',
  publicBaseUrl: 'https://invites.test',
  bases: assetBasesFromEnv({ supabaseUrl: 'https://db.test' }),
};
const doc = () => structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
const template = (d: InvitationDocument) => requireTemplate(d.templateId).manifest;
const textOf = (d: InvitationDocument, locale: Locale) =>
  voiceText(buildRenderContext(d, template(d), locale, { ...OPTIONS, mode: 'live' }));

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';

describe('what the invitation says aloud', () => {
  it('the names, the date and time, the places and the host’s texts — in each language, in order', () => {
    const d = doc();
    const he = textOf(d, 'he');
    const en = textOf(d, 'en');
    expect(he).toContain(d.hosts.primary.he!);
    expect(en).toContain(d.hosts.primary.en!);
    const venues = d.sections.find((s) => s.type === 'venues');
    if (venues?.type === 'venues') expect(en).toContain(venues.data.items[0]!.name.en!);
    // the names come before the places
    expect(en.indexOf(d.hosts.primary.en!)).toBeLessThan(
      en.indexOf(venues?.type === 'venues' ? venues.data.items[0]!.name.en! : ''),
    );
    // paragraphs, no markup, nothing that changes with the clock
    expect(en).not.toMatch(/<|>/);
    expect(en.split('\n\n').length).toBeGreaterThan(3);
    expect(textOf(d, 'en')).toBe(en);
  });

  it('hidden sections stay silent; a long invitation is cut at a paragraph', () => {
    const d = doc();
    const story = d.sections.find((s) => s.type === 'text')!;
    if (story.type !== 'text') throw new Error('text');
    story.data.body = { he: 'משפט סודי מאוד', en: 'A very secret sentence' };
    expect(textOf(d, 'en')).toContain('A very secret sentence');
    story.enabled = false;
    expect(textOf(d, 'en')).not.toContain('A very secret sentence');
    story.enabled = true;
    story.data.body = { he: 'א '.repeat(3000), en: 'word '.repeat(3000) };
    const long = textOf(d, 'en');
    expect(long.length).toBeLessThanOrEqual(VOICE.maxChars);
    expect(long).not.toContain('word word');
  });

  it('a voice per language (Amharic too); the hash follows the words and the voice', () => {
    for (const l of ['he', 'en', 'ru', 'ar', 'fr', 'es', 'am']) expect(voiceFor(l)).toMatch(/Neural$/);
    expect(voiceFor('xx')).toBeNull();
    expect(voiceLang('am-ET-MekdesNeural')).toBe('am-ET');
    const h = voiceHash('he-IL-HilaNeural', 'שלום');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(voiceHash('he-IL-HilaNeural', 'שלום')).toBe(h);
    expect(voiceHash('he-IL-HilaNeural', 'שלום!')).not.toBe(h);
    expect(voiceHash('he-IL-AvriNeural', 'שלום')).not.toBe(h);
  });

  it('each language of the document with its voice, text and hash', () => {
    const d = doc();
    const items = voiceItems(d, template(d), OPTIONS);
    expect(items.map((i) => i.locale)).toEqual(d.locales);
    for (const i of items) {
      expect(i.voice).toBe(voiceFor(i.locale));
      expect(i.hash).toBe(voiceHash(i.voice, i.text));
    }
  });
});

describe('the speech service', () => {
  it('SSML: the language, the voice, a pause between paragraphs, the words escaped', () => {
    const out = ssml('Noa & Itay <3\n\nSee you "there"', 'en-US-JennyNeural');
    expect(out).toMatch(
      /^<speak version="1\.0" xmlns="http:\/\/www\.w3\.org\/2001\/10\/synthesis" xml:lang="en-US">/,
    );
    expect(out).toContain('<voice name="en-US-JennyNeural">');
    expect(out).toContain('<p>Noa &amp; Itay &lt;3</p><break time="450ms"/><p>See you &quot;there&quot;</p>');
  });

  it('one request: the key, SSML, the MP3 format — errors say whether to try again', async () => {
    const config = { key: 'k', region: 'westeurope', endpoint: '' };
    expect(speechConfigured(config)).toBe(true);
    expect(speechConfigured({ key: '', region: 'westeurope', endpoint: '' })).toBe(false);
    const fetchOk = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const ok = await synthesize('שלום', 'he-IL-HilaNeural', config, fetchOk as unknown as typeof fetch);
    expect(ok).toEqual({ ok: true, audio: new Uint8Array([1, 2, 3]) });
    const [url, init] = fetchOk.mock.calls[0]!;
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    const headers = init.headers as Record<string, string>;
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('k');
    expect(headers['Content-Type']).toBe('application/ssml+xml');
    expect(headers['X-Microsoft-OutputFormat']).toBe(VOICE.outputFormat);
    // a stand-in's address
    const standIn = vi.fn(async (_url: string) => new Response(new Uint8Array([9]), { status: 200 }));
    await synthesize(
      'x',
      'he-IL-HilaNeural',
      { ...config, endpoint: 'http://127.0.0.1:55041' },
      standIn as unknown as typeof fetch,
    );
    expect(standIn.mock.calls[0]![0]).toBe('http://127.0.0.1:55041/cognitiveservices/v1');
    const status = (s: number) =>
      vi.fn(async () => new Response(null, { status: s })) as unknown as typeof fetch;
    expect(await synthesize('x', 'v', config, status(401))).toMatchObject({ ok: false, retry: false });
    expect(await synthesize('x', 'v', config, status(429))).toMatchObject({ ok: false, retry: true });
    expect(await synthesize('x', 'v', config, status(503))).toMatchObject({ ok: false, retry: true });
    const thrown = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    expect(await synthesize('x', 'v', config, thrown)).toMatchObject({ ok: false, retry: true });
  });
});

// ─── the queue and the background run ────────────────────────────────────────────────────────────

function fakeDeps(
  over: { enabled?: boolean; claimed?: unknown[]; speech?: 'ok' | 'fail' | null; doneOk?: boolean } = {},
) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const uploads: string[] = [];
  const removed: string[][] = [];
  const revalidated: string[] = [];
  let claimed = over.claimed ?? [];
  const deps = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === 'voice_queue')
        return { queued: (args.p_items as unknown[]).length, remove: ['o/i/voice/fr-old.mp3'] };
      if (fn === 'voice_claim') {
        const out = claimed;
        claimed = [];
        return out;
      }
      if (fn === 'voice_done')
        return over.doneOk === false ? { ok: false } : { ok: true, old: 'o/i/voice/he-previous.mp3' };
      return null;
    }) as never,
    enabled: vi.fn(async () => over.enabled ?? true),
    synthesize:
      over.speech === null
        ? null
        : vi.fn(async () =>
            over.speech === 'fail'
              ? { ok: false as const, error: 'speech 503', retry: true }
              : { ok: true as const, audio: new Uint8Array([7, 7, 7]) },
          ),
    upload: vi.fn(async (path: string) => {
      uploads.push(path);
    }),
    remove: vi.fn(async (paths: string[]) => {
      removed.push(paths);
    }),
    template: getTemplate,
    options: () => OPTIONS,
    revalidate: vi.fn((slug: string) => {
      revalidated.push(slug);
    }),
  };
  return { deps, calls, uploads, removed, revalidated };
}

const job = (d: InvitationDocument, locale: Locale, over: Record<string, unknown> = {}) => {
  const item = voiceItems(d, template(d), OPTIONS).find((i) => i.locale === locale)!;
  return {
    invitationId: INV,
    locale,
    textHash: item.hash,
    voice: item.voice,
    attempts: 1,
    ownerId: OWNER,
    slug: 'noa-itay',
    document: d,
    ...over,
  };
};

describe('after a publish, and in the background', () => {
  it('queues each language’s hash (a language gone: its audio goes) — only with the feature', async () => {
    const d = doc();
    const f = fakeDeps();
    expect(await queueVoice(INV, OWNER, d, f.deps)).toEqual({ queued: 2 });
    const q = f.calls.find((c) => c.fn === 'voice_queue')!;
    expect(q.args).toMatchObject({ p_id: INV, p_owner: OWNER });
    expect(q.args.p_items).toEqual(
      voiceItems(d, template(d), OPTIONS).map(({ locale, hash, voice }) => ({ locale, hash, voice })),
    );
    // the text itself never goes to the database
    expect(JSON.stringify(q.args)).not.toContain(d.hosts.primary.en!);
    expect(f.removed).toEqual([['o/i/voice/fr-old.mp3']]);
    const off = fakeDeps({ enabled: false });
    expect(await queueVoice(INV, OWNER, d, off.deps)).toBeNull();
    expect(off.calls).toEqual([]);
  });

  it('makes what is claimed: read, stored in the host’s folder, marked done, the old file removed, the page refreshed', async () => {
    const d = doc();
    const f = fakeDeps({ claimed: [job(d, 'he')] });
    expect(await processVoice(INV, f.deps)).toEqual({ made: 1, failed: 0 });
    const item = voiceItems(d, template(d), OPTIONS).find((i) => i.locale === 'he')!;
    expect(f.deps.synthesize).toHaveBeenCalledWith(item.text, item.voice);
    const path = voicePath(OWNER, INV, 'he', item.hash);
    expect(path).toBe(`${OWNER}/${INV}/voice/he-${item.hash.slice(0, 16)}.mp3`);
    expect(f.uploads).toEqual([path]);
    expect(f.calls.find((c) => c.fn === 'voice_done')!.args).toEqual({
      p_id: INV,
      p_locale: 'he',
      p_hash: item.hash,
      p_path: path,
      p_bytes: 3,
    });
    expect(f.removed).toEqual([['o/i/voice/he-previous.mp3']]);
    expect(f.revalidated).toEqual(['noa-itay']);
  });

  it('a failure is tried again later; words changed since: queued again; not wanted any more: removed', async () => {
    const d = doc();
    const failing = fakeDeps({ claimed: [job(d, 'en', { attempts: 2 })], speech: 'fail' });
    expect(await processVoice(null, failing.deps)).toEqual({ made: 0, failed: 1 });
    expect(failing.calls.find((c) => c.fn === 'voice_failed')!.args).toMatchObject({
      p_locale: 'en',
      p_wait_seconds: VOICE.retrySeconds * 2,
    });
    const stale = fakeDeps({ claimed: [job(d, 'en', { textHash: 'f'.repeat(64) })] });
    expect(await processVoice(null, stale.deps)).toEqual({ made: 0, failed: 0 });
    expect(stale.deps.synthesize).not.toHaveBeenCalled();
    expect(stale.calls.map((c) => c.fn)).toEqual(['voice_claim', 'voice_queue']);
    const late = fakeDeps({ claimed: [job(d, 'en')], doneOk: false });
    await processVoice(null, late.deps);
    expect(late.removed).toEqual([[late.uploads[0]]]);
    expect(late.revalidated).toEqual([]);
  });

  it('without the speech service nothing is made (the guests’ devices read it)', async () => {
    const f = fakeDeps({ speech: null, claimed: [job(doc(), 'he')] });
    expect(await processVoice(null, f.deps)).toEqual({ made: 0, failed: 0 });
    expect(f.calls).toEqual([]);
  });
});

describe('the guest’s page and the host’s view', () => {
  it('plays the stored audio only when it was made from these very words', () => {
    const d = doc();
    const items = voiceItems(d, template(d), OPTIONS);
    const he = items.find((i) => i.locale === 'he')!;
    const tracks = pageTracks(
      items,
      [
        { locale: 'he', hash: he.hash, path: 'o/i/voice/he.mp3' },
        { locale: 'en', hash: 'a'.repeat(64), path: 'o/i/voice/en-old.mp3' },
      ],
      (path) => `https://db.test/storage/v1/object/public/invitation-media/${path}`,
    );
    expect(tracks.he).toEqual({
      src: 'https://db.test/storage/v1/object/public/invitation-media/o/i/voice/he.mp3',
      text: he.text,
      lang: 'he-IL',
    });
    // older words: the device reads the new ones
    expect(tracks.en?.src).toBeNull();
    expect(tracks.en?.lang).toBe('en-US');
  });

  it('the host sees each language’s state; refused without the feature', async () => {
    const input = (over: Partial<FeatureInput> = {}) => ({
      plan: 'pro' as const,
      admin: false,
      overrides: NO_OVERRIDES,
      available: new Set(FEATURES),
      ownerId: OWNER,
      ...over,
    });
    const state = vi.fn(async () => [
      { locale: 'he', status: 'ready' as const, ready: true, updatedAt: '2026-09-26T10:00:00Z' },
    ]);
    const ok = await getVoice(OWNER, INV, { featureInput: async () => input(), state, configured: true });
    expect(ok).toEqual({
      status: 200,
      body: { ok: true, on: true, configured: true, languages: await state() },
    });
    const switchedOff = await getVoice(OWNER, INV, {
      featureInput: async () => input({ overrides: { off: ['voice'], grant: [] } }),
      state,
      configured: false,
    });
    expect(switchedOff.body).toMatchObject({ ok: true, on: false, configured: false });
    const free = await getVoice(OWNER, INV, {
      featureInput: async () => input({ plan: 'free' }),
      state,
      configured: true,
    });
    expect(free).toMatchObject({ status: 403, body: { code: 'feature_off', feature: 'voice' } });
    expect(
      (await getVoice('someone-else', INV, { featureInput: async () => input(), state, configured: true }))
        .status,
    ).toBe(404);
  });
});
