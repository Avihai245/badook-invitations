import { describe, expect, it, vi } from 'vitest';
import { NO_OVERRIDES, FEATURES, type Feature, type FeatureInput } from '@/features/flags/features';
import { CATEGORY_KEYS } from '@/features/planning/model/categories';
import { buildFollowUps } from '@/features/planning/model/follow-ups';
import type { PlanVendor, RawPlanState } from '@/features/planning/model/plan';
import {
  addDays,
  addMonths,
  isIsoDate,
  parsePaymentTerms,
  type ProposedPayment,
} from '@/features/planning/model/payment-terms';
import type { PlanSummary, PlanningDeps } from '@/features/planning/server/types';
import { vendorOperation } from '@/features/planning/server/vendors';
import {
  cheapestIds,
  countByStatus,
  mailLink,
  missingCategories,
  newId,
  nextSort,
  normalizeUrl,
  parseAmount,
  phoneDigits,
  telLink,
  toggleCompare,
  vendorCost,
  waLink,
} from '@/features/planning/ui/vendors/helpers';

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const V1 = '44444444-4444-4444-8444-444444444441';
const V2 = '44444444-4444-4444-8444-444444444442';
const CAT = '55555555-5555-4555-8555-555555555555';
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

const vendor = (over: Partial<PlanVendor> = {}): PlanVendor => ({
  id: V1,
  name: 'אולם הגן',
  category: 'venue',
  phone: null,
  email: null,
  url: null,
  status: 'idea',
  quoteAmount: null,
  paymentTerms: null,
  included: null,
  rating: null,
  notes: null,
  attachments: [],
  sort: 10,
  ...over,
});

const settings = {
  templateKey: 'wedding',
  variant: 'default' as const,
  totalBudget: 100000,
  vatMode: 'included' as const,
  vatPct: 18,
  guestBasis: 'invited' as const,
  manualAdults: 80,
  manualChildren: 0,
  manualTables: 0,
  integrations: {},
  reminders: {},
  requiredVendors: [],
  onboardingDone: true,
  anchorDate: '2027-06-17',
  headcountSeen: null,
};

const raw = (over: Partial<RawPlanState> = {}): RawPlanState => ({
  invitation: {
    id: ID,
    slug: 's',
    status: 'published',
    eventType: 'wedding',
    date: '2027-06-17',
    timezone: 'Asia/Jerusalem',
    rsvpDeadline: '2027-06-01',
  },
  settings,
  tasks: [],
  categories: [],
  items: [],
  payments: [],
  vendors: [],
  ideas: [],
  headcount: {
    basis: 'invited',
    adults: 80,
    children: 0,
    guests: 80,
    tables: 0,
    invited: 80,
    confirmedAdults: 0,
    confirmedChildren: 0,
  },
  totals: {
    totalBudget: null,
    planned: 0,
    expected: 0,
    committed: 0,
    paid: 0,
    unpaid: 0,
    remaining: null,
    perGuest: null,
    byCategory: [],
  },
  headcountChange: null,
  facts: { tables: 0, confirmedUnseated: 0, stationReady: false },
  ...over,
});

function deps(over: Partial<{ state: RawPlanState | null; input: ReturnType<typeof input> | null }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const state = { current: over.state === undefined ? raw() : over.state };
  const results: Record<string, unknown> = {};
  const d: PlanningDeps & { calls: typeof calls; state: typeof state; results: typeof results } = {
    calls,
    state,
    results,
    access: async (id) => (id === ID ? (over.input === undefined ? input() : over.input) : null),
    rpc: (async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === 'planning_state') return state.current;
      if (fn in results) return results[fn];
      return null;
    }) as PlanningDeps['rpc'],
    summary: async () =>
      ({
        eventType: 'wedding',
        status: 'published',
        unpublishedChanges: false,
        guests: 80,
        sent: 80,
        responses: 4,
      }) satisfies PlanSummary,
    now: () => NOW,
    newId: () => 'new-id',
  };
  return d;
}
const last = (d: ReturnType<typeof deps>, fn: string) => d.calls.filter((c) => c.fn === fn).at(-1)!;
const ran = (d: ReturnType<typeof deps>, fn: string) => d.calls.some((c) => c.fn === fn);
const op = (d: ReturnType<typeof deps>, body: unknown, user = OWNER, id = ID) =>
  vendorOperation(user, id, body, d);

// ─── the API ─────────────────────────────────────────────────────────────────────────────────────

describe('who may use the vendors route', () => {
  it('only the owner, only an event with the planning feature, and a real body', async () => {
    const body = { op: 'delete', ids: [V1] };
    expect((await op(deps(), body, STRANGER)).status).toBe(404);
    expect((await op(deps(), body, OWNER, 'nope')).status).toBe(404);
    expect((await op(deps({ input: null }), body)).status).toBe(404);
    expect(
      await op(deps({ input: input({ overrides: { off: ['planning'], grant: [] } }) }), body),
    ).toMatchObject({ status: 403, body: { code: 'feature_off', feature: 'planning' } });

    const d = deps();
    for (const bad of [
      null,
      'save',
      {},
      { op: 'nope' },
      { op: 'delete' },
      { op: 'delete', ids: [] },
      { op: 'delete', ids: ['x'] },
      { op: 'delete', ids: [V1], extra: 1 },
      { op: 'save' },
      { op: 'save', vendor: { name: 'x', extra: 1 } },
      { op: 'close' },
      { op: 'close', id: 'x' },
      { op: 'undo_close', id: V1 },
    ])
      expect((await op(d, bad)).status, JSON.stringify(bad)).toBe(400);
    expect(d.calls.filter((c) => c.fn.startsWith('planning_vendor'))).toEqual([]);
  });
});

describe('saving a vendor', () => {
  it('a quick add needs only a name; a phone that parses is stored in international form', async () => {
    const d = deps();
    d.results.planning_vendor_save = vendor({ phone: '+972501234567' });
    const res = await op(d, {
      op: 'save',
      vendor: { name: ' דנה צילום ', category: 'photographer', phone: '050-123-4567' },
    });
    expect(res).toMatchObject({ status: 200, body: { ok: true, vendor: { phone: '+972501234567' } } });
    expect(last(d, 'planning_vendor_save').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_vendor: { name: 'דנה צילום', category: 'photographer', phone: '+972501234567' },
    });
  });

  it('a phone that does not parse is kept as typed, and a blank one clears it', async () => {
    const d = deps();
    d.results.planning_vendor_save = vendor();
    await op(d, { op: 'save', vendor: { name: 'DJ', phone: 'ask for Dana' } });
    expect((last(d, 'planning_vendor_save').args.p_vendor as { phone: string }).phone).toBe('ask for Dana');
    await op(d, { op: 'save', vendor: { id: V1, phone: '   ' } });
    expect(last(d, 'planning_vendor_save').args.p_vendor).toEqual({ id: V1, phone: null });
  });

  it('changes by id carry only the fields sent; blanks become none; the name is optional for a known id', async () => {
    const d = deps();
    d.results.planning_vendor_save = vendor({ status: 'quote' });
    const res = await op(d, {
      op: 'save',
      vendor: {
        id: V1,
        status: 'quote',
        quoteAmount: 12500.5,
        paymentTerms: '30% מקדמה, 70% ביום האירוע',
        included: '',
        rating: 5,
        email: 'hall@example.com',
        url: 'https://example.com/hall',
        notes: ' ',
        sort: 30,
      },
    });
    expect(res.status).toBe(200);
    expect(last(d, 'planning_vendor_save').args.p_vendor).toEqual({
      id: V1,
      status: 'quote',
      quoteAmount: 12500.5,
      paymentTerms: '30% מקדמה, 70% ביום האירוע',
      included: null,
      rating: 5,
      email: 'hall@example.com',
      url: 'https://example.com/hall',
      notes: null,
      sort: 30,
    });
  });

  it('refuses what is not a vendor: no name for a new one, a link that is not a web address, a bad rating', async () => {
    const d = deps();
    for (const vendor of [
      { category: 'dj' },
      { name: '   ' },
      { name: 'x'.repeat(121) },
      { name: 'x', category: 'not_a_category' },
      { name: 'x', status: 'maybe' },
      { name: 'x', url: 'javascript:alert(1)' },
      { name: 'x', url: 'ftp://example.com' },
      { name: 'x', url: 'example.com' },
      { name: 'x', email: 'not an email' },
      { name: 'x', rating: 6 },
      { name: 'x', rating: 0 },
      { name: 'x', rating: 2.5 },
      { name: 'x', quoteAmount: -1 },
      { name: 'x', quoteAmount: 1e12 },
      { name: 'x', notes: 'x'.repeat(2001) },
      { name: 'x', id: 'not-a-uuid' },
    ])
      expect((await op(d, { op: 'save', vendor })).status, JSON.stringify(vendor)).toBe(400);
    expect(ran(d, 'planning_vendor_save')).toBe(false);
    expect((await op(d, { op: 'save', vendor: { name: 'x', url: '  ' } })).status).toBe(404);
  });

  it('answers what the database answers: not the host’s → 404, a refusal → 400, too many → 422', async () => {
    const d = deps();
    d.results.planning_vendor_save = null;
    expect((await op(d, { op: 'save', vendor: { name: 'x' } })).status).toBe(404);
    d.results.planning_vendor_save = { ok: false, code: 'invalid' };
    expect(await op(d, { op: 'save', vendor: { name: 'x' } })).toMatchObject({
      status: 400,
      body: { ok: false, code: 'invalid' },
    });
    d.results.planning_vendor_save = { ok: false, code: 'too_many' };
    expect((await op(d, { op: 'save', vendor: { name: 'x' } })).status).toBe(422);
  });
});

describe('attachments', () => {
  const file = (path: string, name = 'quote.pdf') => ({
    path,
    name,
    size: 1200,
    type: 'application/pdf' as const,
  });
  const own = `${OWNER}/${ID}/0b5e7a40-0000-4000-8000-000000000001.pdf`;

  it('need the Pro tool: another plan answers feature_off, and nothing is saved', async () => {
    const d = deps({ input: input({ plan: 'free' }) });
    d.results.planning_vendor_save = vendor();
    const res = await op(d, { op: 'save', vendor: { id: V1, attachments: [file(own)] } });
    expect(res).toMatchObject({
      status: 403,
      body: { code: 'feature_off', feature: 'planning_export', package: 'premium' },
    });
    expect(ran(d, 'planning_vendor_save')).toBe(false);
    // the rest of the vendor is not the paid tool's
    expect((await op(d, { op: 'save', vendor: { id: V1, notes: 'x', attachments: [] } })).status).toBe(200);
  });

  it('are saved with the tool, when every path is in this event’s own folder', async () => {
    const d = deps();
    d.results.planning_vendor_save = vendor({ attachments: [file(own)] });
    expect((await op(d, { op: 'save', vendor: { id: V1, attachments: [file(own)] } })).status).toBe(200);
    expect(
      (last(d, 'planning_vendor_save').args.p_vendor as { attachments: unknown[] }).attachments,
    ).toHaveLength(1);
    const elsewhere = [
      `${STRANGER}/${ID}/a.pdf`,
      `${OWNER}/${STRANGER}/a.pdf`,
      `${OWNER}/${ID}/../${STRANGER}/a.pdf`,
      `${OWNER}/${ID}/nested/a.pdf`,
      `${OWNER}/${ID}/`.slice(0, -1),
      'a.pdf',
    ];
    for (const path of elsewhere)
      expect((await op(d, { op: 'save', vendor: { id: V1, attachments: [file(path)] } })).status, path).toBe(
        400,
      );
  });

  it('what a vendor already holds stays after a downgrade; only new files need the tool', async () => {
    const held = file(own);
    const fresh = file(`${OWNER}/${ID}/0b5e7a40-0000-4000-8000-000000000002.pdf`, 'new.pdf');
    const d = deps({
      input: input({ plan: 'free' }),
      state: raw({ vendors: [vendor({ attachments: [held] })] }),
    });
    d.results.planning_vendor_save = vendor({ attachments: [held] });
    expect((await op(d, { op: 'save', vendor: { id: V1, attachments: [held] } })).status).toBe(200);
    expect((await op(d, { op: 'save', vendor: { id: V1, attachments: [] } })).status).toBe(200);
    expect((await op(d, { op: 'save', vendor: { id: V1, attachments: [held, fresh] } })).status).toBe(403);
    // another vendor's file is not this one's
    expect((await op(d, { op: 'save', vendor: { id: V2, attachments: [held] } })).body).toMatchObject({
      code: 'feature_off',
    });
  });

  it('at most six, with a type that is a document or a picture', async () => {
    const d = deps();
    d.results.planning_vendor_save = vendor();
    const many = Array.from({ length: 7 }, (_, i) => file(`${OWNER}/${ID}/${i}.pdf`));
    expect((await op(d, { op: 'save', vendor: { id: V1, attachments: many } })).status).toBe(400);
    const odd = { ...file(own), type: 'application/zip' };
    expect((await op(d, { op: 'save', vendor: { id: V1, attachments: [odd] } })).status).toBe(400);
  });
});

describe('deleting vendors', () => {
  it('passes the ids and answers how many went', async () => {
    const d = deps();
    d.results.planning_vendor_delete = 2;
    expect(await op(d, { op: 'delete', ids: [V1, V2] })).toMatchObject({
      status: 200,
      body: { ok: true, deleted: 2 },
    });
    expect(last(d, 'planning_vendor_delete').args).toEqual({ p_id: ID, p_owner: OWNER, p_ids: [V1, V2] });
    d.results.planning_vendor_delete = null;
    expect((await op(d, { op: 'delete', ids: [V1] })).status).toBe(404);
  });
});

describe('closing a vendor', () => {
  const plan = {
    item: { categoryKey: 'venue', title: 'אולם הגן', amount: 32000 },
    payments: [
      { label: 'מקדמה', amount: 9600, dueDate: '2026-10-03', payOnEventDay: false },
      { label: 'יתרה', amount: 22400, dueDate: '2027-06-17', payOnEventDay: true },
    ],
    tasks: [{ title: 'לחתום על חוזה', dueDate: '2026-10-06', category: 'venue' }],
  };
  const closed = {
    vendor: vendor({ status: 'booked', quoteAmount: 32000 }),
    previous: { status: 'quote', quoteAmount: 30000 },
    created: { categoryId: CAT, itemId: V2, paymentIds: [], taskIds: [] },
  };

  it('with the budget connected: the plan goes to the database, the price taken from the item', async () => {
    const d = deps();
    d.results.planning_vendor_close = closed;
    const res = await op(d, { op: 'close', id: V1, plan });
    expect(res).toMatchObject({
      status: 200,
      body: { ok: true, vendor: { status: 'booked' }, previous: closed.previous, created: closed.created },
    });
    expect(last(d, 'planning_vendor_close').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_vendor: V1,
      p_plan: { ...plan, amount: 32000 },
    });
  });

  it('a plan with parts left out sends only the parts it has', async () => {
    const d = deps();
    d.results.planning_vendor_close = closed;
    await op(d, { op: 'close', id: V1, plan: { tasks: plan.tasks } });
    expect(last(d, 'planning_vendor_close').args.p_plan).toEqual({ tasks: plan.tasks });
    await op(d, { op: 'close', id: V1, plan: { item: { categoryId: CAT, title: 'x' }, payments: [] } });
    expect(last(d, 'planning_vendor_close').args.p_plan).toEqual({ item: { categoryId: CAT, title: 'x' } });
    await op(d, { op: 'close', id: V1 });
    expect(last(d, 'planning_vendor_close').args.p_plan).toEqual({});
  });

  it('with the vendors connection off only the status changes: the plan is ignored', async () => {
    const off = raw({ settings: { ...settings, integrations: { mode: 'recommended', vendors: false } } });
    const d = deps({ state: off });
    d.results.planning_vendor_close = { ...closed, created: { itemId: null, paymentIds: [], taskIds: [] } };
    const res = await op(d, { op: 'close', id: V1, plan });
    expect(res.status).toBe(200);
    expect(last(d, 'planning_vendor_close').args.p_plan).toEqual({});
    // standalone mode turns it off too; a plan with no settings follows the default (on)
    const alone = deps({ state: raw({ settings: { ...settings, integrations: { mode: 'standalone' } } }) });
    alone.results.planning_vendor_close = closed;
    await op(alone, { op: 'close', id: V1, plan });
    expect(last(alone, 'planning_vendor_close').args.p_plan).toEqual({});
    const fresh = deps({ state: raw({ settings: null }) });
    fresh.results.planning_vendor_close = closed;
    await op(fresh, { op: 'close', id: V1, plan });
    expect(last(fresh, 'planning_vendor_close').args.p_plan).toMatchObject({ amount: 32000 });
  });

  it('refuses a plan that is not one: unknown keys, an empty title, an amount of nothing, a bad date', async () => {
    const d = deps();
    const bad = [
      { item: { categoryKey: 'venue', title: '', amount: 1 } },
      { item: { categoryKey: 'nope', title: 'x', amount: 1 } },
      { item: { categoryKey: 'venue', title: 'x', amount: -1 } },
      { item: { categoryKey: 'venue', title: 'x', extra: 1 } },
      { payments: [{ label: 'x', amount: 0 }] },
      { payments: [{ label: '', amount: 5 }] },
      { payments: [{ label: 'x', amount: 5, dueDate: '2026-13-45' }] },
      { payments: Array.from({ length: 21 }, () => ({ label: 'x', amount: 1 })) },
      { tasks: [{ title: '' }] },
      { tasks: [{ title: 'x', dueDate: 'tomorrow' }] },
      { tasks: Array.from({ length: 21 }, () => ({ title: 'x' })) },
      { extra: true },
    ];
    for (const p of bad)
      expect((await op(d, { op: 'close', id: V1, plan: p })).status, JSON.stringify(p)).toBe(400);
    expect(ran(d, 'planning_vendor_close')).toBe(false);
  });

  it('answers what the database answers: a foreign category → 400 invalid_link, not the host’s → 404', async () => {
    const d = deps();
    d.results.planning_vendor_close = { ok: false, code: 'invalid_link' };
    expect(await op(d, { op: 'close', id: V1, plan })).toMatchObject({
      status: 400,
      body: { ok: false, code: 'invalid_link' },
    });
    d.results.planning_vendor_close = { ok: false, code: 'too_many' };
    expect((await op(d, { op: 'close', id: V1, plan })).status).toBe(422);
    d.results.planning_vendor_close = null;
    expect((await op(d, { op: 'close', id: V1, plan })).status).toBe(404);
    // no plan state at all (not the owner's)
    expect((await op(deps({ state: null }), { op: 'close', id: V1, plan })).status).toBe(404);
  });
});

describe('taking a close back', () => {
  const previous = { status: 'quote', quoteAmount: null };
  const created = { categoryId: CAT, itemId: V2, paymentIds: [V1], taskIds: [V2] };

  it('passes what the close made to the database', async () => {
    const d = deps();
    d.results.planning_vendor_undo_close = true;
    expect(await op(d, { op: 'undo_close', id: V1, previous, created })).toMatchObject({
      status: 200,
      body: { ok: true },
    });
    expect(last(d, 'planning_vendor_undo_close').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_vendor: V1,
      p_previous: previous,
      p_created: created,
    });
    // a close that made nothing answers a short list
    await op(d, {
      op: 'undo_close',
      id: V1,
      previous,
      created: { itemId: null },
    });
    expect(last(d, 'planning_vendor_undo_close').args.p_created).toEqual({
      itemId: null,
      paymentIds: [],
      taskIds: [],
    });
  });

  it('is 404 when the database says it was not the host’s, and refuses ids that are not ids', async () => {
    const d = deps();
    d.results.planning_vendor_undo_close = false;
    expect((await op(d, { op: 'undo_close', id: V1, previous, created })).status).toBe(404);
    for (const bad of [
      { previous: { status: 'nope', quoteAmount: null }, created },
      { previous, created: { ...created, itemId: 'x' } },
      { previous, created: { ...created, paymentIds: ['x'] } },
      { previous, created: { ...created, extra: 1 } },
      { previous: { status: 'quote' }, created },
    ])
      expect((await op(d, { op: 'undo_close', id: V1, ...bad })).status, JSON.stringify(bad)).toBe(400);
  });
});

// ─── the payment terms ───────────────────────────────────────────────────────────────────────────

const TODAY = '2026-10-03';
const EVENT = '2027-06-17';
const terms = (
  text: string | null | undefined,
  amount: number | null | undefined = 20000,
  eventDate: string | null | undefined = EVENT,
  locale?: 'he' | 'en',
) => parsePaymentTerms(text, amount, eventDate, TODAY, locale);
const cents = (rows: ProposedPayment[]) => rows.reduce((sum, r) => sum + Math.round(r.amount * 100), 0);
const row = (label: string, amount: number, dueDate: string | null, payOnEventDay: boolean) => ({
  label,
  amount,
  dueDate,
  payOnEventDay,
});

describe('dates', () => {
  it('knows real calendar days, and moves by days and months without leaving the calendar', () => {
    expect(isIsoDate('2027-02-28')).toBe(true);
    for (const bad of ['2027-02-29', '2027-13-01', '27-01-01', '', null, undefined, 20270101, '2027-1-1'])
      expect(isIsoDate(bad)).toBe(false);
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addMonths('2027-06-17', -1)).toBe('2027-05-17');
    expect(addMonths('2027-03-31', -1)).toBe('2027-02-28');
    expect(addMonths('2028-03-31', -1)).toBe('2028-02-29');
    expect(addMonths('2027-01-15', -2)).toBe('2026-11-15');
    expect(addMonths('2027-11-30', 3)).toBe('2028-02-29');
  });
});

describe('the payment terms a vendor writes', () => {
  it('"30% מקדמה, 70% ביום האירוע": the deposit now, the rest on the day', () => {
    expect(terms('30% מקדמה, 70% ביום האירוע')).toEqual([
      row('מקדמה', 6000, TODAY, false),
      row('יתרה', 14000, EVENT, true),
    ]);
  });

  it('"מקדמה 5,000 ₪ והיתרה ביום האירוע": an amount, then the balance', () => {
    expect(terms('מקדמה 5,000 ₪ והיתרה ביום האירוע')).toEqual([
      row('מקדמה', 5000, TODAY, false),
      row('יתרה', 15000, EVENT, true),
    ]);
    expect(terms('מקדמה: 5000 ש"ח, היתרה ביום האירוע')).toEqual([
      row('מקדמה', 5000, TODAY, false),
      row('יתרה', 15000, EVENT, true),
    ]);
    // an amount that leaves something over, with nothing said about the rest: a balance on the day
    expect(terms('מקדמה 5000')).toEqual([row('מקדמה', 5000, TODAY, false), row('יתרה', 15000, EVENT, true)]);
  });

  it('"שליש מקדמה, שליש חודש לפני, שליש ביום האירוע": thirds that add up exactly', () => {
    const r = terms('שליש מקדמה, שליש חודש לפני, שליש ביום האירוע', 10000);
    expect(r).toEqual([
      row('מקדמה', 3333.33, TODAY, false),
      row('תשלום 2', 3333.33, '2027-05-17', false),
      row('יתרה', 3333.34, EVENT, true),
    ]);
    expect(cents(r)).toBe(1_000_000);
    // an even total: three equal parts
    expect(terms('שליש מקדמה, שליש חודש לפני, שליש ביום האירוע', 9000).map((x) => x.amount)).toEqual([
      3000, 3000, 3000,
    ]);
  });

  it('"50/50" and the other splits that add up to 100', () => {
    expect(terms('50/50')).toEqual([row('מקדמה', 10000, TODAY, false), row('יתרה', 10000, EVENT, true)]);
    const three = terms('30/30/40', 10000);
    expect(three.map((x) => [x.label, x.amount, x.payOnEventDay])).toEqual([
      ['מקדמה', 3000, false],
      ['תשלום 2', 3000, false],
      ['יתרה', 4000, true],
    ]);
    // the one in the middle falls between today and the event
    expect(three[1]!.dueDate! > TODAY && three[1]!.dueDate! < EVENT).toBe(true);
    // not 100: it is not a split
    expect(terms('40/40')).toEqual([row('יתרה', 20000, EVENT, true)]);
  });

  it('"deposit 20%, balance on the day" in English', () => {
    expect(terms('deposit 20%, balance on the day')).toEqual([
      row('Deposit', 4000, TODAY, false),
      row('Balance', 16000, EVENT, true),
    ]);
    expect(terms('30% deposit on signing, 40% one month before, 30% on the day')).toEqual([
      row('Deposit', 6000, TODAY, false),
      row('Payment 2', 8000, '2027-05-17', false),
      row('Balance', 6000, EVENT, true),
    ]);
    expect(terms('50% upfront and 50% on the event day', 1001)).toEqual([
      row('Deposit', 500.5, TODAY, false),
      row('Balance', 500.5, EVENT, true),
    ]);
  });

  it('"תשלום מלא בחתימה": all of it, now', () => {
    expect(terms('תשלום מלא בחתימה')).toEqual([row('תשלום מלא', 20000, TODAY, false)]);
    expect(terms('payment in full on signing', 20000, EVENT, 'en')).toEqual([
      row('Full payment', 20000, TODAY, false),
    ]);
    expect(terms('100%')).toEqual([row('תשלום מלא', 20000, EVENT, true)]);
  });

  it('halves, quarters and numbers on a fraction: 1/3 now, 2/3 on the day', () => {
    expect(terms('מחצית בחתימה ומחצית ביום האירוע')).toEqual([
      row('מקדמה', 10000, TODAY, false),
      row('יתרה', 10000, EVENT, true),
    ]);
    expect(terms('1/3 now, 2/3 on the day', 20000, EVENT, 'en').map((x) => x.amount)).toEqual([
      6666.67, 13333.33,
    ]);
    expect(terms('a quarter now, the rest on the day', 20000, EVENT, 'en').map((x) => x.amount)).toEqual([
      5000, 15000,
    ]);
  });

  it('N days, weeks and months before the event; never earlier than today', () => {
    expect(terms('50% בחתימה, 50% 30 יום לפני האירוע').map((x) => x.dueDate)).toEqual([TODAY, '2027-05-18']);
    expect(terms('50% בחתימה, 50% שבועיים לפני האירוע').map((x) => x.dueDate)).toEqual([TODAY, '2027-06-03']);
    expect(terms('50% בחתימה, 50% 3 שבועות לפני').map((x) => x.dueDate)).toEqual([TODAY, '2027-05-27']);
    expect(terms('50% on signing, 50% 2 months before the event').map((x) => x.dueDate)).toEqual([
      TODAY,
      '2027-04-17',
    ]);
    // with the event in ten days, "a month before" is already due
    expect(
      parsePaymentTerms('50% בחתימה, 50% חודש לפני', 1000, '2026-10-13', TODAY).map((x) => x.dueDate),
    ).toEqual([TODAY, TODAY]);
    // days after
    expect(
      terms('50% on the day, 50% 14 days after the event').map((x) => [x.dueDate, x.payOnEventDay]),
    ).toEqual([
      [EVENT, true],
      ['2027-07-01', false],
    ]);
    expect(terms('50% בחתימה, 50% 10 ימים מהחתימה').map((x) => x.dueDate)).toEqual([TODAY, '2026-10-13']);
    // a date
    expect(terms('50% עד 01.03.2027, 50% ביום האירוע').map((x) => x.dueDate)).toEqual(['2027-03-01', EVENT]);
  });

  it('percentages that do not add up to 100 leave the rest as a balance on the day', () => {
    expect(terms('30% מקדמה')).toEqual([row('מקדמה', 6000, TODAY, false), row('יתרה', 14000, EVENT, true)]);
    expect(terms('30% deposit, 30% 2 weeks before')).toEqual([
      row('Deposit', 6000, TODAY, false),
      row('Payment 2', 6000, '2027-06-03', false),
      row('Balance', 8000, EVENT, true),
    ]);
    // 33 + 33 + 33 is thirds, not a balance of one percent
    const thirds = terms('33% מקדמה, 33% חודש לפני, 33% ביום האירוע', 10000);
    expect(thirds).toHaveLength(3);
    expect(cents(thirds)).toBe(1_000_000);
  });

  it('more than the whole is scaled down to it', () => {
    expect(terms('70% מקדמה, 70% ביום האירוע').map((x) => x.amount)).toEqual([10000, 10000]);
    expect(terms('מקדמה 15,000, יתרה 15,000').map((x) => x.amount)).toEqual([10000, 10000]);
    expect(terms('250%')).toHaveLength(1);
  });

  it('terms with no numbers share the total between the parts', () => {
    expect(terms('מקדמה בחתימה, יתרה ביום האירוע').map((x) => x.amount)).toEqual([10000, 10000]);
    expect(terms('ביום האירוע')).toEqual([row('יתרה', 20000, EVENT, true)]);
    expect(terms('בחתימה')).toEqual([row('תשלום', 20000, TODAY, false)]);
    expect(terms('3 תשלומים שווים', 9000).map((x) => [x.amount, x.payOnEventDay])).toEqual([
      [3000, false],
      [3000, false],
      [3000, true],
    ]);
    expect(terms('in 4 equal payments', 10000, EVENT, 'en').map((x) => x.label)).toEqual([
      'Deposit',
      'Payment 2',
      'Payment 3',
      'Balance',
    ]);
  });

  it('nothing understood: one balance on the day. Nothing to split: nothing', () => {
    const one = [row('יתרה', 20000, EVENT, true)];
    for (const text of [
      'לפי הסכם',
      'תנאים לפי שיחה',
      '',
      '   ',
      null,
      undefined,
      'net 30',
      'מקדמה',
      'deposit',
    ])
      expect(terms(text, 20000, EVENT, 'he'), String(text)).toEqual(one);
    expect(terms('anything at all', 20000, EVENT, 'en')).toEqual([row('Balance', 20000, EVENT, true)]);
    for (const amount of [0, -5, null, undefined, Number.NaN, Number.POSITIVE_INFINITY])
      expect(parsePaymentTerms('30% מקדמה', amount as number, EVENT, TODAY)).toEqual([]);
  });

  it('without an event date the dates that hang on it are left open', () => {
    expect(terms('30% מקדמה, 70% ביום האירוע', 20000, null)).toEqual([
      row('מקדמה', 6000, TODAY, false),
      row('יתרה', 14000, null, true),
    ]);
    expect(terms('50% בחתימה, 50% חודש לפני', 20000, null).map((x) => x.dueDate)).toEqual([TODAY, null]);
    expect(terms('בלי כלום', 1000, null)).toEqual([row('יתרה', 1000, null, true)]);
    expect(terms('בלי כלום', 1000, 'not a date')).toEqual([row('יתרה', 1000, null, true)]);
  });

  it('numbers with separators, decimals, and an index that is not an amount', () => {
    expect(terms('מקדמה 12,500 ש"ח, יתרה 30 יום לפני האירוע', 50000)).toEqual([
      row('מקדמה', 12500, TODAY, false),
      row('יתרה', 37500, '2027-05-18', false),
    ]);
    expect(terms('deposit 1,250.50 NIS, balance on the day', 5000, EVENT, 'en').map((x) => x.amount)).toEqual(
      [1250.5, 3749.5],
    );
    expect(terms('deposit 12.5%, balance on the day', 1000, EVENT, 'en').map((x) => x.amount)).toEqual([
      125, 875,
    ]);
    // "payment 2" is a label, "payment 3000" is money
    expect(
      terms('payment 3000 on signing, rest on the day', 10000, EVENT, 'en').map((x) => x.amount),
    ).toEqual([3000, 7000]);
    expect(terms('תשלום 2 בחתימה')).toEqual([row('תשלום', 20000, TODAY, false)]);
  });

  it('the language of the names follows the locale, else the text', () => {
    expect(terms('30% deposit, 70% on the day').map((x) => x.label)).toEqual(['Deposit', 'Balance']);
    expect(terms('30% deposit, 70% on the day', 20000, EVENT, 'he').map((x) => x.label)).toEqual([
      'מקדמה',
      'יתרה',
    ]);
    expect(terms('30% מקדמה, 70% ביום האירוע', 20000, EVENT, 'en').map((x) => x.label)).toEqual([
      'Deposit',
      'Balance',
    ]);
  });

  it('always adds up to the total exactly, in whole agorot, in time order', () => {
    // a small deterministic generator: the same cases every run
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const shapes = [
      (a: number, b: number) => `${a}% מקדמה, ${b}% ביום האירוע`,
      (a: number, b: number) => `${a}% deposit, ${b}% a month before, balance on the day`,
      (a: number) => `מקדמה ${a * 100} ₪ והיתרה ביום האירוע`,
      (a: number, b: number) => `${a}/${100 - a}/${b % 7 || 1}`,
      () => 'שליש מקדמה, שליש חודש לפני, שליש ביום האירוע',
      () => '7 תשלומים שווים',
      (a: number, b: number) => `${a}% now, ${b}% 2 weeks before`,
    ];
    for (let i = 0; i < 400; i++) {
      const total = Math.round((1 + rand() * 500_000) * 100) / 100;
      const a = 1 + Math.floor(rand() * 98);
      const b = 1 + Math.floor(rand() * 98);
      const text = shapes[i % shapes.length]!(a, b);
      const r = terms(text, total, rand() < 0.2 ? null : EVENT);
      expect(cents(r), `${text} / ${total}`).toBe(Math.round(total * 100));
      expect(r.length).toBeGreaterThan(0);
      for (const x of r) {
        expect(x.amount, text).toBeGreaterThan(0);
        expect(Number.isInteger(Math.round(x.amount * 100))).toBe(true);
        expect(Math.abs(x.amount * 100 - Math.round(x.amount * 100)), text).toBeLessThan(1e-6);
        if (x.dueDate) expect(x.dueDate >= TODAY).toBe(true);
      }
      const dated = r.map((x) => x.dueDate).filter((d): d is string => !!d);
      expect([...dated].sort()).toEqual(dated);
    }
  });

  it('weird input never throws', () => {
    const long = '30% מקדמה, '.repeat(500);
    const weird: unknown[] = [
      long,
      '🙂💸 30%%% ,,, ;;; \n\n 70',
      '‫30% מקדמה‬, ‏70% ביום האירוע',
      '%',
      '%%%%',
      '/',
      '///',
      '50/',
      '/50',
      '999999999999999999999999 ₪',
      '1e400%',
      '-30%',
      '0%',
      '0/100',
      '100/0',
      '5 / 5',
      '30.5.2027',
      '31/02/2027',
      '99.99.9999',
      '0000-00-00',
      '(?<x>',
      '[[[',
      '\\',
      "' OR 1=1 --",
      '<script>alert(1)</script>',
      'ל'.repeat(5000),
      '  \t\n ',
      ',',
      ', , ,',
      'ו',
      ' ו ו ו ו',
      'and and and',
      '1000000000000 ₪ 1000000000000 ₪',
      '0 ימים לפני',
      '999999 ימים לפני האירוע',
      '99999 months before',
      '12345678901234567890 weeks after',
      'a a a a a a a a a a a a a a a a a a a a a a a before',
      { toString: () => 'x' },
      123,
      [],
    ];
    for (const text of weird) {
      for (const [amount, event] of [
        [20000, EVENT],
        [0.01, EVENT],
        [1e9, null],
        [20000, '9999-12-31'],
        [20000, '1000-01-01'],
        [20000, 'garbage'],
      ] as const)
        expect(() => parsePaymentTerms(text as string, amount, event, TODAY)).not.toThrow();
    }
    expect(() => parsePaymentTerms('30% מקדמה', 100, EVENT, 'garbage')).not.toThrow();
    expect(() => parsePaymentTerms('30% מקדמה', 100, EVENT, '')).not.toThrow();
    expect(parsePaymentTerms(long, 20000, EVENT, TODAY).length).toBeLessThanOrEqual(20);
    // a lone cent splits into one payment, not into nothing
    expect(parsePaymentTerms('50/50', 0.01, EVENT, TODAY)).toHaveLength(1);
    expect(cents(parsePaymentTerms('שליש, שליש, שליש', 0.02, EVENT, TODAY))).toBe(2);
  });

  it('a past event date still gives dates, never before today for "before"', () => {
    const r = parsePaymentTerms('50% בחתימה, 50% שבוע לפני', 1000, '2026-09-01', TODAY);
    expect(r.map((x) => x.dueDate)).toEqual([TODAY, TODAY]);
  });
});

// ─── the follow-ups ──────────────────────────────────────────────────────────────────────────────

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const dates = (r: ReturnType<typeof buildFollowUps>) => r.map((x) => x.dueDate);

describe('the follow-ups when a vendor is closed', () => {
  it('four tasks — contract, deposit, coordination, final confirmation — spread around today and the event', () => {
    const r = buildFollowUps('catering', EVENT, TODAY);
    expect(r.map((x) => x.key)).toEqual(['contract', 'deposit', 'coordination', 'confirmation']);
    expect(dates(r)).toEqual(['2026-10-06', '2026-10-10', '2027-05-27', '2027-06-10']);
    expect(r.every((x) => x.category === 'catering')).toBe(true);
    expect(r[0]!.title).toBe('לחתום על חוזה');
    expect(r[2]!.title).toBe('לתאם תפריט וכמות סופית');
    expect(r[3]!.title).toBe('אישור סופי לפני האירוע');
  });

  it('titles come in Hebrew and English, with the vendor’s name when there is one', () => {
    const en = buildFollowUps('photographer', EVENT, TODAY, 'en', ' Dana Photo ');
    expect(en.map((x) => x.title)).toEqual([
      'Sign the contract – Dana Photo',
      'Pay the deposit – Dana Photo',
      'Send the shot list and family groups – Dana Photo',
      'Final confirmation before the event – Dana Photo',
    ]);
    const he = buildFollowUps('photographer', EVENT, TODAY, 'he', 'דנה');
    expect(he[1]!.title).toBe('להעביר מקדמה – דנה');
    // a category with no wording of its own gets the general one
    expect(buildFollowUps('other', EVENT, TODAY, 'en')[2]!.title).toBe('Coordinate details and timing');
    expect(buildFollowUps('other', EVENT, TODAY, 'he')[2]!.title).toBe('לתאם פרטים ולוחות זמנים');
    for (const key of CATEGORY_KEYS)
      for (const locale of ['he', 'en'] as const)
        for (const f of buildFollowUps(key, EVENT, TODAY, locale)) {
          expect(f.title.length).toBeGreaterThan(3);
          expect(f.title.length).toBeLessThanOrEqual(200);
        }
  });

  it('never in the past, never after the day before the event, in order — whatever time is left', () => {
    for (let left = 0; left <= 400; left++) {
      const event = addDays(TODAY, left);
      const r = buildFollowUps('venue', event, TODAY);
      const d = dates(r) as string[];
      expect(
        d.every((x) => x >= TODAY),
        `${left}`,
      ).toBe(true);
      expect(
        d.every((x) => x <= (left > 0 ? addDays(event, -1) : TODAY)),
        `${left}`,
      ).toBe(true);
      expect([...d].sort(), `${left}`).toEqual(d);
      expect(r[3]!.dueDate!, `${left}`).toBe(d[3]);
    }
  });

  it('with little time left the four are compressed into it, the confirmation last', () => {
    const ten = buildFollowUps('dj', addDays(TODAY, 10), TODAY);
    expect(dates(ten)).toEqual(['2026-10-04', '2026-10-05', '2026-10-08', '2026-10-12']);
    const week = dates(buildFollowUps('dj', addDays(TODAY, 7), TODAY)) as string[];
    expect(week[3]).toBe(addDays(TODAY, 6));
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  it('the event is tomorrow or today: everything is today (and the confirmation is not in the past)', () => {
    const tomorrow = buildFollowUps('dj', addDays(TODAY, 1), TODAY);
    expect(dates(tomorrow)).toEqual([TODAY, TODAY, TODAY, TODAY]);
    expect(dates(buildFollowUps('dj', TODAY, TODAY))).toEqual([TODAY, TODAY, TODAY, TODAY]);
    // two days: today for the contract and the deposit, tomorrow for the rest
    expect(dates(buildFollowUps('dj', addDays(TODAY, 2), TODAY))).toEqual([
      TODAY,
      TODAY,
      addDays(TODAY, 1),
      addDays(TODAY, 1),
    ]);
  });

  it('an event that is over has nothing to follow up', () => {
    expect(buildFollowUps('dj', addDays(TODAY, -1), TODAY)).toEqual([]);
    expect(buildFollowUps('dj', '2020-01-01', TODAY)).toEqual([]);
  });

  it('without an event date the contract and the deposit follow closing; the other two have no date', () => {
    for (const event of [null, undefined, '', 'soon', '2027-02-30']) {
      const r = buildFollowUps('band', event, TODAY);
      expect(dates(r), String(event)).toEqual(['2026-10-06', '2026-10-10', null, null]);
    }
  });

  it('weird input never throws', () => {
    for (const key of [null, undefined, '', 'nope', 42, {}, 'a'.repeat(1000)])
      expect(() => buildFollowUps(key as string, EVENT, TODAY)).not.toThrow();
    for (const t of ['', 'garbage', '2027-99-99', '0001-01-01', '9999-12-31'])
      expect(() => buildFollowUps('dj', EVENT, t)).not.toThrow();
    for (const e of ['9999-12-31', '0001-01-01', '1000-01-01', 'x'])
      expect(() => buildFollowUps('dj', e, '9999-12-31')).not.toThrow();
    expect(() => buildFollowUps('dj', EVENT, TODAY, 'fr' as 'he')).not.toThrow();
    expect(buildFollowUps('nope', EVENT, TODAY)[0]!.category).toBeNull();
    expect(buildFollowUps('dj', EVENT, TODAY, 'he', 'x'.repeat(500))[0]!.title.length).toBeLessThanOrEqual(
      200,
    );
    // today of the garbage kind falls back to the real today
    const r = buildFollowUps('dj', '9999-12-30', 'garbage');
    expect(r[0]!.dueDate! > '2020-01-01').toBe(true);
  });

  it('spacing between the dates is sensible with plenty of time', () => {
    const r = buildFollowUps('venue', addDays(TODAY, 120), TODAY);
    const d = dates(r) as string[];
    expect(days(TODAY, d[0]!)).toBe(3);
    expect(days(TODAY, d[1]!)).toBe(7);
    expect(days(d[2]!, addDays(TODAY, 120))).toBe(21);
    expect(days(d[3]!, addDays(TODAY, 120))).toBe(7);
  });
});

// ─── the screen's pure helpers ───────────────────────────────────────────────────────────────────

describe('reaching a vendor', () => {
  it('WhatsApp is a plain wa.me link of the number with its country code, only when there is one', () => {
    expect(waLink('+972501234567')).toBe('https://wa.me/972501234567');
    expect(waLink('050-123-4567')).toBe('https://wa.me/972501234567');
    expect(waLink('03-555-1234')).toBe('https://wa.me/97235551234');
    expect(waLink('+1 (415) 555-2671')).toBe('https://wa.me/14155552671');
    for (const bad of [null, undefined, '', 'ask for Dana', '123', '+', '1']) expect(waLink(bad)).toBeNull();
    expect(phoneDigits('+972501234567')).toBe('972501234567');
  });

  it('a call link for anything dialable, not for words', () => {
    expect(telLink('050-123-4567')).toBe('tel:+972501234567');
    expect(telLink('+972501234567')).toBe('tel:+972501234567');
    expect(telLink('*2800')).toBe('tel:2800');
    for (const bad of [null, '', 'later', '12']) expect(telLink(bad)).toBeNull();
    expect(mailLink('a@b.co')).toBe('mailto:a@b.co');
    expect(mailLink('nope')).toBeNull();
  });

  it('a website is made an address when typed bare, and only http(s) is ever a link', () => {
    expect(normalizeUrl('example.com')).toEqual({ url: 'https://example.com', ok: true });
    expect(normalizeUrl(' https://example.com/dana/ ')).toEqual({
      url: 'https://example.com/dana',
      ok: true,
    });
    expect(normalizeUrl('http://example.com/a?b=1')).toEqual({ url: 'http://example.com/a?b=1', ok: true });
    expect(normalizeUrl('')).toEqual({ url: null, ok: true });
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://example.com',
      'not a url',
      'localhost',
      'mailto:a@b.c',
    ])
      expect(normalizeUrl(bad).ok, bad).toBe(false);
  });

  it('an amount as people write it', () => {
    expect(parseAmount('12000')).toBe(12000);
    expect(parseAmount('₪ 12,000')).toBe(12000);
    expect(parseAmount('12,000.50')).toBe(12000.5);
    expect(parseAmount('1,250,000')).toBe(1250000);
    expect(parseAmount('99,5')).toBe(99.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    for (const bad of ['abc', '12k', '-5', '1e5', '12.345', '1,2,3', '99999999999'])
      expect(parseAmount(bad), bad).toBeUndefined();
  });

  it('a new id is a real uuid, a new one each time', () => {
    const a = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(a);
  });
});

describe('what is missing, and comparing', () => {
  const list = [
    vendor({ id: 'a', category: 'venue', status: 'booked' }),
    vendor({ id: 'b', category: 'catering', status: 'quote', name: 'קייטרינג א' }),
    vendor({ id: 'c', category: 'catering', status: 'idea', name: 'קייטרינג ב' }),
    vendor({ id: 'd', category: 'catering', status: 'rejected' }),
    vendor({ id: 'e', category: 'dj', status: 'contacted', name: 'דיג׳יי' }),
    vendor({ id: 'f', category: 'photographer', status: 'booked' }),
    vendor({ id: 'g', category: 'photographer', status: 'idea' }),
    vendor({ id: 'h', category: null, status: 'idea' }),
  ];

  it('the required categories with nobody booked, and any other with vendors in progress', () => {
    const rows = missingCategories(list, ['venue', 'catering', 'flowers']);
    expect(rows.map((r) => [r.category, r.required, r.inProgress.map((v) => v.id)])).toEqual([
      ['catering', true, ['b', 'c']],
      ['flowers', true, []],
      ['dj', false, ['e']],
    ]);
    // booked ones are done even with others still being looked at; a vendor with no category is nobody's
    expect(missingCategories([], [])).toEqual([]);
    expect(missingCategories([], ['dj', 'dj']).map((r) => r.category)).toEqual(['dj']);
  });

  it('the lowest quote stands out only when two or more quoted and they differ', () => {
    const q = (id: string, amount: number | null) => vendor({ id, quoteAmount: amount });
    expect([...cheapestIds([q('a', 8000), q('b', 7000), q('c', null)])]).toEqual(['b']);
    expect([...cheapestIds([q('a', 7000), q('b', 7000)])]).toEqual([]);
    expect([...cheapestIds([q('a', 7000), q('b', null)])]).toEqual([]);
    expect([...cheapestIds([q('a', 5000), q('b', 5000), q('c', 9000)])].sort()).toEqual(['a', 'b']);
    expect([...cheapestIds([])]).toEqual([]);
  });

  it('the selection for comparing keeps to one category', () => {
    expect(toggleCompare([], list, 'b')).toEqual(['b']);
    expect(toggleCompare(['b'], list, 'c')).toEqual(['b', 'c']);
    expect(toggleCompare(['b', 'c'], list, 'e')).toEqual(['e']);
    expect(toggleCompare(['b', 'c'], list, 'b')).toEqual(['c']);
    // vendors with no category compare with each other
    expect(toggleCompare(['h'], [...list, vendor({ id: 'i', category: null })], 'i')).toEqual(['h', 'i']);
  });

  it('counts the statuses, places a new vendor last, and says what a closed one cost', () => {
    expect(countByStatus(list)).toEqual({ idea: 3, contacted: 1, quote: 1, booked: 2, rejected: 1 });
    expect(countByStatus([])).toEqual({ idea: 0, contacted: 0, quote: 0, booked: 0, rejected: 0 });
    expect(nextSort([])).toBe(10);
    expect(nextSort([vendor({ sort: 40 }), vendor({ sort: 10 })])).toBe(50);
    const item = (vendorId: string | null, over: Record<string, number | null>) => ({
      id: 'i',
      categoryId: 'c',
      vendorId,
      title: 'x',
      estimate: null,
      quoted: null,
      final: null,
      status: 'booked' as const,
      vatIncluded: null,
      attachments: [],
      notes: null,
      sort: 1,
      ...over,
    });
    const v = vendor({ id: 'a', quoteAmount: 5000 });
    expect(vendorCost(v, [])).toBe(5000);
    expect(
      vendorCost(v, [
        item('a', { final: 6000, quoted: 5500 }),
        item('a', { quoted: 100 }),
        item('z', { final: 1 }),
      ]),
    ).toBe(6100);
    expect(vendorCost(vendor({ id: 'a', quoteAmount: null }), [])).toBeNull();
  });
});
