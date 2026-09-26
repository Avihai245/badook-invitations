import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The studio layer (supabase/migrations/*_studio.sql): every save of a draft recoverable (the tracked
// autosave and its coalescing, snapshots before a restore or a design concept, the history, restoring
// any entry, the cap and the daily purge — publishes untouched); the draft review link (setup, rotate,
// expiry, revoke, comments pinned by the link's hash with rate limits, replies both ways, handled /
// open, removal, the host's emails, housekeeping); the voice queue (queue, claim, done, failed, the
// guest page's tracks) — and nothing for anyone but the service role.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let doc: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows[0] as T;
const all = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows as T[];

/** A new draft invitation of OWNER (a copy of the seeded sample's draft). */
async function newInvitation(slug: string, owner = OWNER): Promise<string> {
  const created = await commit<{ id: string }>('create_invitation', [
    owner,
    'sahar-bordeaux',
    'wedding',
    slug,
    doc,
  ]);
  return created.id;
}
/** The row's updated_at as the functions report it (JSON). */
const updatedAt = async (id: string) =>
  (await one<{ u: string }>(`select to_jsonb(updated_at) #>> '{}' u from invitations where id = $1`, [id])).u;
/** The draft with one value changed (the startTime: something a host edits). */
const edited = (time: string) => ({ ...doc, event: { ...doc.event, startTime: time } });
/** Moves an invitation's saves back in time (the coalescing window, the purge). */
const age = (id: string, interval: string) =>
  c.query(
    `update invitation_versions set created_at = created_at - $2::interval where invitation_id = $1 and kind = 'save'`,
    [id, interval],
  );
const saves = (id: string) =>
  all<{ reason: string; start: string }>(
    `select reason, document#>>'{event,startTime}' start from invitation_versions
     where invitation_id = $1 and kind = 'save' order by created_at, id`,
    [id],
  );
const save = async (id: string, draft: unknown, every = 600, max = 60) =>
  commit<Record<string, unknown>>('save_invitation_draft_tracked', [
    id,
    OWNER,
    JSON.stringify(draft),
    await updatedAt(id),
    every,
    max,
  ]);

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'studio@example.com'), ($2, 'other@example.com')`,
    [OWNER, OTHER],
  );
  doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

// ─── every save recoverable ──────────────────────────────────────────────────────────────────────

describe('the tracked autosave', () => {
  it('saves like before (conflicts, other owners) and keeps the draft it replaces — once per stretch of editing', async () => {
    const id = await newInvitation('studio-saves');
    const first = await save(id, edited('18:00'));
    expect(first).toMatchObject({ ok: true, kept: true, reviewChannel: null });
    expect(typeof first.updatedAt).toBe('string');
    // the draft as seeded is the first save
    expect(await saves(id)).toEqual([{ reason: 'autosave', start: doc.event.startTime }]);
    // within ten minutes of editing: no new copy
    expect(await save(id, edited('18:30'))).toMatchObject({ ok: true, kept: false });
    expect(await save(id, edited('19:00'))).toMatchObject({ ok: true, kept: false });
    expect(await saves(id)).toHaveLength(1);
    // later: the draft as it was then
    await age(id, '11 minutes');
    expect(await save(id, edited('19:15'))).toMatchObject({ ok: true, kept: true });
    expect((await saves(id)).map((s) => s.start)).toEqual([doc.event.startTime, '19:00']);
    // the same document twice is no change: nothing kept
    await age(id, '11 minutes');
    expect(await save(id, edited('19:15'))).toMatchObject({ ok: true, kept: false });
    // a stale version conflicts, with the stored draft; another owner gets nothing
    const stale = await commit<Record<string, any>>('save_invitation_draft_tracked', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      id,
      OWNER,
      JSON.stringify(edited('20:00')),
      '2000-01-01T00:00:00Z',
      600,
      60,
    ]);
    expect(stale).toMatchObject({ ok: false, code: 'conflict' });
    expect(stale.draft.event.startTime).toBe('19:15');
    expect(
      await commit('save_invitation_draft_tracked', [
        id,
        OTHER,
        JSON.stringify(doc),
        await updatedAt(id),
        600,
        60,
      ]),
    ).toBeNull();
  });

  it('the slug stays the row’s; a template the database has is taken, an unknown one is not', async () => {
    const id = await newInvitation('studio-template');
    await save(id, { ...doc, share: { ...doc.share, slug: 'hijack' }, templateId: 'honey-meadow' });
    let row = await one<{ template_id: string; t: string; s: string }>(
      `select template_id, draft->>'templateId' t, draft#>>'{share,slug}' s from invitations where id = $1`,
      [id],
    );
    expect(row).toEqual({ template_id: 'honey-meadow', t: 'honey-meadow', s: 'studio-template' });
    await save(id, { ...doc, templateId: 'no-such-design' });
    row = await one(
      `select template_id, draft->>'templateId' t, draft#>>'{share,slug}' s from invitations where id = $1`,
      [id],
    );
    expect(row.template_id).toBe('honey-meadow');
    expect(row.t).toBe('honey-meadow');
  });

  it('a draft that is the published one needs no copy (the publish holds it)', async () => {
    const id = await newInvitation('studio-published');
    await commit('publish_invitation', [id, OWNER]);
    const before = (await saves(id)).length;
    await save(id, edited('17:00'));
    expect((await saves(id)).length).toBe(before);
  });

  it('keeps at most the cap: the oldest saves go first', async () => {
    const id = await newInvitation('studio-cap');
    for (let n = 0; n < 5; n++) {
      await save(id, edited(`1${n}:00`), 0, 3);
    }
    expect((await saves(id)).map((s) => s.start)).toEqual(['11:00', '12:00', '13:00']);
  });
});

describe('snapshots, the history and restoring', () => {
  it('keeps the draft before a restore or a concept, lists everything newest first, and restores any entry', async () => {
    const id = await newInvitation('studio-restore');
    await save(id, edited('18:00'), 0);
    await commit('publish_invitation', [id, OWNER]);
    // the draft being replaced is the published one: the publish holds it, no save
    expect(await save(id, edited('21:00'), 0)).toMatchObject({ kept: false });
    expect(await commit('snapshot_invitation_draft', [id, OWNER, 'concept', 60])).toMatchObject({ ok: true });
    // the same draft again: nothing new
    expect(await commit('snapshot_invitation_draft', [id, OWNER, 'concept', 60])).toEqual({
      ok: true,
      id: null,
    });
    await expect(commit('snapshot_invitation_draft', [id, OWNER, 'nonsense', 60])).rejects.toThrow(/reason/);
    expect(await commit('snapshot_invitation_draft', [id, OTHER, 'concept', 60])).toBeNull();
    // the concept's copy is the newest entry: an autosave of the same draft adds nothing
    expect(await save(id, edited('22:00'), 0)).toMatchObject({ kept: false });

    const history = await commit<
      { id: number; kind: string; version: number | null; reason: string | null }[]
    >('owner_invitation_history', [id, OWNER, 100]);
    expect(history.map((h) => [h.kind, h.version, h.reason])).toEqual([
      ['save', null, 'concept'],
      ['publish', 1, null],
      ['save', null, 'autosave'],
    ]);
    expect(await commit('owner_invitation_history', [id, OTHER, 100])).toEqual([]);
    // the older functions list and read the publishes only
    expect(await commit('owner_invitation_versions', [id, OWNER])).toEqual([
      { version: 1, createdAt: expect.any(String) },
    ]);

    const publish = history.find((h) => h.kind === 'publish')!;
    const entry = await commit<{ document: { event: { startTime: string } } }>('owner_invitation_entry', [
      id,
      OWNER,
      publish.id,
    ]);
    expect(entry.document.event.startTime).toBe('18:00');
    expect(await commit('owner_invitation_entry', [id, OTHER, publish.id])).toBeNull();

    // restore the publish: the current draft is kept first (the restore can be undone)
    const restored = await commit<{
      ok: boolean;
      draft: { event: { startTime: string } };
      updatedAt: string;
    }>('restore_invitation_entry', [id, OWNER, publish.id, 60]);
    expect(restored.ok).toBe(true);
    expect(restored.draft.event.startTime).toBe('18:00');
    expect(restored.updatedAt).toBe(await updatedAt(id));
    const after = await saves(id);
    expect(after.at(-1)).toEqual({ reason: 'restore', start: '22:00' });
    // another owner's, or an entry of another invitation: nothing
    expect(await commit('restore_invitation_entry', [id, OTHER, publish.id, 60])).toBeNull();
    const other = await newInvitation('studio-restore-other');
    expect(await commit('restore_invitation_entry', [other, OWNER, publish.id, 60])).toBeNull();
    // the old restore by version still restores publishes
    expect(await commit('restore_invitation_version', [id, OWNER, 1])).toBe(true);
  });

  it('the daily purge: saves older than the keeping time and beyond the cap go; publishes stay', async () => {
    const id = await newInvitation('studio-purge');
    await save(id, edited('10:00'), 0);
    await commit('publish_invitation', [id, OWNER]);
    await save(id, edited('11:00'), 0);
    await save(id, edited('12:00'), 0);
    await save(id, edited('13:00'), 0);
    await age(id, '100 days');
    await save(id, edited('14:00'), 0);
    await save(id, edited('15:00'), 0);
    const removed = await commit<number>('invitation_saves_purge', [90, 1]);
    expect(removed).toBeGreaterThanOrEqual(4);
    expect((await saves(id)).map((s) => s.start)).toEqual(['14:00']);
    const publishes = await all(
      `select version from invitation_versions where invitation_id = $1 and kind = 'publish'`,
      [id],
    );
    expect(publishes).toHaveLength(1);
  });

  it('the table keeps its shape: a publish is numbered, a save has a reason', async () => {
    const id = await newInvitation('studio-shape');
    await expect(
      c.query(
        `insert into invitation_versions (invitation_id, version, document, kind) values ($1, null, '{}', 'publish')`,
        [id],
      ),
    ).rejects.toThrow(/invitation_versions_kind_shape/);
    await expect(
      c.query(
        `insert into invitation_versions (invitation_id, version, document, kind) values ($1, null, '{}', 'save')`,
        [id],
      ),
    ).rejects.toThrow(/invitation_versions_kind_shape/);
  });
});

// ─── draft review ────────────────────────────────────────────────────────────────────────────────

const RATE = sha('an-address');
const LINK = {
  token: 'review-token-aaaaaaaaaaaa',
  nonce: 'review-nonce-0123456789',
  channel: 'review-channel-0123456789',
};

describe('the review link', () => {
  let id: string;
  beforeAll(async () => {
    id = await newInvitation('studio-review');
  });

  it('is made once for the owner; rotated, expired, revoked and made again', async () => {
    expect(await commit('review_owner_get', [id, OWNER])).toMatchObject({ link: null, comments: [] });
    expect(await commit('review_owner_get', [id, OTHER])).toBeNull();
    expect(
      await commit('review_owner_setup', [id, OTHER, sha(LINK.token), LINK.nonce, LINK.channel, null]),
    ).toBeNull();
    const made = await commit<{ link: Record<string, unknown> }>('review_owner_setup', [
      id,
      OWNER,
      sha(LINK.token),
      LINK.nonce,
      LINK.channel,
      null,
    ]);
    expect(made.link).toMatchObject({
      tokenHash: sha(LINK.token),
      tokenNonce: LINK.nonce,
      channel: LINK.channel,
      expiresAt: null,
      revokedAt: null,
      notify: 'each',
    });
    // a second setup leaves a working link as it is
    const again = await commit<{ link: Record<string, unknown> }>('review_owner_setup', [
      id,
      OWNER,
      sha('other-token-bbbbbbbbbbbb'),
      'other-nonce-0123456789',
      'other-channel-012345678',
      null,
    ]);
    expect(again.link.tokenHash).toBe(sha(LINK.token));
    expect(await commit('review_link', [sha(LINK.token)])).toEqual({
      invitationId: id,
      channel: LINK.channel,
      state: 'ok',
    });
    expect(await commit('review_link', [sha('nope')])).toBeNull();

    // the autosave tells the review page (its channel)
    expect(await save(id, edited('18:45'))).toMatchObject({ ok: true, reviewChannel: LINK.channel });

    // rotate: the old token stops, the new one works
    await commit('review_owner_rotate', [
      id,
      OWNER,
      sha('rotated-token-cccccccccc'),
      'rotated-nonce-012345678',
      'rotated-channel-01234567',
    ]);
    expect(await commit('review_link', [sha(LINK.token)])).toBeNull();
    expect(await commit('review_link', [sha('rotated-token-cccccccccc')])).toMatchObject({ state: 'ok' });
    expect(
      await commit('review_owner_rotate', [
        id,
        OTHER,
        sha('x'),
        'rotated-nonce-012345678',
        'y-channel-0123456789',
      ]),
    ).toBeNull();

    // expiry and the notification mode
    const expired = await commit<{ link: Record<string, unknown> }>('review_owner_update', [
      id,
      OWNER,
      JSON.stringify({ expiresAt: '2001-01-01T00:00:00Z', notify: 'daily' }),
    ]);
    expect(expired.link).toMatchObject({ notify: 'daily' });
    expect(await commit('review_link', [sha('rotated-token-cccccccccc')])).toMatchObject({
      state: 'expired',
    });
    expect(await commit('review_open', [sha('rotated-token-cccccccccc'), RATE])).toBeNull();
    await expect(
      commit('review_owner_update', [id, OWNER, JSON.stringify({ notify: 'hourly' })]),
    ).rejects.toThrow(/notify/);
    await commit('review_owner_update', [id, OWNER, JSON.stringify({ expiresAt: null })]);
    expect(await commit('review_link', [sha('rotated-token-cccccccccc')])).toMatchObject({ state: 'ok' });

    // revoke: the link says so; a new setup replaces it
    await commit('review_owner_revoke', [id, OWNER]);
    expect(await commit('review_link', [sha('rotated-token-cccccccccc')])).toMatchObject({
      state: 'revoked',
    });
    expect(await save(id, edited('18:50'))).toMatchObject({ reviewChannel: null });
    const remade = await commit<{ link: Record<string, unknown> }>('review_owner_setup', [
      id,
      OWNER,
      sha(LINK.token),
      LINK.nonce,
      LINK.channel,
      null,
    ]);
    expect(remade.link).toMatchObject({ tokenHash: sha(LINK.token), revokedAt: null });
  });

  it('family members pin comments by the link: numbered, on a section of the draft, limited', async () => {
    const opened = await commit<Record<string, any>>('review_open', [sha(LINK.token), RATE]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(opened).toMatchObject({
      ok: true,
      channel: LINK.channel,
      templateId: 'sahar-bordeaux',
      comments: [],
    });
    expect(opened.draft.share.slug).toBe('studio-review');
    const hero = opened.draft.sections[0].id as string;
    const key = sha('a-browser-key');
    const first = randomUUID();
    const added = await commit<Record<string, any>>('review_comment_add', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      sha(LINK.token),
      RATE,
      key,
      first,
      hero,
      0.25,
      0.5,
      '  דודה רותי ',
      'אולי תמונה אחרת?',
    ]);
    expect(added.ok).toBe(true);
    expect(added.comment).toMatchObject({
      id: first,
      number: 1,
      sectionId: hero,
      x: 0.25,
      y: 0.5,
      name: 'דודה רותי',
      body: 'אולי תמונה אחרת?',
      status: 'open',
      replies: [],
    });
    expect(added.comment.draftUpdatedAt).toBe(opened.updatedAt);
    // a retried request adds it once
    expect(
      (
        await commit<Record<string, any>>('review_comment_add', [
          sha(LINK.token),
          RATE,
          key,
          first,
          hero,
          0.25,
          0.5,
          'x',
          'y',
        ])
      ).comment.number,
    ).toBe(1); // eslint-disable-line @typescript-eslint/no-explicit-any
    const second = await commit<Record<string, any>>('review_comment_add', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      sha(LINK.token),
      RATE,
      null,
      randomUUID(),
      hero,
      0.9,
      0.1,
      'Dana',
      'Love it',
    ]);
    expect(second.comment.number).toBe(2);
    // an unknown section, a link that isn't
    expect(
      await commit('review_comment_add', [
        sha(LINK.token),
        RATE,
        key,
        randomUUID(),
        'no-such-section',
        0.1,
        0.1,
        'x',
        'y',
      ]),
    ).toEqual({ ok: false, code: 'unknown_section' });
    expect(
      await commit('review_comment_add', [sha('nope'), RATE, key, randomUUID(), hero, 0.1, 0.1, 'x', 'y']),
    ).toBeNull();

    // replies both ways; the author's key never comes back
    const reply = await commit<Record<string, any>>('review_owner_reply', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      id,
      OWNER,
      first,
      randomUUID(),
      'בטח, נחליף',
    ]);
    expect(reply.comment.replies).toEqual([
      { id: expect.any(String), by: 'host', name: null, body: 'בטח, נחליף', at: expect.any(String) },
    ]);
    const familyReply = await commit<Record<string, any>>('review_reply_add', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      sha(LINK.token),
      RATE,
      key,
      first,
      randomUUID(),
      'רותי',
      'תודה!',
    ]);
    expect(familyReply.comment.replies).toHaveLength(2);
    expect(familyReply.comment.replies[1]).toEqual({
      id: expect.any(String),
      by: 'reviewer',
      name: 'רותי',
      body: 'תודה!',
      at: expect.any(String),
    });
    expect(await commit('review_owner_reply', [id, OTHER, first, randomUUID(), 'x'])).toBeNull();

    // handled and open again (the host only)
    expect(await commit('review_owner_status', [id, OWNER, first, 'handled'])).toMatchObject({
      ok: true,
      comment: { status: 'handled', handledAt: expect.any(String) },
    });
    expect(await commit('review_owner_status', [id, OWNER, first, 'open'])).toMatchObject({
      comment: { status: 'open', handledAt: null },
    });
    expect(await commit('review_owner_status', [id, OTHER, first, 'handled'])).toBeNull();
    await expect(commit('review_owner_status', [id, OWNER, first, 'done'])).rejects.toThrow(/status/);

    // a family member removes their own comment only
    expect(
      await commit('review_comment_remove', [sha(LINK.token), RATE, sha('someone-else'), first]),
    ).toEqual({ ok: false, code: 'not_found' });
    const secondId = second.comment.id as string;
    expect(await commit('review_comment_remove', [sha(LINK.token), RATE, key, secondId])).toEqual({
      ok: false,
      code: 'not_found',
    });
    const third = await commit<Record<string, any>>('review_comment_add', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      sha(LINK.token),
      RATE,
      key,
      randomUUID(),
      hero,
      0.5,
      0.5,
      'רותי',
      'מחקו את זה',
    ]);
    expect(third.comment.number).toBe(3);
    expect(await commit('review_comment_remove', [sha(LINK.token), RATE, key, third.comment.id])).toEqual({
      ok: true,
    });
    // the host removes any; numbers are never reused
    expect(await commit('review_owner_delete', [id, OTHER, secondId])).toBe(false);
    expect(await commit('review_owner_delete', [id, OWNER, secondId])).toBe(true);
    const fourth = await commit<Record<string, any>>('review_comment_add', [
      // eslint-disable-line @typescript-eslint/no-explicit-any
      sha(LINK.token),
      RATE,
      key,
      randomUUID(),
      hero,
      0.5,
      0.5,
      'רותי',
      'עוד אחת',
    ]);
    expect(fourth.comment.number).toBe(4);
    const view = await commit<{ comments: { number: number }[] }>('review_owner_get', [id, OWNER]);
    expect(view.comments.map((x) => x.number)).toEqual([1, 4]);
  });

  it('writes are limited per address and per link; reading too', async () => {
    const hero = doc.sections[0].id as string;
    const busy = sha('a-busy-address');
    let last: unknown = null;
    for (let n = 0; n < 41; n++)
      last = await commit('review_comment_add', [
        sha(LINK.token),
        busy,
        null,
        randomUUID(),
        hero,
        0.1,
        0.1,
        'a',
        'b',
      ]);
    expect(last).toEqual({ ok: false, code: 'rate' });
    // another address may still write
    expect(
      await commit<{ ok: boolean }>('review_comment_add', [
        sha(LINK.token),
        sha('calm'),
        null,
        randomUUID(),
        hero,
        0.1,
        0.1,
        'a',
        'b',
      ]),
    ).toMatchObject({ ok: true });
    const reader = sha('a-reader');
    await c.query(`insert into gallery_rate_events (key_hash) select $1 from generate_series(1, 1200)`, [
      reader,
    ]);
    expect(await commit('review_open', [sha(LINK.token), reader])).toEqual({ ok: false, code: 'rate' });
  });

  it('tells the host what is new once, and daily for the summary mode', async () => {
    const pending = await commit<Record<string, any>>('review_notify_pending', [id]); // eslint-disable-line @typescript-eslint/no-explicit-any
    // (the daily summary: set above)
    expect(pending).toMatchObject({ id, mode: 'daily', notifiedAt: null, email: 'studio@example.com' });
    expect(pending.comments.length).toBeGreaterThan(2);
    expect(pending.comments.some((x: { reply: boolean }) => x.reply)).toBe(true);
    expect(pending.document.share.slug).toBe('studio-review');
    expect(await commit('review_digest_due', [])).toContain(id);
    await commit('review_notify_mark', [id, new Date().toISOString()]);
    expect((await commit<{ comments: unknown[] }>('review_notify_pending', [id])).comments).toEqual([]);
    expect(await commit('review_digest_due', [])).not.toContain(id);
    await commit('review_owner_update', [id, OWNER, JSON.stringify({ notify: 'off' })]);
    const hero = doc.sections[0].id as string;
    await commit('review_comment_add', [
      sha(LINK.token),
      sha('late'),
      null,
      randomUUID(),
      hero,
      0.1,
      0.1,
      'a',
      'b',
    ]);
    expect(await commit('review_digest_due', [])).not.toContain(id);
  });

  it('housekeeping: comments go 90 days after the event, removed ones after a month', async () => {
    const gone = await newInvitation('studio-review-old');
    await commit('review_owner_setup', [
      gone,
      OWNER,
      sha('old-token-dddddddddddd'),
      LINK.nonce,
      'old-channel-0123456789',
      null,
    ]);
    await commit('review_comment_add', [
      sha('old-token-dddddddddddd'),
      sha('o'),
      null,
      randomUUID(),
      doc.sections[0].id,
      0.1,
      0.1,
      'a',
      'b',
    ]);
    await c.query(
      `update invitations set draft = jsonb_set(draft, '{event,date}', '"2020-01-01"') where id = $1`,
      [gone],
    );
    await c.query(
      `update review_comments set deleted_at = now() - interval '40 days' where invitation_id = $1 and number = 4`,
      [id],
    );
    const result = await commit<{ comments: number; removed: number }>('review_maintenance', [90]);
    expect(result.comments).toBeGreaterThanOrEqual(1);
    expect(result.removed).toBeGreaterThanOrEqual(1);
    expect(await all(`select 1 from review_comments where invitation_id = $1`, [gone])).toEqual([]);
  });
});

// ─── voice ───────────────────────────────────────────────────────────────────────────────────────

describe('the voice queue', () => {
  it('queues changed languages, claims published ones, keeps the old audio until the new is ready', async () => {
    const id = await newInvitation('studio-voice');
    const h1 = sha('he-1');
    const e1 = sha('en-1');
    const items = [
      { locale: 'he', hash: h1, voice: 'he-IL-HilaNeural' },
      { locale: 'en', hash: e1, voice: 'en-GB-SoniaNeural' },
    ];
    expect(await commit('voice_queue', [id, OTHER, JSON.stringify(items)])).toBeNull();
    expect(await commit('voice_queue', [id, OWNER, JSON.stringify(items)])).toEqual({
      queued: 2,
      remove: [],
    });
    // not published: nothing to make yet
    expect(await commit('voice_claim', [id, 10])).toEqual([]);
    await commit('publish_invitation', [id, OWNER]);
    const claimed = await commit<
      { locale: string; textHash: string; ownerId: string; slug: string; document: unknown }[]
    >('voice_claim', [id, 10]);
    expect(claimed.map((x) => x.locale).sort()).toEqual(['en', 'he']);
    expect(claimed[0]).toMatchObject({ ownerId: OWNER, slug: 'studio-voice', attempts: 1 });
    expect(claimed[0]!.document).toBeTruthy();
    // taken: not claimed twice
    expect(await commit('voice_claim', [id, 10])).toEqual([]);
    expect(await commit('voice_done', [id, 'he', h1, `${OWNER}/${id}/voice/he-1.mp3`, 1234])).toEqual({
      ok: true,
      old: null,
    });
    await commit('voice_failed', [id, 'en', e1, 'the service said no', 0]);
    expect(await commit('voice_tracks', ['studio-voice'])).toEqual([
      { locale: 'he', hash: h1, path: `${OWNER}/${id}/voice/he-1.mp3` },
    ]);
    const state = await commit<{ locale: string; status: string; ready: boolean }[]>('voice_owner_state', [
      id,
      OWNER,
    ]);
    expect(state.map((s) => [s.locale, s.status, s.ready])).toEqual([
      ['en', 'failed', false],
      ['he', 'ready', true],
    ]);
    expect(await commit('voice_owner_state', [id, OTHER])).toBeNull();

    // the same words again: nothing new; a failed one is queued again; new words replace the old audio
    const h2 = sha('he-2');
    expect(
      await commit('voice_queue', [id, OWNER, JSON.stringify([{ ...items[0], hash: h2 }, items[1]])]),
    ).toEqual({ queued: 2, remove: [] });
    // the audio stays on the page (its hash is the old words') until the new one is ready
    expect(await commit('voice_tracks', ['studio-voice'])).toEqual([
      { locale: 'he', hash: h1, path: `${OWNER}/${id}/voice/he-1.mp3` },
    ]);
    const again = await commit<{ locale: string }[]>('voice_claim', [id, 10]);
    expect(again.map((x) => x.locale).sort()).toEqual(['en', 'he']);
    // a worker that made the old words' audio after the change: not wanted
    expect(await commit('voice_done', [id, 'he', h1, `${OWNER}/${id}/voice/he-late.mp3`, 1])).toEqual({
      ok: false,
    });
    expect(await commit('voice_done', [id, 'he', h2, `${OWNER}/${id}/voice/he-2.mp3`, 1])).toEqual({
      ok: true,
      old: `${OWNER}/${id}/voice/he-1.mp3`,
    });
    // a language the invitation dropped goes, with its file (English, still being made, stays)
    expect(await commit('voice_queue', [id, OWNER, JSON.stringify([{ ...items[1] }])])).toEqual({
      queued: 0,
      remove: [`${OWNER}/${id}/voice/he-2.mp3`],
    });
    // English had no audio yet: nothing to remove
    expect(await commit('voice_queue', [id, OWNER, JSON.stringify([])])).toEqual({ queued: 0, remove: [] });
  });

  it('a failed language is tried again later, three times at most; a stuck one is taken back', async () => {
    const id = await newInvitation('studio-voice-retry');
    const h = sha('retry');
    await commit('publish_invitation', [id, OWNER]);
    await commit('voice_queue', [id, OWNER, JSON.stringify([{ locale: 'he', hash: h, voice: 'v' }])]);
    for (let n = 1; n <= 3; n++) {
      const claimed = await commit<{ attempts: number }[]>('voice_claim', [id, 5]);
      expect(claimed.map((x) => x.attempts)).toEqual([n]);
      if (n < 3) await commit('voice_failed', [id, 'he', h, 'busy', 0]);
    }
    // the third try hangs: after ten minutes it isn't taken again (no tries left)
    await c.query(
      `update invitation_voice set claimed_at = now() - interval '11 minutes' where invitation_id = $1`,
      [id],
    );
    expect(await commit('voice_claim', [id, 5])).toEqual([]);
    // a waiting time is respected
    const other = await newInvitation('studio-voice-wait');
    await commit('publish_invitation', [other, OWNER]);
    await commit('voice_queue', [other, OWNER, JSON.stringify([{ locale: 'he', hash: h, voice: 'v' }])]);
    await commit('voice_claim', [other, 5]);
    await commit('voice_failed', [other, 'he', h, 'busy', 600]);
    expect(await commit('voice_claim', [other, 5])).toEqual([]);
  });
});

// ─── privileges ──────────────────────────────────────────────────────────────────────────────────

describe('privileges', () => {
  it('nobody but the service role runs the functions; nobody at all the helpers; the tables are closed', async () => {
    const calls = [
      `select save_invitation_draft_tracked(gen_random_uuid(), gen_random_uuid(), '{}', now(), 1, 1)`,
      `select snapshot_invitation_draft(gen_random_uuid(), gen_random_uuid(), 'concept', 1)`,
      `select owner_invitation_history(gen_random_uuid(), gen_random_uuid(), 1)`,
      `select restore_invitation_entry(gen_random_uuid(), gen_random_uuid(), 1, 1)`,
      `select invitation_saves_purge(1, 1)`,
      `select review_open('x', 'y')`,
      `select review_comment_add('x', 'y', null, gen_random_uuid(), 's', 0.1, 0.1, 'a', 'b')`,
      `select review_owner_get(gen_random_uuid(), gen_random_uuid())`,
      `select voice_tracks('x')`,
      `select voice_claim(null, 1)`,
    ];
    for (const role of ['anon', 'authenticated'] as const)
      for (const sql of calls)
        await expect(
          as(c, role, role === 'anon' ? null : OWNER, () => c.query(sql)),
          sql,
        ).rejects.toThrow(/permission denied/);
    for (const sql of [
      `select invitation_snapshot(gen_random_uuid(), '{}', 'autosave', 1)`,
      `select review_link_row('x')`,
      `select review_write_allowed('x', 'y')`,
    ])
      await expect(
        as(c, 'service_role', null, () => c.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
    for (const table of ['review_links', 'review_comments', 'invitation_voice'])
      for (const role of ['anon', 'authenticated'] as const)
        await expect(
          as(c, role, role === 'anon' ? null : OWNER, () => c.query(`select * from ${table}`)),
        ).rejects.toThrow(/permission denied/);
    // the service role runs what the server calls
    await expect(
      as(c, 'service_role', null, () => c.query(`select voice_tracks('x')`)),
    ).resolves.toBeTruthy();
  });
});
