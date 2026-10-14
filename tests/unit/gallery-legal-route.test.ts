import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, type Feature } from '@/features/flags/features';

// POST /api/gallery/acknowledge, the route itself: 404 while version 2 of the legal documents is not in
// force (the database is not touched), and the stored call — gallery_acknowledge with the invitation, the
// per-event hash of the uploader id and the rules version — when it is.

vi.mock('server-only', () => ({}));
vi.mock('@/lib/feature', () => ({ invitationsEnabled: () => true }));
const env = {
  INVITES_GALLERY_SECRET: 'unit-gallery-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
const legal = { active: true };
vi.mock('@/features/legal/context', () => ({ legalStatus: () => ({ active: legal.active }) }));
const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: null, error: null }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const UPLOADER = 'phone-uploader-0001';
const tokens = await import('@/features/live-gallery/server/tokens');
const upload = tokens.newLink('upload', INV);
vi.mock('@/features/live-gallery/server/deps', () => ({
  guestDeps: () => ({
    db: {
      byToken: async (hash: string) =>
        hash === upload.hash
          ? {
              gallery: {
                invitationId: INV,
                enabled: true,
                mode: 'instant',
                paused: false,
                opensAt: null,
                closesAt: null,
                accessCodeHash: null,
                accessCodeSalt: null,
                channel: 'c',
              },
              invitation: { id: INV, status: 'published' },
            }
          : null,
      rateHit: async () => true,
    },
    features: async () => new Set<Feature>(FEATURES),
    now: () => Date.parse('2026-09-26T18:00:00.000Z'),
  }),
}));

const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/gallery/acknowledge/route');
  const res = await POST(
    new Request('https://x.test/api/gallery/acknowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  legal.active = true;
  rpc.mockClear();
});

describe('POST /api/gallery/acknowledge (route)', () => {
  it('records the acknowledgement through gallery_acknowledge with the hashed uploader', async () => {
    const res = await post({ t: upload.token, uploader: UPLOADER, version: '2' });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('gallery_acknowledge', {
      p_invitation_id: INV,
      p_uploader_hash: tokens.uploaderHash(INV, UPLOADER),
      p_version: '2',
    });
  });

  it('is 404 {ok:false, code:not_found} while version 2 is not in force, and does not touch the database', async () => {
    legal.active = false;
    const res = await post({ t: upload.token, uploader: UPLOADER, version: '2' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, code: 'not_found' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('answers 400 to a malformed body and 415 to a form post', async () => {
    expect((await post({ t: upload.token, uploader: 'x', version: '2' })).status).toBe(400);
    const { POST } = await import('@/app/api/gallery/acknowledge/route');
    const res = await POST(
      new Request('https://x.test/api/gallery/acknowledge', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(415);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a database failure is a 500 the page ignores, not a stored acknowledgement', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await post({ t: upload.token, uploader: UPLOADER, version: '2' });
    spy.mockRestore();
    expect(res.status).toBe(500);
  });
});
