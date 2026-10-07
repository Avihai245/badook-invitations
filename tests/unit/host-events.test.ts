import { describe, expect, it, vi } from 'vitest';
import { recordHostEvent } from '@/features/analytics/model';

const ID = '11111111-1111-4111-8111-111111111111';
const deps = () => ({
  owns: vi.fn(async (_u: string, id: string) => id === ID),
  insert: vi.fn(async () => undefined),
});
const open = { gpc: false, dnt: false };

describe('recordHostEvent — the host’s path, first party', () => {
  it('keeps a known step for the host', async () => {
    const d = deps();
    expect(
      await recordHostEvent(
        'u1',
        { name: 'step_click', invitationId: ID, props: { step: 'guests' } },
        open,
        d,
      ),
    ).toEqual({
      status: 204,
    });
    expect(d.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      invitation_id: ID,
      name: 'step_click',
      props: { step: 'guests' },
    });
  });
  it('drops it under Global Privacy Control / Do Not Track, and for another host’s event', async () => {
    const d = deps();
    await recordHostEvent('u1', { name: 'list_view' }, { gpc: true, dnt: false }, d);
    await recordHostEvent(
      'u1',
      { name: 'home_view', invitationId: '22222222-2222-4222-8222-222222222222' },
      open,
      d,
    );
    expect(d.insert).not.toHaveBeenCalled();
  });
  it('refuses unknown steps and odd props', async () => {
    const d = deps();
    expect((await recordHostEvent('u1', { name: 'hack' }, open, d)).status).toBe(400);
    expect(
      (await recordHostEvent('u1', { name: 'list_view', props: { 'Bad Key': 1 } }, open, d)).status,
    ).toBe(400);
    expect(d.insert).not.toHaveBeenCalled();
  });
});
