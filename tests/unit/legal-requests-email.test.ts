import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The report and privacy-request notices are recorded as sent or not sent, shown to the team: an email
// that was never handed to a provider (not configured) must not count as sent (sendEmailStrict), and the
// log of a skipped one carries the kind, not the address.

vi.mock('server-only', () => ({}));
const env: Record<string, string> = { INVITES_EMAIL_API_KEY: '', INVITES_EMAIL_FROM: '' };
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));

const { sendEmail, sendEmailStrict } = await import('@/features/invitations/server/email');
const mail = {
  to: 'dana@example.com',
  subject: 'Secret subject',
  html: '<p>x</p>',
  text: 'x',
  kind: 'other' as const,
};
const logged = () => rpc.mock.calls.map((c) => c as unknown as [string, { p_status: string }]);

beforeEach(() => {
  rpc.mockClear();
  env.INVITES_EMAIL_API_KEY = '';
  env.INVITES_EMAIL_FROM = '';
});
afterEach(() => vi.unstubAllGlobals());

describe('sendEmailStrict', () => {
  it('not configured: false (the plain sendEmail keeps its true), logged as skipped without the address', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(await sendEmailStrict(mail)).toBe(false);
    expect(await sendEmail(mail)).toBe(true);
    expect(logged().map(([, a]) => a.p_status)).toEqual(['skipped', 'skipped']);
    const lines = info.mock.calls.flat().join('\n');
    expect(lines).not.toContain('dana@example.com');
    expect(lines).not.toContain('Secret subject');
    expect(lines).toContain('other');
    info.mockRestore();
  });

  it('configured: true only when the provider took it', async () => {
    env.INVITES_EMAIL_API_KEY = 'key';
    env.INVITES_EMAIL_FROM = 'Badook <no-reply@example.com>';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    expect(await sendEmailStrict(mail)).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sendEmailStrict(mail)).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('network'))),
    );
    expect(await sendEmailStrict(mail)).toBe(false);
    expect(logged().map(([, a]) => a.p_status)).toEqual(['sent', 'failed', 'failed']);
    err.mockRestore();
  });
});

describe('what the flows use', () => {
  it('the real dependencies send with the strict variant', async () => {
    vi.doMock('@/features/legal/status', () => ({ legalStatus: () => ({ active: true }) }));
    vi.doMock('@/features/legal/context', () => ({
      legalContext: () => ({ privacyEmail: 'p@example.com' }),
    }));
    vi.doMock('next/server', () => ({ after: () => undefined }));
    vi.doMock('@/lib/live/broadcast', () => ({ broadcastRefresh: async () => true }));
    vi.doMock('@/features/live-gallery/server/db', () => ({ galleryDb: {} }));
    vi.doMock('@/features/album/server/db', () => ({ albumDb: {} }));
    const { reportDeps } = await import('@/features/legal-requests/server/deps');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(await reportDeps().send({ to: 'x@example.com', subject: 's', html: 'h', text: 't' })).toBe(false);
    info.mockRestore();
  });
});
