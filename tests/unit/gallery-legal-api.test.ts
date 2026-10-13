import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FEATURES, type Feature } from '@/features/flags/features';
import type { TokenLookup } from '@/features/live-gallery/server/db';
import type { GuestDeps } from '@/features/live-gallery/server/guest-api';
import { GALLERY_RULES_VERSION } from '@/features/legal/versions';

/**
 * POST /api/gallery/acknowledge (version 2 of the legal documents): 404 while version 2 is not in force,
 * validation, the link and its access code, rate limits, and what is stored — the per-event hash of the
 * device's id, nothing else. The database function itself: tests/db.
 */

vi.mock('server-only', () => ({}));
const env = {
  INVITES_GALLERY_SECRET: 'unit-gallery-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.test/',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'unit-anon-key',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));

const tokens = await import('@/features/live-gallery/server/tokens');
const guest = await import('@/features/live-gallery/server/guest-api');

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const UPLOADER = 'phone-uploader-0001';
const IP = '203.0.113.9';
const NOW = Date.parse('2026-09-26T18:00:00.000Z');

function world(
  opts: {
    active?: boolean;
    gallery?: Partial<TokenLookup['gallery']>;
    rate?: boolean;
    paused?: boolean;
  } = {},
) {
  const upload = tokens.newLink('upload', INV);
  const gallery: TokenLookup['gallery'] = {
    invitationId: INV,
    enabled: true,
    mode: 'instant',
    paused: opts.paused ?? false,
    opensAt: null,
    closesAt: null,
    hasCode: false,
    uploadTokenHash: upload.hash,
    uploadTokenNonce: upload.nonce,
    projectorTokenHash: '',
    projectorTokenNonce: '',
    channel: 'gallery-channel-unit',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    accessCodeHash: null,
    accessCodeSalt: null,
    ...opts.gallery,
  };
  const lookup: TokenLookup = {
    gallery,
    invitation: {
      id: INV,
      slug: 'noa-itay',
      status: 'published',
      eventType: 'wedding',
      templateId: 'classic',
      hosts: null,
      date: '2026-09-26',
      timezone: 'Asia/Jerusalem',
      locales: ['he', 'en'],
      defaultLocale: 'he',
      palette: null,
    },
  };
  const rateHit = vi.fn(async (_key: string) => opts.rate ?? true);
  const acknowledge = vi.fn(async (_inv: string, _hash: string, _version: string) => undefined);
  const deps = {
    db: {
      byToken: vi.fn(async (hash: string, kind: 'upload' | 'projector') =>
        kind === 'upload' && hash === gallery.uploadTokenHash ? lookup : null,
      ),
      rateHit,
    },
    features: vi.fn(async () => new Set<Feature>(FEATURES)),
    now: () => NOW,
    legalActive: () => opts.active ?? true,
    acknowledge,
  } as unknown as GuestDeps;
  return { deps, token: upload.token, acknowledge, rateHit, gallery };
}

const body = (token: string, over: Record<string, unknown> = {}) => ({
  t: token,
  uploader: UPLOADER,
  version: GALLERY_RULES_VERSION,
  ...over,
});

describe('POST /api/gallery/acknowledge', () => {
  it('stores the per-event hash of the device id and the rules version, nothing else', async () => {
    const w = world();
    const res = await guest.guestAcknowledge(body(w.token), IP, w.deps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(w.acknowledge).toHaveBeenCalledTimes(1);
    const [inv, hash, version] = w.acknowledge.mock.calls[0]!;
    expect(inv).toBe(INV);
    expect(version).toBe(GALLERY_RULES_VERSION);
    expect(hash).toBe(tokens.uploaderHash(INV, UPLOADER));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(UPLOADER);
    // not the plain hash of the id: the event's id is part of it, so a phone can't be followed between events
    expect(hash).not.toBe(createHash('sha256').update(UPLOADER).digest('hex'));
    expect(tokens.uploaderHash('another-event', UPLOADER)).not.toBe(hash);
  });

  it('is 404 while version 2 is not in force, and records nothing', async () => {
    const w = world({ active: false });
    const res = await guest.guestAcknowledge(body(w.token), IP, w.deps);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, code: 'not_found' });
    expect(w.acknowledge).not.toHaveBeenCalled();
    // nor does a deployment whose dependencies know nothing of it
    const bare = world();
    delete (bare.deps as { legalActive?: unknown }).legalActive;
    expect((await guest.guestAcknowledge(body(bare.token), IP, bare.deps)).status).toBe(404);
  });

  it('validates the request', async () => {
    const w = world();
    for (const bad of [
      body(w.token, { uploader: 'short' }),
      body(w.token, { uploader: 'has spaces and !! symbols' }),
      body(w.token, { version: '1' }),
      body(w.token, { version: 2 }),
      body(w.token, { extra: true }),
      { t: w.token, uploader: UPLOADER },
      {},
      null,
    ])
      expect((await guest.guestAcknowledge(bad, IP, w.deps)).status).toBe(400);
    expect(w.acknowledge).not.toHaveBeenCalled();
  });

  it('needs a link that opens a gallery', async () => {
    const w = world();
    expect((await guest.guestAcknowledge(body('short'), IP, w.deps)).status).toBe(404);
    expect((await guest.guestAcknowledge(body('A'.repeat(24)), IP, w.deps)).status).toBe(404);
    expect(w.acknowledge).not.toHaveBeenCalled();
  });

  it('asks for the access code when the hosts set one', async () => {
    const salt = tokens.randomId();
    const w = world({ gallery: { accessCodeHash: tokens.codeHash('AB-12', salt), accessCodeSalt: salt } });
    expect((await guest.guestAcknowledge(body(w.token), IP, w.deps)).status).toBe(401);
    expect((await guest.guestAcknowledge(body(w.token, { code: 'nope' }), IP, w.deps)).status).toBe(401);
    expect(w.acknowledge).not.toHaveBeenCalled();
    expect((await guest.guestAcknowledge(body(w.token, { code: 'ab 12' }), IP, w.deps)).status).toBe(200);
    expect(w.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('is rate limited per address and per device, with hashed keys', async () => {
    const w = world({ rate: false });
    const res = await guest.guestAcknowledge(body(w.token), IP, w.deps);
    expect(res.status).toBe(429);
    expect(w.acknowledge).not.toHaveBeenCalled();
    const keys = w.rateHit.mock.calls.map((c) => c[0]);
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain(IP);
    }
  });

  it('a filled honeypot answers ok and stores nothing', async () => {
    const w = world();
    const res = await guest.guestAcknowledge(body(w.token, { website: 'http://spam.test' }), IP, w.deps);
    expect(res.status).toBe(200);
    expect(w.acknowledge).not.toHaveBeenCalled();
  });
});
