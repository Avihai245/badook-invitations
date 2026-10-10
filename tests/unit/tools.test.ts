import { describe, expect, it, vi } from 'vitest';
import { cleanTools, eventTools, readTools } from '@/features/invitations/lib/tools';
import { setEventTools } from '@/features/invitations/server/tools-api';
import { stageItems, stageOf, type WorkspaceCaps } from '@/features/invitations/app/workspace/stages';

const ID = '11111111-1111-4111-8111-111111111111';
const caps = (tools: WorkspaceCaps['tools']): WorkspaceCaps => ({
  planning: true,
  seating: 'on',
  eventDay: 'on',
  gallery: true,
  insights: true,
  tools,
});

describe('the event’s tools', () => {
  it('reads only known tools, in order; nothing chosen is null', () => {
    expect(readTools(['day', 'invite', 'x'])).toEqual(['invite', 'day']);
    expect(readTools([])).toBeNull();
    expect(readTools('invite')).toBeNull();
    expect(cleanTools([])).toEqual(['invite']);
  });

  it('an event from before the choice keeps what it used; planning only once it was set up', () => {
    expect([...eventTools(null, { planned: false })]).toEqual(['invite', 'seating', 'day']);
    expect(eventTools(null, { planned: true }).has('plan')).toBe(true);
    expect([...eventTools(['plan'], { planned: false })]).toEqual(['plan']);
  });

  it('the sidebar shows only the chosen tools’ stages', () => {
    expect(stageItems('plan', caps(['invite']))).toEqual([]);
    expect(stageItems('invite', caps(['invite']))).toEqual(['design', 'guests', 'share', 'responses']);
    // seating without the invitation: the guest list sits with the seating
    expect(stageItems('arrange', caps(['seating']))).toEqual(['guests', 'seating']);
    expect(stageOf('guests', caps(['seating']))).toBe('arrange');
    expect(stageOf('guests', caps(['invite', 'seating']))).toBe('invite');
  });

  it('PUT stores a clean list for the host’s own event only', async () => {
    const set = vi.fn(async (_id: string, owner: string, tools: string[]) =>
      owner === 'me' ? { tools } : null,
    );
    expect(await setEventTools('me', ID, { tools: ['plan', 'invite', 'plan'] }, { set })).toEqual({
      status: 200,
      body: { ok: true, tools: ['invite', 'plan'] },
    });
    expect((await setEventTools('other', ID, { tools: ['plan'] }, { set })).status).toBe(404);
    expect((await setEventTools('me', ID, { tools: ['nope'] }, { set })).status).toBe(400);
    expect((await setEventTools('me', 'not-a-uuid', { tools: [] }, { set })).status).toBe(404);
  });
});
