import { describe, expect, it } from 'vitest';
import {
  CELEBRATE_OPENS_DAYS,
  navKeyOf,
  stageItems,
  stageOf,
  stageOpenByDefault,
  stageProgress,
  stageStatus,
  stageStatusSoFar,
  type StageFacts,
  type StageFactsSoFar,
} from '@/features/invitations/app/workspace/stages';

const ID = '11111111-1111-4111-8111-111111111111';
const at = (rest = '') => `/app/invitations/${ID}${rest}`;

describe('navKeyOf / stageOf — the event space grouped by stages (UX report §4.1)', () => {
  it('finds the most specific screen', () => {
    expect(navKeyOf(at(), ID)).toBe('home');
    expect(navKeyOf(at('/plan/budget'), ID)).toBe('budget');
    expect(navKeyOf(at('/plan'), ID)).toBe('tasks');
    expect(navKeyOf(at('/gallery/film'), ID)).toBe('film');
    expect(navKeyOf(at('/gallery'), ID)).toBe('gallery');
    expect(navKeyOf(at('/seating/cards'), ID)).toBe('seating');
    expect(navKeyOf('/app/invitations', ID)).toBeNull();
  });
  it('puts each screen in its stage', () => {
    expect(stageOf('budget')).toBe('plan');
    expect(stageOf('guests')).toBe('invite');
    expect(stageOf('seating')).toBe('arrange');
    expect(stageOf('film')).toBe('celebrate');
    expect(stageOf('home')).toBeNull();
    expect(stageOf('settings')).toBeNull();
  });
  it('leaves out what the event does not offer', () => {
    const caps = {
      planning: false,
      seating: null,
      eventDay: 'plan' as const,
      gallery: false,
      insights: false,
    };
    expect(stageItems('plan', caps)).toEqual([]);
    expect(stageItems('arrange', caps)).toEqual([]);
    expect(stageItems('celebrate', caps)).toEqual(['live']);
    expect(stageItems('invite', caps)).toEqual(['design', 'guests', 'share', 'responses']);
  });
});

describe('stageStatus', () => {
  const facts: StageFacts = {
    status: 'published',
    guests: 40,
    sent: 0,
    daysLeft: 58,
    plan: { open: 3 },
    seating: { tables: 0, unseated: 0 },
  };
  it('says what is open, what is done and when the day comes', () => {
    expect(stageStatus('plan', facts)).toEqual({ kind: 'open', n: 3 });
    expect(stageStatus('plan', { ...facts, plan: null })).toEqual({ kind: 'notStarted' });
    expect(stageStatus('invite', facts)).toEqual({ kind: 'toSend', n: 40 });
    expect(stageStatus('invite', { ...facts, sent: 40 })).toEqual({ kind: 'done' });
    expect(stageStatus('invite', { ...facts, status: 'draft' })).toEqual({ kind: 'draft' });
    expect(stageStatus('arrange', facts)).toEqual({ kind: 'notStarted' });
    expect(stageStatus('arrange', { ...facts, seating: { tables: 4, unseated: 2 } })).toEqual({
      kind: 'open',
      n: 2,
    });
    expect(stageStatus('celebrate', facts)).toEqual({ kind: 'startsIn', n: 58 });
    expect(stageStatus('celebrate', { ...facts, daysLeft: 0 })).toEqual({ kind: 'today' });
    expect(stageStatus('celebrate', { ...facts, daysLeft: -3 })).toEqual({ kind: 'done' });
  });
});

describe('the sidebar’s stages as steps that open and close', () => {
  const facts: StageFactsSoFar = {
    status: 'published',
    guests: 120,
    sent: 80,
    daysLeft: 57,
    plan: { open: 73 },
    seating: { tables: 12, unseated: 0 },
  };

  it('draws each step by its own state, not by the screen being looked at', () => {
    expect(stageProgress({ kind: 'done' })).toBe('done');
    for (const kind of ['open', 'toSend'] as const) expect(stageProgress({ kind, n: 3 })).toBe('active');
    expect(stageProgress({ kind: 'draft' })).toBe('active');
    expect(stageProgress({ kind: 'today' })).toBe('active');
    expect(stageProgress({ kind: 'notStarted' })).toBe('waiting');
    expect(stageProgress({ kind: 'startsIn', n: 57 })).toBe('waiting');
    expect(stageProgress(null)).toBe('waiting');
  });

  it('knows three stages before the visitor’s today does; "celebrate" waits for it', () => {
    const before = { ...facts, daysLeft: null };
    expect(stageStatusSoFar('plan', before)).toEqual({ kind: 'open', n: 73 });
    expect(stageStatusSoFar('invite', before)).toEqual({ kind: 'toSend', n: 40 });
    expect(stageStatusSoFar('arrange', before)).toEqual({ kind: 'done' });
    expect(stageStatusSoFar('celebrate', before)).toBeNull();
    expect(stageStatusSoFar('celebrate', facts)).toEqual({ kind: 'startsIn', n: 57 });
  });

  it('opens what has work left and the stage being looked at; a finished stage folds', () => {
    const open = (viewing: Parameters<typeof stageOpenByDefault>[2], f = facts) =>
      (['plan', 'invite', 'arrange', 'celebrate'] as const).filter((s) => stageOpenByDefault(s, f, viewing));
    // the reported sidebar: 73 open tasks, 40 to send, seating done, the day in 57 days
    expect(open('invite')).toEqual(['plan', 'invite']);
    // looking at a finished stage keeps it open
    expect(open('arrange')).toEqual(['plan', 'invite', 'arrange']);
    // a new event: nothing done yet, the day far away
    expect(
      open(null, {
        ...facts,
        status: 'draft',
        guests: 0,
        sent: 0,
        plan: null,
        seating: { tables: 0, unseated: 0 },
      }),
    ).toEqual(['plan', 'invite', 'arrange']);
  });

  it('opens "celebrate" a month before the event and keeps it open after, never before today is known', () => {
    const celebrate = (daysLeft: number | null) =>
      stageOpenByDefault('celebrate', { ...facts, daysLeft }, null);
    expect(celebrate(null)).toBe(false);
    expect(celebrate(CELEBRATE_OPENS_DAYS + 1)).toBe(false);
    expect(celebrate(CELEBRATE_OPENS_DAYS)).toBe(true);
    expect(celebrate(0)).toBe(true);
    // after the event: the gallery and the film
    expect(celebrate(-10)).toBe(true);
    expect(stageOpenByDefault('celebrate', { ...facts, daysLeft: null }, 'celebrate')).toBe(true);
  });
});
