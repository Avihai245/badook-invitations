import { beforeEach, describe, expect, it, vi } from 'vitest';

// "Report content / request removal" and the privacy request (features/legal-requests): the public flows
// over fake dependencies — validation, the item resolved from the gallery link, the limits, the duplicate,
// the notices (best effort, recorded, never claimed), what the visitor is told — and the gating: version 2
// of the legal documents not in force answers "not found".

vi.mock('server-only', () => ({}));
const env = {
  INVITES_PUBLIC_BASE_URL: 'https://invitations.example.com',
  INVITES_BRAND_NAME: 'Badook',
  INVITES_SUPPORT_EMAIL: 'team@example.com',
  INVITES_IP_HASH_SALT: 'unit-salt',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));
vi.mock('@/lib/feature', () => ({ invitationsEnabled: () => true }));
let active = true;
vi.mock('@/features/legal/context', () => ({
  legalStatus: () => ({ active, requested: active, missing: [], effective: '2026-11-01' }),
  legalContext: () => ({ privacyEmail: 'privacy@example.com', operator: {} }),
}));
vi.mock('@/features/legal/status', () => ({
  legalStatus: () => ({ active, requested: active, missing: [], effective: '2026-11-01' }),
}));
const sendEmail = vi.fn(async (_: unknown) => true);
vi.mock('@/features/invitations/server/email', () => ({ sendEmail }));
const jobs: (() => Promise<unknown>)[] = [];
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: (job: () => Promise<unknown>) => void jobs.push(job),
}));

const { AdminDbError } = await import('@/features/admin/server/db');
const { submitReport, resolveReportLink, checkReportLink, ReportSchema } =
  await import('@/features/legal-requests/server/report');
const { submitPrivacyRequest } = await import('@/features/legal-requests/server/privacy-request');
const { sha256Hex } = await import('@/features/live-gallery/server/tokens');
const { dictFor } = await import('@/lib/i18n/dict');

const INV: string = '11111111-1111-4111-8111-111111111111';
const OTHER_INV = '99999999-9999-4999-8999-999999999999';
const ITEM = '22222222-2222-4222-8222-222222222222';
const REPORT_ID = '33333333-3333-4333-8333-333333333333';
const GALLERY_TOKEN = 'abcdefghijklmnopqrstuvwx';
const ALBUM_TOKEN = 'ABCDEFGHIJKLMNOPQRSTUVWX';

const config = { teamEmail: 'privacy@example.com', brand: 'Badook', site: 'https://invitations.example.com' };

function makeDeps(over: Record<string, unknown> = {}) {
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  const later: (() => Promise<unknown>)[] = [];
  const db = {
    invitationOfGalleryLink: vi.fn(async (hash: string) => (hash === sha256Hex(GALLERY_TOKEN) ? INV : null)),
    invitationOfAlbumLink: vi.fn(async (hash: string) => (hash === sha256Hex(ALBUM_TOKEN) ? INV : null)),
    // only this event's published item is visible
    itemVisible: vi.fn(async (inv: string, item: string) => inv === INV && item === ITEM),
    submitReport: vi.fn(async (_: unknown) => ({
      id: REPORT_ID,
      number: 5001,
      urgent: false,
      hidden: false,
    })),
    markReportNotified: vi.fn(async (_id: string, _who: string, _ok: boolean) => null),
    countSince: vi.fn(async (_t: string, _h: string, _hours: number) => 0),
    earlierReport: vi.fn(
      async (..._: unknown[]) => null as null | { number: number; urgent: boolean; hidden: boolean },
    ),
    ownerEmail: vi.fn(async (_: string) => 'host@example.com' as string | null),
    submitRequest: vi.fn(async (_: unknown) => ({
      id: REPORT_ID,
      number: 7001,
      dueAt: '2026-11-12T10:00:00Z',
    })),
    markRequestNotified: vi.fn(async (_id: string, _who: string, _ok: boolean) => null),
  };
  const deps = {
    db,
    send: vi.fn(
      async (m: { to: string; subject: string; html: string; text: string }) => (sent.push(m), true),
    ),
    later: (job: () => Promise<unknown>) => void later.push(job),
    hashIp: (ip: string | null) => `hash:${ip ?? 'unknown'}`,
    refreshGallery: vi.fn(async (_: string) => undefined),
    config,
    ...over,
  };
  const flush = async () => {
    while (later.length) await later.shift()!();
  };
  return { deps, db, sent, flush };
}

const valid = {
  category: 'privacy',
  role: 'depicted',
  description: 'This photo shows my face and I did not agree.',
  g: GALLERY_TOKEN,
  i: ITEM,
  locale: 'he',
};
const reportOf = (extra: Record<string, unknown> = {}) => ({ ...valid, ...extra });

beforeEach(() => {
  active = true;
  jobs.length = 0;
  sendEmail.mockClear();
});

describe('the report form’s validation', () => {
  it('needs a category, a role and a description of 10 to 2000 characters, and refuses unknown fields', async () => {
    const { deps, db } = makeDeps();
    const bad = async (extra: Record<string, unknown>) =>
      (await submitReport(reportOf(extra), { ip: '1.1.1.1' }, deps)).body;
    expect(await bad({ description: 'too short' })).toMatchObject({
      ok: false,
      error: 'invalid',
      fields: ['description'],
    });
    expect(await bad({ description: 'x'.repeat(2001) })).toMatchObject({
      error: 'invalid',
      fields: ['description'],
    });
    expect(await bad({ category: 'gossip' })).toMatchObject({ error: 'invalid', fields: ['category'] });
    expect(await bad({ role: 'nobody' })).toMatchObject({ error: 'invalid', fields: ['role'] });
    expect(await bad({ email: 'not an email' })).toMatchObject({ error: 'invalid', fields: ['email'] });
    expect(await bad({ phone: 'abc' })).toMatchObject({ error: 'invalid', fields: ['phone'] });
    expect(await bad({ admin: true })).toMatchObject({ error: 'invalid' });
    expect(db.submitReport).not.toHaveBeenCalled();
  });

  it('a copyright claim needs the name and the email', async () => {
    const { deps, db } = makeDeps();
    const r = await submitReport(reportOf({ category: 'copyright' }), { ip: '1.1.1.1' }, deps);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: 'invalid', fields: ['name', 'email'] });
    const half = await submitReport(
      reportOf({ category: 'copyright', name: 'Dana' }),
      { ip: '1.1.1.1' },
      deps,
    );
    expect(half.body).toMatchObject({ fields: ['email'] });
    expect(db.submitReport).not.toHaveBeenCalled();
    const whole = await submitReport(
      reportOf({ category: 'copyright', name: 'Dana', email: 'dana@example.com' }),
      { ip: '1.1.1.1' },
      deps,
    );
    expect(whole.status).toBe(200);
    expect(db.submitReport).toHaveBeenCalledTimes(1);
  });

  it('contact details are optional for the other categories', async () => {
    expect(ReportSchema.safeParse(reportOf()).success).toBe(true);
  });

  it('drops what a bot filled in, quietly', async () => {
    const { deps, db } = makeDeps();
    const r = await submitReport(reportOf({ website: 'http://spam.example' }), { ip: '1.1.1.1' }, deps);
    expect(r).toMatchObject({ status: 200, body: { ok: true, number: null } });
    expect(db.submitReport).not.toHaveBeenCalled();
    expect(db.countSince).not.toHaveBeenCalled();
  });

  it('“intimate” counts only for the harmful category', async () => {
    const { deps, db } = makeDeps();
    await submitReport(reportOf({ category: 'privacy', intimate: true }), { ip: '1.1.1.1' }, deps);
    await submitReport(
      reportOf({ category: 'harmful', intimate: true, i: undefined, reference: 'the photo by Dana' }),
      { ip: '2.2.2.2' },
      deps,
    );
    const calls = db.submitReport.mock.calls.map(([p]) => p as { intimate: boolean });
    expect(calls.map((p) => p.intimate)).toEqual([false, true]);
  });
});

describe('the item, resolved from the link', () => {
  it('a valid upload link and one of its published items', async () => {
    const { deps, db } = makeDeps();
    const r = await submitReport(reportOf(), { ip: '1.1.1.1' }, deps);
    expect(r.status).toBe(200);
    expect(db.invitationOfGalleryLink).toHaveBeenCalledWith(sha256Hex(GALLERY_TOKEN));
    expect(db.itemVisible).toHaveBeenCalledWith(INV, ITEM);
    expect(db.submitReport.mock.calls[0]![0]).toMatchObject({
      invitation_id: INV,
      item_id: ITEM,
      surface: 'gallery',
      category: 'privacy',
      locale: 'he',
      ip_hash: 'hash:1.1.1.1',
    });
  });

  it('an album link works the same, a link without an item is about the whole gallery', async () => {
    const { deps, db } = makeDeps();
    await submitReport(reportOf({ g: undefined, a: ALBUM_TOKEN }), { ip: '1.1.1.1' }, deps);
    expect(db.submitReport.mock.calls[0]![0]).toMatchObject({
      invitation_id: INV,
      item_id: ITEM,
      surface: 'album',
    });
    await submitReport(
      reportOf({ i: undefined, reference: 'the photo Dana uploaded at the dance' }),
      { ip: '2.2.2.2' },
      deps,
    );
    expect(db.submitReport.mock.calls[1]![0]).toMatchObject({
      invitation_id: INV,
      item_id: null,
      surface: 'gallery',
      reference: 'the photo Dana uploaded at the dance',
    });
  });

  it('a link to the gallery without an item (the footer’s) needs the reporter to say which photo', async () => {
    const { deps, db } = makeDeps();
    for (const extra of [{ i: undefined }, { i: undefined, g: undefined, a: ALBUM_TOKEN }]) {
      const r = await submitReport(reportOf(extra), { ip: '1.1.1.1' }, deps);
      expect(r).toMatchObject({ status: 400, body: { error: 'invalid', fields: ['reference'] } });
    }
    expect(db.submitReport).not.toHaveBeenCalled();
    // an item in the link needs none
    expect((await submitReport(reportOf(), { ip: '2.2.2.2' }, deps)).status).toBe(200);
  });

  it('a link that opens nothing is link_invalid — the form then asks where the content is', async () => {
    const { deps, db } = makeDeps();
    const r = await submitReport(reportOf({ g: 'zzzzzzzzzzzzzzzzzzzzzzzz' }), { ip: '1.1.1.1' }, deps);
    expect(r).toMatchObject({ status: 422, body: { ok: false, error: 'link_invalid' } });
    const malformed = await submitReport(reportOf({ g: 'short' }), { ip: '1.1.1.1' }, deps);
    expect(malformed.body).toMatchObject({ error: 'link_invalid' });
    expect(db.submitReport).not.toHaveBeenCalled();
  });

  it('an item of another event, or one that is not there, is refused without saying which', async () => {
    const { deps, db } = makeDeps();
    const other = await submitReport(
      reportOf({ i: '44444444-4444-4444-8444-444444444444' }),
      { ip: '1.1.1.1' },
      deps,
    );
    expect(other.body).toEqual({ ok: false, error: 'link_invalid' });
    const notUuid = await submitReport(reportOf({ i: 'not-an-id' }), { ip: '1.1.1.1' }, deps);
    expect(notUuid.body).toEqual({ ok: false, error: 'link_invalid' });
    // an item id without a link cannot be checked either
    const bare = await submitReport(reportOf({ g: undefined }), { ip: '1.1.1.1' }, deps);
    expect(bare.body).toEqual({ ok: false, error: 'link_invalid' });
    expect(db.submitReport).not.toHaveBeenCalled();
    // the same item asked through a link of ANOTHER invitation
    db.invitationOfGalleryLink.mockResolvedValueOnce(OTHER_INV);
    expect(await resolveReportLink({ g: GALLERY_TOKEN, i: ITEM }, deps)).toEqual({ kind: 'invalid' });
  });

  it('without a link the visitor describes where the content is; with neither, the report is refused', async () => {
    const { deps, db } = makeDeps();
    const none = await submitReport(reportOf({ g: undefined, i: undefined }), { ip: '1.1.1.1' }, deps);
    expect(none).toMatchObject({ status: 400, body: { error: 'invalid', fields: ['reference'] } });
    const typed = await submitReport(
      reportOf({ g: undefined, i: undefined, reference: 'https://example.com/e/x/upload' }),
      { ip: '1.1.1.1' },
      deps,
    );
    expect(typed.status).toBe(200);
    expect(db.submitReport.mock.calls[0]![0]).toMatchObject({
      invitation_id: null,
      item_id: null,
      surface: 'link',
      reference: 'https://example.com/e/x/upload',
    });
    // a broken link plus a description is accepted as a typed reference
    await submitReport(
      reportOf({ g: 'zzzzzzzzzzzzzzzzzzzzzzzz', reference: 'the second photo' }),
      { ip: '3.3.3.3' },
      deps,
    );
    expect(db.submitReport.mock.calls[1]![0]).toMatchObject({ invitation_id: null, surface: 'link' });
  });

  it('an item that goes away between the check and the insert is link_invalid too', async () => {
    const { deps } = makeDeps();
    deps.db.submitReport.mockRejectedValueOnce(new AdminDbError('item_not_found', 'item not found'));
    const r = await submitReport(reportOf(), { ip: '1.1.1.1' }, deps);
    expect(r.body).toEqual({ ok: false, error: 'link_invalid' });
  });
});

describe('checking the link for the form', () => {
  it('says what the link opens, and nothing about the item', async () => {
    const { deps } = makeDeps();
    expect((await checkReportLink({ g: GALLERY_TOKEN, i: ITEM }, deps)).body).toEqual({
      ok: true,
      state: 'ok',
      item: true,
    });
    expect((await checkReportLink({ a: ALBUM_TOKEN }, deps)).body).toEqual({
      ok: true,
      state: 'ok',
      item: false,
    });
    expect((await checkReportLink({ g: 'zzzzzzzzzzzzzzzzzzzzzzzz' }, deps)).body).toMatchObject({
      state: 'invalid',
    });
    expect(
      (await checkReportLink({ g: GALLERY_TOKEN, i: '44444444-4444-4444-8444-444444444444' }, deps)).body,
    ).toMatchObject({ state: 'invalid', item: false });
    expect((await checkReportLink({}, deps)).body).toMatchObject({ state: 'none' });
    expect((await checkReportLink({ g: 1 }, deps)).status).toBe(400);
  });

  it('is not found while version 2 is not in force', async () => {
    active = false;
    const route = await import('@/app/api/legal/report/link/route');
    const res = await route.POST(new Request('https://x.example/api/legal/report/link', { method: 'POST' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('an item that goes dark reaches the open pages', () => {
  it('a report that hid the item tells the gallery’s open pages first, then the notices', async () => {
    const { deps, db, flush } = makeDeps();
    const order: string[] = [];
    deps.refreshGallery.mockImplementation(async (inv: string) => void order.push(`refresh:${inv}`));
    deps.send.mockImplementation(async (m: { to: string }) => (order.push(`mail:${m.to}`), true));
    db.submitReport.mockResolvedValueOnce({ id: REPORT_ID, number: 5009, urgent: true, hidden: true });
    await submitReport(reportOf({ category: 'child_safety' }), { ip: '1.1.1.1' }, deps);
    expect(deps.refreshGallery).not.toHaveBeenCalled(); // after the answer
    await flush();
    expect(order[0]).toBe(`refresh:${INV}`);
    expect(order.length).toBe(3); // the hint, then the team's and the host's notices
  });

  it('not when nothing was hidden (not urgent, or capped), and a failing hint changes nothing', async () => {
    const { deps, db, flush } = makeDeps();
    await submitReport(reportOf(), { ip: '1.1.1.1' }, deps);
    db.submitReport.mockResolvedValueOnce({ id: REPORT_ID, number: 5010, urgent: true, hidden: false });
    await submitReport(reportOf({ category: 'child_safety' }), { ip: '2.2.2.2' }, deps);
    await flush();
    expect(deps.refreshGallery).not.toHaveBeenCalled();
    db.submitReport.mockResolvedValueOnce({ id: REPORT_ID, number: 5011, urgent: true, hidden: true });
    deps.refreshGallery.mockRejectedValueOnce(new Error('realtime down'));
    const r = await submitReport(reportOf({ category: 'child_safety' }), { ip: '3.3.3.3' }, deps);
    expect(r.body).toMatchObject({ ok: true, hidden: true });
    // the notices still go out, and recorded
    await expect(flush()).resolves.toBeUndefined();
    expect(db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'team', true);
  });
});

describe('limits and duplicates', () => {
  it('five reports an hour and twenty a day from one address', async () => {
    const hour = makeDeps();
    hour.db.countSince.mockImplementation(async (_t, _h, hours) => (hours === 1 ? 5 : 5));
    expect((await submitReport(reportOf(), { ip: '1.1.1.1' }, hour.deps)).status).toBe(429);
    const day = makeDeps();
    day.db.countSince.mockImplementation(async (_t, _h, hours) => (hours === 1 ? 0 : 20));
    const r = await submitReport(reportOf(), { ip: '1.1.1.1' }, day.deps);
    expect(r).toMatchObject({ status: 429, body: { ok: false, error: 'rate' } });
    expect(hour.db.submitReport).not.toHaveBeenCalled();
    const fine = makeDeps();
    fine.db.countSince.mockImplementation(async (_t, _h, hours) => (hours === 1 ? 4 : 19));
    expect((await submitReport(reportOf(), { ip: '1.1.1.1' }, fine.deps)).status).toBe(200);
    expect(fine.db.countSince).toHaveBeenCalledWith('media_reports', 'hash:1.1.1.1', 1);
    expect(fine.db.countSince).toHaveBeenCalledWith('media_reports', 'hash:1.1.1.1', 24);
  });

  it('the same address, item and reason within a day is the same report: no second row, no new notices', async () => {
    const { deps, db, flush, sent } = makeDeps();
    db.earlierReport.mockResolvedValueOnce({ number: 5001, urgent: true, hidden: true });
    const r = await submitReport(reportOf({ category: 'child_safety' }), { ip: '1.1.1.1' }, deps);
    expect(r).toMatchObject({ status: 200, body: { ok: true, number: 5001, hidden: true, urgent: true } });
    expect(db.earlierReport).toHaveBeenCalledWith('hash:1.1.1.1', ITEM, 'child_safety', 24);
    expect(db.submitReport).not.toHaveBeenCalled();
    await flush();
    expect(sent).toEqual([]);
  });

  it('an unknown address is everyone: no duplicate check on it', async () => {
    const { deps, db } = makeDeps();
    await submitReport(reportOf(), { ip: null }, deps);
    expect(db.earlierReport).not.toHaveBeenCalled();
    expect(db.submitReport).toHaveBeenCalled();
  });
});

describe('what the reporter is told, and the notices', () => {
  it('the answer carries the number and whether the item was hidden, as the database said', async () => {
    const { deps, db } = makeDeps();
    db.submitReport.mockResolvedValueOnce({ id: REPORT_ID, number: 5002, urgent: true, hidden: true });
    const r = await submitReport(reportOf({ category: 'child_safety' }), { ip: '1.1.1.1' }, deps);
    expect(r.body).toEqual({ ok: true, number: 5002, hidden: true, urgent: true });
    const plain = await submitReport(reportOf(), { ip: '2.2.2.2' }, deps);
    expect(plain.body).toEqual({ ok: true, number: 5001, hidden: false, urgent: false });
  });

  it('after the answer: the team and the host are told, each recorded as sent', async () => {
    const { deps, db, sent, flush } = makeDeps();
    await submitReport(
      reportOf({
        name: 'Dana Cohen',
        email: 'dana@example.com',
        description: 'SECRET-DESCRIPTION text here',
      }),
      { ip: '1.1.1.1' },
      deps,
    );
    expect(sent).toEqual([]); // nothing goes out before the answer
    await flush();
    expect(sent.map((m) => m.to).sort()).toEqual(['host@example.com', 'privacy@example.com']);
    expect(db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'team', true);
    expect(db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'host', true);
    const team = sent.find((m) => m.to === 'privacy@example.com')!;
    expect(team.text).toContain('5001');
    expect(team.text).toContain(
      `https://invitations.example.com/app/admin/legal?tab=reports&id=${REPORT_ID}`,
    );
    const host = sent.find((m) => m.to === 'host@example.com')!;
    // neither carries the reporter's words or identity
    for (const m of sent) {
      const all = `${m.subject}${m.html}${m.text}`;
      expect(all).not.toContain('SECRET-DESCRIPTION');
      expect(all).not.toContain('Dana');
      expect(all).not.toContain('dana@example.com');
      expect(all).not.toContain('1.1.1.1');
    }
    expect(host.text).toContain(dictFor('he').legalRequests.admin.category.privacy);
  });

  it('an urgent report says so to the team, and the host is told the item is hidden', async () => {
    const { deps, db, sent, flush } = makeDeps();
    db.submitReport.mockResolvedValueOnce({ id: REPORT_ID, number: 5003, urgent: true, hidden: true });
    await submitReport(reportOf({ category: 'child_safety' }), { ip: '1.1.1.1' }, deps);
    await flush();
    const h = dictFor('he').legalRequests.mail;
    expect(sent.find((m) => m.to === 'privacy@example.com')!.subject).toContain('דחוף');
    expect(sent.find((m) => m.to === 'host@example.com')!.text).toContain(h.host.hidden);
  });

  it('notices that fail leave the answer ok:true and are recorded as not sent', async () => {
    const { deps, db, flush } = makeDeps();
    deps.send.mockResolvedValue(false);
    const r = await submitReport(reportOf(), { ip: '1.1.1.1' }, deps);
    expect(r.body).toMatchObject({ ok: true, number: 5001 });
    await flush();
    expect(db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'team', false);
    expect(db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'host', false);
    expect(db.markReportNotified).not.toHaveBeenCalledWith(REPORT_ID, expect.any(String), true);
  });

  it('a mailer that throws, a missing team address and an owner without email are all “not sent”', async () => {
    const throwing = makeDeps();
    throwing.deps.send.mockRejectedValue(new Error('smtp down'));
    expect((await submitReport(reportOf(), { ip: '1.1.1.1' }, throwing.deps)).body).toMatchObject({
      ok: true,
    });
    await throwing.flush();
    expect(throwing.db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'team', false);

    const noTeam = makeDeps({ config: { ...config, teamEmail: '' } });
    noTeam.db.ownerEmail.mockResolvedValue(null);
    await submitReport(reportOf(), { ip: '1.1.1.1' }, noTeam.deps);
    await noTeam.flush();
    expect(noTeam.deps.send).not.toHaveBeenCalled();
    expect(noTeam.db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'team', false);
    expect(noTeam.db.markReportNotified).toHaveBeenCalledWith(REPORT_ID, 'host', false);
  });

  it('a record that cannot be written does not break the rest', async () => {
    const { deps, db, flush } = makeDeps();
    db.markReportNotified.mockRejectedValue(new Error('db down'));
    await submitReport(reportOf(), { ip: '1.1.1.1' }, deps);
    await expect(flush()).resolves.toBeUndefined();
  });

  it('a report about no invitation tells no host', async () => {
    const { deps, db, flush } = makeDeps();
    await submitReport(
      reportOf({ g: undefined, i: undefined, reference: 'somewhere' }),
      { ip: '1.1.1.1' },
      deps,
    );
    await flush();
    expect(db.ownerEmail).not.toHaveBeenCalled();
    expect(db.markReportNotified.mock.calls.map((c) => c[1])).toEqual(['team']);
  });

  it('if the database did not store it, nothing is claimed and nothing is sent', async () => {
    const { deps, db, flush } = makeDeps();
    db.submitReport.mockRejectedValueOnce(new Error('connection refused'));
    await expect(submitReport(reportOf(), { ip: '1.1.1.1' }, deps)).rejects.toThrow('connection refused');
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(db.markReportNotified).not.toHaveBeenCalled();
  });

  it('never claims that an email was sent: not in the answer, not in the page’s texts', async () => {
    const { deps } = makeDeps();
    const r = await submitReport(reportOf({ email: 'dana@example.com' }), { ip: '1.1.1.1' }, deps);
    expect(Object.keys(r.body).sort()).toEqual(['hidden', 'number', 'ok', 'urgent']);
    for (const locale of ['he', 'en'] as const) {
      const ok = dictFor(locale).legalRequests.report.success;
      for (const text of Object.values(ok))
        expect(text).not.toMatch(
          /נשלח[ה]? (אליכם|אליך)|שלחנו|we (have )?sent|has been sent|was sent|emailed/i,
        );
    }
    // the privacy request's success card says the same
    for (const locale of ['he', 'en'] as const) {
      const ok = dictFor(locale).legalRequests.privacyRequest.success;
      for (const text of Object.values(ok))
        expect(text).not.toMatch(
          /נשלח[ה]? (אליכם|אליך)|שלחנו|we (have )?sent|has been sent|was sent|emailed/i,
        );
    }
  });
});

describe('the privacy request', () => {
  const request = {
    kind: 'deletion',
    relation: 'guest',
    name: 'Yossi Levi',
    email: 'yossi@example.com',
    details: 'Please delete the photos of me from the wedding gallery.',
    locale: 'en',
  };

  it('needs a kind, a relation, a name, an email and 10 to 4000 characters of details', async () => {
    const { deps, db } = makeDeps();
    const bad = async (extra: Record<string, unknown>) =>
      (await submitPrivacyRequest({ ...request, ...extra }, { ip: '1.1.1.1' }, deps)).body;
    expect(await bad({ kind: 'sell_my_data' })).toMatchObject({ error: 'invalid', fields: ['kind'] });
    expect(await bad({ name: '' })).toMatchObject({ fields: ['name'] });
    expect(await bad({ email: 'nope' })).toMatchObject({ fields: ['email'] });
    expect(await bad({ details: 'short' })).toMatchObject({ fields: ['details'] });
    expect(await bad({ details: 'x'.repeat(4001) })).toMatchObject({ fields: ['details'] });
    expect(await bad({ unknown: 1 })).toMatchObject({ error: 'invalid' });
    expect(db.submitRequest).not.toHaveBeenCalled();
    for (const kind of [
      'access',
      'correction',
      'deletion',
      'restriction',
      'gallery_removal',
      'child_photo',
      'biometric_exclusion',
      'other',
    ])
      expect(
        (await submitPrivacyRequest({ ...request, kind }, { ip: `9.9.9.${kind.length}` }, deps)).status,
      ).toBe(200);
  });

  it('limits and bots', async () => {
    const { deps, db } = makeDeps();
    db.countSince.mockResolvedValue(5);
    expect(await submitPrivacyRequest(request, { ip: '1.1.1.1' }, deps)).toMatchObject({
      status: 429,
      body: { error: 'rate' },
    });
    expect(db.countSince).toHaveBeenCalledWith('privacy_requests', 'hash:1.1.1.1', 1);
    db.countSince.mockResolvedValue(0);
    const bot = await submitPrivacyRequest({ ...request, website: 'x' }, { ip: '1.1.1.1' }, deps);
    expect(bot.body).toMatchObject({ ok: true, number: null });
    expect(db.submitRequest).not.toHaveBeenCalled();
  });

  it('stores it, answers with the number and the due date, then writes to the requester and the team', async () => {
    const { deps, db, sent, flush } = makeDeps();
    const r = await submitPrivacyRequest({ ...request, phone: '+972 50 123 4567' }, { ip: '1.1.1.1' }, deps);
    expect(r).toEqual({ status: 200, body: { ok: true, number: 7001, dueAt: '2026-11-12T10:00:00Z' } });
    expect(db.submitRequest.mock.calls[0]![0]).toMatchObject({
      kind: 'deletion',
      name: 'Yossi Levi',
      email: 'yossi@example.com',
      phone: '+972 50 123 4567',
      reference: null,
      locale: 'en',
      ip_hash: 'hash:1.1.1.1',
    });
    await flush();
    const ack = sent.find((m) => m.to === 'yossi@example.com')!;
    expect(ack.subject).toContain('7001');
    // the statutory date, and only what is true
    expect(ack.text).toContain('12 November 2026');
    expect(ack.text).toMatch(/may ask you to verify your identity/);
    expect(ack.text).not.toMatch(/deleted|removed|completed/i);
    const team = sent.find((m) => m.to === 'privacy@example.com')!;
    expect(team.text).toContain('7001');
    expect(team.text).toContain(`/app/admin/legal?tab=requests&id=${REPORT_ID}`);
    expect(`${team.html}${team.text}`).not.toContain('Please delete the photos');
    expect(`${team.html}${team.text}`).not.toContain('yossi@example.com');
    expect(db.markRequestNotified).toHaveBeenCalledWith(REPORT_ID, 'requester', true);
    expect(db.markRequestNotified).toHaveBeenCalledWith(REPORT_ID, 'team', true);
  });

  it('emails that fail leave the answer ok:true and are recorded as not sent; a failed insert claims nothing', async () => {
    const { deps, db, flush } = makeDeps();
    deps.send.mockResolvedValue(false);
    expect((await submitPrivacyRequest(request, { ip: '1.1.1.1' }, deps)).body).toMatchObject({
      ok: true,
      number: 7001,
    });
    await flush();
    expect(db.markRequestNotified).toHaveBeenCalledWith(REPORT_ID, 'requester', false);
    expect(db.markRequestNotified).toHaveBeenCalledWith(REPORT_ID, 'team', false);

    const broken = makeDeps();
    broken.db.submitRequest.mockRejectedValueOnce(new Error('db down'));
    await expect(submitPrivacyRequest(request, { ip: '1.1.1.1' }, broken.deps)).rejects.toThrow('db down');
    await broken.flush();
    expect(broken.deps.send).not.toHaveBeenCalled();
  });

  it('without a privacy mailbox the team notice is recorded as not sent', async () => {
    const { deps, db, flush } = makeDeps({ config: { ...config, teamEmail: '' } });
    await submitPrivacyRequest(request, { ip: '1.1.1.1' }, deps);
    await flush();
    expect(db.markRequestNotified).toHaveBeenCalledWith(REPORT_ID, 'team', false);
    expect(db.markRequestNotified).toHaveBeenCalledWith(REPORT_ID, 'requester', true);
  });
});

describe('gated behind version 2 of the legal documents', () => {
  const post = (url: string, body: unknown) =>
    new Request(`https://invitations.example.com${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('the public routes answer 404 {error:"not_found"} while it is not in force, and do not touch anything', async () => {
    active = false;
    const report = await import('@/app/api/legal/report/route');
    const privacy = await import('@/app/api/legal/privacy-request/route');
    for (const [route, url] of [
      [report, '/api/legal/report'],
      [privacy, '/api/legal/privacy-request'],
    ] as const) {
      const res = await route.POST(post(url, {}));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('the console’s routes answer 404 too', async () => {
    active = false;
    const reports = await import('@/app/api/admin/legal/reports/[id]/route');
    const requests = await import('@/app/api/admin/legal/requests/[id]/route');
    const params = { params: Promise.resolve({ id: REPORT_ID }) };
    for (const route of [reports, requests]) {
      const res = await route.POST(post('/api/admin/legal/x', {}), params);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
  });

  it('with it in force the route reaches the handler (JSON only, like the other public routes)', async () => {
    active = true;
    const report = await import('@/app/api/legal/report/route');
    const res = await report.POST(
      new Request('https://invitations.example.com/api/legal/report', { method: 'POST', body: 'x' }),
    );
    expect(res.status).toBe(415);
  });
});
