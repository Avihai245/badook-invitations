import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES } from '@/features/flags/features';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { seedDocument } from '@/features/invitations/templates/seed-document';
import { isTimeZone, localExists, localMoment, localParts, zoneCity } from '@/features/scheduler/time';
import type { ScheduledSend } from '@/features/scheduler/types';

// The clock's scheduling (features/scheduler): a date and a time on the clock become a moment only
// with their time zone (New York's 15:00 is 19:00 UTC in summer, 20:00 in winter — never Israel's
// 15:00), a time the clocks skip is refused; the host's API checks the zone, the time, the feature and
// the template; the clock's turn sends to the guests the send is for and keeps how it went.

vi.mock('server-only', () => ({}));
const api = await import('@/features/scheduler/server/api');
const run = await import('@/features/scheduler/server/run');
const email = await import('@/features/scheduler/server/email');
const alerts = await import('@/features/scheduler/server/whatsapp');

const { manifest, defaults } = TEMPLATES.get('sahar-bordeaux')!;
const doc = seedDocument(manifest, defaults, {
  eventType: 'wedding',
  locales: ['he', 'en'],
  defaultLocale: 'he',
  hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
  date: '2027-06-17',
  startTime: '19:30',
  endTime: '01:00',
  timezone: 'Asia/Jerusalem',
});

describe('a date and a time in a time zone', () => {
  it('is the moment it means there, daylight saving included', () => {
    expect(localMoment('2027-06-17', '15:00', 'America/New_York').toISOString()).toBe(
      '2027-06-17T19:00:00.000Z',
    );
    expect(localMoment('2027-01-10', '15:00', 'America/New_York').toISOString()).toBe(
      '2027-01-10T20:00:00.000Z',
    );
    expect(localMoment('2027-06-17', '15:00', 'Asia/Jerusalem').toISOString()).toBe(
      '2027-06-17T12:00:00.000Z',
    );
    expect(localMoment('2027-01-10', '15:00', 'Asia/Jerusalem').toISOString()).toBe(
      '2027-01-10T13:00:00.000Z',
    );
    expect(localMoment('2027-06-17', '15:00', 'America/Los_Angeles').toISOString()).toBe(
      '2027-06-17T22:00:00.000Z',
    );
  });

  it('read back on each clock', () => {
    const at = new Date('2027-06-17T19:00:00Z');
    expect(localParts(at, 'America/New_York')).toEqual({ date: '2027-06-17', time: '15:00' });
    expect(localParts(at, 'Asia/Jerusalem')).toEqual({ date: '2027-06-17', time: '22:00' });
    expect(localParts(at, 'Asia/Tokyo')).toEqual({ date: '2027-06-18', time: '04:00' });
  });

  it('a time the clocks skip doesn’t exist; an unknown zone isn’t one', () => {
    // New York moves to summer time on 14 March 2027 at 02:00
    expect(localExists('2027-03-14', '02:30', 'America/New_York')).toBe(false);
    expect(localExists('2027-03-14', '03:30', 'America/New_York')).toBe(true);
    // Israel on 26 March 2027 at 02:00
    expect(localExists('2027-03-26', '02:15', 'Asia/Jerusalem')).toBe(false);
    expect(localExists('2027-02-30', '10:00', 'Asia/Jerusalem')).toBe(false);
    expect(localExists('2027-06-17', '24:00', 'Asia/Jerusalem')).toBe(false);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
    expect(isTimeZone('Europe/Paris')).toBe(true);
    expect(zoneCity('America/New_York')).toBe('New York');
  });
});

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const nextYear = new Date().getUTCFullYear() + 1;

function deps(ready = true) {
  return {
    db: {
      list: vi.fn(async () => ({ timeZone: 'America/New_York', sends: [] })),
      set: vi.fn(async (_id: string, _owner: string, s: Record<string, unknown>) => ({
        ok: true as const,
        send: { ...s, id: 's1', status: 'scheduled' } as unknown as ScheduledSend,
      })),
      cancel: vi.fn(async () => true),
    },
    featureInput: vi.fn(async () => ({
      ownerId: OWNER,
      plan: 'business' as const,
      admin: false,
      overrides: NO_OVERRIDES,
      available: new Set(FEATURES),
    })),
    ready: vi.fn(() => ready),
  };
}

describe('the host schedules a send', () => {
  const body = {
    kind: 'album_thanks',
    date: `${nextYear}-06-17`,
    time: '15:00',
    timeZone: 'America/New_York',
  };

  it('keeps the date, the time and the zone as picked (the database works the moment out)', async () => {
    const d = deps();
    const res = await api.setSchedule(OWNER, INV, body, d);
    expect(res.status).toBe(200);
    expect(d.db.set).toHaveBeenCalledWith(INV, OWNER, { ...body, audience: 'unsent' });
  });

  it('refuses a zone that isn’t one, a time the clocks skip, a template not approved, another’s event', async () => {
    expect((await api.setSchedule(OWNER, INV, { ...body, timeZone: 'Mars/Olympus' }, deps())).body.code).toBe(
      'time_zone',
    );
    expect(
      (await api.setSchedule(OWNER, INV, { ...body, date: `${nextYear}-03-14`, time: '02:30' }, deps())).body
        .code,
    ).toBe(nextYear === 2027 ? 'no_such_time' : expect.any(String));
    expect((await api.setSchedule(OWNER, INV, body, deps(false))).status).toBe(503);
    expect((await api.setSchedule('someone-else', INV, body, deps())).status).toBe(404);
    expect((await api.setSchedule(OWNER, INV, { ...body, time: '3pm' }, deps())).status).toBe(400);
  });

  it('the database’s answer: past, too far, running', async () => {
    for (const [code, status] of [
      ['past', 422],
      ['too_far', 422],
      ['running', 409],
    ] as const) {
      const d = deps();
      d.db.set.mockResolvedValueOnce({ ok: false, code } as never);
      const res = await api.setSchedule(OWNER, INV, body, d);
      expect([res.status, res.body.code]).toEqual([status, code]);
    }
  });

  it('the view starts in the event’s time zone; taking a send back', async () => {
    const res = await api.getSchedule(OWNER, INV, deps());
    expect(res.body).toMatchObject({
      timeZone: 'America/New_York',
      sends: [],
      ready: { album_thanks: true },
    });
    expect((await api.cancelSchedule(OWNER, INV, { kind: 'gallery_link' }, deps())).status).toBe(200);
    const none = deps();
    none.db.cancel.mockResolvedValueOnce(false);
    expect((await api.cancelSchedule(OWNER, INV, { kind: 'gallery_link' }, none)).body.code).toBe('none');
  });
});

describe('the clock’s turn', () => {
  const send = (over: Partial<ScheduledSend> = {}): ScheduledSend => ({
    id: 's1',
    invitationId: INV,
    ownerId: OWNER,
    kind: 'album_thanks',
    date: '2027-06-17',
    time: '15:00',
    timeZone: 'America/New_York',
    runAt: '2027-06-17T19:00:00Z',
    audience: 'unsent',
    status: 'running',
    attempts: 1,
    result: null,
    error: null,
    createdAt: '2027-06-01T00:00:00Z',
    finishedAt: null,
    ...over,
  });
  const rows = [
    { guestId: 'a', reach: 'ok', queued: false, last: null },
    { guestId: 'b', reach: 'ok', queued: false, last: { status: 'delivered' } },
    { guestId: 'c', reach: 'ok', queued: false, last: { status: 'failed' } },
    { guestId: 'd', reach: 'ok', queued: true, last: null },
    { guestId: 'e', reach: 'landline', queued: false, last: null },
  ] as const;

  it('to whom: who hasn’t got it (or failed) — or everyone it reaches; never twice at once', () => {
    expect(run.recipients(rows, 'unsent')).toEqual(['a', 'c']);
    expect(run.recipients(rows, 'all')).toEqual(['a', 'b', 'c']);
  });

  function runDeps(sendRes: { status: number; body: Record<string, unknown> }) {
    const runner = {
      state: vi.fn(async (): Promise<{ status: number; body: Record<string, unknown> }> => ({
        status: 200,
        body: { ok: true, rows },
      })),
      send: vi.fn(async () => sendRes),
    };
    return {
      runner,
      deps: {
        db: { claim: vi.fn(async () => [send()]), finish: vi.fn(async () => true) },
        runners: { album_thanks: runner, gallery_link: runner },
      },
    };
  }

  it('sends as the owner would, keeps how it went', async () => {
    const { runner, deps } = runDeps({
      status: 200,
      body: { ok: true, queued: 2, sent: 2, failed: 0, pending: 0 },
    });
    expect(await run.processScheduledSends(deps)).toEqual({ ran: 1, done: 1, failed: 0 });
    expect(runner.send).toHaveBeenCalledWith(OWNER, INV, { action: 'send', guestIds: ['a', 'c'] });
    expect(deps.db.finish).toHaveBeenCalledWith(
      's1',
      'done',
      { queued: 2, sent: 2, failed: 0, pending: 0 },
      null,
    );
  });

  it('not enough credits by then: failed, with what was needed', async () => {
    const { deps } = runDeps({ status: 402, body: { ok: false, code: 'credits', needed: 2, balance: 0 } });
    expect(await run.processScheduledSends(deps)).toEqual({ ran: 1, done: 0, failed: 1 });
    expect(deps.db.finish).toHaveBeenCalledWith('s1', 'failed', { needed: 2, balance: 0 }, 'credits');
  });

  it('the album turned off by then: failed with why; a run that throws is left for the next turn', async () => {
    const { runner, deps } = runDeps({ status: 200, body: {} });
    runner.state.mockResolvedValueOnce({ status: 409, body: { ok: false, code: 'no_album' } });
    await run.processScheduledSends(deps);
    expect(deps.db.finish).toHaveBeenCalledWith('s1', 'failed', null, 'no_album');
    deps.db.finish.mockClear();
    runner.state.mockRejectedValueOnce(new Error('network'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await run.processScheduledSends(deps)).toEqual({ ran: 1, done: 0, failed: 0 });
    expect(deps.db.finish).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('a scheduled send that didn’t go out: the host’s email', () => {
  const failed = {
    kind: 'album_thanks' as const,
    runAt: '2027-06-18T19:00:00Z',
    timeZone: 'America/New_York',
    error: 'credits',
    result: { needed: 40, balance: 3 },
  };
  const urls = {
    sendUrl: 'https://x.test/app/invitations/i/gallery',
    billingUrl: 'https://x.test/app/billing',
  };

  it('what, when on the clock picked (the zone named), why, and what to do', () => {
    const e = email.failedEmail({ send: failed, doc, ...urls, brand: 'Badook' });
    expect(e.subject).toBe('השליחה המתוזמנת לא יצאה — נועה & איתי');
    expect(e.text).toContain('התודה עם האלבום');
    // 15:00 New York time — not Israel's 22:00
    expect(e.text).toContain('15:00');
    expect(e.text).not.toContain('22:00');
    expect(e.text).toContain('New York');
    expect(e.text).toContain('היה צריך 40, היו 3');
    expect(e.text).toContain('https://x.test/app/billing');
    expect(e.html).toContain(urls.sendUrl);
    // another reason: no billing link
    const off = email.failedEmail({
      send: { ...failed, error: 'no_album', result: null },
      doc,
      ...urls,
      brand: 'B',
    });
    expect(off.text).toContain('האלבום היה כבוי');
    expect(off.text).not.toContain('billing');
    // an English host
    const en = email.failedEmail({
      send: failed,
      doc: { ...doc, defaultLocale: 'en', locales: ['en'] },
      ...urls,
      brand: 'B',
    });
    expect(en.subject).toBe('Noa & Itay — your scheduled send didn’t go out');
    expect(en.text).toContain('15:00');
  });

  it('once each: marked after it went; one that couldn’t go is tried again; nobody to write to is marked', async () => {
    const row = (id: string, ownerEmail: string | null) => ({
      ...failed,
      id,
      invitationId: 'i',
      ownerId: OWNER,
      date: '2027-06-18',
      time: '15:00',
      audience: 'unsent' as const,
      status: 'failed' as const,
      attempts: 1,
      createdAt: '',
      finishedAt: '',
      ownerEmail,
      slug: 'noa-and-itay',
      document: doc,
    });
    const deps = {
      db: {
        failures: vi.fn(async () => [
          row('a', 'host@example.com'),
          row('b', 'down@example.com'),
          row('c', null),
        ]),
        failureMailed: vi.fn(async (_id: string) => true),
      },
      send: vi.fn(async (m: { to: string }) => m.to !== 'down@example.com'),
      base: 'https://x.test',
      brand: 'Badook',
    };
    expect(await email.mailFailedSends(deps)).toEqual({ mailed: 1 });
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.db.failureMailed.mock.calls.map(([id]) => id)).toEqual(['a', 'c']);
  });
});

describe('a scheduled send that didn’t go out: the host’s WhatsApp message', () => {
  const he = { locale: 'he' as const, code: 'he' };
  const en = { locale: 'en' as const, code: 'en_US' };
  const alert = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    invitationId: INV,
    ownerId: OWNER,
    kind: 'album_thanks' as const,
    date: '2027-06-18',
    time: '15:00',
    timeZone: 'America/New_York',
    runAt: '2027-06-18T19:00:00Z',
    audience: 'unsent' as const,
    status: 'failed' as const,
    attempts: 1,
    result: { needed: 40, balance: 3 },
    error: 'credits',
    createdAt: '',
    finishedAt: '',
    ownerPhone: '+972501234567',
    reach: 'ok' as const,
    document: doc,
    ...over,
  });

  it('the template’s three values — what, when on the clock picked (the zone named), why — and the button', () => {
    expect(alerts.alertMessage(alert('a'), 'badook_host_alert', he)).toEqual({
      to: '+972501234567',
      template: 'badook_host_alert',
      lang: 'he',
      body: [
        'התודה עם האלבום',
        expect.stringMatching(/15:00.*\(לפי שעון New York\)$/),
        'לא היו מספיק קרדיטים (היה צריך 40, היו 3)',
      ],
      button: `${INV}/gallery?view=extras`,
      ref: 'alert:a',
    });
    const english = alerts.alertMessage(alert('a'), 'badook_host_alert', en)!;
    expect(english.lang).toBe('en_US');
    expect(english.body[0]).toBe('The thank-you with the album');
    expect(english.body[1]).toMatch(/15:00 \(New York time\)$/);
  });

  function deps(
    answers: Record<string, { ok: true; id: string } | { ok: false; error: string; retryable: boolean }>,
  ) {
    const sent: { to: string; lang: string }[] = [];
    return {
      sent,
      d: {
        db: {
          failureAlerts: vi.fn(async () => [
            alert('ok'),
            alert('nophone', { ownerPhone: null, reach: 'none' }),
            alert('optout', { reach: 'opted_out' }),
            alert('busy', { ownerPhone: '+972500000009' }),
            alert('bad', { ownerPhone: '+972500000000' }),
          ]),
          failureAlerted: vi.fn(async (_id: string, _o: string) => true),
        },
        template: 'badook_host_alert',
        languages: () => [he, en],
        send: vi.fn(async (m: { to: string; lang: string }) => {
          sent.push(m);
          return answers[`${m.to}:${m.lang}`] ?? { ok: true as const, id: 'wamid.1' };
        }),
      },
    };
  }

  it('once each: sent; nobody to write to skipped; busy tried again next turn; refused recorded', async () => {
    const { d } = deps({
      '+972500000009:he': { ok: false, error: '130429 · rate', retryable: true },
      '+972500000000:he': { ok: false, error: '131026 · not a WhatsApp user', retryable: false },
    });
    expect(await alerts.alertFailedSends(d)).toEqual({ sent: 1, skipped: 2, failed: 1 });
    expect(d.db.failureAlerted.mock.calls).toEqual([
      ['ok', 'sent'],
      ['nophone', 'skipped'],
      ['optout', 'skipped'],
      ['bad', 'failed'],
    ]);
  });

  it('the host’s language first; when Meta has no template in it, the next; no template set up: nothing', async () => {
    const { d, sent } = deps({
      '+972501234567:he': { ok: false, error: '132001 · no such template', retryable: false },
    });
    d.db.failureAlerts.mockResolvedValueOnce([alert('a')]);
    expect(await alerts.alertFailedSends(d)).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(sent.map((m) => m.lang)).toEqual(['he', 'en_US']);
    const off = deps({});
    off.d.template = '';
    expect(await alerts.alertFailedSends(off.d)).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(off.d.db.failureAlerts).not.toHaveBeenCalled();
  });
});
