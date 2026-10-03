// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/app';
import { NO_OVERRIDES, FEATURES, type FeatureInput } from '@/features/flags/features';
import type { PlanView, RawPlanState } from '@/features/planning/model/plan';
import { composeView } from '@/features/planning/server/view';
import { BudgetScreen } from '@/features/planning/ui/BudgetScreen';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { TodayPayments } from '@/features/planning/ui/TodayPayments';
import { UiProvider } from '@/lib/i18n/provider';

// The budget screen as the host uses it (jsdom, the server's answers faked): the setup card, the numbers, a
// category opening into its items, adding and closing an expense, marking a payment paid, deleting with Undo,
// the guest numbers and the locked Excel card.

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ID = '11111111-1111-4111-8111-111111111111';
const CAT = '44444444-4444-4444-8444-444444444441';
const CAT2 = '44444444-4444-4444-8444-444444444442';
const I1 = '55555555-5555-4555-8555-555555555551';
const I2 = '55555555-5555-4555-8555-555555555552';
const P1 = '66666666-6666-4666-8666-666666666661';
const P2 = '66666666-6666-4666-8666-666666666662';
const NOW = Date.parse('2026-10-03T09:00:00Z');

const settings = {
  templateKey: 'wedding',
  variant: 'default' as const,
  totalBudget: 100000 as number | null,
  vatMode: 'included' as const,
  vatPct: 18,
  guestBasis: 'invited' as const,
  manualAdults: 100,
  manualChildren: 10,
  manualTables: 12,
  integrations: { mode: 'recommended' as const, guests: false, seating: false },
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
    rsvpDeadline: null,
  },
  settings,
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
    {
      id: CAT2,
      key: null,
      name: 'מתנות',
      plannedAmount: 2000,
      costBasis: 'fixed',
      unitPrice: null,
      childPrice: null,
      required: false,
      sort: 20,
    },
  ],
  items: [
    {
      id: I1,
      categoryId: CAT,
      vendorId: null,
      title: 'קייטרינג של שף יוסי',
      estimate: 30000,
      quoted: 31000,
      final: null,
      status: 'quoted',
      vatIncluded: null,
      attachments: [],
      notes: null,
      sort: 10,
    },
    {
      id: I2,
      categoryId: CAT2,
      vendorId: null,
      title: 'שוקולדים',
      estimate: 1500,
      quoted: null,
      final: 1500,
      status: 'booked',
      vatIncluded: null,
      attachments: [],
      notes: null,
      sort: 10,
    },
  ],
  payments: [
    {
      id: P1,
      itemId: I2,
      label: 'מקדמה',
      amount: 500,
      dueDate: '2026-09-01',
      paidAt: null,
      payOnEventDay: false,
      payer: null,
    },
    {
      id: P2,
      itemId: I2,
      label: 'יתרה',
      amount: 1000,
      dueDate: '2027-06-17',
      paidAt: null,
      payOnEventDay: true,
      payer: null,
    },
  ],
  vendors: [],
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
    planned: 33500,
    expected: 32500,
    committed: 1500,
    paid: 0,
    unpaid: 1500,
    remaining: 98500,
    perGuest: 13.64,
    byCategory: [
      { id: CAT, planned: 31500, expected: 31000, committed: 0, paid: 0 },
      { id: CAT2, planned: 2000, expected: 1500, committed: 1500, paid: 0 },
    ],
  },
  headcountChange: null,
  facts: { tables: 0, confirmedUnseated: 0, stationReady: false },
  ...over,
});

const input = (plan: 'free' | 'pro'): FeatureInput => ({
  plan,
  admin: false,
  overrides: NO_OVERRIDES,
  available: new Set(FEATURES),
});
const summary = {
  eventType: 'wedding',
  status: 'published' as const,
  unpublishedChanges: false,
  guests: 80,
  sent: 0,
  responses: 0,
};
const makeView = (state: RawPlanState, plan: 'free' | 'pro' = 'pro'): PlanView =>
  composeView(state, summary, input(plan), NOW);

type Call = { url: string; method: string; body: Record<string, unknown> | undefined };
let calls: Call[];
let serverView: PlanView;

/** The server, faked: it keeps the plan, applies what it is asked and answers like the real routes do. */
function fakeServer() {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      calls.push({ url, method: init?.method ?? 'GET', body });
      let answer: Record<string, unknown> = { ok: true };
      if (url.endsWith('/planning/budget') && body) {
        const v = serverView;
        if (body.op === 'item_save') {
          const given = body.item as Record<string, unknown>;
          const old = v.items.find((i) => i.id === given.id);
          const item = {
            vendorId: null,
            attachments: [],
            notes: null,
            vatIncluded: null,
            sort: 99,
            ...old,
            ...given,
          } as unknown as PlanView['items'][number];
          const pays = (body.payments as Record<string, unknown>[] | undefined)?.map((p) => ({
            dueDate: null,
            paidAt: null,
            payOnEventDay: false,
            payer: null,
            ...p,
            itemId: item.id,
          })) as PlanView['payments'] | undefined;
          serverView = {
            ...v,
            items: old ? v.items.map((i) => (i.id === item.id ? item : i)) : [...v.items, item],
            payments: pays ? [...v.payments.filter((p) => p.itemId !== item.id), ...pays] : v.payments,
          };
          answer = { ok: true, item, payments: serverView.payments.filter((p) => p.itemId === item.id) };
        } else if (body.op === 'payment_paid') {
          const p = v.payments.find((x) => x.id === body.id)!;
          const paid = { ...p, paidAt: body.paid ? '2026-10-03T09:00:00.000Z' : null };
          serverView = { ...v, payments: v.payments.map((x) => (x.id === p.id ? paid : x)) };
          answer = { ok: true, payment: paid, itemStatus: 'booked' };
        } else if (body.op === 'category_save') {
          const given = body.category as Record<string, unknown>;
          const old = v.categories.find((c) => c.id === given.id);
          const category = {
            key: null,
            name: null,
            plannedAmount: 0,
            costBasis: 'fixed',
            unitPrice: null,
            childPrice: null,
            required: false,
            sort: 99,
            ...old,
            ...given,
          } as unknown as PlanView['categories'][number];
          serverView = {
            ...v,
            categories: old
              ? v.categories.map((c) => (c.id === category.id ? category : c))
              : [...v.categories, category],
          };
          answer = { ok: true, category };
        } else if (body.op === 'category_delete') {
          const ids = body.ids as string[];
          const gone = new Set(v.items.filter((i) => ids.includes(i.categoryId)).map((i) => i.id));
          serverView = {
            ...v,
            categories: v.categories.filter((c) => !ids.includes(c.id)),
            items: v.items.filter((i) => !gone.has(i.id)),
            payments: v.payments.filter((p) => !gone.has(p.itemId)),
          };
          answer = { ok: true, deleted: ids.length };
        } else if (body.op === 'item_delete') {
          const ids = body.ids as string[];
          serverView = {
            ...v,
            items: v.items.filter((i) => !ids.includes(i.id)),
            payments: v.payments.filter((p) => !ids.includes(p.itemId)),
          };
          answer = { ok: true, deleted: ids.length };
        }
      } else if (url.endsWith('/planning') && init?.method === 'POST' && body?.op === 'settings') {
        const patch = body.patch as Record<string, unknown>;
        serverView = {
          ...serverView,
          settings: {
            ...serverView.settings!,
            ...patch,
            integrations: { ...serverView.settings!.integrations, ...(patch.integrations as object) },
          } as PlanView['settings'],
        };
        answer = { ok: true, view: serverView };
      } else if (url.endsWith('/planning')) answer = { ok: true, view: serverView };
      return new Response(JSON.stringify(answer), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}
const budgetCalls = () =>
  calls.filter((c) => c.method === 'POST' && c.url.endsWith('/planning/budget')).map((c) => c.body!);

function mount(view: PlanView, locale: 'he' | 'en' = 'he') {
  serverView = view;
  fakeServer();
  return render(
    <UiProvider locale={locale}>
      <ToastProvider label="alert" viewportLabel="alerts" closeLabel="close">
        <PlanProvider id={ID} initial={view}>
          <BudgetScreen />
        </PlanProvider>
      </ToastProvider>
    </UiProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the first time', () => {
  it('asks for the total budget and the guests on one card, and one button saves them', async () => {
    mount(makeView(raw({ settings: { ...settings, totalBudget: null } })));
    const card = screen.getByTestId('budget-setup');
    expect(
      within(card)
        .getAllByRole('button')
        .filter((b) => b.getAttribute('type') === 'submit'),
    ).toHaveLength(1);
    // the numbers are the host's own here (the budget does not follow the guest list): adults and children
    const inputs = within(card).getAllByRole('textbox');
    expect(inputs).toHaveLength(3);
    // nothing without a total
    fireEvent.click(within(card).getByRole('button', { name: 'לשמור ולהתחיל' }));
    expect(within(card).getByText(/כתבו סכום בשקלים/)).toBeTruthy();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    fireEvent.change(inputs[0]!, { target: { value: '80,000' } });
    fireEvent.change(inputs[1]!, { target: { value: '90' } });
    fireEvent.click(within(card).getByRole('button', { name: 'לשמור ולהתחיל' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      op: 'settings',
      patch: { totalBudget: 80000, manualAdults: 90, manualChildren: 10 },
    });
    // the server's plan comes back with the total: the budget itself appears
    await waitFor(() => expect(screen.getByTestId('budget-summary')).toBeTruthy());
  });

  it('can be put off: the budget shows without a total, and it is remembered', async () => {
    mount(makeView(raw({ settings: { ...settings, totalBudget: null } })));
    fireEvent.click(screen.getByRole('button', { name: 'בינתיים בלי תקציב כולל' }));
    await waitFor(() => expect(screen.getByTestId('budget-summary')).toBeTruthy());
    expect(window.localStorage.getItem(`planning:budget-skip:${ID}`)).toBe('1');
  });
});

describe('the numbers', () => {
  it('shows planned, committed, paid and left, one meter, and the cost per guest', () => {
    mount(makeView(raw()));
    const s = screen.getByTestId('budget-summary');
    for (const label of ['התקציב', 'מתוכנן', 'התחייבנו', 'שולם', 'נשאר', 'עלות לאורח'])
      expect(within(s).getAllByText(label).length).toBeGreaterThan(0);
    expect(s.textContent).toContain('₪33,500');
    expect(s.textContent).toContain('₪98,500');
    // the cost per guest in whole shekels (UX report B1), and the budget as one speedometer
    expect(s.textContent).toContain('₪14');
    expect(s.textContent).not.toContain('₪13.64');
    expect(within(s).getAllByRole('meter')).toHaveLength(1);
    // under budget: no warning at all
    expect(screen.queryByTestId('budget-over')).toBeNull();
  });

  it('changes the budget in place: whole shekels, Enter saves, Esc leaves it as it was', async () => {
    mount(makeView(raw()));
    const s = screen.getByTestId('budget-summary');
    // Esc: nothing is sent
    fireEvent.click(within(s).getByRole('button', { name: 'שינוי התקציב' }));
    const field = within(s).getByRole('textbox', { name: /שינוי התקציב/ });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(within(s).queryByRole('textbox', { name: /שינוי התקציב/ })).toBeNull();
    // not a number: a word, and nothing sent
    fireEvent.click(within(s).getByRole('button', { name: 'שינוי התקציב' }));
    fireEvent.change(within(s).getByRole('textbox', { name: /שינוי התקציב/ }), { target: { value: 'הרבה' } });
    fireEvent.click(within(s).getByRole('button', { name: 'שמירה' }));
    expect(s.textContent).toContain('כתבו סכום בשקלים, למשל 80000');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    // a new amount, rounded to a whole shekel, through the settings route
    fireEvent.change(within(s).getByRole('textbox', { name: /שינוי התקציב/ }), {
      target: { value: '120,000.4' },
    });
    fireEvent.submit(
      within(s)
        .getByRole('textbox', { name: /שינוי התקציב/ })
        .closest('form')!,
    );
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
        op: 'settings',
        patch: { totalBudget: 120000 },
      }),
    );
    await waitFor(() => expect(within(s).queryByRole('textbox', { name: /שינוי התקציב/ })).toBeNull());
  });

  it('warns, quietly, only when what is committed passes the total', () => {
    const state = raw();
    mount(
      makeView({
        ...state,
        totals: { ...state.totals, committed: 120000, remaining: -20000 },
      }),
    );
    const warn = screen.getByTestId('budget-over');
    expect(warn.className).toContain('bg-warning-bg');
    expect(warn.className).not.toMatch(/danger|red/);
    expect(warn.textContent).toContain('₪20,000');
  });

  it('is a summary after the event: what it came to, no warnings', () => {
    const state = raw();
    const view = makeView({
      ...state,
      invitation: { ...state.invitation, date: '2026-09-01' },
      totals: {
        ...state.totals,
        committed: 120000,
        remaining: -20000,
        byCategory: [
          { id: CAT, planned: 100, expected: 0, committed: 5000, paid: 0 },
          ...state.totals.byCategory.slice(1),
        ],
      },
    });
    mount(view);
    expect(screen.getByTestId('budget-past')).toBeTruthy();
    expect(screen.queryByTestId('budget-over')).toBeNull();
    expect(screen.queryByTestId('budget-whatif')).toBeNull();
    expect(screen.queryByTestId('budget-guests')).toBeNull();
    expect(screen.queryByText(/מעל המתוכנן/)).toBeNull();
  });
});

describe('the categories', () => {
  it('open into their items, with the stage and the amount (VAT as the plan sets it)', () => {
    mount(makeView(raw()));
    const cats = screen.getAllByTestId('budget-category');
    expect(cats).toHaveLength(2);
    expect(within(cats[0]!).queryByText('קייטרינג של שף יוסי')).toBeNull();
    fireEvent.click(within(cats[0]!).getByRole('button', { name: /פתיחת קייטרינג/ }));
    expect(within(cats[0]!).getByText('קייטרינג של שף יוסי')).toBeTruthy();
    expect(within(cats[0]!).getByText('הצעה')).toBeTruthy();
    // the quote is what counts while there is no final price
    expect(cats[0]!.textContent).toContain('₪31,000');
    // the variance against the estimate, under the title
    expect(cats[0]!.textContent).toContain('₪1,000 מעל ההערכה');
    // how its cost is set: per adult, with the price, and what the server works out
    expect(cats[0]!.textContent).toContain('לכל מבוגר');
    expect(cats[0]!.textContent).toContain('₪31,500');
  });

  it('edits how a cost is set, with the numbers it follows beside it, and saves just that', async () => {
    mount(makeView(raw()));
    const cat = screen.getAllByTestId('budget-category')[0]!;
    fireEvent.click(within(cat).getByRole('button', { name: /פתיחת קייטרינג/ }));
    fireEvent.click(within(cat).getAllByRole('button', { name: 'שיטת חישוב' }).at(-1)!);
    const form = within(cat).getByRole('form', { name: 'איך העלות נקבעת' });
    // the guest numbers the price follows are on the form
    expect(form.textContent).toContain('100 מבוגרים');
    expect(form.textContent).toContain('10 ילדים');
    // …and the budget says it does not follow the guest list
    expect(form.textContent).toContain('התקציב לא עוקב אחרי רשימת המוזמנים');
    const [unit] = within(form).getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(unit!, { target: { value: '350' } });
    // the preview is the same formula: 350 × 100 + 150 × 10
    await waitFor(() => expect(form.textContent).toContain('₪36,500'));
    fireEvent.click(within(form).getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(budgetCalls()).toHaveLength(1));
    expect(budgetCalls()[0]).toEqual({
      op: 'category_save',
      category: { id: CAT, costBasis: 'per_adult', unitPrice: 350, childPrice: 150 },
    });
    // the server works the totals out: the plan is read again
    await waitFor(() => expect(calls.some((c) => c.method === 'GET')).toBe(true));
  });

  it('adds a standard category not yet used, or one of the host’s own', async () => {
    mount(makeView(raw()));
    fireEvent.click(screen.getAllByRole('button', { name: 'הוספת קטגוריה' }).at(-1)!);
    const dialog = await screen.findByRole('dialog');
    // catering is in the budget already: not offered; the venue is
    expect(within(dialog).queryByRole('button', { name: 'קייטרינג' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'אולם / מקום' }));
    await waitFor(() => expect(budgetCalls()).toHaveLength(1));
    expect(budgetCalls()[0]).toMatchObject({ op: 'category_save', category: { key: 'venue' } });
    expect(typeof (budgetCalls()[0]!.category as { id: string }).id).toBe('string');
    // it is in the list at once
    await waitFor(() => expect(screen.getAllByTestId('budget-category')).toHaveLength(3));
  });

  it('deleting a category takes it off at once and Undo puts it back, with its items', async () => {
    mount(makeView(raw()));
    const cat = screen.getAllByTestId('budget-category')[1]!;
    fireEvent.pointerDown(within(cat).getByRole('button', { name: /פעולות ל/ }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'מחיקת הקטגוריה' }));
    await waitFor(() => expect(screen.getAllByTestId('budget-category')).toHaveLength(1));
    await waitFor(() => expect(budgetCalls()[0]).toEqual({ op: 'category_delete', ids: [CAT2] }));
    const undo = await screen.findByRole('button', { name: 'ביטול' });
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getAllByTestId('budget-category')).toHaveLength(2));
    await waitFor(() =>
      expect(budgetCalls().map((b) => b.op)).toEqual(['category_delete', 'category_save', 'item_save']),
    );
    const restored = budgetCalls()[2]!;
    expect(restored.item).toMatchObject({
      id: I2,
      categoryId: CAT2,
      title: 'שוקולדים',
      final: 1500,
      status: 'booked',
    });
    expect((restored.payments as { id: string }[]).map((p) => p.id)).toEqual([P1, P2]);
  });
});

describe('an expense', () => {
  const add = async () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'הוספת הוצאה' })[0]!);
    return screen.findByRole('dialog');
  };

  it('is added from the one main button: a name, a category, an estimate — saved at once, closed, shown at once', async () => {
    mount(makeView(raw()));
    const drawer = await add();
    fireEvent.change(within(drawer).getByLabelText('מה זה?'), { target: { value: 'צלם' } });
    fireEvent.change(within(drawer).getByLabelText('קטגוריה'), { target: { value: CAT2 } });
    fireEvent.change(within(drawer).getByLabelText('הערכה'), { target: { value: '5,000' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'להוספה' }));
    await waitFor(() => expect(budgetCalls()).toHaveLength(1));
    const body = budgetCalls()[0] as { item: Record<string, unknown>; payments?: unknown };
    expect(body).toMatchObject({
      op: 'item_save',
      item: {
        categoryId: CAT2,
        vendorId: null,
        title: 'צלם',
        estimate: 5000,
        quoted: null,
        final: null,
        status: 'estimate',
        notes: null,
      },
    });
    expect(body.payments).toBeUndefined();
    expect(typeof body.item.id).toBe('string');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // the category now holds two
    const cat = screen.getAllByTestId('budget-category')[1]!;
    expect(cat.textContent).toContain('2 סעיפים');
  });

  it('asks for a name and refuses a number that is not one', async () => {
    mount(makeView(raw()));
    const drawer = await add();
    fireEvent.change(within(drawer).getByLabelText('הערכה'), { target: { value: 'abc' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'להוספה' }));
    expect(within(drawer).getByText('כתבו מה ההוצאה')).toBeTruthy();
    expect(within(drawer).getAllByText('כתבו סכום בשקלים').length).toBeGreaterThan(0);
    expect(budgetCalls()).toHaveLength(0);
  });

  it('keeps a payment schedule: a deposit and the balance (the rest of the amount), one for the day itself', async () => {
    mount(makeView(raw()));
    const drawer = await add();
    fireEvent.change(within(drawer).getByLabelText('מה זה?'), { target: { value: 'תקליטן' } });
    fireEvent.change(within(drawer).getByLabelText('מחיר סופי'), { target: { value: '4000' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'מקדמה' }));
    const rows = () => within(drawer).getAllByTestId('schedule-row');
    fireEvent.change(within(rows()[0]!).getByLabelText('סכום'), { target: { value: '1000' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'יתרה' }));
    // the balance starts at what is left
    expect((within(rows()[1]!).getByLabelText('סכום') as HTMLInputElement).value).toBe('3000');
    fireEvent.click(within(rows()[1]!).getByLabelText('תשלום ביום האירוע'));
    fireEvent.change(within(rows()[0]!).getByLabelText('תאריך'), { target: { value: '2027-01-01' } });
    expect(drawer.textContent).toContain('התשלומים מכסים את כל הסכום');
    fireEvent.click(within(drawer).getByRole('button', { name: 'להוספה' }));
    await waitFor(() => expect(budgetCalls()).toHaveLength(1));
    const body = budgetCalls()[0] as { payments: Record<string, unknown>[] };
    // (the ids are the client's to choose: the rows are on the screen before the server answers)
    expect(body.payments).toEqual([
      {
        id: expect.any(String),
        label: 'מקדמה',
        amount: 1000,
        dueDate: '2027-01-01',
        paidAt: null,
        payOnEventDay: false,
        payer: null,
      },
      {
        id: expect.any(String),
        label: 'יתרה',
        amount: 3000,
        dueDate: null,
        paidAt: null,
        payOnEventDay: true,
        payer: null,
      },
    ]);
  });

  it('files are a Pro tool: without it a gentle card with the way to Pro, and nothing to upload', async () => {
    mount(makeView(raw(), 'free'));
    const drawer = await add();
    const locked = within(drawer).getByTestId('files-locked');
    expect(within(locked).getByRole('link', { name: 'מעבר ל-Pro' }).getAttribute('href')).toBe(
      '/app/billing?plan=pro',
    );
    expect(drawer.querySelector('input[type="file"]')).toBeNull();
  });

  it('files on Pro: an input for PDFs and pictures', async () => {
    mount(makeView(raw(), 'pro'));
    const drawer = await add();
    expect(within(drawer).queryByTestId('files-locked')).toBeNull();
    expect(drawer.querySelector('input[type="file"]')!.getAttribute('accept')).toBe(
      'application/pdf,image/png,image/jpeg,image/webp',
    );
  });

  it('closing a deal from the item’s menu keeps the item and moves it to "closed"', async () => {
    mount(makeView(raw()));
    const cat = screen.getAllByTestId('budget-category')[0]!;
    fireEvent.click(within(cat).getByRole('button', { name: /פתיחת קייטרינג/ }));
    fireEvent.pointerDown(within(cat).getByRole('button', { name: /פעולות ל.*קייטרינג של שף יוסי/ }), {
      button: 0,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'סימון כסגור' }));
    await waitFor(() => expect(budgetCalls()).toHaveLength(1));
    expect(budgetCalls()[0]!.item).toMatchObject({
      id: I1,
      title: 'קייטרינג של שף יוסי',
      status: 'booked',
      quoted: 31000,
    });
    await waitFor(() => expect(within(cat).getByText('סגור')).toBeTruthy());
  });

  it('deleting an expense takes it off at once and Undo puts the same one back, with its payments', async () => {
    mount(makeView(raw()));
    const cat = screen.getAllByTestId('budget-category')[1]!;
    fireEvent.click(within(cat).getByRole('button', { name: /פתיחת מתנות/ }));
    fireEvent.pointerDown(within(cat).getByRole('button', { name: /פעולות ל.*שוקולדים/ }), { button: 0 });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'מחיקה' }));
    await waitFor(() => expect(within(cat).queryByText('שוקולדים')).toBeNull());
    expect(budgetCalls()[0]).toEqual({ op: 'item_delete', ids: [I2] });
    fireEvent.click(await screen.findByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(within(cat).getByText('שוקולדים')).toBeTruthy());
    const back = budgetCalls().find((b) => b.op === 'item_save')!;
    expect(back.item).toMatchObject({ id: I2, categoryId: CAT2, final: 1500, status: 'booked' });
    expect((back.payments as { id: string; label: string }[]).map((p) => [p.id, p.label])).toEqual([
      [P1, 'מקדמה'],
      [P2, 'יתרה'],
    ]);
  });
});

describe('the payment schedule', () => {
  const open = () => {
    fireEvent.click(screen.getByRole('radio', { name: 'לוח תשלומים' }));
    return screen.getByTestId('budget-payments');
  };

  it('lists the payments by date, the overdue ones with a gentle word, and marks one paid at once', async () => {
    mount(makeView(raw()));
    const board = open();
    const rows = within(board).getAllByTestId('payment-row');
    expect(rows).toHaveLength(2);
    // the deposit was due on 2026-09-01: before today (2026-10-03)
    expect(rows[0]!.textContent).toContain('מקדמה');
    expect(within(rows[0]!).getByText('באיחור')).toBeTruthy();
    expect(rows[1]!.textContent).toContain('ביום האירוע');
    expect(within(rows[1]!).queryByText('באיחור')).toBeNull();
    expect(board.textContent).toContain('עוד לתשלום: ₪1,500');

    fireEvent.click(within(rows[0]!).getByRole('checkbox'));
    // marked at once (the open list drops it)…
    await waitFor(() => expect(within(board).getAllByTestId('payment-row')).toHaveLength(1));
    // …and the server is asked
    await waitFor(() => expect(budgetCalls()).toEqual([{ op: 'payment_paid', id: P1, paid: true }]));
    await waitFor(() => expect(calls.some((c) => c.method === 'GET')).toBe(true));
  });

  it('shows no overdue after the event', () => {
    const state = raw();
    mount(makeView({ ...state, invitation: { ...state.invitation, date: '2026-09-15' } }));
    const board = open();
    expect(within(board).queryByText('באיחור')).toBeNull();
  });
});

describe('the guests and the VAT', () => {
  const panel = () => {
    const p = screen.getByTestId('budget-guests');
    fireEvent.click(within(p).getAllByRole('button', { expanded: false })[0]!);
    return p;
  };

  it('says the budget does not follow the guest list, with the switch to turn the link on', async () => {
    mount(makeView(raw()));
    const p = panel();
    expect(within(p).getByText('התקציב לא עוקב אחרי רשימת המוזמנים')).toBeTruthy();
    // the numbers are the host's own: adults and children editable
    expect((within(p).getByLabelText('מבוגרים') as HTMLInputElement).value).toBe('100');
    fireEvent.click(within(p).getByRole('switch', { name: 'לעקוב אחרי רשימת המוזמנים והתשובות' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
        op: 'settings',
        patch: { integrations: { guests: true } },
      }),
    );
  });

  it('writes the manual numbers when the field is left, and only if they changed', async () => {
    mount(makeView(raw()));
    const p = panel();
    const adults = within(p).getByLabelText('מבוגרים');
    fireEvent.change(adults, { target: { value: '120' } });
    fireEvent.blur(adults);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      op: 'settings',
      patch: { manualAdults: 120 },
    });
    const before = calls.length;
    fireEvent.blur(within(p).getByLabelText('ילדים'));
    expect(calls.length).toBe(before);
    fireEvent.change(adults, { target: { value: '12x' } });
    fireEvent.blur(adults);
    expect(within(p).getByText('כתבו מספר שלם')).toBeTruthy();
  });

  it('the basis and the VAT go through the settings route', async () => {
    mount(
      makeView(
        raw({ settings: { ...settings, integrations: { mode: 'full', guests: true, seating: true } } }),
      ),
    );
    const p = panel();
    fireEvent.click(within(p).getByRole('radio', { name: 'מי שאישר הגעה' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
        op: 'settings',
        patch: { guestBasis: 'confirmed' },
      }),
    );
    fireEvent.click(within(p).getByRole('radio', { name: 'לפני מע״מ' }));
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'POST').at(-1)!.body).toEqual({
        op: 'settings',
        patch: { vatMode: 'excluded' },
      }),
    );
    expect(p.textContent).toContain('לפי סידור השולחנות');
  });
});

describe('what if', () => {
  it('moves the guests and the plate with the same formula and saves nothing', async () => {
    mount(makeView(raw()));
    const panel = screen.getByTestId('budget-whatif');
    fireEvent.click(within(panel).getByRole('button', { expanded: false }));
    // 110 guests now; 10 children stay: 150 adults → 150 × 300 + 10 × 150 = 46,500; plus the gifts, 2,000
    fireEvent.change(within(panel).getByLabelText(/כמה אורחים/), { target: { value: '160' } });
    await waitFor(() => expect(panel.textContent).toContain('₪51,500'));
    expect(panel.textContent).toContain('₪33,500');
    // the plate: 400 → 150 × 400 + 10 × 150 + 2,000 = 63,500
    fireEvent.change(within(panel).getByLabelText(/מחיר מנה/), { target: { value: '400' } });
    await waitFor(() => expect(panel.textContent).toContain('₪63,500'));
    // reset
    fireEvent.click(within(panel).getByRole('button', { name: 'איפוס' }));
    await waitFor(() => expect(within(panel).queryByText('₪63,500')).toBeNull());
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
});

describe('the chart and the Excel file', () => {
  it('small gauges by category with the same numbers as a table', () => {
    mount(makeView(raw()));
    const chart = screen.getByTestId('budget-cat-gauges');
    expect(within(chart).getAllByRole('meter').length).toBeGreaterThan(0);
    const toggle = within(chart).getByRole('button', { name: 'הצגה כטבלה' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    const table = within(chart).getByRole('table', { name: 'התקציב לפי קטגוריה' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(table.textContent).toContain('₪31,500');
    expect(within(chart).getByRole('button', { name: 'הצגה כתרשים' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('Pro: a download button; otherwise a soft locked card with the way to Pro', () => {
    mount(makeView(raw(), 'pro'));
    const link = screen.getByTestId('budget-export') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`/api/invitations/${ID}/planning/budget/export`);
    expect(link.hasAttribute('download')).toBe(true);
    expect(screen.queryByTestId('budget-export-locked')).toBeNull();
    cleanup();
    mount(makeView(raw(), 'free'));
    expect(screen.queryByTestId('budget-export')).toBeNull();
    const locked = screen.getByTestId('budget-export-locked');
    expect(within(locked).getByRole('link', { name: 'מעבר ל-Pro' }).getAttribute('href')).toBe(
      '/app/billing?plan=pro',
    );
  });
});

describe('in English', () => {
  it('reads the same screen in English', () => {
    mount(makeView(raw()), 'en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Budget');
    expect(screen.getByTestId('budget-summary').textContent).toContain('Committed');
    expect(screen.getAllByRole('button', { name: 'Add an expense' }).length).toBeGreaterThan(0);
  });
});

describe('the payments of the event day', () => {
  const rows = [
    { id: P1, label: 'יתרה במזומן', amount: 3000, paidAt: null, itemTitle: 'תקליטן', vendorName: 'DJ רועי' },
    {
      id: P2,
      label: 'במקום',
      amount: 800,
      paidAt: '2027-06-17T20:00:00Z',
      itemTitle: 'עוגה',
      vendorName: null,
    },
  ];
  const mountToday = (initial = rows) => {
    fakeServer();
    serverView = makeView(raw());
    return render(
      <UiProvider locale="he">
        <ToastProvider label="alert" viewportLabel="alerts" closeLabel="close">
          <TodayPayments id={ID} initial={initial} />
        </ToastProvider>
      </UiProvider>,
    );
  };

  it('lists them, open first, with what is left to pay, and marks one paid at once', async () => {
    mountToday();
    const card = screen.getByTestId('today-payments');
    expect(within(card).getAllByRole('checkbox')).toHaveLength(2);
    expect(card.textContent).toContain('תקליטן · DJ רועי');
    expect(card.textContent).toContain('עוד לתשלום: ₪3,000');
    fireEvent.click(within(card).getAllByRole('checkbox')[0]!);
    await waitFor(() => expect(card.textContent).toContain('הכול שולם'));
    await waitFor(() => expect(budgetCalls()).toEqual([{ op: 'payment_paid', id: P1, paid: true }]));
  });

  it('puts the mark back, with a note, when the server refuses', async () => {
    mountToday();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'not_found' }), { status: 404 })),
    );
    const card = screen.getByTestId('today-payments');
    await act(async () => {
      fireEvent.click(within(card).getAllByRole('checkbox')[0]!);
    });
    await waitFor(() =>
      expect(within(card).getAllByRole('checkbox')[0]!.getAttribute('aria-checked')).toBe('false'),
    );
    expect(await screen.findByText('לא הצלחנו לסמן. אפשר לנסות שוב.')).toBeTruthy();
  });

  it('shows nothing when there is nothing to pay on the day', () => {
    mountToday([]);
    expect(screen.queryByTestId('today-payments')).toBeNull();
  });
});
