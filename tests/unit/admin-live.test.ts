import { beforeEach, describe, expect, it, vi } from 'vitest';

// The admin console's live hints (features/admin/server/live.ts): where they go, and what the server
// remembers of the console's channel.

vi.mock('server-only', () => ({}));
const peek = vi.fn<() => Promise<string | null>>();
vi.mock('@/features/admin/server/db', () => ({ adminDb: { channelPeek: () => peek() } }));
const sent = vi.fn<(channel: string, kind: string) => Promise<boolean>>(async () => true);
vi.mock('@/lib/live/broadcast', () => ({
  broadcastRefresh: (channel: string, kind: string) => sent(channel, kind),
  realtimeInfo: () => null,
}));

beforeEach(() => {
  vi.resetModules();
  peek.mockReset();
  sent.mockClear();
});

describe('the console’s live hints', () => {
  it('go nowhere until a console page made the channel — and “none” isn’t remembered', async () => {
    const { adminNudge } = await import('@/features/admin/server/live');
    peek.mockResolvedValueOnce(null);
    await adminNudge('user');
    expect(sent).not.toHaveBeenCalled();
    // a console page opened a moment later: the next hint finds the channel at once
    peek.mockResolvedValueOnce('chan-0123456789abcdef');
    await adminNudge('user');
    expect(sent).toHaveBeenCalledWith('chan-0123456789abcdef', 'user');
  });

  it('remember the channel for a while (one read, many hints)', async () => {
    const { adminNudge } = await import('@/features/admin/server/live');
    peek.mockResolvedValue('chan-0123456789abcdef');
    await adminNudge('invitation');
    await adminNudge('rsvp');
    await adminNudge('message');
    expect(peek).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls.map(([, kind]) => kind)).toEqual(['invitation', 'rsvp', 'message']);
  });

  it('never throw: a failed read is only logged', async () => {
    const { adminNudge } = await import('@/features/admin/server/live');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    peek.mockRejectedValueOnce(new Error('down'));
    await expect(adminNudge('payment')).resolves.toBeUndefined();
    expect(sent).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
