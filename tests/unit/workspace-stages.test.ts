import { describe, expect, it } from 'vitest';
import {
  navKeyOf,
  stageItems,
  stageOf,
  stageStatus,
  type StageFacts,
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
