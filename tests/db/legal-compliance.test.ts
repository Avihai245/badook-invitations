import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Legal compliance, version 2 (supabase/migrations/*_legal_compliance.sql): the report flow (a report
// points only at an item of the invitation its link opened, an urgent one hides the item reversibly),
// the console's decisions with the role rules and the record of actions, removal into the trash, the
// privacy requests and their 30-day due date, the acceptance evidence, the gallery acknowledgement, the
// daily erasure, and that none of it is reachable from the browser's roles.

const OWNER = '99999999-9999-4999-8999-999999999901';
const ADMIN = '99999999-9999-4999-8999-999999999902';
const AGENT = '99999999-9999-4999-8999-999999999903';
const VIEWER = '99999999-9999-4999-8999-999999999904';
const FINANCE = '99999999-9999-4999-8999-999999999905';
const DANA = '99999999-9999-4999-8999-999999999906';
const YOSSI = '99999999-9999-4999-8999-999999999907';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let danaInvitation: string;
let yossiInvitation: string;

/** As the server (the service role), kept. */
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
/** As the server (the service role), rolled back. */
async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: { message?: string }) => e.message ?? 'error',
  );

const hex = (n: number) => randomBytes(n).toString('hex').slice(0, n);
let itemSeq = 0;

/** A gallery item of the invitation, with its three files. */
async function item(invitation: string, status = 'published'): Promise<string> {
  const id = `aaaaaaaa-0000-4000-8000-${String(++itemSeq).padStart(12, '0')}`;
  await c.query(
    `insert into gallery_items (id, invitation_id, kind, status, status_reason, original_path, original_type,
       original_size, display_path, thumb_path, uploader_hash, published_at)
     values ($1, $2, 'image', $3, 'ok', $4, 'image/jpeg', 1000, $5, $6, $7, now())`,
    [
      id,
      invitation,
      status,
      `${invitation}/${id}/original.jpg`,
      `${invitation}/${id}/display.jpg`,
      `${invitation}/${id}/thumb.jpg`,
      hex(64).padEnd(64, '0'),
    ],
  );
  return id;
}

let slugSeq = 0;
/** A new invitation of DANA's with a gallery (its own item count for the hourly cap). */
async function newInvitation(): Promise<string> {
  const draft = { defaultLocale: 'he', hosts: { primary: { he: 'דנה' }, secondary: { he: 'איתי' } } };
  const id = (
    await c.query(
      `insert into invitations (owner_id, template_id, slug, event_type, draft)
       values ($1, 'sahar-bordeaux', $2, 'wedding', $3) returning id`,
      [DANA, `dana-extra-${++slugSeq}`, draft],
    )
  ).rows[0].id as string;
  await c.query(
    `insert into galleries (invitation_id, upload_token_hash, upload_token_nonce, projector_token_hash,
       projector_token_nonce, channel)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, hex(64).padEnd(64, 'c'), hex(24), hex(64).padEnd(64, 'd'), hex(24), hex(24)],
  );
  return id;
}
type Moderated = { count: number; ids: string[]; held?: string[] };
/** The host's decision (gallery_owner_moderate), as the server calls it. */
const hostModerate = (invitation: string, ids: string[], action: string) =>
  commit<Moderated>('gallery_owner_moderate', [invitation, DANA, ids, action]);
const itemRow = async (id: string) =>
  row('select status, status_reason, deleted_at from gallery_items where id = $1', [id]);

const submitArgs = (over: Record<string, unknown> = {}) => ({
  invitation_id: danaInvitation,
  item_id: null,
  surface: 'gallery',
  category: 'privacy',
  intimate: false,
  role: 'depicted',
  description: 'This photo shows me and I did not agree to it.',
  locale: 'he',
  ip_hash: 'iphash-1',
  ...over,
});
type Submitted = { id: string; number: number; urgent: boolean; hidden: boolean };
const submit = (over: Record<string, unknown> = {}) =>
  commit<Submitted>('media_report_submit', [JSON.stringify(submitArgs(over))]);

type Report = {
  id: string;
  number: number;
  status: string;
  resolution: string | null;
  resolutionNote: string | null;
  hiddenByReport: boolean;
  priorStatus: string | null;
  item: { status: string; reason: string | null; deleted: boolean } | null;
  reporterEmail: string | null;
  canReply: boolean;
  events: { actor: string; action: string; detail: Record<string, unknown> }[];
};
const act = (actor: string, id: string, action: string, note: string | null = null) =>
  commit<Report>('media_report_admin_act', [actor, id, action, note]);
const getReport = (actor: string, id: string) => commit<Report>('media_report_admin_get', [actor, id]);
const row = async (sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows[0];

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, raw_app_meta_data, created_at) values
       ($1, 'owner@example.com', '{}', now()),
       ($2, 'admin@example.com', '{}', now()),
       ($3, 'agent@example.com', '{}', now()),
       ($4, 'viewer@example.com', '{}', now()),
       ($5, 'finance@example.com', '{}', now()),
       ($6, 'dana@example.com', '{}', now()),
       ($7, 'yossi@example.com', '{}', now())`,
    [OWNER, ADMIN, AGENT, VIEWER, FINANCE, DANA, YOSSI],
  );
  await c.query(`insert into public.admin_staff (email, role) values
    ('owner@example.com', 'owner'), ('admin@example.com', 'admin'), ('agent@example.com', 'support'),
    ('viewer@example.com', 'viewer'), ('finance@example.com', 'finance')`);
  const draft = (he: string) => ({
    defaultLocale: 'he',
    hosts: { primary: { he }, secondary: { he: 'איתי' } },
  });
  const invite = async (owner: string, slug: string) => {
    const id = (
      await c.query(
        `insert into invitations (owner_id, template_id, slug, event_type, draft)
         values ($1, 'sahar-bordeaux', $2, 'wedding', $3) returning id`,
        [owner, slug, draft(slug)],
      )
    ).rows[0].id as string;
    await c.query(
      `insert into galleries (invitation_id, upload_token_hash, upload_token_nonce, projector_token_hash,
         projector_token_nonce, channel)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, hex(64).padEnd(64, 'a'), hex(24), hex(64).padEnd(64, 'b'), hex(24), hex(24)],
    );
    return id;
  };
  danaInvitation = await invite(DANA, 'dana-legal');
  yossiInvitation = await invite(YOSSI, 'yossi-legal');
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('submitting a report', () => {
  it('stores it with its trail and leaves a published item alone when it is not urgent', async () => {
    const it1 = await item(danaInvitation);
    const r = await submit({ item_id: it1, reporter_email: 'rep@example.com', reporter_name: 'Rina' });
    expect(r).toMatchObject({ urgent: false, hidden: false });
    expect(r.number).toBeGreaterThanOrEqual(5001);
    expect(await row('select status, status_reason from gallery_items where id = $1', [it1])).toEqual({
      status: 'published',
      status_reason: 'ok',
    });
    const m = await row('select * from media_reports where id = $1', [r.id]);
    expect(m).toMatchObject({
      status: 'new',
      urgent: false,
      hidden_by_report: false,
      prior_status: null,
      surface: 'gallery',
      invitation_id: danaInvitation,
      item_id: it1,
      ip_hash: 'iphash-1',
      locale: 'he',
    });
    const events = (
      await c.query(
        'select actor, action, detail from media_report_events where report_id = $1 order by id',
        [r.id],
      )
    ).rows;
    expect(events).toEqual([
      {
        actor: 'reporter',
        action: 'submitted',
        detail: { category: 'privacy', urgent: false, hasItem: true },
      },
    ]);
  });

  it('an urgent report (a child, an intimate image) hides a published item at once, reversibly, and records it', async () => {
    const child = await item(danaInvitation);
    const r = await submit({ item_id: child, category: 'child_safety' });
    expect(r).toMatchObject({ urgent: true, hidden: true });
    expect(await row('select status, status_reason from gallery_items where id = $1', [child])).toEqual({
      status: 'hidden',
      status_reason: 'report',
    });
    expect(
      await row('select hidden_by_report, prior_status, urgent from media_reports where id = $1', [r.id]),
    ).toEqual({
      hidden_by_report: true,
      prior_status: 'published',
      urgent: true,
    });
    expect(
      (
        await c.query('select action from media_report_events where report_id = $1 order by id', [r.id])
      ).rows.map((e) => e.action),
    ).toEqual(['submitted', 'hidden_urgent']);
    expect(
      await row(`select check_name, result, decided_by from gallery_moderation where item_id = $1`, [child]),
    ).toEqual({
      check_name: 'report',
      result: 'hidden',
      decided_by: 'server',
    });

    const intimate = await item(danaInvitation);
    expect(await submit({ item_id: intimate, category: 'harmful', intimate: true })).toMatchObject({
      urgent: true,
      hidden: true,
    });
    // harmful without the flag is not urgent
    const plainHarm = await item(danaInvitation);
    expect(await submit({ item_id: plainHarm, category: 'harmful' })).toMatchObject({
      urgent: false,
      hidden: false,
    });

    // staff put it back where it was
    const restored = await act(AGENT, r.id, 'restore');
    expect(restored.item).toMatchObject({ status: 'published', reason: 'host' });
    expect(restored.hiddenByReport).toBe(false);
  });

  it('an urgent report about an item that is not published changes nothing', async () => {
    const pending = await item(danaInvitation, 'pending');
    await expect(submit({ item_id: pending, category: 'child_safety' })).rejects.toThrow('item not found');
    const noItem = await submit({ category: 'child_safety' });
    expect(noItem).toMatchObject({ urgent: true, hidden: false });
  });

  it('refuses an item of ANOTHER invitation, a deleted one, an unknown one — and an item without an invitation', async () => {
    const theirs = await item(yossiInvitation);
    await expect(submit({ item_id: theirs })).rejects.toThrow('item not found');
    expect(await call('media_report_item_visible', [danaInvitation, theirs])).toBe(false);
    expect(await call('media_report_item_visible', [yossiInvitation, theirs])).toBe(true);
    const gone = await item(danaInvitation);
    await c.query('update gallery_items set deleted_at = now(), deleted_by = $2 where id = $1', [
      gone,
      'host',
    ]);
    await expect(submit({ item_id: gone })).rejects.toThrow('item not found');
    await expect(submit({ item_id: 'bbbbbbbb-0000-4000-8000-000000000000' })).rejects.toThrow(
      'item not found',
    );
    await expect(submit({ item_id: theirs, invitation_id: null })).rejects.toThrow('item not found');
    // nothing was stored for any of them
    expect((await row(`select count(*)::int as n from media_reports where item_id = $1`, [theirs])).n).toBe(
      0,
    );
  });

  it('the database’s own rules: a copyright claim needs name and email; lengths; categories', async () => {
    await expect(submit({ category: 'copyright' })).rejects.toThrow(/media_reports_check/);
    await expect(submit({ category: 'copyright', reporter_name: 'Dana' })).rejects.toThrow(
      /media_reports_check/,
    );
    await expect(submit({ category: 'copyright', reporter_email: 'd@example.com' })).rejects.toThrow(
      /media_reports_check/,
    );
    expect(
      await submit({ category: 'copyright', reporter_name: 'Dana', reporter_email: 'd@example.com' }),
    ).toMatchObject({ urgent: false });
    await expect(submit({ description: 'short' })).rejects.toThrow(/description/);
    await expect(submit({ category: 'gossip' })).rejects.toThrow(/category/);
    await expect(submit({ reporter_email: 'not an email' })).rejects.toThrow(/reporter_email/);
    await expect(submit({ surface: 'tv' })).rejects.toThrow(/surface/);
  });

  it('records whether a notice went out; a failure leaves a trace and no timestamp', async () => {
    const r = await submit();
    await commit('media_report_mark_notified', [r.id, 'team', false]);
    expect(
      (await row('select team_notified_at from media_reports where id = $1', [r.id])).team_notified_at,
    ).toBeNull();
    await commit('media_report_mark_notified', [r.id, 'team', true]);
    await commit('media_report_mark_notified', [r.id, 'host', true]);
    const m = await row(
      'select team_notified_at, host_notified_at, reporter_notified_at from media_reports where id = $1',
      [r.id],
    );
    expect(m.team_notified_at).not.toBeNull();
    expect(m.host_notified_at).not.toBeNull();
    expect(m.reporter_notified_at).toBeNull();
    const events = (
      await c.query(
        `select action, detail from media_report_events where report_id = $1 and action like 'notice_%' order by id`,
        [r.id],
      )
    ).rows;
    expect(events).toEqual([
      { action: 'notice_team', detail: { sent: false } },
      { action: 'notice_team', detail: { sent: true } },
      { action: 'notice_host', detail: { sent: true } },
    ]);
    expect(await reason(commit('media_report_mark_notified', [r.id, 'nobody', true]))).toContain(
      'bad notice',
    );
  });
});

describe('the console’s decisions on a report', () => {
  it('review, hide, restore, keep: each recorded in the report’s trail and in the audit log', async () => {
    const it1 = await item(danaInvitation);
    const r = await submit({ item_id: it1, reporter_email: 'rep@example.com' });

    const reviewed = await act(AGENT, r.id, 'review');
    expect(reviewed.status).toBe('in_review');
    const hidden = await act(AGENT, r.id, 'hide');
    expect(hidden).toMatchObject({
      hiddenByReport: true,
      priorStatus: 'published',
      item: { status: 'hidden', reason: 'report' },
    });
    expect(
      await row(
        `select decided_by, actor_id from gallery_moderation where item_id = $1 and decided_by = 'staff'`,
        [it1],
      ),
    ).toMatchObject({ decided_by: 'staff', actor_id: AGENT });
    const back = await act(AGENT, r.id, 'restore');
    expect(back).toMatchObject({ hiddenByReport: false, item: { status: 'published' } });
    const kept = await act(AGENT, r.id, 'keep', 'The photo shows a public stage; no privacy issue.');
    expect(kept).toMatchObject({
      status: 'dismissed',
      resolution: 'kept',
      resolutionNote: 'The photo shows a public stage; no privacy issue.',
    });
    expect(kept.item?.status).toBe('published');
    expect(
      await row('select resolved_at, handled_by from media_reports where id = $1', [r.id]),
    ).toMatchObject({ handled_by: AGENT });
    expect(kept.events.map((e) => e.action)).toEqual(['submitted', 'review', 'hide', 'restore', 'keep']);
    // the staff's note is kept in the trail (the console shows it to staff; no email carries it)
    expect(kept.events.at(-1)).toMatchObject({
      actor: 'staff',
      detail: { hasNote: true, note: 'The photo shows a public stage; no privacy issue.' },
    });

    const audit = (
      await c.query(
        `select action, target_type, target_id, actor_id, details from admin_audit where target_id = $1 order by id`,
        [`media_report:${r.number}`],
      )
    ).rows;
    expect(audit.map((a) => a.action)).toEqual([
      'report.review',
      'report.hide',
      'report.restore',
      'report.keep',
    ]);
    expect(audit[0]).toMatchObject({ target_type: 'system', actor_id: AGENT, details: { role: 'support' } });
  });

  it('removing needs an owner or an admin: support is refused, the item stays; an admin deletes it for good', async () => {
    const it1 = await item(danaInvitation);
    const r = await submit({ item_id: it1, category: 'privacy' });
    expect(await reason(act(AGENT, r.id, 'remove', 'Remove it'))).toContain('forbidden');
    expect((await row('select deleted_at from gallery_items where id = $1', [it1])).deleted_at).toBeNull();
    expect((await row('select status from media_reports where id = $1', [r.id])).status).toBe('new');

    const trashBefore = (await row(`select count(*)::int as n from gallery_trash`)).n;
    const removed = await act(ADMIN, r.id, 'remove', 'Confirmed: it shows the reporter without consent.');
    expect(removed).toMatchObject({ status: 'actioned', resolution: 'removed', item: { deleted: true } });
    const gone = await row('select deleted_at, deleted_by from gallery_items where id = $1', [it1]);
    expect(gone.deleted_at).not.toBeNull();
    expect(gone.deleted_by).toBe('system');
    // the files go to the trash like any deletion
    const trash = (
      await c.query(`select bucket, path from gallery_trash order by id offset $1`, [trashBefore])
    ).rows;
    expect(trash).toEqual([
      { bucket: 'gallery-originals', path: `${danaInvitation}/${it1}/original.jpg` },
      { bucket: 'gallery-media', path: `${danaInvitation}/${it1}/display.jpg` },
      { bucket: 'gallery-media', path: `${danaInvitation}/${it1}/thumb.jpg` },
    ]);
    // the console's audit entry
    const audit = await row(`select action, actor_id, details from admin_audit where target_id = $1`, [
      `media_report:${r.number}`,
    ]);
    expect(audit).toEqual({ action: 'report.remove', actor_id: ADMIN, details: { role: 'admin' } });
    // an owner may too
    const other = await submit({ item_id: await item(danaInvitation) });
    expect((await act(OWNER, other.id, 'remove', 'owner removal')).resolution).toBe('removed');
  });

  it('a viewer (or finance) cannot read or act; support and above can read', async () => {
    const r = await submit();
    for (const who of [VIEWER, FINANCE]) {
      expect(await reason(commit('media_report_admin_list', [who, 'open', 10]))).toContain('forbidden');
      expect(await reason(commit('media_report_admin_get', [who, r.id]))).toContain('forbidden');
      for (const action of ['review', 'note', 'close'])
        expect(await reason(act(who, r.id, action, 'x'))).toContain('forbidden');
    }
    expect(await reason(act(DANA, r.id, 'review'))).toContain('forbidden');
    expect((await getReport(AGENT, r.id)).id).toBe(r.id);
    expect(
      await commit('media_report_admin_get', [AGENT, 'cccccccc-0000-4000-8000-000000000000']),
    ).toBeNull();
    expect(await reason(act(AGENT, 'cccccccc-0000-4000-8000-000000000000', 'review'))).toContain('not found');
  });

  it('the notes the rules ask for, and the actions that need an item', async () => {
    const withItem = await submit({ item_id: await item(danaInvitation) });
    for (const action of ['keep', 'dismiss', 'close', 'remove']) {
      expect(await reason(act(ADMIN, withItem.id, action, null))).toContain('note required');
      expect(await reason(act(ADMIN, withItem.id, action, ''))).toContain('note required');
    }
    expect((await getReport(ADMIN, withItem.id)).status).toBe('new');
    // none for review / hide / restore / note
    expect((await act(AGENT, withItem.id, 'note')).status).toBe('new');
    const noItem = await submit();
    for (const action of ['hide', 'restore', 'remove'])
      expect(await reason(act(ADMIN, noItem.id, action, 'x'))).toContain('no item');
    expect(await reason(act(AGENT, noItem.id, 'explode', 'x'))).toContain('bad action');
  });

  it('dismiss and close; a close keeps what the report already decided, and says hidden when the report hid the item', async () => {
    const spam = await submit();
    expect(await act(AGENT, spam.id, 'dismiss', 'spam')).toMatchObject({
      status: 'dismissed',
      resolution: 'not_applicable',
    });
    const hostHandled = await submit();
    expect(await act(AGENT, hostHandled.id, 'close', 'the host dealt with it')).toMatchObject({
      status: 'closed',
      resolution: 'host_handled',
    });
    const urgent = await submit({ item_id: await item(danaInvitation), category: 'child_safety' });
    expect(await act(AGENT, urgent.id, 'close', 'left hidden for the host to decide')).toMatchObject({
      status: 'closed',
      resolution: 'hidden',
      item: { status: 'hidden' },
    });
    const done = await submit();
    await act(AGENT, done.id, 'dismiss', 'first');
    expect(await act(AGENT, done.id, 'close', 'second')).toMatchObject({
      status: 'dismissed',
      resolution: 'not_applicable',
    });
  });

  it('the list: open first, urgent first, the filter; the reporter’s contact for roles that may see it', async () => {
    const calm = await submit({ reporter_email: 'calm@example.com', reporter_name: 'Calm' });
    const urgent = await submit({ category: 'child_safety', reporter_email: 'urgent@example.com' });
    const closed = await submit();
    await act(AGENT, closed.id, 'dismiss', 'x');
    const open = await commit<Report[]>('media_report_admin_list', [AGENT, 'open', 200]);
    const ids = open.map((r) => r.id);
    expect(ids.indexOf(urgent.id)).toBeLessThan(ids.indexOf(calm.id));
    expect(ids).not.toContain(closed.id);
    expect(open.find((r) => r.id === urgent.id)).toMatchObject({
      canReply: true,
      reporterEmail: 'urgent@example.com',
    });
    const all = await commit<Report[]>('media_report_admin_list', [AGENT, 'all', 200]);
    expect(all.map((r) => r.id)).toContain(closed.id);
    expect(await commit('media_report_admin_list', [AGENT, 'dismissed', 200])).toSatisfy((l: Report[]) =>
      l.every((r) => r.status === 'dismissed'),
    );
    expect(await commit('media_report_admin_list', [AGENT, null, 1])).toHaveLength(1);
    const noEmail = await submit();
    expect((await getReport(AGENT, noEmail.id)).canReply).toBe(false);
  });
});

describe('what is urgent, and the cap on automatic hiding', () => {
  it('a child (the category, or the reporter is the child’s parent or guardian) and an intimate image are urgent and hide the item', async () => {
    const inv = await newInvitation();
    const byGuardian = await submit({ invitation_id: inv, item_id: await item(inv), role: 'guardian' });
    expect(byGuardian).toMatchObject({ urgent: true, hidden: true });
    const byCategory = await submit({
      invitation_id: inv,
      item_id: await item(inv),
      category: 'child_safety',
    });
    expect(byCategory).toMatchObject({ urgent: true, hidden: true });
    // any category with the guardian role
    const copyright = await submit({
      invitation_id: inv,
      item_id: await item(inv),
      role: 'guardian',
      category: 'copyright',
      reporter_name: 'Dana',
      reporter_email: 'd@example.com',
    });
    expect(copyright).toMatchObject({ urgent: true, hidden: true });
    // not a guardian, not a child, not intimate: not urgent
    expect(await submit({ invitation_id: inv, item_id: await item(inv), role: 'depicted' })).toMatchObject({
      urgent: false,
      hidden: false,
    });
  });

  it('hides at most 5 items per invitation an hour: beyond that the report is urgent, stored, and the item stays', async () => {
    const inv = await newInvitation();
    const other = await newInvitation();
    const hiddenFlags: boolean[] = [];
    let sixth: { id: string; item: string } | null = null;
    for (let n = 0; n < 6; n++) {
      const it1 = await item(inv);
      const r = await submit({ invitation_id: inv, item_id: it1, category: 'child_safety' });
      hiddenFlags.push(r.hidden);
      expect(r.urgent).toBe(true);
      if (n === 5) sixth = { id: r.id, item: it1 };
    }
    expect(hiddenFlags).toEqual([true, true, true, true, true, false]);
    const m = await row(
      'select urgent, hidden_by_report, prior_status, status from media_reports where id = $1',
      [sixth!.id],
    );
    expect(m).toEqual({ urgent: true, hidden_by_report: false, prior_status: null, status: 'new' });
    expect(await itemRow(sixth!.item)).toMatchObject({ status: 'published', status_reason: 'ok' });
    const events = (
      await c.query(
        'select actor, action, detail from media_report_events where report_id = $1 order by id',
        [sixth!.id],
      )
    ).rows;
    expect(events.map((e) => e.action)).toEqual(['submitted', 'hide_capped']);
    expect(events[1]).toMatchObject({ actor: 'system', detail: { cap: 5 } });
    // another invitation is not affected
    expect(
      await submit({ invitation_id: other, item_id: await item(other), category: 'child_safety' }),
    ).toMatchObject({
      hidden: true,
    });
    // an hour later the cap is open again
    await c.query(
      `update media_report_events set created_at = now() - interval '61 minutes'
       where action = 'hidden_urgent' and report_id in (select id from media_reports where invitation_id = $1)`,
      [inv],
    );
    expect(
      await submit({ invitation_id: inv, item_id: await item(inv), category: 'child_safety' }),
    ).toMatchObject({
      hidden: true,
    });
  });

  it('the item is checked again under the lock: one deleted a moment ago is not reportable', async () => {
    const inv = await newInvitation();
    const it1 = await item(inv);
    await c.query(`update gallery_items set deleted_at = now(), deleted_by = 'host' where id = $1`, [it1]);
    await expect(submit({ invitation_id: inv, item_id: it1, category: 'child_safety' })).rejects.toThrow(
      'item not found',
    );
    const hiddenAlready = await item(inv, 'hidden');
    await expect(submit({ invitation_id: inv, item_id: hiddenAlready })).rejects.toThrow('item not found');
  });
});

describe('an item a report holds', () => {
  it('the host cannot publish, hide or reject it — only delete it; the others in the same call are decided', async () => {
    const inv = await newInvitation();
    const held = await item(inv);
    const normal = await item(inv);
    const r = await submit({ invitation_id: inv, item_id: held, category: 'child_safety' });
    expect(r.hidden).toBe(true);
    for (const action of ['publish', 'hide', 'reject']) {
      const done = await hostModerate(inv, [held], action);
      expect(done, action).toEqual({ count: 0, ids: [], held: [held] });
      expect(await itemRow(held), action).toMatchObject({
        status: 'hidden',
        status_reason: 'report',
        deleted_at: null,
      });
    }
    const mixed = await hostModerate(inv, [held, normal], 'hide');
    expect(mixed).toEqual({ count: 1, ids: [normal], held: [held] });
    expect(await itemRow(normal)).toMatchObject({ status: 'hidden', status_reason: 'host' });
    expect(await itemRow(held)).toMatchObject({ status_reason: 'report' });
    // a host's own hidden item is theirs to show again
    expect(await hostModerate(inv, [normal], 'publish')).toEqual({ count: 1, ids: [normal] });
    expect(await itemRow(normal)).toMatchObject({ status: 'published' });
    // delete is allowed, and puts the files in the trash
    const before = (await row('select count(*)::int as n from gallery_trash')).n;
    const deleted = await hostModerate(inv, [held], 'delete');
    expect(deleted).toEqual({ count: 1, ids: [held] });
    expect((await itemRow(held)).deleted_at).not.toBeNull();
    expect((await row('select count(*)::int as n from gallery_trash')).n).toBe(before + 3);
    // not their gallery: still null
    expect(await commit('gallery_owner_moderate', [inv, YOSSI, [held], 'delete'])).toBeNull();
  });

  it('staff’s restore is the way back; then the host decides again', async () => {
    const inv = await newInvitation();
    const it1 = await item(inv);
    const r = await submit({ invitation_id: inv, item_id: it1, intimate: true, category: 'harmful' });
    expect((await hostModerate(inv, [it1], 'publish')).count).toBe(0);
    const back = await act(AGENT, r.id, 'restore', 'Checked: not the person reported.');
    expect(back.item).toMatchObject({ status: 'published', reason: 'host' });
    expect(await hostModerate(inv, [it1], 'hide')).toEqual({ count: 1, ids: [it1] });
    expect((await hostModerate(inv, [it1], 'publish')).count).toBe(1);
  });

  it('a staff hide holds the item the same way', async () => {
    const inv = await newInvitation();
    const it1 = await item(inv);
    const r = await submit({ invitation_id: inv, item_id: it1 });
    await act(AGENT, r.id, 'hide', 'hold until I read it');
    expect(await hostModerate(inv, [it1], 'publish')).toEqual({ count: 0, ids: [], held: [it1] });
  });
});

describe('the staff’s decisions keep the item and the report consistent', () => {
  const heldReport = async (extra: Record<string, unknown> = {}) => {
    const inv = await newInvitation();
    const it1 = await item(inv);
    const r = await submit({ invitation_id: inv, item_id: it1, category: 'child_safety', ...extra });
    expect(r.hidden).toBe(true);
    return { inv, it1, r };
  };

  it('keep and dismiss put back an item that the report hid, and clear the flag', async () => {
    for (const [action, resolution] of [
      ['keep', 'kept'],
      ['dismiss', 'not_applicable'],
    ] as const) {
      const { it1, r } = await heldReport();
      const done = await act(AGENT, r.id, action, `${action}: not what was reported`);
      expect(done).toMatchObject({
        resolution,
        hiddenByReport: false,
        item: { status: 'published', reason: 'host' },
      });
      expect(await itemRow(it1)).toMatchObject({ status: 'published', status_reason: 'host' });
      expect(
        await row(
          `select result, detail from gallery_moderation where item_id = $1 and check_name = 'report' and decided_by = 'staff'`,
          [it1],
        ),
      ).toMatchObject({ result: 'published', detail: { restored: true, by: action } });
      expect(
        (await row('select published_at from gallery_items where id = $1', [it1])).published_at,
      ).not.toBeNull();
    }
  });

  it('keep leaves alone an item the host already deleted, or that was restored', async () => {
    const { it1, r } = await heldReport();
    await hostModerate(
      (await row('select invitation_id from gallery_items where id = $1', [it1])).invitation_id,
      [it1],
      'delete',
    );
    const done = await act(AGENT, r.id, 'keep', 'host deleted it');
    expect(done.item?.deleted).toBe(true);
    const second = await heldReport();
    await act(AGENT, second.r.id, 'restore');
    expect((await act(AGENT, second.r.id, 'keep', 'fine')).item).toMatchObject({ status: 'published' });
  });

  it('close says “hidden” only while the item is still held, else the host’s own decision stands', async () => {
    const held = await heldReport();
    expect(await act(AGENT, held.r.id, 'close', 'leave it held')).toMatchObject({
      resolution: 'hidden',
      item: { status: 'hidden', reason: 'report' },
    });
    const restored = await heldReport();
    await act(AGENT, restored.r.id, 'restore');
    expect(await act(AGENT, restored.r.id, 'close', 'back in the gallery')).toMatchObject({
      resolution: 'host_handled',
      status: 'closed',
    });
    const deleted = await heldReport();
    await hostModerate(deleted.inv, [deleted.it1], 'delete');
    expect((await act(AGENT, deleted.r.id, 'close', 'host removed it')).resolution).toBe('host_handled');
  });

  it('notes are kept in the trail — on every action, trimmed, up to 2000 characters, in any script', async () => {
    const { r } = await heldReport();
    const noted = await act(AGENT, r.id, 'note', '  The reporter called to add details.  ');
    expect(noted.events.at(-1)).toMatchObject({
      actor: 'staff',
      action: 'note',
      detail: { hasNote: true, note: 'The reporter called to add details.' },
    });
    const hebrew = 'ש'.repeat(2000);
    const long = await act(AGENT, r.id, 'hide', hebrew + 'extra');
    const note = (long.events.at(-1)!.detail as { note: string }).note;
    expect(note).toHaveLength(2000);
    const emoji = await act(AGENT, r.id, 'note', '😀'.repeat(2000));
    expect((emoji.events.at(-1)!.detail as { note: string }).note).toHaveLength(4000); // UTF-16 length of 2000 emoji
    // an action without a note says so
    const plain = await act(AGENT, r.id, 'review');
    expect(plain.events.at(-1)!.detail).toEqual({ hasNote: false });
    // the audit log carries no note
    const audit = await row(
      `select details from admin_audit where target_id = $1 and action = 'report.note' limit 1`,
      [`media_report:${r.number}`],
    );
    expect(JSON.stringify(audit)).not.toContain('reporter called');
  });
});

describe('privacy requests', () => {
  const request = (over: Record<string, unknown> = {}) =>
    commit<{ id: string; number: number; dueAt: string }>('privacy_request_submit', [
      JSON.stringify({
        kind: 'deletion',
        relation: 'guest',
        name: 'Yossi Levi',
        email: 'yossi@example.com',
        details: 'Please delete my photos from the wedding gallery.',
        locale: 'en',
        ip_hash: 'iphash-2',
        ...over,
      }),
    ]);
  type Req = {
    id: string;
    status: string;
    overdue: boolean;
    resolvedAt: string | null;
    decisionNote: string | null;
    email: string | null;
    dueAt: string;
    events: { action: string; detail: Record<string, unknown> }[];
  };
  const set = (actor: string, id: string, status: string, note: string | null = null) =>
    commit<Req>('privacy_request_admin_set', [actor, id, status, note]);

  it('is due 30 days after it arrives and starts with its trail', async () => {
    const r = await request();
    expect(r.number).toBeGreaterThanOrEqual(7001);
    const m = await row(
      `select status, extract(epoch from (due_at - created_at)) / 86400 as days, locale, phone, reference from privacy_requests where id = $1`,
      [r.id],
    );
    expect(m.status).toBe('new');
    expect(Number(m.days)).toBeGreaterThan(29.999);
    expect(Number(m.days)).toBeLessThan(30.001);
    expect(new Date(r.dueAt).getTime() - Date.now()).toBeGreaterThan(29.9 * 86_400_000);
    expect(m).toMatchObject({ locale: 'en', phone: null, reference: null });
    expect(
      (
        await c.query('select actor, action, detail from privacy_request_events where request_id = $1', [
          r.id,
        ])
      ).rows,
    ).toEqual([{ actor: 'requester', action: 'submitted', detail: { kind: 'deletion' } }]);
  });

  it('checks its fields', async () => {
    await expect(request({ kind: 'sell' })).rejects.toThrow(/kind/);
    await expect(request({ relation: 'ceo' })).rejects.toThrow(/relation/);
    await expect(request({ email: 'nope' })).rejects.toThrow(/email/);
    await expect(request({ details: 'short' })).rejects.toThrow(/details/);
    await expect(request({ name: '' })).rejects.toThrow(/name/);
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
      expect((await request({ kind })).number).toBeGreaterThan(7000);
  });

  it('the lifecycle: verifying, in progress, a final status needs a note and ends it; reopening clears the end', async () => {
    const r = await request();
    expect((await set(AGENT, r.id, 'verifying')).status).toBe('verifying');
    expect((await set(AGENT, r.id, 'in_progress')).resolvedAt).toBeNull();
    for (const status of ['fulfilled', 'partly', 'declined', 'closed'])
      expect(await reason(set(AGENT, r.id, status, null))).toContain('note required');
    expect(await reason(set(AGENT, r.id, 'new', 'x'))).toContain('bad status');
    const done = await set(AGENT, r.id, 'partly', 'Deleted the photos; invoices are kept by law.');
    expect(done).toMatchObject({
      status: 'partly',
      decisionNote: 'Deleted the photos; invoices are kept by law.',
    });
    expect(done.resolvedAt).not.toBeNull();
    const reopened = await set(AGENT, r.id, 'in_progress');
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.decisionNote).toBe('Deleted the photos; invoices are kept by law.');
    expect(reopened.events.map((e) => e.action)).toEqual([
      'submitted',
      'status_verifying',
      'status_in_progress',
      'status_partly',
      'status_in_progress',
    ]);
    const audit = (
      await c.query(`select action, details from admin_audit where target_id = $1 order by id`, [
        `privacy_request:${r.number}`,
      ])
    ).rows;
    expect(audit.map((a) => a.action)).toEqual(Array(4).fill('privacy_request.status'));
    expect(audit[2].details).toEqual({ role: 'support', status: 'partly' });
  });

  it('is overdue once the due date has passed and it is still open, and not after it ends', async () => {
    const r = await request();
    expect((await commit<Req>('privacy_request_admin_get', [AGENT, r.id])).overdue).toBe(false);
    await c.query(`update privacy_requests set due_at = now() - interval '1 day' where id = $1`, [r.id]);
    expect((await commit<Req>('privacy_request_admin_get', [AGENT, r.id])).overdue).toBe(true);
    await set(AGENT, r.id, 'declined', 'Not our data.');
    expect((await commit<Req>('privacy_request_admin_get', [AGENT, r.id])).overdue).toBe(false);
  });

  // privacy_request_admin_list orders with `y.m.due_at` where media_report_admin_list writes `(y.m).urgent`:
  // PostgreSQL then fails with "missing FROM-clause entry for table m" (a bug in the migration to fix).
  it('lists the open ones by due date, the finished ones after them, and filters by status', async () => {
    const late = await request();
    const soon = await request();
    await c.query(`update privacy_requests set due_at = now() - interval '2 days' where id = $1`, [late.id]);
    await c.query(`update privacy_requests set due_at = now() + interval '5 days' where id = $1`, [soon.id]);
    const open = (await commit<Req[]>('privacy_request_admin_list', [AGENT, 'open', 200])).map((x) => x.id);
    expect(open.indexOf(late.id)).toBeLessThan(open.indexOf(soon.id));
    const done = await request();
    await set(AGENT, done.id, 'declined', 'Not our data.');
    expect(open).not.toContain(done.id);
    const all = (await commit<Req[]>('privacy_request_admin_list', [AGENT, 'all', 200])).map((x) => x.id);
    expect(all).toContain(done.id);
    expect(all.indexOf(soon.id)).toBeLessThan(all.indexOf(done.id));
    const declined = await commit<Req[]>('privacy_request_admin_list', [AGENT, 'declined', 200]);
    expect(declined.every((x) => x.status === 'declined')).toBe(true);
    expect(await commit('privacy_request_admin_list', [AGENT, 'all', 1])).toHaveLength(1);
  });

  it('only support and above; notices are recorded as for reports', async () => {
    const r = await request();
    for (const who of [VIEWER, FINANCE]) {
      expect(await reason(set(who, r.id, 'verifying'))).toContain('forbidden');
      expect(await reason(commit('privacy_request_admin_list', [who, 'open', 5]))).toContain('forbidden');
      expect(await reason(commit('privacy_request_admin_get', [who, r.id]))).toContain('forbidden');
    }
    expect(await reason(set(AGENT, 'cccccccc-0000-4000-8000-000000000000', 'verifying'))).toContain(
      'not found',
    );
    expect((await commit<Req>('privacy_request_admin_get', [ADMIN, r.id])).email).toBe('yossi@example.com');
    await commit('privacy_request_mark_notified', [r.id, 'requester', true]);
    await commit('privacy_request_mark_notified', [r.id, 'team', false]);
    const m = await row(
      'select requester_notified_at, team_notified_at from privacy_requests where id = $1',
      [r.id],
    );
    expect(m.requester_notified_at).not.toBeNull();
    expect(m.team_notified_at).toBeNull();
    expect(await reason(commit('privacy_request_mark_notified', [r.id, 'host', true]))).toContain(
      'bad notice',
    );
  });
});

describe('acceptance evidence and the gallery acknowledgement', () => {
  it('records what an account accepted, newest first, and nothing for an unknown account', async () => {
    expect(await commit('legal_accept', [DANA, ['terms', 'privacy'], '2', 'signup', null])).toBe(2);
    expect(
      await commit('legal_accept', [DANA, ['terms', 'privacy', 'refunds'], '2', 'checkout', 'pro']),
    ).toBe(3);
    const list = await commit<{ doc: string; version: string; source: string; context: string | null }[]>(
      'legal_acceptances_of',
      [DANA],
    );
    expect(list).toHaveLength(5);
    expect(list[0]).toMatchObject({ version: '2', source: 'checkout' });
    expect(
      list
        .filter((a) => a.source === 'signup')
        .map((a) => a.doc)
        .sort(),
    ).toEqual(['privacy', 'terms']);
    expect(list.find((a) => a.context === 'pro')).toBeTruthy();
    expect(await commit('legal_acceptances_of', [YOSSI])).toEqual([]);
    expect(
      await reason(
        commit('legal_accept', ['dddddddd-0000-4000-8000-000000000000', ['terms'], '2', 'signup', null]),
      ),
    ).toContain('unknown user');
    await expect(commit('legal_accept', [DANA, ['cookies'], '2', 'signup', null])).rejects.toThrow(/doc_key/);
    await expect(commit('legal_accept', [DANA, ['terms'], 'two', 'signup', null])).rejects.toThrow(/version/);
    await expect(commit('legal_accept', [DANA, ['terms'], '2', 'email', null])).rejects.toThrow(/source/);
    // deleted with the account
    await c.query('delete from auth.users where id = $1', [FINANCE]);
    expect(await commit('legal_accept', [YOSSI, ['terms'], '2', 'signup', null])).toBe(1);
    await c.query('delete from auth.users where id = $1', [YOSSI]);
    expect(
      (await row('select count(*)::int as n from legal_acceptances where user_id = $1', [YOSSI])).n,
    ).toBe(0);
  });

  it('acknowledging the gallery notice is idempotent, per version, and refuses an unknown gallery', async () => {
    const hash = 'e'.repeat(64);
    const first = await commit<string>('gallery_acknowledge', [danaInvitation, hash, '2']);
    await new Promise((r) => setTimeout(r, 20));
    const second = await commit<string>('gallery_acknowledge', [danaInvitation, hash, '2']);
    expect(new Date(second).getTime()).toBe(new Date(first).getTime());
    expect(
      (
        await row('select count(*)::int as n from gallery_acknowledgements where invitation_id = $1', [
          danaInvitation,
        ])
      ).n,
    ).toBe(1);
    await commit('gallery_acknowledge', [danaInvitation, hash, '3']);
    expect(
      (
        await row('select count(*)::int as n from gallery_acknowledgements where invitation_id = $1', [
          danaInvitation,
        ])
      ).n,
    ).toBe(2);
    expect(
      await reason(commit('gallery_acknowledge', ['dddddddd-0000-4000-8000-000000000000', hash, '2'])),
    ).toContain('unknown gallery');
    await expect(commit('gallery_acknowledge', [danaInvitation, 'not-a-hash', '2'])).rejects.toThrow(
      /uploader_hash/,
    );
    // gone with the gallery
    await c.query('delete from galleries where invitation_id = $1', [yossiInvitation]);
  });
});

describe('the daily erasure', () => {
  it('erases only reports and requests that were resolved more than two years ago, and old address hashes', async () => {
    const old = await submit({ ip_hash: 'old-hash' });
    const recent = await submit({ ip_hash: 'recent-hash' });
    const openOld = await submit({ ip_hash: 'open-hash' });
    const young = await submit({ ip_hash: 'young-hash' });
    await act(AGENT, old.id, 'dismiss', 'x');
    await act(AGENT, recent.id, 'dismiss', 'x');
    await c.query(
      `update media_reports set resolved_at = now() - interval '25 months', created_at = now() - interval '26 months' where id = $1`,
      [old.id],
    );
    await c.query(
      `update media_reports set resolved_at = now() - interval '23 months', created_at = now() - interval '24 months' where id = $1`,
      [recent.id],
    );
    await c.query(`update media_reports set created_at = now() - interval '3 years' where id = $1`, [
      openOld.id,
    ]);
    await c.query(`update media_reports set created_at = now() - interval '31 days' where id = $1`, [
      young.id,
    ]);

    const reqs = async (ip: string) =>
      (
        await commit<{ id: string }>('privacy_request_submit', [
          JSON.stringify({
            kind: 'access',
            relation: 'guest',
            name: 'N',
            email: 'n@example.com',
            details: 'details details',
            ip_hash: ip,
          }),
        ])
      ).id;
    const oldReq = await reqs('r-old');
    const recentReq = await reqs('r-recent');
    const openReq = await reqs('r-open');
    await commit('privacy_request_admin_set', [AGENT, oldReq, 'fulfilled', 'done']);
    await commit('privacy_request_admin_set', [AGENT, recentReq, 'closed', 'done']);
    await c.query(
      `update privacy_requests set resolved_at = now() - interval '2 years 1 day', created_at = now() - interval '3 years' where id = $1`,
      [oldReq],
    );
    await c.query(`update privacy_requests set resolved_at = now() - interval '1 year' where id = $1`, [
      recentReq,
    ]);
    await c.query(`update privacy_requests set created_at = now() - interval '3 years' where id = $1`, [
      openReq,
    ]);

    const result = await commit<{ reports: number; requests: number; hashes: number }>(
      'legal_maintenance',
      [],
    );
    expect(result.reports).toBe(1);
    expect(result.requests).toBe(1);
    const exists = async (table: string, id: string) =>
      (await row(`select count(*)::int as n from ${table} where id = $1`, [id])).n === 1;
    expect(await exists('media_reports', old.id)).toBe(false);
    expect(await exists('media_reports', recent.id)).toBe(true);
    expect(await exists('media_reports', openOld.id)).toBe(true);
    expect(await exists('privacy_requests', oldReq)).toBe(false);
    expect(await exists('privacy_requests', recentReq)).toBe(true);
    expect(await exists('privacy_requests', openReq)).toBe(true);
    // the trail went with the report
    expect(
      (await row('select count(*)::int as n from media_report_events where report_id = $1', [old.id])).n,
    ).toBe(0);
    // address hashes older than 30 days are erased, younger ones kept
    const hash = async (id: string) =>
      (await row('select ip_hash from media_reports where id = $1', [id])).ip_hash;
    expect(await hash(openOld.id)).toBeNull();
    expect(await hash(young.id)).toBeNull();
    expect(await hash(recent.id)).toBeNull();
    const fresh = await submit({ ip_hash: 'fresh-hash' });
    await commit('legal_maintenance', []);
    expect(await hash(fresh.id)).toBe('fresh-hash');
    expect((await row('select ip_hash from privacy_requests where id = $1', [openReq])).ip_hash).toBeNull();
    // running it again changes nothing
    expect(await commit('legal_maintenance', [])).toEqual({ reports: 0, requests: 0, hashes: 0 });
  });
});

describe('none of it is reachable from the browser’s roles', () => {
  const TABLES = [
    'legal_acceptances',
    'gallery_acknowledgements',
    'media_reports',
    'media_report_events',
    'privacy_requests',
    'privacy_request_events',
  ];
  const FUNCTIONS = [
    'legal_accept(uuid, text[], text, text, text)',
    'legal_acceptances_of(uuid)',
    'gallery_acknowledge(uuid, text, text)',
    'media_report_item_visible(uuid, uuid)',
    'media_report_submit(jsonb)',
    'media_report_mark_notified(uuid, text, boolean)',
    'media_report_admin_list(uuid, text, int)',
    'media_report_admin_get(uuid, uuid)',
    'media_report_admin_act(uuid, uuid, text, text)',
    'privacy_request_submit(jsonb)',
    'privacy_request_mark_notified(uuid, text, boolean)',
    'privacy_request_admin_list(uuid, text, int)',
    'privacy_request_admin_get(uuid, uuid)',
    'privacy_request_admin_set(uuid, uuid, text, text)',
    'legal_maintenance()',
    'gallery_owner_moderate(uuid, uuid, uuid[], text)',
  ];

  it('anon and authenticated have no privilege on the six tables', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const table of TABLES) {
        for (const priv of ['select', 'insert', 'update', 'delete']) {
          const { rows } = await c.query('select has_table_privilege($1, $2, $3) as ok', [
            role,
            `public.${table}`,
            priv,
          ]);
          expect(rows[0].ok, `${role} ${priv} ${table}`).toBe(false);
        }
        await expect(
          as(c, role, role === 'authenticated' ? DANA : null, () => c.query(`select * from public.${table}`)),
        ).rejects.toThrow(/permission denied/);
      }
    }
    for (const table of TABLES) {
      const { rows } = await c.query(`select relrowsecurity as rls from pg_class where oid = $1::regclass`, [
        `public.${table}`,
      ]);
      expect(rows[0].rls, table).toBe(true);
    }
  });

  it('anon and authenticated cannot run any of the functions; the server’s role can', async () => {
    for (const fn of FUNCTIONS) {
      for (const role of ['anon', 'authenticated']) {
        const { rows } = await c.query('select has_function_privilege($1, $2, $3) as ok', [
          role,
          `public.${fn}`,
          'execute',
        ]);
        expect(rows[0].ok, `${role} ${fn}`).toBe(false);
      }
      const { rows } = await c.query('select has_function_privilege($1, $2, $3) as ok', [
        'service_role',
        `public.${fn}`,
        'execute',
      ]);
      expect(rows[0].ok, `service_role ${fn}`).toBe(true);
    }
    // really calling them
    await expect(
      as(c, 'anon', null, () => c.query(`select public.media_report_submit('{}'::jsonb)`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(c, 'authenticated', DANA, () =>
        c.query(`select public.legal_accept($1, array['terms'], '2', 'signup', null)`, [DANA]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(c, 'authenticated', AGENT, () =>
        c.query(`select public.media_report_admin_list($1, 'open', 5)`, [AGENT]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(as(c, 'anon', null, () => c.query(`select public.legal_maintenance()`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('the row helpers are not callable by anyone', async () => {
    for (const fn of [
      'media_report_json(public.media_reports, boolean)',
      'privacy_request_json(public.privacy_requests, boolean)',
    ])
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const { rows } = await c.query('select has_function_privilege($1, $2, $3) as ok', [
          role,
          `public.${fn}`,
          'execute',
        ]);
        expect(rows[0].ok, `${role} ${fn}`).toBe(false);
      }
  });
});
