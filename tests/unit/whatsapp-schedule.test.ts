import { describe, expect, it } from 'vitest';
import { MESSAGE_KINDS, MESSAGE_TEXT, renderMessage, type EventValues } from '@/features/whatsapp/catalog';
import { LOCALES } from '@/features/invitations/contracts/types';
import {
  defaultStages,
  estimateStage,
  followupDates,
  presetAllowed,
  PRESET_STAGES,
  stageInstant,
  validateSchedule,
  zonedParts,
  type EstimateGuest,
  type ScheduleContext,
  type StageDraft,
  type ValidateContext,
} from '@/features/whatsapp/schedule';

// Smart scheduling as plain math (features/whatsapp/schedule.ts) and the messages as guests see them
// (features/whatsapp/catalog.ts).

const ctx = (over: Partial<ScheduleContext> = {}): ScheduleContext => ({
  today: '2026-10-10',
  now: '10:00',
  eventDate: '2026-11-18',
  startTime: '19:30',
  rsvpDeadline: null,
  album: false,
  ...over,
});
const dates = (stages: StageDraft[]) => Object.fromEntries(stages.map((s) => [s.key, `${s.date} ${s.time}`]));

describe('the presets', () => {
  it('have 2, 4, 6 and 8 stages', () => {
    expect(PRESET_STAGES.basic).toHaveLength(2);
    expect(PRESET_STAGES.advanced).toHaveLength(4);
    expect(PRESET_STAGES.smart).toHaveLength(6);
    expect(PRESET_STAGES.premium).toHaveLength(8);
  });

  it('come with the plans: Smart from Pro, Premium from Business; admins have all', () => {
    expect(presetAllowed('basic', 'free')).toBe(true);
    expect(presetAllowed('advanced', 'free')).toBe(true);
    expect(presetAllowed('smart', 'free')).toBe(false);
    expect(presetAllowed('smart', 'pro')).toBe(true);
    expect(presetAllowed('premium', 'pro')).toBe(false);
    expect(presetAllowed('premium', 'business')).toBe(true);
    expect(presetAllowed('premium', 'free', true)).toBe(true);
  });
});

describe('the suggested dates', () => {
  it('Smart: tomorrow, +3, +7, five days before, the event’s morning, the day after', () => {
    const { stages, notes } = defaultStages('smart', ctx());
    expect(notes).toEqual([]);
    expect(dates(stages)).toEqual({
      invitation: '2026-10-11 11:00',
      followup1: '2026-10-14 11:00',
      followup2: '2026-10-18 11:00',
      followup3: '2026-11-13 11:00',
      event_reminder: '2026-11-18 10:00',
      thanks: '2026-11-19 12:00',
    });
    expect(stages.every((s) => s.enabled)).toBe(true);
    expect(stages.find((s) => s.key === 'followup1')).toMatchObject({
      message: 'reminder',
      audience: 'unanswered',
    });
    expect(stages.find((s) => s.key === 'event_reminder')).toMatchObject({ audience: 'attending' });
    expect(stages.find((s) => s.key === 'thanks')).toMatchObject({ message: 'thanks' });
  });

  it('the thank-you carries the album when there is one', () => {
    const { stages } = defaultStages('smart', ctx({ album: true }));
    expect(stages.find((s) => s.key === 'thanks')!.message).toBe('album');
  });

  it('squeezes the follow-ups in order when the event is close', () => {
    const { stages, notes } = defaultStages('smart', ctx({ eventDate: '2026-10-20' }));
    expect(notes).toEqual([{ code: 'compressed' }]);
    const f = stages.filter((s) => s.kind === 'followup').map((s) => s.date);
    expect(f).toEqual([...f].sort());
    expect(new Set(f).size).toBe(3);
    expect(f.every((d) => d > '2026-10-11' && d < '2026-10-20')).toBe(true);
  });

  it('turns follow-ups off when there are fewer days than follow-ups', () => {
    const { stages, notes } = defaultStages('smart', ctx({ eventDate: '2026-10-13' }));
    // invitation tomorrow (11th), the 12th is the only day before the event
    expect(notes).toContainEqual({ code: 'tooClose', disabled: 2 });
    expect(stages.filter((s) => s.kind === 'followup' && s.enabled)).toHaveLength(1);
  });

  it('sends the invitation today when the event is tomorrow, soon after now', () => {
    const { stages } = defaultStages('basic', ctx({ eventDate: '2026-10-11', now: '10:10' }));
    expect(stages[0]).toMatchObject({ date: '2026-10-10', time: '11:00' });
  });

  it('respects the RSVP deadline', () => {
    const { stages } = defaultStages('smart', ctx({ rsvpDeadline: '2026-11-01' }));
    const f3 = stages.find((s) => s.key === 'followup3')!;
    expect(f3.date <= '2026-10-31').toBe(true);
  });

  it('reminds the evening before an event that starts in the morning', () => {
    const { stages, notes } = defaultStages('basic', ctx({ startTime: '10:30' }));
    expect(notes).toContainEqual({ code: 'eveReminder' });
    expect(stages[1]).toMatchObject({ date: '2026-11-17', time: '19:00' });
  });

  it('after the event only the thank-you is left', () => {
    const { stages, notes } = defaultStages('smart', ctx({ eventDate: '2026-10-01' }));
    expect(notes).toContainEqual({ code: 'eventPast' });
    expect(stages.filter((s) => s.enabled).map((s) => s.key)).toEqual(['thanks']);
  });

  it('spreads evenly', () => {
    expect(followupDates('2026-10-11', '2026-10-17', 3, '2026-10-12')).toEqual({
      dates: ['2026-10-13', '2026-10-15', '2026-10-17'],
      enabled: 3,
      compressed: true,
    });
  });
});

describe('time zones', () => {
  it('a stage’s moment is its date and time in the event’s zone', () => {
    const at = stageInstant({ date: '2026-11-18', time: '10:00' }, 'Asia/Jerusalem');
    expect(new Date(at).toISOString()).toBe('2026-11-18T08:00:00.000Z');
    expect(zonedParts(at, 'Asia/Jerusalem')).toEqual({ date: '2026-11-18', time: '10:00', weekday: 3 });
    // summer time
    expect(
      new Date(stageInstant({ date: '2026-07-01', time: '10:00' }, 'Asia/Jerusalem')).toISOString(),
    ).toBe('2026-07-01T07:00:00.000Z');
  });
});

describe('validation', () => {
  const now = Date.parse('2026-10-10T07:00:00Z');
  const v = (over: Partial<ValidateContext> = {}): ValidateContext => ({
    now,
    timeZone: 'Asia/Jerusalem',
    eventStart: Date.parse('2026-11-18T17:30:00Z'),
    eventEnd: Date.parse('2026-11-18T22:00:00Z'),
    approved: ['invitation', 'reminder', 'event_reminder', 'thanks', 'album'],
    album: false,
    plan: 'pro',
    admin: false,
    published: true,
    configured: true,
    checkins: false,
    ...over,
  });

  it('the suggested Smart sequence is fine', () => {
    const { stages } = defaultStages('smart', ctx());
    expect(validateSchedule('smart', stages, v()).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('refuses what can’t be sent', () => {
    const { stages } = defaultStages('smart', ctx());
    const codes = (issues: ReturnType<typeof validateSchedule>) =>
      issues.map((i) => `${i.key ?? '*'}:${i.code}`);
    expect(codes(validateSchedule('smart', stages, v({ plan: 'free' })))).toContain('*:plan');
    expect(codes(validateSchedule('smart', stages, v({ approved: ['invitation'] })))).toEqual(
      expect.arrayContaining(['followup1:template', 'event_reminder:template', 'thanks:template']),
    );
    const moved = stages.map((s) =>
      s.key === 'followup1'
        ? { ...s, date: '2026-10-11', time: '09:00' }
        : s.key === 'event_reminder'
          ? { ...s, time: '20:00' }
          : s.key === 'thanks'
            ? { ...s, date: '2026-11-18', time: '21:00' }
            : s.key === 'invitation'
              ? { ...s, date: '2026-10-09' }
              : s,
    );
    expect(codes(validateSchedule('smart', moved, v()))).toEqual(
      expect.arrayContaining([
        'invitation:past',
        'event_reminder:reminderAfterStart',
        'thanks:thanksBeforeEnd',
      ]),
    );
    expect(
      codes(
        validateSchedule(
          'smart',
          moved.map((s) => ({ ...s, enabled: false })),
          v(),
        ),
      ),
    ).toContain('*:none');
    expect(codes(validateSchedule('smart', stages, v({ published: false, configured: false })))).toEqual(
      expect.arrayContaining(['*:notPublished', '*:notConfigured']),
    );
  });

  it('a follow-up can’t come before the invitation', () => {
    const { stages } = defaultStages('advanced', ctx());
    const early = stages.map((s) =>
      s.key === 'followup1' ? { ...s, date: '2026-10-11', time: '10:00' } : s,
    );
    expect(validateSchedule('advanced', early, v())).toContainEqual({
      level: 'error',
      code: 'beforeInvitation',
      key: 'followup1',
    });
  });

  it('the album falls back to the thank-you, or blocks without one', () => {
    const { stages } = defaultStages('smart', ctx({ album: true }));
    expect(validateSchedule('smart', stages, v())).toContainEqual({
      level: 'warning',
      code: 'albumFallback',
      key: 'thanks',
    });
    expect(
      validateSchedule(
        'smart',
        stages,
        v({ approved: ['invitation', 'reminder', 'event_reminder', 'album'] }),
      ),
    ).toContainEqual({ level: 'error', code: 'album', key: 'thanks' });
  });

  it('warns about the night and Shabbat; stages that ran are left alone', () => {
    const base = defaultStages('basic', ctx()).stages;
    // 2026-10-17 is a Saturday
    const night = base.map((s) => (s.key === 'invitation' ? { ...s, time: '23:00' } : s));
    expect(validateSchedule('basic', night, v())).toContainEqual({
      level: 'warning',
      code: 'night',
      key: 'invitation',
    });
    const shabbat = base.map((s) =>
      s.key === 'invitation' ? { ...s, date: '2026-10-17', time: '12:00' } : s,
    );
    expect(validateSchedule('basic', shabbat, v())).toContainEqual({
      level: 'warning',
      code: 'shabbat',
      key: 'invitation',
    });
    const ran = base.map((s) =>
      s.key === 'invitation' ? { ...s, date: '2026-10-01', status: 'done' as const } : s,
    );
    expect(validateSchedule('basic', ran, v()).filter((i) => i.key === 'invitation')).toEqual([]);
  });

  it('refuses a message or an audience a stage can’t have', () => {
    const base = defaultStages('basic', ctx()).stages;
    const wrong = base.map((s) =>
      s.key === 'invitation' ? { ...s, message: 'thanks' as const, audience: 'attending' as const } : s,
    );
    expect(validateSchedule('basic', wrong, v()).map((i) => i.code)).toEqual(
      expect.arrayContaining(['message', 'audience']),
    );
  });
});

describe('the estimate', () => {
  const g = (over: Partial<EstimateGuest>): EstimateGuest => ({
    reachable: true,
    received: false,
    answer: null,
    ...over,
  });
  const guests = [
    g({}),
    g({ received: true }),
    g({ received: true, answer: 'yes' }),
    g({ received: true, answer: 'no' }),
    g({ reachable: false }),
  ];
  const stage = (audience: StageDraft['audience']) => ({
    audience,
    enabled: true,
    status: 'scheduled' as const,
  });

  it('counts the reachable audience now, and the most it may become', () => {
    expect(estimateStage(stage('not_received'), guests, true)).toEqual({ now: 1, upTo: 1 });
    expect(estimateStage(stage('unanswered'), guests, true)).toEqual({ now: 1, upTo: 2 });
    expect(estimateStage(stage('unanswered'), guests, false)).toEqual({ now: 1, upTo: 1 });
    expect(estimateStage(stage('attending'), guests, true)).toEqual({ now: 1, upTo: 3 });
    expect(estimateStage(stage('all'), guests, true)).toEqual({ now: 4, upTo: 4 });
  });

  it('a stage that’s off or ran counts nothing', () => {
    expect(estimateStage({ audience: 'all', enabled: false }, guests, true)).toEqual({ now: 0, upTo: 0 });
    expect(estimateStage({ audience: 'all', enabled: true, status: 'done' }, guests, true)).toEqual({
      now: 0,
      upTo: 0,
    });
  });
});

describe('the messages', () => {
  const values: EventValues = {
    hosts: 'דנה & איתי',
    event: 'לחתונה',
    date: 'יום רביעי, 18 בנובמבר 2026',
    when: 'יום רביעי, 18 בנובמבר · 19:30 · גן האירועים',
    phrase: 'בחתונה שלנו',
  };

  it('every template has every language, with all its values used and no leftover placeholder', () => {
    for (const kind of MESSAGE_KINDS)
      for (const l of LOCALES) {
        const t = MESSAGE_TEXT[kind][l];
        expect(t.body.length).toBeGreaterThan(10);
        const rendered = renderMessage(kind, l, 'דניאל', values).body;
        expect(rendered).not.toMatch(/\{\{\d\}\}/);
        expect(rendered).toContain('דניאל');
      }
  });

  it('fills the follow-up, the reminder and the thank-you like guests will see them', () => {
    expect(renderMessage('reminder', 'he', 'דניאל', values).body).toContain(
      'דנה & איתי מזמינים אותך לחתונה ביום רביעי, 18 בנובמבר 2026',
    );
    const reminder = renderMessage('event_reminder', 'he', 'דניאל', values);
    expect(reminder.body).toContain('📅 יום רביעי, 18 בנובמבר · 19:30 · גן האירועים');
    expect(reminder.button).toBe('לפרטים ולניווט');
    const thanks = renderMessage('thanks', 'he', 'דניאל', values);
    expect(thanks.body).toContain('תודה שחגגתם איתנו בחתונה שלנו!');
    expect(thanks.button).toBeNull();
    expect(renderMessage('album', 'he', 'דניאל', values).link).toBe('album');
  });

  it('no template puts two values side by side (Meta refuses that)', () => {
    for (const kind of MESSAGE_KINDS)
      for (const l of LOCALES) expect(MESSAGE_TEXT[kind][l].body).not.toMatch(/\}\}\s*\{\{/);
  });
});
