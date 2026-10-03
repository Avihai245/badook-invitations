import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { PlanIdea } from '@/features/planning/model/plan';
import { IdeaPatch } from '@/features/planning/model/schemas-ideas';
import { ideaOperation } from '@/features/planning/server/ideas';
import {
  cleanText,
  decodeEntities,
  fetchPreview,
  isPublicAddress,
  liveFetch,
  parseHtml,
  PREVIEW_LIMIT,
  PREVIEW_MAX_BYTES,
  previewOperation,
  PreviewError,
  type PreviewDeps,
  type PreviewFailure,
  type PreviewFetchDeps,
  type PreviewRequest,
  type PreviewResponse,
} from '@/features/planning/server/preview';
import type { PlanningDeps } from '@/features/planning/server/types';
import {
  addTags,
  byBoard,
  draftHasContent,
  draftOf,
  draftPatch,
  emptyDraft,
  matchesIdea,
  newId,
  normalizeUrl,
  parseComposer,
  restorePatch,
  shortUrl,
  suggestName,
  suggestNotes,
  tagCounts,
  webHref,
} from '@/features/planning/ui/ideas/model';

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const IDEA_ID = '44444444-4444-4444-8444-444444444444';
const CAT_ID = '55555555-5555-4555-8555-555555555555';
const NOW = Date.parse('2026-10-03T09:00:00Z');

const ALL = new Set<Feature>(FEATURES);
const input = (over: Partial<FeatureInput> = {}): FeatureInput & { ownerId: string } => ({
  ownerId: OWNER,
  plan: 'pro',
  admin: false,
  overrides: NO_OVERRIDES,
  available: ALL,
  ...over,
});

function deps(over: Partial<{ input: ReturnType<typeof input> | null }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const results: Record<string, unknown> = {};
  const d: PlanningDeps & { calls: typeof calls; results: typeof results } = {
    calls,
    results,
    access: async (id) => (id === ID ? (over.input === undefined ? input() : over.input) : null),
    rpc: (async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return fn in results ? results[fn] : null;
    }) as PlanningDeps['rpc'],
    summary: async () => null,
    now: () => NOW,
    newId: () => 'new-id',
  };
  return d;
}
const last = (d: ReturnType<typeof deps>, fn: string) => d.calls.filter((c) => c.fn === fn).at(-1)!;

const idea = (over: Partial<PlanIdea> = {}): PlanIdea => ({
  id: IDEA_ID,
  type: 'note',
  title: null,
  body: 'x',
  url: null,
  ogPreview: null,
  imagePath: null,
  color: 'default',
  tags: [],
  pinned: false,
  items: [],
  linkedTaskId: null,
  linkedVendorId: null,
  linkedBudgetItemId: null,
  sort: 0,
  createdAt: '2026-10-03T10:00:00+00:00',
  ...over,
});

// ─── the ideas API ──────────────────────────────────────────────────────────────────────────────

describe('who may use the board', () => {
  it('only the owner, only an event that has the planning feature', async () => {
    const body = { op: 'save', idea: { type: 'note', body: 'x' } };
    expect((await ideaOperation(OWNER, 'nope', body, deps())).status).toBe(404);
    expect((await ideaOperation(STRANGER, ID, body, deps())).status).toBe(404);
    expect((await ideaOperation(OWNER, ID, body, deps({ input: null }))).status).toBe(404);
    const d = deps({ input: input({ overrides: { off: ['planning'], grant: [] } }) });
    expect(await ideaOperation(OWNER, ID, body, d)).toMatchObject({
      status: 403,
      body: { code: 'feature_off', feature: 'planning' },
    });
    expect(d.calls).toEqual([]);
  });
});

describe('saving a card', () => {
  it('a quick add needs only a note’s text or a link’s address', async () => {
    const d = deps();
    d.results.planning_idea_save = idea({ body: 'לבדוק פרחים' });
    const res = await ideaOperation(
      OWNER,
      ID,
      { op: 'save', idea: { type: 'note', body: 'לבדוק פרחים' } },
      d,
    );
    expect(res).toEqual({ status: 200, body: { ok: true, idea: idea({ body: 'לבדוק פרחים' }) } });
    expect(last(d, 'planning_idea_save').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_idea: { type: 'note', body: 'לבדוק פרחים' },
    });
    d.results.planning_idea_save = idea({ type: 'link', url: 'https://example.com/hall' });
    const link = await ideaOperation(
      OWNER,
      ID,
      { op: 'save', idea: { type: 'link', url: 'https://example.com/hall' } },
      d,
    );
    expect(link.status).toBe(200);
    expect(last(d, 'planning_idea_save').args.p_idea).toEqual({
      type: 'link',
      url: 'https://example.com/hall',
    });
  });

  it('takes every field of a card, a client’s own id, and passes only what it was given', async () => {
    const d = deps();
    d.results.planning_idea_save = idea();
    const full = {
      id: IDEA_ID,
      type: 'list',
      title: 'לקנות',
      body: null,
      url: null,
      ogPreview: { title: 't', description: 'd', image: 'https://cdn.example.com/a.jpg', site: 's' },
      imagePath: `${OWNER}/${ID}/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b.png`,
      color: 'warning',
      tags: ['א', 'ב'],
      pinned: true,
      items: [{ text: 'נרות', done: true }, { text: 'מפיות' }],
      sort: -10,
    };
    expect((await ideaOperation(OWNER, ID, { op: 'save', idea: full }, d)).status).toBe(200);
    expect(last(d, 'planning_idea_save').args.p_idea).toEqual({
      ...full,
      items: [
        { text: 'נרות', done: true },
        { text: 'מפיות', done: false },
      ],
    });
  });

  it('is strict: an unknown key, a made-up type or color, or the wrong kind of value is refused', async () => {
    const d = deps();
    for (const bad of [
      { type: 'note', body: 'x', hacked: true },
      { type: 'sticker', body: 'x' },
      { type: 'note', body: 'x', color: 'neon' },
      { type: 'note', body: 'x', color: '#ff0000' },
      { id: 'not-a-uuid', type: 'note', body: 'x' },
      { type: 'note', body: 'x'.repeat(5001) },
      { type: 'note', title: 'x'.repeat(161) },
      { type: 'note', body: 'x', pinned: 'yes' },
      { type: 'note', body: 'x', sort: 1.5 },
      { type: 'note', body: 'x', sort: 2_000_000 },
      { type: 'note', body: 'x', ogPreview: { title: 't', extra: 1 } },
      { type: 'note', body: 'x', ogPreview: { image: 'http://insecure.example.com/a.jpg' } },
      { type: 'note', body: 'x', ogPreview: { description: 'x'.repeat(301) } },
    ]) {
      const res = await ideaOperation(OWNER, ID, { op: 'save', idea: bad }, d);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(res.body).toMatchObject({ ok: false, code: 'invalid' });
    }
    expect((await ideaOperation(OWNER, ID, { op: 'save', idea: {}, extra: 1 }, d)).status).toBe(400);
    expect((await ideaOperation(OWNER, ID, { op: 'unknown' }, d)).status).toBe(400);
    expect((await ideaOperation(OWNER, ID, null, d)).status).toBe(400);
    expect(d.calls).toEqual([]);
  });

  it('an address must be http(s), without a login, of at most a thousand characters', async () => {
    const d = deps();
    d.results.planning_idea_save = idea();
    const long = `https://example.com/${'a'.repeat(1000)}`;
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/x',
      'file:///etc/passwd',
      'example.com',
      '//example.com',
      'https://user:pass@example.com/',
      long,
      '',
    ]) {
      const res = await ideaOperation(OWNER, ID, { op: 'save', idea: { type: 'link', url } }, d);
      expect(res.status, url).toBe(400);
      expect(res.body.fields).toEqual(['idea.url']);
    }
    for (const url of [
      'http://example.com',
      'https://example.com/a?b=c#d',
      `https://example.com/${'a'.repeat(900)}`,
    ])
      expect(
        (await ideaOperation(OWNER, ID, { op: 'save', idea: { type: 'link', url } }, d)).status,
        url,
      ).toBe(200);
    // clearing the address is allowed
    expect((await ideaOperation(OWNER, ID, { op: 'save', idea: { id: IDEA_ID, url: null } }, d)).status).toBe(
      200,
    );
  });

  it('tags: twelve at most, thirty characters each; checklists: a hundred lines of two hundred characters', async () => {
    const d = deps();
    d.results.planning_idea_save = idea();
    const save = (i: Record<string, unknown>) => ideaOperation(OWNER, ID, { op: 'save', idea: i }, d);
    expect((await save({ body: 'x', tags: Array.from({ length: 12 }, (_, i) => `t${i}`) })).status).toBe(200);
    expect((await save({ body: 'x', tags: Array.from({ length: 13 }, (_, i) => `t${i}`) })).status).toBe(400);
    expect((await save({ body: 'x', tags: ['x'.repeat(30)] })).status).toBe(200);
    expect((await save({ body: 'x', tags: ['x'.repeat(31)] })).status).toBe(400);
    expect(
      (await save({ type: 'list', items: Array.from({ length: 100 }, (_, i) => ({ text: `l${i}` })) }))
        .status,
    ).toBe(200);
    expect(
      (await save({ type: 'list', items: Array.from({ length: 101 }, (_, i) => ({ text: `l${i}` })) }))
        .status,
    ).toBe(400);
    expect((await save({ type: 'list', items: [{ text: 'x'.repeat(200) }] })).status).toBe(200);
    expect((await save({ type: 'list', items: [{ text: 'x'.repeat(201) }] })).status).toBe(400);
    expect((await save({ type: 'list', items: [{ text: 'x', done: 'no' }] })).status).toBe(400);
    expect((await save({ type: 'list', items: [{ text: 'x', extra: 1 }] })).status).toBe(400);
  });

  it('every color of the palette is accepted', async () => {
    const d = deps();
    d.results.planning_idea_save = idea();
    for (const color of ['default', 'brand', 'success', 'warning', 'info'])
      expect(
        (await ideaOperation(OWNER, ID, { op: 'save', idea: { body: 'x', color } }, d)).status,
        color,
      ).toBe(200);
  });

  it('a picture must be one of this host’s own files for this event, and the database is not asked otherwise', async () => {
    const d = deps();
    d.results.planning_idea_save = idea();
    const save = (imagePath: string | null) =>
      ideaOperation(OWNER, ID, { op: 'save', idea: { type: 'image', title: 'x', imagePath } }, d);
    for (const bad of [
      `${STRANGER}/${ID}/a.png`,
      `${OWNER}/${STRANGER}/a.png`,
      `${OWNER}/a.png`,
      'a.png',
      `../${OWNER}/${ID}/a.png`,
      '',
    ]) {
      const res = await save(bad);
      expect(res.status, bad).toBe(400);
      expect(res.body.fields).toEqual(['idea.imagePath']);
    }
    expect(d.calls).toEqual([]);
    expect((await save(`${OWNER}/${ID}/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b.webp`)).status).toBe(200);
    expect((await save(null)).status).toBe(200);
  });

  it('answers what the database refuses: no content or a bad file (400), too many or too large (422), not theirs (404)', async () => {
    const d = deps();
    const save = () => ideaOperation(OWNER, ID, { op: 'save', idea: { type: 'note', body: 'x' } }, d);
    d.results.planning_idea_save = { ok: false, code: 'empty' };
    expect(await save()).toEqual({ status: 400, body: { ok: false, code: 'empty' } });
    d.results.planning_idea_save = { ok: false, code: 'invalid_image' };
    expect((await save()).status).toBe(400);
    d.results.planning_idea_save = { ok: false, code: 'too_many' };
    expect(await save()).toEqual({ status: 422, body: { ok: false, code: 'too_many' } });
    d.results.planning_idea_save = { ok: false, code: 'too_large' };
    expect((await save()).status).toBe(422);
    d.results.planning_idea_save = null;
    expect(await save()).toEqual({ status: 404, body: { ok: false, code: 'not_found' } });
  });
});

describe('deleting cards', () => {
  it('deletes the listed cards and says how many went', async () => {
    const d = deps();
    d.results.planning_idea_delete = 2;
    const res = await ideaOperation(OWNER, ID, { op: 'delete', ids: [IDEA_ID, CAT_ID] }, d);
    expect(res).toEqual({ status: 200, body: { ok: true, deleted: 2 } });
    expect(last(d, 'planning_idea_delete').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_ids: [IDEA_ID, CAT_ID],
    });
    d.results.planning_idea_delete = null;
    expect((await ideaOperation(OWNER, ID, { op: 'delete', ids: [IDEA_ID] }, d)).status).toBe(404);
  });

  it('wants ids: one to a hundred, each an id', async () => {
    const d = deps();
    d.results.planning_idea_delete = 0;
    for (const ids of [
      [],
      ['x'],
      [IDEA_ID, 'x'],
      Array.from({ length: 101 }, () => IDEA_ID),
      'all',
      undefined,
    ]) {
      expect((await ideaOperation(OWNER, ID, { op: 'delete', ids }, d)).status, JSON.stringify(ids)).toBe(
        400,
      );
    }
    expect(d.calls).toEqual([]);
    expect(
      (await ideaOperation(OWNER, ID, { op: 'delete', ids: Array.from({ length: 100 }, () => IDEA_ID) }, d))
        .status,
    ).toBe(200);
  });
});

describe('turning a card into something', () => {
  const made = (created: Record<string, string>) => ({ idea: idea({ linkedTaskId: 't' }), created });

  it('a task, a vendor or a budget line, with what the card brings; answers the card and what was made', async () => {
    const d = deps();
    d.results.planning_idea_convert = made({ taskId: 'task-1' });
    const task = await ideaOperation(
      OWNER,
      ID,
      {
        op: 'convert',
        id: IDEA_ID,
        kind: 'task',
        data: { title: 'להזמין חופה', dueDate: '2027-03-01', category: 'design', notes: 'n' },
      },
      d,
    );
    expect(task).toEqual({
      status: 200,
      body: { ok: true, idea: idea({ linkedTaskId: 't' }), created: { taskId: 'task-1' } },
    });
    expect(last(d, 'planning_idea_convert').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_idea: IDEA_ID,
      p_kind: 'task',
      p_data: { title: 'להזמין חופה', dueDate: '2027-03-01', category: 'design', notes: 'n' },
    });

    d.results.planning_idea_convert = made({ vendorId: 'v-1' });
    const vendor = await ideaOperation(
      OWNER,
      ID,
      {
        op: 'convert',
        id: IDEA_ID,
        kind: 'vendor',
        data: { name: 'סטודיו אור', category: 'photographer', url: 'https://example.com/p' },
      },
      d,
    );
    expect(vendor.body).toMatchObject({ ok: true, created: { vendorId: 'v-1' } });
    expect(last(d, 'planning_idea_convert').args).toMatchObject({
      p_kind: 'vendor',
      p_data: { name: 'סטודיו אור' },
    });

    d.results.planning_idea_convert = made({ itemId: 'i-1' });
    const item = await ideaOperation(
      OWNER,
      ID,
      {
        op: 'convert',
        id: IDEA_ID,
        kind: 'item',
        data: { categoryId: CAT_ID, title: 'זר כלה', estimate: 850.5 },
      },
      d,
    );
    expect(item.body).toMatchObject({ ok: true, created: { itemId: 'i-1' } });
    expect(last(d, 'planning_idea_convert').args).toMatchObject({
      p_kind: 'item',
      p_data: { categoryId: CAT_ID, title: 'זר כלה', estimate: 850.5 },
    });
    // optional parts really are optional
    expect(
      (await ideaOperation(OWNER, ID, { op: 'convert', id: IDEA_ID, kind: 'task', data: { title: 'x' } }, d))
        .status,
    ).toBe(200);
    expect(
      (
        await ideaOperation(
          OWNER,
          ID,
          { op: 'convert', id: IDEA_ID, kind: 'item', data: { categoryId: CAT_ID, title: 'x' } },
          d,
        )
      ).status,
    ).toBe(200);
  });

  it('refuses what is not a task, vendor or line: no title, a bad date, an unknown kind or key, a category that is not an id', async () => {
    const d = deps();
    d.results.planning_idea_convert = made({ taskId: 'x' });
    const convert = (kind: string, data: unknown, id: unknown = IDEA_ID) =>
      ideaOperation(OWNER, ID, { op: 'convert', id, kind, data }, d);
    for (const [kind, data] of [
      ['task', {}],
      ['task', { title: '  ' }],
      ['task', { title: 'x'.repeat(201) }],
      ['task', { title: 'x', dueDate: 'tomorrow' }],
      ['task', { title: 'x', dueDate: '2027-02-31' }],
      ['task', { title: 'x', category: 'not_a_category' }],
      ['task', { title: 'x', extra: 1 }],
      ['task', { name: 'x' }],
      ['vendor', {}],
      ['vendor', { name: 'x'.repeat(121) }],
      ['vendor', { name: 'x', url: 'javascript:alert(1)' }],
      ['vendor', { name: 'x', url: `https://example.com/${'a'.repeat(500)}` }],
      ['item', { title: 'x' }],
      ['item', { categoryId: 'venue', title: 'x' }],
      ['item', { categoryId: CAT_ID, title: '' }],
      ['item', { categoryId: CAT_ID, title: 'x', estimate: -1 }],
      ['item', { categoryId: CAT_ID, title: 'x', estimate: 2_000_000_000 }],
      ['event', { title: 'x' }],
    ] as const) {
      const res = await convert(kind, data);
      expect(res.status, `${kind} ${JSON.stringify(data)}`).toBe(400);
      expect(res.body).toMatchObject({ ok: false, code: 'invalid' });
    }
    expect((await convert('task', { title: 'x' }, 'not-an-id')).status).toBe(400);
    expect(d.calls).toEqual([]);
  });

  it('answers the database’s refusals: a category of another event (400), a full table (422), a card that is not theirs (404)', async () => {
    const d = deps();
    const convert = () =>
      ideaOperation(
        OWNER,
        ID,
        { op: 'convert', id: IDEA_ID, kind: 'item', data: { categoryId: CAT_ID, title: 'x' } },
        d,
      );
    d.results.planning_idea_convert = { ok: false, code: 'invalid_link' };
    expect(await convert()).toEqual({ status: 400, body: { ok: false, code: 'invalid_link' } });
    d.results.planning_idea_convert = { ok: false, code: 'too_many' };
    expect(await convert()).toEqual({ status: 422, body: { ok: false, code: 'too_many' } });
    d.results.planning_idea_convert = null;
    expect(await convert()).toEqual({ status: 404, body: { ok: false, code: 'not_found' } });
  });
});

// ─── addresses ──────────────────────────────────────────────────────────────────────────────────

describe('which addresses are the public internet’s', () => {
  const refused = [
    // IPv4: this network, private, CGNAT, loopback, link-local (the cloud metadata address), IETF, documentation,
    // 6to4 relay, benchmarking, multicast, reserved, broadcast
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '100.127.255.255',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254',
    '169.254.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '192.88.99.1',
    '192.168.0.1',
    '192.168.255.255',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
    // IPv6: unspecified, loopback, unique local, link-local, site-local, multicast, IPv4-mapped (private),
    // IPv4-compatible, NAT64, 6to4 of a private address, Teredo, documentation, discard
    '::',
    '::1',
    'fc00::1',
    'fd12:3456:789a::1',
    'fe80::1',
    'fe80::1ff:fe23:4567:890a',
    'fec0::1',
    'ff02::1',
    'ff00::',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '::ffff:a00:1',
    '::ffff:169.254.169.254',
    '::ffff:192.168.1.1',
    '::127.0.0.1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
    '2002:a00:1::',
    '2002:c0a8:101::1',
    '2001::1',
    '2001:0:4136:e378:8000:63bf:3fff:fdd2',
    '2001:db8::1',
    '3fff::1',
    '100::1',
  ];
  const allowed = [
    '1.1.1.1',
    '8.8.8.8',
    '93.184.216.34',
    '100.63.255.255',
    '100.128.0.1',
    '172.15.255.255',
    '172.32.0.1',
    '169.253.1.1',
    '192.0.1.1',
    '192.169.0.1',
    '198.17.255.255',
    '198.20.0.1',
    '223.255.255.255',
    '::ffff:8.8.8.8',
    '::ffff:5db8:d822',
    '2606:2800:220:1:248:1893:25c8:1946',
    '2001:4860:4860::8888',
    '2a00:1450:4001:81b::200e',
    '2002:5db8:d822::1',
  ];
  it('refuses loopback, private, link-local, CGNAT, unspecified, multicast, reserved and their IPv6 equivalents', () => {
    for (const ip of refused) expect(isPublicAddress(ip), ip).toBe(false);
  });
  it('allows ordinary public addresses, next to the ranges it refuses', () => {
    for (const ip of allowed) expect(isPublicAddress(ip), ip).toBe(true);
  });
  it('refuses what is not an address, and spellings that hide one', () => {
    for (const bad of [
      '',
      'localhost',
      'example.com',
      '1.2.3',
      '1.2.3.4.5',
      '256.1.1.1',
      '010.0.0.1',
      '8.8.8.8 ',
      '::g',
      ':::',
      '[::1]',
      'fe80::1%eth0',
      '1::2::3',
      '12345::1',
    ])
      expect(isPublicAddress(bad), bad).toBe(false);
  });
});

// ─── the fetcher ────────────────────────────────────────────────────────────────────────────────

const enc = new TextEncoder();
async function* chunks(parts: (string | Uint8Array)[], onClose?: () => void): AsyncGenerator<Uint8Array> {
  try {
    for (const p of parts) yield typeof p === 'string' ? enc.encode(p) : p;
  } finally {
    onClose?.();
  }
}
const page = (html: string, headers: Record<string, string> = {}, status = 200): PreviewResponse => ({
  status,
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  body: chunks([html]),
});
const redirect = (location: string | undefined, status = 302): PreviewResponse => ({
  status,
  headers: location ? { location } : {},
  body: null,
});
const PAGE = '<html><head><title>אולם בגליל</title></head><body></body></html>';

type World = {
  dns?: Record<string, string[]>;
  routes: Record<string, PreviewResponse | (() => PreviewResponse)>;
};
function world({ dns = {}, routes }: World) {
  const resolved: string[] = [];
  const fetched: PreviewRequest[] = [];
  const deps: PreviewFetchDeps = {
    async resolve(host) {
      resolved.push(host);
      const answer = dns[host];
      if (!answer) throw new Error(`ENOTFOUND ${host}`);
      return answer;
    },
    async fetch(request) {
      fetched.push(request);
      const route = routes[request.url.href];
      if (!route) throw new Error(`no route for ${request.url.href}`);
      return typeof route === 'function' ? route() : route;
    },
  };
  return { deps, resolved, fetched };
}
const PUBLIC = '93.184.216.34';
async function reason(url: string, w: ReturnType<typeof world>, timeoutMs?: number): Promise<PreviewFailure> {
  try {
    await fetchPreview(url, w.deps, timeoutMs);
  } catch (err) {
    if (err instanceof PreviewError) return err.reason;
    throw err;
  }
  throw new Error(`${url} was not refused`);
}

describe('the preview fetcher keeps to the public web', () => {
  it('reads a page and returns its preview', async () => {
    const w = world({ dns: { 'example.com': [PUBLIC] }, routes: { 'https://example.com/hall': page(PAGE) } });
    expect(await fetchPreview('https://example.com/hall', w.deps)).toEqual({ title: 'אולם בגליל' });
    expect(w.fetched).toHaveLength(1);
  });

  it('takes only http and https', async () => {
    for (const url of [
      'ftp://example.com/',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'gopher://example.com/',
      'data:text/html,x',
      'ws://example.com/',
      'not a url',
      '',
      '//example.com/x',
    ]) {
      const w = world({ dns: { 'example.com': [PUBLIC] }, routes: {} });
      expect(await reason(url, w), url).toBe('scheme');
      expect(w.resolved).toEqual([]);
      expect(w.fetched).toEqual([]);
    }
  });

  it('takes only the ordinary ports', async () => {
    for (const url of [
      'http://example.com:22/',
      'http://example.com:25/',
      'http://example.com:3306/',
      'https://example.com:6379/',
      'http://example.com:9200/',
      'https://example.com:65535/',
      'http://example.com:1/',
    ]) {
      const w = world({ dns: { 'example.com': [PUBLIC] }, routes: {} });
      expect(await reason(url, w), url).toBe('port');
      expect(w.fetched).toEqual([]);
    }
    for (const url of [
      'http://example.com/',
      'http://example.com:80/',
      'https://example.com:443/',
      'http://example.com:8080/',
      'https://example.com:8443/',
    ]) {
      const w = world({ dns: { 'example.com': [PUBLIC] }, routes: { [new URL(url).href]: page(PAGE) } });
      expect((await fetchPreview(url, w.deps)).title, url).toBe('אולם בגליל');
    }
  });

  it('takes no address with a login in it', async () => {
    const w = world({ dns: { 'example.com': [PUBLIC] }, routes: {} });
    expect(await reason('http://user:pass@example.com/', w)).toBe('credentials');
    expect(await reason('https://admin@example.com/', w)).toBe('credentials');
    expect(w.fetched).toEqual([]);
  });

  it('refuses an address that is itself loopback, private, link-local, CGNAT, unspecified or multicast — in every spelling — without asking the DNS', async () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://127.1/',
      'http://2130706433/',
      'http://0x7f000001/',
      'http://0177.0.0.1/',
      'http://017700000001/',
      'http://10.0.0.5/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://100.64.0.1/',
      'http://0.0.0.0/',
      'http://0/',
      'http://224.0.0.1/',
      'http://255.255.255.255/',
      'http://[::1]/',
      'http://[::]/',
      'http://[fc00::1]/',
      'http://[fd12:3456::1]/',
      'http://[fe80::1]/',
      'http://[ff02::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:10.0.0.1]/',
      'http://[::ffff:169.254.169.254]/',
      'http://[2002:7f00:1::]/',
      'http://[64:ff9b::7f00:1]/',
      'http://[2001:db8::1]/',
    ]) {
      const w = world({ routes: {} });
      expect(await reason(url, w), url).toBe('address');
      expect(w.resolved, url).toEqual([]);
      expect(w.fetched, url).toEqual([]);
    }
  });

  it('connects to a public address given as such, as itself', async () => {
    const w = world({
      routes: {
        'http://93.184.216.34/': page(PAGE),
        'http://[2606:2800:220:1:248:1893:25c8:1946]/': page(PAGE),
      },
    });
    await fetchPreview('http://93.184.216.34/', w.deps);
    await fetchPreview('http://[2606:2800:220:1:248:1893:25c8:1946]/', w.deps);
    expect(w.fetched.map((f) => [f.address, f.family])).toEqual([
      ['93.184.216.34', 4],
      ['2606:2800:220:1:248:1893:25c8:1946', 6],
    ]);
    expect(w.resolved).toEqual([]);
  });

  it('refuses names that can only be inside a network, without asking the DNS', async () => {
    for (const url of [
      'http://localhost/',
      'http://localhost./',
      'http://foo.localhost/',
      'http://intranet/',
      'http://printer.local/',
      'http://metadata.google.internal/',
      'http://db.internal/',
      'http://router.lan/',
      'http://a.home.arpa/',
      'http://x.onion/',
      'http://exa_mple$.com/',
    ]) {
      const w = world({ routes: {} });
      expect(await reason(url, w), url).toBe('host');
      expect(w.resolved).toEqual([]);
      expect(w.fetched).toEqual([]);
    }
  });

  it('refuses a name the DNS answers with a private address — one of several is enough — and with nothing', async () => {
    for (const answer of [
      ['10.0.0.1'],
      ['127.0.0.1'],
      ['169.254.169.254'],
      ['192.168.0.10'],
      ['::1'],
      ['fe80::1'],
      ['::ffff:10.0.0.1'],
      [PUBLIC, '127.0.0.1'],
      ['10.0.0.1', PUBLIC],
      [PUBLIC, 'fd00::1'],
    ]) {
      const w = world({
        dns: { 'evil.example.com': answer },
        routes: { 'http://evil.example.com/': page(PAGE) },
      });
      expect(await reason('http://evil.example.com/', w), answer.join()).toBe('address');
      expect(w.resolved).toEqual(['evil.example.com']);
      expect(w.fetched).toEqual([]);
    }
    expect(
      await reason('http://empty.example.com/', world({ dns: { 'empty.example.com': [] }, routes: {} })),
    ).toBe('dns');
    // a name that does not resolve is a failure like any other
    expect(await reason('http://nowhere.example.com/', world({ routes: {} }))).toBe('network');
  });

  it('connects to the one address it checked, and asks the DNS once per host (the name is not looked up again)', async () => {
    const w = world({
      dns: { 'example.com': ['2606:2800:220:1:248:1893:25c8:1946', PUBLIC] },
      routes: { 'https://example.com/': page(PAGE) },
    });
    await fetchPreview('https://example.com/', w.deps);
    expect(w.resolved).toEqual(['example.com']);
    expect(w.fetched).toHaveLength(1);
    // IPv4 first, and exactly an address the DNS gave
    expect(w.fetched[0]).toMatchObject({ address: PUBLIC, family: 4 });
    expect(w.fetched[0]!.url.hostname).toBe('example.com');
  });

  it('follows at most three redirects, by hand, and checks every hop as if it were the first', async () => {
    const hop = (to: string): PreviewResponse => redirect(to);
    // three redirects, then the page
    const ok = world({
      dns: {
        'a.example.com': ['93.184.216.1'],
        'b.example.com': ['93.184.216.2'],
        'c.example.com': ['93.184.216.3'],
        'd.example.com': ['93.184.216.4'],
      },
      routes: {
        'http://a.example.com/': hop('https://b.example.com/x'),
        'https://b.example.com/x': hop('/y'),
        'https://b.example.com/y': hop('http://c.example.com:8080/z'),
        'http://c.example.com:8080/z': page(PAGE),
      },
    });
    expect((await fetchPreview('http://a.example.com/', ok.deps)).title).toBe('אולם בגליל');
    // each hop connected to its own host's checked address
    expect(ok.fetched.map((f) => [f.url.href, f.address])).toEqual([
      ['http://a.example.com/', '93.184.216.1'],
      ['https://b.example.com/x', '93.184.216.2'],
      ['https://b.example.com/y', '93.184.216.2'],
      ['http://c.example.com:8080/z', '93.184.216.3'],
    ]);
    // …a fourth is one too many
    const four = world({
      dns: { 'a.example.com': [PUBLIC] },
      routes: {
        'http://a.example.com/': hop('/1'),
        'http://a.example.com/1': hop('/2'),
        'http://a.example.com/2': hop('/3'),
        'http://a.example.com/3': hop('/4'),
        'http://a.example.com/4': page(PAGE),
      },
    });
    expect(await reason('http://a.example.com/', four)).toBe('redirects');
    expect(four.fetched).toHaveLength(4);
    // a loop, and a redirect to nowhere
    const loop = world({ dns: { 'a.example.com': [PUBLIC] }, routes: { 'http://a.example.com/': hop('/') } });
    expect(await reason('http://a.example.com/', loop)).toBe('redirects');
    const none = world({
      dns: { 'a.example.com': [PUBLIC] },
      routes: { 'http://a.example.com/': redirect(undefined) },
    });
    expect(await reason('http://a.example.com/', none)).toBe('redirects');
    for (const status of [301, 302, 303, 307, 308]) {
      const w = world({
        dns: { 'a.example.com': [PUBLIC] },
        routes: { 'http://a.example.com/': redirect('/p', status), 'http://a.example.com/p': page(PAGE) },
      });
      expect((await fetchPreview('http://a.example.com/', w.deps)).title).toBe('אולם בגליל');
    }
  });

  it('refuses a redirect into the private network, whatever the hop is written as', async () => {
    const start = 'http://good.example.com/';
    const cases: [string, PreviewFailure][] = [
      ['http://127.0.0.1/admin', 'address'],
      ['http://169.254.169.254/latest/meta-data/iam/security-credentials/', 'address'],
      ['http://[::1]/', 'address'],
      ['http://[::ffff:10.0.0.1]/', 'address'],
      ['http://2130706433/', 'address'],
      ['http://10.1.2.3:8080/', 'address'],
      ['http://rebind.example.com/', 'address'],
      ['http://localhost/', 'host'],
      ['//internal.local/x', 'host'],
      ['http://metadata.google.internal/computeMetadata/v1/', 'host'],
      ['ftp://example.com/x', 'scheme'],
      ['file:///etc/passwd', 'scheme'],
      ['javascript:alert(1)', 'scheme'],
      ['http://example.com:22/', 'port'],
      ['http://user:pw@example.com/', 'credentials'],
    ];
    for (const [to, why] of cases) {
      const w = world({
        dns: {
          'good.example.com': [PUBLIC],
          'rebind.example.com': ['192.168.0.10'],
          'example.com': [PUBLIC],
        },
        routes: { [start]: redirect(to) },
      });
      expect(await reason(start, w), to).toBe(why);
      // only the first, public hop was ever requested
      expect(
        w.fetched.map((f) => f.url.href),
        to,
      ).toEqual([start]);
    }
  });

  it('gives up after five seconds in all (a slow DNS, a slow server or a slow page), through an AbortSignal', async () => {
    const never = new Promise<never>(() => undefined);
    // the DNS that never answers
    const slowDns: PreviewFetchDeps = { resolve: () => never, fetch: async () => page(PAGE) };
    expect(await reason('http://example.com/', { deps: slowDns, resolved: [], fetched: [] }, 40)).toBe(
      'timeout',
    );
    // the server that never answers: the request is told to stop
    let signal: AbortSignal | undefined;
    const slowServer: PreviewFetchDeps = {
      resolve: async () => [PUBLIC],
      fetch: (req) => {
        signal = req.signal;
        return new Promise((_, reject) =>
          req.signal.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      },
    };
    expect(await reason('http://example.com/', { deps: slowServer, resolved: [], fetched: [] }, 40)).toBe(
      'timeout',
    );
    expect(signal?.aborted).toBe(true);
    // the page that never ends
    let closed = false;
    const slowBody: PreviewFetchDeps = {
      resolve: async () => [PUBLIC],
      fetch: async () => ({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: (async function* () {
          try {
            yield enc.encode('<title>x</title>');
            await never;
          } finally {
            closed = true;
          }
        })(),
        close: () => {
          closed = true;
        },
      }),
    };
    expect(await reason('http://example.com/', { deps: slowBody, resolved: [], fetched: [] }, 40)).toBe(
      'timeout',
    );
    expect(closed).toBe(true);
    // the default allowance is five seconds
    let given: AbortSignal | undefined;
    await fetchPreview('http://example.com/', {
      resolve: async () => [PUBLIC],
      fetch: async (req) => {
        given = req.signal;
        return page(PAGE);
      },
    });
    expect(given).toBeInstanceOf(AbortSignal);
    expect(given!.aborted).toBe(false);
  });

  it('reads at most 512 KB of a page and lets go of the connection', async () => {
    let read = 0;
    let closed = false;
    const chunk = new Uint8Array(64 * 1024).fill(32);
    const w = world({
      dns: { 'example.com': [PUBLIC] },
      routes: {
        'http://example.com/': () => ({
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: (async function* () {
            try {
              yield enc.encode('<title>קודם</title>');
              for (let i = 0; i < 64; i++) {
                read += chunk.byteLength;
                yield chunk;
              }
            } finally {
              closed = true;
            }
          })(),
        }),
      },
    });
    expect((await fetchPreview('http://example.com/', w.deps)).title).toBe('קודם');
    expect(PREVIEW_MAX_BYTES).toBe(512 * 1024);
    expect(read).toBeLessThanOrEqual(PREVIEW_MAX_BYTES);
    expect(closed).toBe(true);
    // what comes after the first 512 KB is never seen
    const late = world({
      dns: { 'example.com': [PUBLIC] },
      routes: {
        'http://example.com/': page(
          `<title>t</title><!--${' '.repeat(PREVIEW_MAX_BYTES)}--><meta property="og:description" content="late">`,
        ),
      },
    });
    expect(await fetchPreview('http://example.com/', late.deps)).toEqual({ title: 't' });
  });

  it('takes only HTML, with a good status, and no content coding it cannot read', async () => {
    const tryType = async (headers: Record<string, string>, status = 200) => {
      const w = world({
        dns: { 'example.com': [PUBLIC] },
        routes: { 'http://example.com/': { status, headers, body: chunks([PAGE]) } },
      });
      return reason('http://example.com/', w).catch(() => 'ok');
    };
    for (const type of [
      'application/json',
      'image/png',
      'text/plain',
      'application/pdf',
      'application/octet-stream',
      'text/xml',
      'video/mp4',
      '',
    ])
      expect(await tryType({ 'content-type': type }), type).toBe('type');
    expect(await tryType({})).toBe('type');
    for (const type of [
      'text/html',
      'TEXT/HTML; charset=UTF-8',
      'application/xhtml+xml',
      'text/html;charset=windows-1255',
    ])
      expect(await tryType({ 'content-type': type }), type).toBe('ok');
    for (const status of [199, 204, 400, 401, 403, 404, 410, 429, 500, 503])
      expect(await tryType({ 'content-type': 'text/html' }, status), String(status)).toBe('status');
    expect(await tryType({ 'content-type': 'text/html', 'content-encoding': 'compress' })).toBe('encoding');
    expect(await tryType({ 'content-type': 'text/html', 'content-encoding': 'identity' })).toBe('ok');
    // a page with nothing to show
    const empty = world({
      dns: { 'example.com': [PUBLIC] },
      routes: { 'http://example.com/': page('<html><body>hi</body></html>') },
    });
    expect(await reason('http://example.com/', empty)).toBe('empty');
    const noBody = world({
      dns: { 'example.com': [PUBLIC] },
      routes: {
        'http://example.com/': { status: 200, headers: { 'content-type': 'text/html' }, body: null },
      },
    });
    expect(await reason('http://example.com/', noBody)).toBe('empty');
  });

  it('sends no cookies and no credentials, and a neutral User-Agent', async () => {
    const w = world({ dns: { 'example.com': [PUBLIC] }, routes: { 'https://example.com/': page(PAGE) } });
    await fetchPreview('https://example.com/', w.deps);
    const headers = w.fetched[0]!.headers;
    expect(
      Object.keys(headers)
        .map((k) => k.toLowerCase())
        .sort(),
    ).toEqual(['accept', 'accept-encoding', 'accept-language', 'connection', 'user-agent']);
    expect(headers['user-agent']).toMatch(/^Mozilla\/5\.0 \(compatible; [A-Za-z]+\/[\d.]+\)$/);
    expect(headers['user-agent']!.toLowerCase()).not.toContain('badook');
    // a fresh header object per request: nothing carried from one to the next
    expect(w.fetched[0]!.headers).not.toBe(headers === undefined ? null : undefined);
  });

  it('reads the page in the charset it names (a Hebrew page in windows-1255)', async () => {
    const shalom = Uint8Array.from([0xf9, 0xec, 0xe5, 0xed]);
    const bytes = new Uint8Array([
      ...enc.encode('<head><title>'),
      ...shalom,
      ...enc.encode('</title></head>'),
    ]);
    const header = world({
      dns: { 'example.com': [PUBLIC] },
      routes: {
        'http://example.com/': {
          status: 200,
          headers: { 'content-type': 'text/html; charset=windows-1255' },
          body: chunks([bytes]),
        },
      },
    });
    expect((await fetchPreview('http://example.com/', header.deps)).title).toBe('שלום');
    const meta = new Uint8Array([
      ...enc.encode('<head><meta charset="windows-1255"><title>'),
      ...shalom,
      ...enc.encode('</title></head>'),
    ]);
    const sniffed = world({
      dns: { 'example.com': [PUBLIC] },
      routes: {
        'http://example.com/': {
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: chunks([meta]),
        },
      },
    });
    expect((await fetchPreview('http://example.com/', sniffed.deps)).title).toBe('שלום');
    // an unknown charset falls back to UTF-8
    const odd = world({
      dns: { 'example.com': [PUBLIC] },
      routes: {
        'http://example.com/': {
          status: 200,
          headers: { 'content-type': 'text/html; charset=nonsense-9' },
          body: chunks([PAGE]),
        },
      },
    });
    expect((await fetchPreview('http://example.com/', odd.deps)).title).toBe('אולם בגליל');
  });

  it('logs nothing — not the address, not what the page said', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const secret = 'https://example.com/secret-path?token=abc123';
    const w = world({ dns: { 'example.com': [PUBLIC] }, routes: { [secret]: page(PAGE) } });
    await fetchPreview(secret, w.deps);
    await reason('http://127.0.0.1/secret', world({ routes: {} }));
    await reason(
      'http://example.com/other',
      world({ dns: { 'example.com': [PUBLIC] }, routes: { 'http://example.com/other': page('x', {}, 500) } }),
    );
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

// ─── reading a page ─────────────────────────────────────────────────────────────────────────────

describe('what a page says about itself', () => {
  const base = 'https://example.com/a/b';

  it('takes og:title, og:description, og:image and og:site_name', () => {
    const html = `<!doctype html><html><head>
      <title>Fallback title</title>
      <meta name="description" content="Fallback description">
      <meta property="og:title" content="האולם שלנו">
      <meta property="og:description" content="מקום לאירועים בגליל">
      <meta property="og:image" content="https://cdn.example.com/hall.jpg">
      <meta property="og:site_name" content="אולמי הגליל">
    </head><body><h1>x</h1></body></html>`;
    expect(parseHtml(html, base)).toEqual({
      title: 'האולם שלנו',
      description: 'מקום לאירועים בגליל',
      image: 'https://cdn.example.com/hall.jpg',
      site: 'אולמי הגליל',
    });
  });

  it('falls back to twitter:*, <title> and the description meta', () => {
    expect(parseHtml('<head><title> Just a title </title></head>', base)).toEqual({ title: 'Just a title' });
    expect(parseHtml('<head><title>T</title><meta name="description" content="D"></head>', base)).toEqual({
      title: 'T',
      description: 'D',
    });
    expect(
      parseHtml(
        '<head><meta name="twitter:title" content="TT"><meta name="twitter:description" content="TD"><meta name="twitter:image" content="/i.png"></head>',
        base,
      ),
    ).toEqual({ title: 'TT', description: 'TD', image: 'https://example.com/i.png' });
    // og wins over twitter, and the first of a kind wins
    expect(
      parseHtml(
        '<head><meta name="twitter:title" content="TT"><meta property="og:title" content="A"><meta property="og:title" content="B"></head>',
        base,
      ).title,
    ).toBe('A');
    // a page that says og: in `name`, and in capitals
    expect(parseHtml('<HEAD><META NAME="og:title" CONTENT="Caps"></HEAD>', base).title).toBe('Caps');
    // an empty og:title falls through to the next
    expect(
      parseHtml('<head><meta property="og:title" content="  "><title>T</title></head>', base).title,
    ).toBe('T');
  });

  it('reads quotes of both kinds and unquoted values, and a tag spread over lines', () => {
    expect(parseHtml(`<head><meta property='og:title' content='It is "quoted"'></head>`, base).title).toBe(
      'It is "quoted"',
    );
    expect(parseHtml('<head><meta property=og:title content=Plain></head>', base).title).toBe('Plain');
    expect(
      parseHtml('<head><meta\n  property="og:title"\n  content="Multi\n line"\n/></head>', base).title,
    ).toBe('Multi line');
    expect(parseHtml('<head><meta content="Reversed" property="og:title"></head>', base).title).toBe(
      'Reversed',
    );
    expect(parseHtml('<head><meta property="og:title" content="a > b"></head>', base).title).toBe('a > b');
  });

  it('decodes the basic entities, once, and drops what is not a character', () => {
    expect(
      decodeEntities(
        'Tom &amp; Jerry &lt;3 &gt; &quot;x&quot; &#39;y&#39; &#x27;z&#x27; a&nbsp;b &hellip; &ndash; &mdash; &#128512; &euro;',
      ),
    ).toBe("Tom & Jerry <3 > \"x\" 'y' 'z' a b … – — 😀 €");
    // not decoded twice
    expect(decodeEntities('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
    expect(decodeEntities('&amp;amp;')).toBe('&amp;');
    // unknown names stay as written; impossible numbers go
    expect(decodeEntities('&madeup; &#0; &#xD800; &#1114112; &#99999999;')).toBe('&madeup;    ');
    expect(parseHtml('<head><title>R&amp;D &#8211; ל&quot;ג</title></head>', base).title).toBe('R&D – ל"ג');
  });

  it('collapses whitespace, strips control and bidi-override characters, and cuts to 160 and 300 characters', () => {
    expect(cleanText('  a \n\t b   c  ', 50)).toBe('a b c');
    expect(cleanText('x\u0000y\u0007z‮wxyz⁦q‏r﻿s', 50)).toBe('x y z wxyz q r s');
    expect(cleanText('   ', 50)).toBeUndefined();
    expect(cleanText(undefined, 50)).toBeUndefined();
    const long = 'א'.repeat(500);
    const p = parseHtml(
      `<head><meta property="og:title" content="${long}"><meta property="og:description" content="${long}"></head>`,
      base,
    );
    expect(Array.from(p.title!)).toHaveLength(160);
    expect(p.title!.endsWith('…')).toBe(true);
    expect(Array.from(p.description!)).toHaveLength(300);
    // never in the middle of a character
    const emoji = parseHtml(`<head><title>${'😀'.repeat(200)}</title></head>`, base).title!;
    expect(Array.from(emoji)).toHaveLength(160);
    expect(emoji).not.toMatch(/[\ud800-\udbff]$/);
    // exactly the limit stays whole
    expect(parseHtml(`<head><title>${'x'.repeat(160)}</title></head>`, base).title).toBe('x'.repeat(160));
    expect(
      parseHtml(`<head><meta property="og:site_name" content="${'s'.repeat(200)}"></head>`, base).site,
    ).toHaveLength(100);
  });

  it('makes the picture an absolute https address, or drops it', () => {
    const image = (src: string, page = base) =>
      parseHtml(`<head><meta property="og:image" content="${src}"></head>`, page).image;
    expect(image('/img/a.jpg')).toBe('https://example.com/img/a.jpg');
    expect(image('a.jpg')).toBe('https://example.com/a/a.jpg');
    expect(image('../a.jpg')).toBe('https://example.com/a.jpg');
    expect(image('//cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(image('https://cdn.example.com/a.jpg?x=1&amp;y=2')).toBe('https://cdn.example.com/a.jpg?x=1&y=2');
    expect(image('HTTPS://CDN.EXAMPLE.COM/A.JPG')).toBe('https://cdn.example.com/A.JPG');
    // dropped: not https, not a web address, a login in it, a private host, too long
    expect(image('http://cdn.example.com/a.jpg')).toBeUndefined();
    expect(image('//cdn.example.com/a.jpg', 'http://example.com/')).toBeUndefined();
    expect(image('javascript:alert(1)')).toBeUndefined();
    expect(image('data:image/png;base64,AAAA')).toBeUndefined();
    expect(image('ftp://example.com/a.jpg')).toBeUndefined();
    expect(image('https://user:pw@cdn.example.com/a.jpg')).toBeUndefined();
    expect(image('https://localhost/a.jpg')).toBeUndefined();
    expect(image('https://192.168.1.1/a.jpg')).toBeUndefined();
    expect(image('https://169.254.169.254/a.jpg')).toBeUndefined();
    expect(image('https://[::1]/a.jpg')).toBeUndefined();
    expect(image('https://printer.local/a.jpg')).toBeUndefined();
    expect(image(`https://cdn.example.com/${'a'.repeat(1000)}.jpg`)).toBeUndefined();
    expect(image('')).toBeUndefined();
    expect(image('   ')).toBeUndefined();
  });

  it('ignores what is only text to the page: comments, scripts and styles, and anything after the head', () => {
    const html = `<head>
      <!-- <meta property="og:title" content="from a comment"> -->
      <script>var s = "<meta property='og:title' content='from a script'>"; </script>
      <style>/* <title>from a style</title> */</style>
      <noscript><meta property="og:title" content="from noscript"></noscript>
      <meta property="og:title" content="the real one">
    </head><body><meta property="og:description" content="from the body"><title>from the body</title></body>`;
    expect(parseHtml(html, base)).toEqual({ title: 'the real one' });
    expect(parseHtml('<head></head><meta property="og:title" content="after the head">', base)).toEqual({});
    expect(
      parseHtml('<head><title>T</title></head><body><meta property="og:title" content="late"></body>', base)
        .title,
    ).toBe('T');
    // a tag name that merely starts like another
    expect(
      parseHtml('<head><metadata property="og:title" content="no"><title>yes</title></head>', base).title,
    ).toBe('yes');
  });

  it('survives broken pages without throwing', () => {
    for (const html of [
      '',
      '<',
      '<<<<',
      '<meta',
      '<meta property="og:title" content="unterminated',
      '<!-- never closed <title>x</title>',
      '<title>no end',
      '<script>no end <title>x</title>',
      '<head><title>t</title></head',
      '\u0000\u0001<head>',
      '<meta property="__proto__" content="x"><meta property="constructor" content="y">',
      '<head><meta property="og:title" content="a" content="b"></head>',
    ])
      expect(() => parseHtml(html, base), html).not.toThrow();
    expect(parseHtml('<title>no end', base).title).toBe('no end');
    expect(parseHtml('<head><meta property="og:title" content="a" content="b"></head>', base).title).toBe(
      'a',
    );
    expect(parseHtml('<meta property="__proto__" content="x">', base)).toEqual({});
  });

  it('stays fast on a page built to be slow (half a megabyte of unclosed tags, scripts and quotes)', () => {
    const attack = [
      '<script '.repeat(60_000),
      '<'.repeat(200_000),
      '<meta '.repeat(40_000),
      `<meta content="${'"'.repeat(1000)}`,
      '<!--'.repeat(50_000),
      `<title>${'&'.repeat(100_000)}`,
    ];
    for (const html of attack) {
      const started = performance.now();
      parseHtml(html.slice(0, PREVIEW_MAX_BYTES), base);
      expect(performance.now() - started, html.slice(0, 20)).toBeLessThan(1500);
    }
    const many = `<head>${'<meta name="x" content="y">'.repeat(15_000)}<title>t</title></head>`;
    const started = performance.now();
    expect(parseHtml(many, base).title).toBe('t');
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

// ─── the preview route's handler ────────────────────────────────────────────────────────────────

describe('POST …/planning/ideas/preview', () => {
  function previewDeps(over: Partial<PreviewDeps> = {}) {
    const hits: string[] = [];
    const w = world({ dns: { 'example.com': [PUBLIC] }, routes: { 'https://example.com/hall': page(PAGE) } });
    const deps: PreviewDeps = {
      ...w.deps,
      rateHit: async (userId) => {
        hits.push(userId);
        return true;
      },
      ...over,
    };
    return { deps, hits, w };
  }

  it('answers the preview, for the owner of an event that has the planning feature only', async () => {
    const { deps: p, hits } = previewDeps();
    const ok = await previewOperation(OWNER, ID, { url: 'https://example.com/hall' }, deps(), p);
    expect(ok).toEqual({ status: 200, body: { ok: true, preview: { title: 'אולם בגליל' } } });
    expect(hits).toEqual([OWNER]);
    expect(
      (await previewOperation(STRANGER, ID, { url: 'https://example.com/hall' }, deps(), p)).status,
    ).toBe(404);
    expect(
      (await previewOperation(OWNER, 'nope', { url: 'https://example.com/hall' }, deps(), p)).status,
    ).toBe(404);
    const off = deps({ input: input({ overrides: { off: ['planning'], grant: [] } }) });
    expect(await previewOperation(OWNER, ID, { url: 'https://example.com/hall' }, off, p)).toMatchObject({
      status: 403,
      body: { code: 'feature_off' },
    });
    expect(hits).toEqual([OWNER]);
  });

  it('wants an http(s) address and nothing else, before it counts a preview or touches the network', async () => {
    const { deps: p, hits, w } = previewDeps();
    for (const body of [
      {},
      { url: 'javascript:alert(1)' },
      { url: 'ftp://example.com' },
      { url: 'example.com' },
      { url: '' },
      { url: 5 },
      { url: 'https://example.com/', extra: 1 },
      { url: `https://example.com/${'a'.repeat(1000)}` },
      null,
      'https://example.com',
    ])
      expect(await previewOperation(OWNER, ID, body, deps(), p), JSON.stringify(body)).toMatchObject({
        status: 400,
        body: { ok: false, code: 'invalid' },
      });
    expect(hits).toEqual([]);
    expect(w.fetched).toEqual([]);
  });

  it('allows thirty previews an hour per user, then answers 429 without fetching anything', async () => {
    expect(PREVIEW_LIMIT).toEqual({ count: 30, windowSeconds: 3600 });
    const { deps: p, w } = previewDeps({ rateHit: async () => false });
    expect(await previewOperation(OWNER, ID, { url: 'https://example.com/hall' }, deps(), p)).toEqual({
      status: 429,
      body: { ok: false, code: 'rate_limited' },
    });
    expect(w.resolved).toEqual([]);
    expect(w.fetched).toEqual([]);
  });

  it('answers preview_failed (422) for any failure, giving nothing away about why', async () => {
    const { deps: p } = previewDeps();
    const fails = [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:8080/',
      'http://example.com:22/',
      'https://nowhere.example.org/',
      'https://example.com/missing',
    ];
    for (const url of fails)
      expect(await previewOperation(OWNER, ID, { url }, deps(), p), url).toEqual({
        status: 422,
        body: { ok: false, code: 'preview_failed' },
      });
  });
});

// ─── the real connection ────────────────────────────────────────────────────────────────────────

describe('the real connection (a local server stands in for the web)', () => {
  const servers: http.Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
  });
  async function serve(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return (server.address() as AddressInfo).port;
  }
  const request = (port: number, path = '/', over: Partial<PreviewRequest> = {}): PreviewRequest => ({
    // a name nothing resolves: the request can only get here through the pinned address
    url: new URL(`http://pinned.invalid:${port}${path}`),
    address: '127.0.0.1',
    family: 4,
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)',
      'accept-encoding': 'gzip, deflate, br',
    },
    signal: AbortSignal.timeout(3000),
    ...over,
  });
  const read = async (res: PreviewResponse) => {
    let text = '';
    for await (const c of res.body!) text += Buffer.from(c).toString('utf8');
    return text;
  };

  it('connects to the address it was given, never looking the name up, and keeps the name for the Host header', async () => {
    const seen: http.IncomingHttpHeaders[] = [];
    const port = await serve((req, res) => {
      seen.push(req.headers);
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<title>pinned</title>');
    });
    const res = await liveFetch(request(port));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    expect(await read(res)).toBe('<title>pinned</title>');
    expect(seen[0]!.host).toBe(`pinned.invalid:${port}`);
    expect(seen[0]!.cookie).toBeUndefined();
    expect(seen[0]!.authorization).toBeUndefined();
    expect(seen[0]!['user-agent']).toBe('Mozilla/5.0 (compatible; LinkPreview/1.0)');
  });

  it('hands a redirect back as it is (the caller checks the next hop), and reads a compressed page as text', async () => {
    const port = await serve((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: 'http://127.0.0.1:9/' });
        res.end();
      } else {
        res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
        res.end(gzipSync('<title>zipped</title>'));
      }
    });
    const redirected = await liveFetch(request(port, '/redirect'));
    expect(redirected.status).toBe(302);
    expect(redirected.headers.location).toBe('http://127.0.0.1:9/');
    redirected.close?.();
    const zipped = await liveFetch(request(port, '/zip'));
    expect(zipped.headers['content-encoding']).toBeUndefined();
    expect(await read(zipped)).toBe('<title>zipped</title>');
  });

  it('stops when told to: a server that never answers, and one that never stops', async () => {
    const port = await serve(() => undefined);
    await expect(liveFetch(request(port, '/', { signal: AbortSignal.timeout(80) }))).rejects.toBeTruthy();
    const endless = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      const timer = setInterval(() => res.write('x'.repeat(1024)), 5);
      res.on('close', () => clearInterval(timer));
    });
    const res = await liveFetch(request(endless));
    let total = 0;
    for await (const c of res.body!) {
      total += c.byteLength;
      if (total > 8 * 1024) break;
    }
    res.close?.();
    expect(total).toBeGreaterThan(8 * 1024);
  });

  it('is used end to end with the guard: a name that resolves to loopback never reaches the server', async () => {
    let hits = 0;
    const port = await serve((_req, res) => {
      hits++;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<title>inside</title>');
    });
    const deps: PreviewFetchDeps = { resolve: async () => ['127.0.0.1'], fetch: liveFetch };
    await expect(fetchPreview(`http://rebind.example.com:${port}/`, deps)).rejects.toBeInstanceOf(
      PreviewError,
    );
    await expect(fetchPreview(`http://127.0.0.1:${port}/`, deps)).rejects.toBeInstanceOf(PreviewError);
    expect(hits).toBe(0);
  });
});

// ─── the board's own logic ──────────────────────────────────────────────────────────────────────

describe('the composer', () => {
  it('a pasted link is a link card; anything else is a note; nothing is nothing', () => {
    expect(parseComposer('')).toBeNull();
    expect(parseComposer('   \n ')).toBeNull();
    expect(parseComposer('https://example.com/hall?x=1')).toEqual({
      type: 'link',
      url: 'https://example.com/hall?x=1',
    });
    expect(parseComposer('  http://example.com  ')).toEqual({ type: 'link', url: 'http://example.com' });
    expect(parseComposer('www.example.com/path')).toEqual({
      type: 'link',
      url: 'https://www.example.com/path',
    });
    // text that merely contains a link, or looks like a file name, is a note
    expect(parseComposer('כדאי לראות https://example.com')).toEqual({
      type: 'note',
      body: 'כדאי לראות https://example.com',
    });
    expect(parseComposer('notes.txt')).toEqual({ type: 'note', body: 'notes.txt' });
    expect(parseComposer('לקנות נרות')).toEqual({ type: 'note', body: 'לקנות נרות' });
    expect(parseComposer('javascript:alert(1)')).toEqual({ type: 'note', body: 'javascript:alert(1)' });
    expect(parseComposer('ftp://example.com/x')).toEqual({ type: 'note', body: 'ftp://example.com/x' });
    expect(parseComposer(`https://example.com/${'a'.repeat(1000)}`)).toMatchObject({ type: 'note' });
    expect((parseComposer('x'.repeat(6000)) as { body: string }).body).toHaveLength(5000);
  });

  it('normalizes an address typed in the editor', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('HTTPS://Example.com/X')).toBe('HTTPS://Example.com/X');
    for (const bad of [
      '',
      'hello',
      'hello world',
      'javascript:alert(1)',
      'ftp://example.com',
      'mailto:a@b.com',
      'a.b',
      'https://u:p@example.com',
      'example .com',
    ])
      expect(normalizeUrl(bad), bad).toBeNull();
  });
});

describe('the board', () => {
  it('orders pinned first, then by sort, then the newest', () => {
    const a = idea({ id: 'a', sort: 0, createdAt: '2026-10-01T00:00:00+00:00' });
    const b = idea({ id: 'b', sort: -10, createdAt: '2026-10-02T00:00:00+00:00' });
    const c = idea({ id: 'c', sort: 0, createdAt: '2026-10-03T00:00:00+00:00' });
    const d = idea({ id: 'd', sort: 50, pinned: true });
    expect([a, b, c, d].sort(byBoard).map((i) => i.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('counts tags, most used first', () => {
    const ideas = [
      idea({ tags: ['פרחים', 'אולם'] }),
      idea({ tags: ['אולם'] }),
      idea({ tags: ['אולם', 'דיג׳יי'] }),
      idea({ tags: [] }),
    ];
    expect(tagCounts(ideas)).toEqual([
      { tag: 'אולם', count: 3 },
      { tag: 'דיג׳יי', count: 1 },
      { tag: 'פרחים', count: 1 },
    ]);
  });

  it('searches title, text, address, tags, the preview’s words and checklist lines; every word must be found; by tag too', () => {
    const card = idea({
      title: 'אולם בגליל',
      body: 'נראה מקסים',
      url: 'https://halls.example.com/galil',
      ogPreview: { title: 'Galilee Hall', description: 'Weddings with a view', site: 'Halls' },
      tags: ['אולם', 'Priority'],
      items: [{ text: 'להתקשר ביום ראשון', done: false }],
    });
    for (const q of [
      '',
      '  ',
      'גליל',
      'מקסים',
      'halls.example',
      'galilee',
      'WEDDINGS',
      'priority',
      'ראשון',
      'אולם מקסים',
      'view hall',
    ])
      expect(matchesIdea(card, q, null), q).toBe(true);
    for (const q of ['דיג׳יי', 'אולם צלם', 'xyz']) expect(matchesIdea(card, q, null), q).toBe(false);
    expect(matchesIdea(card, '', 'אולם')).toBe(true);
    expect(matchesIdea(card, '', 'פרחים')).toBe(false);
    expect(matchesIdea(card, 'גליל', 'אולם')).toBe(true);
    expect(matchesIdea(card, 'גליל', 'פרחים')).toBe(false);
  });

  it('suggests a name and notes for what a card becomes', () => {
    expect(suggestName(idea({ title: ' כותרת ', body: 'גוף' }), 120)).toBe('כותרת');
    expect(suggestName(idea({ title: null, body: '\n\nשורה ראשונה\nשנייה' }), 120)).toBe('שורה ראשונה');
    expect(
      suggestName(
        idea({ title: null, body: null, url: 'https://www.example.com/x', ogPreview: { title: 'Page' } }),
        120,
      ),
    ).toBe('Page');
    expect(suggestName(idea({ title: null, body: null, url: 'https://www.example.com/x' }), 120)).toBe(
      'example.com',
    );
    expect(suggestName(idea({ title: null, body: null, items: [{ text: 'נרות', done: false }] }), 120)).toBe(
      'נרות',
    );
    expect(suggestName(idea({ title: 'x'.repeat(300) }), 120)).toHaveLength(120);
    expect(
      suggestNotes(
        idea({
          body: 'הערה',
          url: 'https://example.com/x',
          items: [
            { text: 'א', done: true },
            { text: 'ב', done: false },
          ],
        }),
        2000,
      ),
    ).toBe('הערה\n✓ א\n○ ב\nhttps://example.com/x');
    expect(suggestNotes(idea({ body: null }), 2000)).toBe('');
    expect(suggestNotes(idea({ body: 'x'.repeat(3000) }), 2000)).toHaveLength(2000);
  });
});

describe('the editor’s draft', () => {
  it('a new card sends everything it holds; an old one only what changed', () => {
    const d = { ...emptyDraft('note'), title: ' כותרת ', body: 'גוף', tags: ['א'] };
    expect(draftPatch(d)).toEqual({
      type: 'note',
      title: 'כותרת',
      body: 'גוף',
      url: null,
      imagePath: null,
      color: 'default',
      tags: ['א'],
      pinned: false,
      items: [],
    });
    const original = idea({ title: 'כותרת', body: 'גוף', tags: ['א'] });
    expect(draftPatch(draftOf(original), original)).toEqual({});
    expect(draftPatch({ ...draftOf(original), color: 'info', pinned: true }, original)).toEqual({
      color: 'info',
      pinned: true,
    });
    expect(draftPatch({ ...draftOf(original), body: '' }, original)).toEqual({ body: null });
  });

  it('a card is what it holds: a link without an address, a picture without a file, a checklist without lines is a note', () => {
    expect(draftPatch({ ...emptyDraft('link'), body: 'x' }).type).toBe('note');
    expect(draftPatch({ ...emptyDraft('image'), body: 'x' }).type).toBe('note');
    expect(draftPatch({ ...emptyDraft('list'), body: 'x' }).type).toBe('note');
    expect(draftPatch({ ...emptyDraft('link'), url: 'example.com' })).toMatchObject({
      type: 'link',
      url: 'https://example.com',
    });
    expect(draftPatch({ ...emptyDraft('image'), imagePath: 'a/b/c.png' }).type).toBe('image');
    expect(
      draftPatch({
        ...emptyDraft('list'),
        items: [
          { text: ' נרות ', done: true },
          { text: ' ', done: false },
        ],
      }),
    ).toMatchObject({
      type: 'list',
      items: [{ text: 'נרות', done: true }],
    });
  });

  it('changing a link’s address drops the preview of the old page', () => {
    const original = idea({ type: 'link', url: 'https://a.example.com/', ogPreview: { title: 'A' } });
    expect(draftPatch({ ...draftOf(original), url: 'https://b.example.com/' }, original)).toEqual({
      url: 'https://b.example.com/',
      ogPreview: null,
    });
    expect(draftPatch({ ...draftOf(original), title: 'שם' }, original)).toEqual({ title: 'שם' });
  });

  it('knows when there is nothing to save, and adds tags the way they are typed', () => {
    expect(draftHasContent(emptyDraft('note'))).toBe(false);
    expect(draftHasContent({ ...emptyDraft('list'), items: [{ text: '  ', done: false }] })).toBe(false);
    expect(draftHasContent({ ...emptyDraft('note'), body: 'x' })).toBe(true);
    expect(draftHasContent({ ...emptyDraft('image'), imagePath: 'a/b/c.png' })).toBe(true);
    expect(addTags(['א'], ' #ב , ג,א, ,')).toEqual(['א', 'ב', 'ג']);
    expect(addTags([], 'x'.repeat(40))[0]).toHaveLength(30);
    expect(
      addTags(
        Array.from({ length: 11 }, (_, i) => `t${i}`),
        'a, b, c',
      ),
    ).toHaveLength(12);
  });

  it('what Undo and the editor send is what the API takes', () => {
    const full = idea({
      type: 'link',
      title: 'אולם',
      body: 'הערה',
      url: 'https://example.com/hall',
      ogPreview: { title: 'T', description: 'D', image: 'https://cdn.example.com/a.jpg', site: 'S' },
      imagePath: null,
      color: 'brand',
      tags: ['א', 'ב'],
      pinned: true,
      items: [{ text: 'נרות', done: true }],
      sort: -20,
    });
    expect(IdeaPatch.safeParse(restorePatch(full)).success).toBe(true);
    expect(restorePatch(full)).toMatchObject({ id: IDEA_ID, sort: -20, pinned: true, color: 'brand' });
    expect(IdeaPatch.safeParse(draftPatch(draftOf(full))).success).toBe(true);
    expect(IdeaPatch.safeParse(draftPatch(emptyDraft('note'))).success).toBe(true);
  });
});

describe('small helpers of the board', () => {
  it('only an http(s) address is ever a link or a picture on the page', () => {
    expect(webHref('https://example.com/x')).toBe('https://example.com/x');
    expect(webHref('HTTP://example.com')).toBe('HTTP://example.com');
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://example.com',
      '//example.com',
      'example.com',
      '',
      null,
      undefined,
    ])
      expect(webHref(bad), String(bad)).toBeUndefined();
    expect(webHref('https://cdn.example.com/a.jpg', true)).toBe('https://cdn.example.com/a.jpg');
    expect(webHref('http://cdn.example.com/a.jpg', true)).toBeUndefined();
  });

  it('shows a link without its scheme, www, query or trailing slash', () => {
    expect(shortUrl('https://www.example.com/')).toBe('example.com');
    expect(shortUrl('https://example.com/halls/galil/?utm=1#x')).toBe('example.com/halls/galil');
    expect(shortUrl('not a url')).toBe('not a url');
  });

  it('makes an id for a new card even where the browser has no randomUUID', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const real = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const a = newId();
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(newId()).not.toBe(a);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: real, configurable: true });
    }
  });
});
