import readXlsxFile from 'read-excel-file/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type FeatureInput } from '@/features/flags/features';
import type { RawPlanState } from '@/features/planning/model/plan';
import type { PlanningDeps } from '@/features/planning/server/types';
import { dictFor, type UiLocale } from '@/lib/i18n/app';

// GET /api/invitations/:id/planning/budget/export: the budget as an Excel file, for the owner of an event whose
// plan has the export (Pro), in the language of the screen.

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const CAT = '44444444-4444-4444-8444-444444444441';

const state = {
  user: { id: OWNER } as { id: string } | null,
  plan: 'pro' as 'free' | 'pro',
  locale: 'he' as UiLocale,
  enabled: true,
  plannedState: null as RawPlanState | null,
};

vi.mock('@/lib/feature', () => ({ invitationsEnabled: () => state.enabled }));
vi.mock('@/lib/supabase/session', () => ({ getSessionUser: async () => state.user }));
vi.mock('@/lib/i18n/server', () => ({
  getUi: async () => ({ locale: state.locale, t: dictFor(state.locale) }),
}));
vi.mock('@/features/planning/server/deps', () => {
  const deps: PlanningDeps = {
    access: async (id) =>
      id === ID
        ? ({
            ownerId: OWNER,
            plan: state.plan,
            admin: false,
            overrides: NO_OVERRIDES,
            available: new Set(FEATURES),
          } satisfies FeatureInput & { ownerId: string })
        : null,
    rpc: (async (fn: string) => (fn === 'planning_state' ? state.plannedState : null)) as PlanningDeps['rpc'],
    summary: async () => null,
    now: () => 0,
    newId: () => 'x',
  };
  return { planningDeps: deps };
});

const { GET } = await import('@/app/api/invitations/[id]/planning/budget/export/route');

const plan = (): RawPlanState =>
  ({
    invitation: {
      id: ID,
      slug: 'noa-and-itay',
      status: 'published',
      eventType: 'wedding',
      date: '2027-06-17',
      timezone: null,
      rsvpDeadline: null,
    },
    settings: { vatMode: 'included', vatPct: 18, totalBudget: 100000 },
    tasks: [],
    categories: [
      {
        id: CAT,
        key: 'catering',
        name: null,
        plannedAmount: 0,
        costBasis: 'per_adult',
        unitPrice: 300,
        childPrice: 150,
        required: true,
        sort: 10,
      },
    ],
    items: [
      {
        id: 'i1',
        categoryId: CAT,
        vendorId: 'v1',
        title: 'שף יוסי',
        estimate: 30000,
        quoted: 31000,
        final: null,
        status: 'booked',
        vatIncluded: null,
        attachments: [],
        notes: null,
        sort: 10,
      },
    ],
    payments: [
      {
        id: 'p1',
        itemId: 'i1',
        label: 'מקדמה',
        amount: 10000.5,
        dueDate: '2027-01-01',
        paidAt: null,
        payOnEventDay: false,
        payer: 'אבא',
      },
    ],
    vendors: [{ id: 'v1', name: 'שף יוסי בע״מ' }],
    ideas: [],
    headcount: {
      basis: 'manual',
      adults: 100,
      children: 10,
      guests: 110,
      tables: 12,
      invited: 80,
      confirmedAdults: 0,
      confirmedChildren: 0,
    },
    totals: {
      totalBudget: 100000,
      planned: 31500,
      expected: 31000,
      committed: 31000,
      paid: 0,
      unpaid: 10000.5,
      remaining: 69000,
      perGuest: 281.82,
      byCategory: [{ id: CAT, planned: 31500, expected: 31000, committed: 31000, paid: 0 }],
    },
    headcountChange: null,
    facts: { tables: 0, confirmedUnseated: 0, stationReady: false },
  }) as unknown as RawPlanState;

const get = (id = ID) =>
  GET(new Request(`http://x/api/invitations/${id}/planning/budget/export`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  state.user = { id: OWNER };
  state.plan = 'pro';
  state.locale = 'he';
  state.enabled = true;
  state.plannedState = plan();
});

describe('the budget as an Excel file', () => {
  it('is a workbook with the numbers, the categories, the items and the payments, in Hebrew', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-disposition')).toContain(
      'attachment; filename="budget-noa-and-itay.xlsx"',
    );
    expect(decodeURIComponent(res.headers.get('content-disposition')!)).toContain(
      "filename*=UTF-8''תקציב-noa-and-itay.xlsx",
    );
    const sheets = await readXlsxFile(Buffer.from(await res.arrayBuffer()));
    expect(sheets.map((s) => s.sheet)).toEqual(['סיכום', 'קטגוריות', 'סעיפים', 'תשלומים']);
    // money is a number the host can add up
    expect(sheets[0]!.data.find((r) => r[0] === 'תקציב כולל')![1]).toBe(100000);
    expect(sheets[1]!.data[1]).toEqual(['קייטרינג', 'לכל מבוגר', 300, 150, 31500, 31000, 31000, 0]);
    expect(sheets[2]!.data[1]).toEqual([
      'קייטרינג',
      'שף יוסי',
      'שף יוסי בע״מ',
      'סגור',
      30000,
      31000,
      null,
      31000,
      null,
    ]);
    expect(sheets[3]!.data[0]).toEqual([
      'תאריך',
      'סעיף',
      'קטגוריה',
      'תשלום',
      'סכום (כולל מע״מ)',
      'שולם בתאריך',
      'מי משלם',
      'ביום האירוע',
    ]);
    expect(sheets[3]!.data[1]).toEqual([
      '2027-01-01',
      'שף יוסי',
      'קייטרינג',
      'מקדמה',
      10000.5,
      'עוד לא',
      'אבא',
      null,
    ]);
  });

  it('in the language of the screen', async () => {
    state.locale = 'en';
    const res = await get();
    expect(decodeURIComponent(res.headers.get('content-disposition')!)).toContain(
      "filename*=UTF-8''budget-noa-and-itay.xlsx",
    );
    const sheets = await readXlsxFile(Buffer.from(await res.arrayBuffer()));
    expect(sheets.map((s) => s.sheet)).toEqual(['Summary', 'Categories', 'Items', 'Payments']);
    expect(sheets[1]!.data[1]![0]).toBe('Catering');
  });

  it('is for a signed-in owner, with the export in the package, once the plan exists', async () => {
    state.plan = 'free';
    expect((await get()).status).toBe(403);
    state.plan = 'pro';
    state.user = null;
    expect((await get()).status).toBe(401);
    state.user = { id: 'someone-else' };
    expect((await get()).status).toBe(404);
    state.user = { id: OWNER };
    expect((await get('33333333-3333-4333-8333-333333333333')).status).toBe(404);
    state.plannedState = { ...plan(), settings: null };
    expect((await get()).status).toBe(404);
    state.plannedState = null;
    expect((await get()).status).toBe(404);
    state.enabled = false;
    expect((await get()).status).toBe(404);
  });
});
