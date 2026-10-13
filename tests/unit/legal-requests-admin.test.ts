import { beforeEach, describe, expect, it, vi } from 'vitest';

// The console's side of the report and privacy-request flows (features/legal-requests): the decisions on
// a report and the status of a request over fake dependencies — what the database refuses, the fixed
// outcome emails (never the staff's note unless ticked), the record of whether they went — and the
// pages that are "not found" while version 2 of the legal documents is not in force.

import type { AdminLegalDeps } from '@/features/legal-requests/server/admin-api';

vi.mock('server-only', () => ({}));
const env = { INVITES_PUBLIC_BASE_URL: 'https://invitations.example.com', INVITES_BRAND_NAME: 'Badook' };
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));
let active = false;
vi.mock('@/features/legal/context', () => ({
  legalStatus: () => ({ active, requested: active, missing: [], effective: null }),
  legalContext: () => ({ privacyEmail: '', operator: {} }),
}));
vi.mock('@/features/legal/status', () => ({
  legalStatus: () => ({ active, requested: active, missing: [], effective: null }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));

const { AdminDbError } = await import('@/features/admin/server/db');
const { adminReportAct, adminRequestSet } = await import('@/features/legal-requests/server/admin-api');
const { reporterOutcomeEmail, requestStatusEmail, requestAckEmail, hostReportEmail, reportOutcomeOf } =
  await import('@/features/legal-requests/email');

const ID = '33333333-3333-4333-8333-333333333333';
const staff = { userId: 'u1', email: 's@example.com', role: 'support', permissions: [] } as never;
const config = { teamEmail: 'privacy@example.com', brand: 'Badook', site: 'https://invitations.example.com' };
const NOTE = 'INTERNAL: matched the uploader, ticket 4412';

function setup(over: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {}) {
  const before = {
    id: ID,
    number: 5001,
    invitationId: 'inv',
    status: 'in_review',
    resolution: null,
    resolvedAt: null,
    reporterEmail: 'dana@example.com',
    locale: 'en',
    ...over.before,
  };
  const after = {
    ...before,
    status: 'actioned',
    resolution: 'removed',
    resolvedAt: '2026-11-01T10:00:00Z',
    ...over.after,
  };
  const targets = [before, after];
  const db = {
    reportTarget: vi.fn(async (_: string) => targets.shift() ?? after),
    act: vi.fn(
      async (_a: string, _id: string, _action: string, _note: string | null) => ({ id: ID }) as never,
    ),
    requestTarget: vi.fn(async (_: string) => ({
      id: ID,
      number: 7001,
      status: 'in_progress',
      resolvedAt: null,
      email: 'yossi@example.com',
      locale: 'en',
      ...over.before,
    })),
    setStatus: vi.fn(async (..._: unknown[]) => ({ id: ID }) as never),
    markReportNotified: vi.fn(async (..._: unknown[]) => null),
    markRequestNotified: vi.fn(async (..._: unknown[]) => null),
  };
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  const send = vi.fn(
    async (m: { to: string; subject: string; html: string; text: string }) => (sent.push(m), true),
  );
  // (the fakes answer with plain strings where the real thing has unions)
  const deps = { db, send, config } as unknown as AdminLegalDeps & { db: typeof db; send: typeof send };
  return { deps, db, send, sent };
}

beforeEach(() => {
  active = false;
  notFound.mockClear();
});

describe('a decision on a report', () => {
  it('needs a valid id and action; a decision needs a note (the database wants one too)', async () => {
    const { deps, db } = setup();
    expect((await adminReportAct(staff, 'nope', { action: 'note', note: 'x' }, deps)).status).toBe(404);
    expect((await adminReportAct(staff, ID, { action: 'explode' }, deps)).status).toBe(400);
    for (const action of ['remove', 'keep', 'dismiss', 'close', 'note'])
      expect(await adminReportAct(staff, ID, { action, note: '  ' }, deps)).toMatchObject({
        status: 400,
        body: { ok: false, code: 'note_required' },
      });
    expect(db.act).not.toHaveBeenCalled();
    for (const action of ['review', 'hide', 'restore'])
      expect((await adminReportAct(staff, ID, { action }, deps)).status).toBe(200);
    expect(db.act).toHaveBeenCalledTimes(3);
  });

  it('the database’s refusal (support cannot remove) is raised as is, for the route to show as 403', async () => {
    const { deps, send } = setup();
    deps.db.act.mockRejectedValueOnce(new AdminDbError('forbidden', 'forbidden'));
    await expect(adminReportAct(staff, ID, { action: 'remove', note: 'gone' }, deps)).rejects.toMatchObject({
      reason: 'forbidden',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('an unknown report is 404', async () => {
    const { deps, db } = setup();
    db.reportTarget.mockResolvedValueOnce(null as never);
    expect((await adminReportAct(staff, ID, { action: 'review' }, deps)).status).toBe(404);
  });

  it('ending a report writes the reporter the fixed outcome — never the staff note — and records it', async () => {
    const { deps, db, sent } = setup();
    const r = await adminReportAct(staff, ID, { action: 'remove', note: NOTE }, deps);
    expect(r.body).toMatchObject({ ok: true, emailed: 'sent' });
    expect(db.act).toHaveBeenCalledWith('u1', ID, 'remove', NOTE);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('dana@example.com');
    expect(sent[0]!.text).toContain('the item was removed from the gallery');
    expect(`${sent[0]!.subject}${sent[0]!.html}${sent[0]!.text}`).not.toContain('INTERNAL');
    expect(db.markReportNotified).toHaveBeenCalledWith(ID, 'reporter', true);
  });

  it('one fixed text per outcome, in the report’s language', () => {
    const texts = (['removed', 'hidden', 'kept', 'notApplicable', 'closed'] as const).map(
      (outcome) =>
        reporterOutcomeEmail({
          locale: 'en',
          brand: 'Badook',
          number: 5001,
          outcome,
          contactUrl: 'https://x/contact',
        }).text,
    );
    expect(new Set(texts).size).toBe(5);
    const he = reporterOutcomeEmail({
      locale: 'he',
      brand: 'Badook',
      number: 5001,
      outcome: 'kept',
      contactUrl: 'https://x/contact',
    });
    expect(he.html).toContain('dir="rtl"');
    expect(he.text).toContain('להשאיר את הפריט');
    expect(reportOutcomeOf('removed')).toBe('removed');
    expect(reportOutcomeOf('hidden')).toBe('hidden');
    expect(reportOutcomeOf('kept')).toBe('kept');
    expect(reportOutcomeOf('not_applicable')).toBe('notApplicable');
    expect(reportOutcomeOf('host_handled')).toBe('closed');
    expect(reportOutcomeOf(null)).toBe('closed');
  });

  it('the outcome follows what the report ended as (kept, not applicable)', async () => {
    const kept = setup({ after: { status: 'dismissed', resolution: 'kept' } });
    await adminReportAct(staff, ID, { action: 'keep', note: 'fine' }, kept.deps);
    expect(kept.sent[0]!.text).toContain('decided to leave the item in the gallery');
    const na = setup({ after: { status: 'dismissed', resolution: 'not_applicable' } });
    await adminReportAct(staff, ID, { action: 'dismiss', note: 'spam' }, na.deps);
    expect(na.sent[0]!.text).toContain('could not be processed');
  });

  it('an email that does not go is recorded as not sent and the console is told', async () => {
    const { deps, db, send } = setup();
    send.mockResolvedValue(false);
    const r = await adminReportAct(staff, ID, { action: 'close', note: 'done' }, deps);
    expect(r.body).toMatchObject({ ok: true, emailed: 'failed' });
    expect(db.markReportNotified).toHaveBeenCalledWith(ID, 'reporter', false);
  });

  it('no address, a non-final decision, or a report already ended: nothing is sent', async () => {
    const noMail = setup({ before: { reporterEmail: null }, after: { reporterEmail: null } });
    expect((await adminReportAct(staff, ID, { action: 'keep', note: 'n' }, noMail.deps)).body).toMatchObject({
      emailed: 'none',
    });
    expect(noMail.send).not.toHaveBeenCalled();
    const hide = setup();
    expect((await adminReportAct(staff, ID, { action: 'hide' }, hide.deps)).body).toMatchObject({
      emailed: 'none',
    });
    expect(hide.send).not.toHaveBeenCalled();
    const again = setup({ before: { status: 'actioned', resolvedAt: '2026-10-30T10:00:00Z' } });
    await adminReportAct(staff, ID, { action: 'close', note: 'n' }, again.deps);
    expect(again.send).not.toHaveBeenCalled();
  });
});

describe('the status of a privacy request', () => {
  it('a final status needs a note; the others do not', async () => {
    const { deps, db } = setup();
    for (const status of ['fulfilled', 'partly', 'declined', 'closed'])
      expect(await adminRequestSet(staff, ID, { status, note: '' }, deps)).toMatchObject({
        status: 400,
        body: { code: 'note_required' },
      });
    expect((await adminRequestSet(staff, ID, { status: 'new', note: 'x' }, deps)).status).toBe(400);
    expect(db.setStatus).not.toHaveBeenCalled();
    for (const status of ['verifying', 'in_progress'])
      expect((await adminRequestSet(staff, ID, { status }, deps)).status).toBe(200);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('a final status writes the requester a fixed text; the note only when ticked', async () => {
    const plain = setup();
    const r = await adminRequestSet(staff, ID, { status: 'declined', note: NOTE }, plain.deps);
    expect(r.body).toMatchObject({ ok: true, emailed: 'sent' });
    expect(plain.sent[0]!.to).toBe('yossi@example.com');
    expect(plain.sent[0]!.text).toContain('We could not grant your request.');
    expect(`${plain.sent[0]!.html}${plain.sent[0]!.text}`).not.toContain('INTERNAL');
    expect(plain.db.markRequestNotified).toHaveBeenCalledWith(ID, 'requester', true);

    const withNote = setup();
    await adminRequestSet(
      staff,
      ID,
      { status: 'partly', note: 'We deleted the photos <b>but</b> kept invoices.', includeNote: true },
      withNote.deps,
    );
    expect(withNote.sent[0]!.text).toContain('We deleted the photos <b>but</b> kept invoices.');
    expect(withNote.sent[0]!.html).toContain('&lt;b&gt;but&lt;/b&gt;');
    expect(withNote.sent[0]!.html).not.toContain('<b>but</b>');
  });

  it('a failed email is recorded as not sent; the same final status twice writes once', async () => {
    const failed = setup();
    failed.send.mockResolvedValue(false);
    expect(
      (await adminRequestSet(staff, ID, { status: 'fulfilled', note: 'done' }, failed.deps)).body,
    ).toMatchObject({ emailed: 'failed' });
    expect(failed.db.markRequestNotified).toHaveBeenCalledWith(ID, 'requester', false);
    const twice = setup({ before: { status: 'fulfilled', resolvedAt: '2026-10-30T10:00:00Z' } });
    await adminRequestSet(staff, ID, { status: 'fulfilled', note: 'again' }, twice.deps);
    expect(twice.send).not.toHaveBeenCalled();
  });

  it('the database’s refusal is raised as is', async () => {
    const { deps } = setup();
    deps.db.setStatus.mockRejectedValueOnce(new AdminDbError('forbidden', 'forbidden'));
    await expect(adminRequestSet(staff, ID, { status: 'verifying' }, deps)).rejects.toMatchObject({
      reason: 'forbidden',
    });
  });
});

describe('the emails’ texts', () => {
  it('the acknowledgement names the number and the statutory date and promises nothing else', () => {
    const he = requestAckEmail({
      locale: 'he',
      brand: 'Badook',
      number: 7001,
      dueAt: '2026-11-12T10:00:00Z',
      privacyUrl: 'https://x/privacy',
    });
    expect(he.text).toContain('7001');
    expect(he.text).toContain('12 בנובמבר 2026');
    expect(
      requestStatusEmail({
        locale: 'he',
        brand: 'B',
        number: 1,
        status: 'closed',
        note: null,
        contactUrl: 'u',
      }).text,
    ).not.toContain('הערת הצוות');
  });

  it('the host’s notice has the category and never who reported', () => {
    const m = hostReportEmail({
      locale: 'en',
      brand: 'Badook',
      category: 'copyright',
      hidden: false,
      appUrl: 'https://x/app',
    });
    expect(m.text).toContain('Copyright');
    expect(m.text).toContain('We do not share who made the report.');
    expect(m.text).not.toContain('hidden from the gallery');
  });
});

describe('the console’s pages while version 2 is not in force', () => {
  it('the legal page and the public pages are not found', async () => {
    for (const mod of [
      '@/app/(site)/app/(admin)/admin/legal/page',
      '@/app/(site)/report/page',
      '@/app/(site)/privacy-request/page',
    ]) {
      const page = (await import(mod)) as {
        default: (p: { searchParams: Promise<object> }) => Promise<unknown>;
      };
      await expect(page.default({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(notFound).toHaveBeenCalledTimes(3);
  });
});
