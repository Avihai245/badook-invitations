// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/app';
import { NO_OVERRIDES, FEATURES, type FeatureInput } from '@/features/flags/features';
import type { PlanVendor, PlanView, RawPlanState } from '@/features/planning/model/plan';
import { composeView } from '@/features/planning/server/view';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { VendorsScreen } from '@/features/planning/ui/VendorsScreen';
import { UiProvider } from '@/lib/i18n/provider';
import { planningVendorsEn } from '@/lib/i18n/planning-vendors.en';
import { planningVendorsHe } from '@/lib/i18n/planning-vendors.he';

// The vendors screen as the host uses it (jsdom, the server's answers faked): the counters that filter, what is
// missing with its quick add, moving by the menu, closing with the budget/payments/tasks and Undo, deleting with
// Undo, comparing quotes, the details with their links and files, the contact picker, and the summary after the
// event. (Dragging with a pointer is dnd-kit's own; what the screen adds is the menu, the grip and its words.)

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const T = planningVendorsHe;
const ID = '11111111-1111-4111-8111-111111111111';
const V1 = '44444444-4444-4444-8444-444444444441';
const V2 = '44444444-4444-4444-8444-444444444442';
const V3 = '44444444-4444-4444-8444-444444444443';
const V4 = '44444444-4444-4444-8444-444444444444';
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
  integrations: { mode: 'recommended' as const } as Record<string, unknown>,
  reminders: {},
  requiredVendors: ['venue', 'catering'] as string[],
  onboardingDone: true,
  anchorDate: '2027-06-17',
  headcountSeen: null,
};

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
  settings: settings as unknown as RawPlanState['settings'],
  tasks: [],
  categories: [],
  items: [],
  payments: [],
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
    planned: 0,
    expected: 0,
    committed: 0,
    paid: 0,
    unpaid: 0,
    remaining: 100000,
    perGuest: null,
    byCategory: [],
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
/** what the next close answers with */
let closeAnswer: Record<string, unknown> | null;

const vendorCalls = () =>
  calls.filter((c) => c.method === 'POST' && c.url.endsWith('/planning/vendors')).map((c) => c.body!);

/** The server, faked: it keeps the vendors, applies what it is asked and answers like the real route does. */
function fakeServer() {
  calls = [];
  closeAnswer = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body =
        init?.body && typeof init.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined;
      calls.push({ url, method: init?.method ?? 'GET', body });
      let answer: Record<string, unknown> = { ok: true };
      if (url.endsWith('/planning/vendors') && body) {
        const v = serverView;
        if (body.op === 'save') {
          const given = body.vendor as Partial<PlanVendor> & { id: string };
          const old = v.vendors.find((x) => x.id === given.id);
          const saved = {
            ...vendor({ id: given.id, name: '', sort: 10 * (v.vendors.length + 1) }),
            ...old,
            ...given,
          } as PlanVendor;
          serverView = {
            ...v,
            vendors: old ? v.vendors.map((x) => (x.id === saved.id ? saved : x)) : [...v.vendors, saved],
          };
          answer = { ok: true, vendor: saved };
        } else if (body.op === 'delete') {
          const ids = body.ids as string[];
          serverView = { ...v, vendors: v.vendors.filter((x) => !ids.includes(x.id)) };
          answer = { ok: true, deleted: ids.length };
        } else if (body.op === 'close') {
          const old = v.vendors.find((x) => x.id === body.id)!;
          const plan = (body.plan ?? {}) as { item?: { amount?: number } };
          const saved = {
            ...old,
            status: 'booked',
            quoteAmount: plan.item?.amount ?? old.quoteAmount,
          } as PlanVendor;
          serverView = { ...v, vendors: v.vendors.map((x) => (x.id === saved.id ? saved : x)) };
          answer = closeAnswer ?? {
            ok: true,
            vendor: saved,
            previous: { status: old.status, quoteAmount: old.quoteAmount },
            created: { itemId: null, paymentIds: [], taskIds: [] },
          };
        } else if (body.op === 'undo_close') {
          const prev = body.previous as { status: PlanVendor['status']; quoteAmount: number | null };
          serverView = {
            ...v,
            vendors: v.vendors.map((x) => (x.id === body.id ? { ...x, ...prev } : x)),
          };
        }
      } else if (url.endsWith('/planning/files') && body) {
        if (body.op === 'upload')
          answer = {
            ok: true,
            path: `owner/${ID}/file-1.pdf`,
            url: 'https://storage.example/upload?token=t',
            token: 't',
          };
        else if (body.op === 'read')
          answer = {
            ok: true,
            urls: Object.fromEntries((body.paths as string[]).map((p) => [p, `https://signed.example/${p}`])),
          };
      } else if (url.endsWith('/planning')) answer = { ok: true, view: serverView };
      else if (url.startsWith('https://storage.example')) return new Response('', { status: 200 });
      return new Response(JSON.stringify(answer), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function mount(view: PlanView, locale: 'he' | 'en' = 'he') {
  serverView = view;
  fakeServer();
  return render(
    <UiProvider locale={locale}>
      <ToastProvider label="alert" viewportLabel="alerts" closeLabel="close">
        <PlanProvider id={ID} initial={view}>
          <VendorsScreen />
        </PlanProvider>
      </ToastProvider>
    </UiProvider>,
  );
}

const openMenu = (button: HTMLElement) => fireEvent.pointerDown(button, { button: 0 });
/** the phone's list (the desktop's columns hold the same cards: CSS shows one of them) */
const list = () => within(screen.getByTestId('vendors-groups'));
const columns = () => within(screen.getByTestId('vendors-columns'));

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
  Reflect.deleteProperty(navigator, 'contacts');
});

const pipeline = () =>
  raw({
    vendors: [
      vendor({ id: V1, name: 'אולם הגן', category: 'venue', status: 'booked', sort: 10 }),
      vendor({ id: V2, name: 'דנה צילום', category: 'photographer', status: 'idea', sort: 20 }),
      vendor({
        id: V3,
        name: 'סטודיו נועה',
        category: 'photographer',
        status: 'quote',
        quoteAmount: 7000,
        sort: 30,
      }),
      vendor({ id: V4, name: 'DJ מקס', category: 'dj', status: 'rejected', sort: 40 }),
    ],
  });

describe('the pipeline and its counters', () => {
  it('counts each status, shows every vendor, and a counter filters to its status', () => {
    mount(makeView(pipeline()));
    const chips = screen.getByRole('group', { name: T.filters.label });
    expect(within(chips).getByRole('button', { name: 'הכול: 4' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(chips).getByRole('button', { name: 'סגרנו: 1' })).toBeTruthy();
    expect(within(chips).getByRole('button', { name: 'לא רלוונטי: 1' })).toBeTruthy();
    expect(within(chips).getByRole('button', { name: 'יצרנו קשר: 0' })).toBeTruthy();
    // desktop: a column per status; phone: a group per status that has vendors
    expect(columns().getAllByRole('region')).toHaveLength(5);
    expect(list().getAllByRole('region')).toHaveLength(4);
    expect(list().getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);

    fireEvent.click(within(chips).getByRole('button', { name: 'הצעת מחיר: 1' }));
    expect(within(chips).getByRole('button', { name: 'הצעת מחיר: 1' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(columns().getAllByRole('region')).toHaveLength(1);
    expect(list().queryByText('אולם הגן')).toBeNull();
    expect(list().getByText('סטודיו נועה')).toBeTruthy();
    // a status with none says so, and gives a way back
    fireEvent.click(within(chips).getByRole('button', { name: 'יצרנו קשר: 0' }));
    expect(screen.getByText(T.empty.filtered)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: T.empty.showAll }));
    expect(list().getByText('אולם הגן')).toBeTruthy();
  });

  it('with no vendors there is one clear next step; the header has the one primary action', () => {
    mount(makeView(raw()));
    expect(screen.getByText(T.empty.title)).toBeTruthy();
    // the header's add is the page's only primary button (the empty state's is secondary)
    const primaries = screen
      .getAllByRole('button', { name: T.add })
      .filter((b) => b.getAttribute('data-variant') === 'primary');
    expect(primaries).toHaveLength(1);
    expect(screen.queryByRole('group', { name: T.filters.label })).toBeNull();
  });

  it('the cards have a grip with its words, and the keyboard instructions are there for a screen reader', () => {
    mount(makeView(pipeline()));
    const grips = columns().getAllByRole('button', { name: 'גרירה של דנה צילום למצב אחר' });
    expect(grips).toHaveLength(1);
    expect(screen.getByText(T.dnd.instructions)).toBeTruthy();
    expect(grips[0]!.getAttribute('aria-describedby')).toBeTruthy();
  });
});

describe('what is missing', () => {
  it('lists the required categories with no booked vendor, and those with vendors in progress', () => {
    mount(makeView(pipeline()));
    const card = screen.getByRole('region', { name: T.missing.title });
    // venue is booked; catering has nobody; photographers are in progress (not required, but still open)
    expect(within(card).queryByText('אולם / מקום')).toBeNull();
    expect(within(card).getByText('קייטרינג')).toBeTruthy();
    expect(within(card).getByText(T.missing.noVendor)).toBeTruthy();
    expect(within(card).getByText('צלם / צלמת')).toBeTruthy();
    expect(within(card).getByText(/2 ספקים בתהליך: דנה צילום, סטודיו נועה/)).toBeTruthy();
    // a dropped vendor's category is not "in progress"
    expect(within(card).queryByText('תקליטן / DJ')).toBeNull();
  });

  it('says so when every required category is closed, and is gone after the event', () => {
    const state = raw({
      vendors: [
        vendor({ id: V1, category: 'venue', status: 'booked' }),
        vendor({ id: V2, name: 'קייטרינג הים', category: 'catering', status: 'booked' }),
      ],
    });
    const { unmount } = mount(makeView(state));
    expect(
      within(screen.getByRole('region', { name: T.missing.title })).getByText(T.missing.allClosed),
    ).toBeTruthy();
    unmount();
    mount(makeView({ ...state, invitation: { ...state.invitation, date: '2026-09-01' } }));
    expect(screen.queryByRole('region', { name: T.missing.title })).toBeNull();
  });

  it('its add opens the form with the category chosen; adding is shown at once and saved with a new id', async () => {
    mount(makeView(raw({ vendors: [vendor({ id: V1, category: 'venue', status: 'booked' })] })));
    const card = screen.getByRole('region', { name: T.missing.title });
    fireEvent.click(within(card).getByRole('button', { name: 'הוספת ספק בקטגוריה קייטרינג' }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText(T.quick.category) as HTMLSelectElement).value).toBe('catering');
    // a name is needed
    fireEvent.click(within(dialog).getByRole('button', { name: T.quick.submit }));
    expect(within(dialog).getByText(T.quick.nameRequired)).toBeTruthy();
    expect(vendorCalls()).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText(new RegExp(T.quick.name)), {
      target: { value: 'קייטרינג הים' },
    });
    fireEvent.change(within(dialog).getByLabelText(T.quick.phone), { target: { value: '050-123-4567' } });
    fireEvent.click(within(dialog).getByRole('button', { name: T.quick.submit }));
    // at once, in the list
    expect(await list().findByText('קייטרינג הים')).toBeTruthy();
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    const sent = vendorCalls()[0] as { op: string; vendor: Record<string, unknown> };
    expect(sent.op).toBe('save');
    expect(sent.vendor).toMatchObject({ name: 'קייטרינג הים', category: 'catering', phone: '050-123-4567' });
    expect(sent.vendor.id).toMatch(/^[0-9a-f-]{36}$/);
    // and the server's own vendor replaces it: still one
    await waitFor(() => expect(list().getAllByText('קייטרינג הים')).toHaveLength(1));
  });

  it('a vendor that could not be saved is taken off again, with a message', async () => {
    mount(makeView(raw()));
    fakeServer();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'too_many' }), { status: 422 })),
    );
    fireEvent.click(screen.getAllByRole('button', { name: T.add })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(new RegExp(T.quick.name)), {
      target: { value: 'ספק שלא נשמר' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: T.quick.submit }));
    expect(await screen.findByText(T.toast.tooMany)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('ספק שלא נשמר')).toBeNull());
  });
});

describe('the contact picker', () => {
  it('is offered only where the browser has one, and fills the name and the phone', async () => {
    mount(makeView(raw()));
    fireEvent.click(screen.getAllByRole('button', { name: T.add })[0]!);
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: T.quick.contactsLabel })).toBeNull();
    cleanup();

    vi.stubGlobal('ContactsManager', class {});
    Object.defineProperty(navigator, 'contacts', {
      configurable: true,
      value: { select: vi.fn(async () => [{ name: ['דנה כהן'], tel: ['050-765-4321'] }]) },
    });
    mount(makeView(raw()));
    fireEvent.click(screen.getAllByRole('button', { name: T.add })[0]!);
    dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: T.quick.contactsLabel }));
    await waitFor(() =>
      expect((within(dialog).getByLabelText(T.quick.phone) as HTMLInputElement).value).toBe('050-765-4321'),
    );
    expect((within(dialog).getByLabelText(new RegExp(T.quick.name)) as HTMLInputElement).value).toBe(
      'דנה כהן',
    );
  });

  it('a cancelled or refused picker changes nothing and does not crash', async () => {
    vi.stubGlobal('ContactsManager', class {});
    Object.defineProperty(navigator, 'contacts', {
      configurable: true,
      value: {
        select: vi.fn(async () => {
          throw new DOMException('denied', 'NotAllowedError');
        }),
      },
    });
    mount(makeView(raw()));
    fireEvent.click(screen.getAllByRole('button', { name: T.add })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: T.quick.contactsLabel }));
    await act(async () => {});
    expect((within(dialog).getByLabelText(T.quick.phone) as HTMLInputElement).value).toBe('');
  });
});

describe('moving a vendor', () => {
  it('by its menu: shown at once and saved as a status change', async () => {
    mount(makeView(pipeline()));
    const card = list().getByText('דנה צילום').closest('li')!;
    openMenu(within(card).getByRole('button', { name: 'פעולות עבור דנה צילום' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'יצרנו קשר' }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'save', vendor: { id: V2, status: 'contacted' } });
    // it is in the other column now, and the move was said aloud
    expect(columns().getByRole('region', { name: /יצרנו קשר: ספק אחד/ })).toBeTruthy();
    expect(screen.getByText('דנה צילום עבר ל"יצרנו קשר"')).toBeTruthy();
  });

  it('a failed move puts the vendor back and says so', async () => {
    mount(makeView(pipeline()));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'invalid' }), { status: 400 })),
    );
    const card = list().getByText('דנה צילום').closest('li')!;
    openMenu(within(card).getByRole('button', { name: 'פעולות עבור דנה צילום' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'הצעת מחיר' }));
    expect(await screen.findByText(/השינוי לא נשמר/)).toBeTruthy();
    await waitFor(() => expect(columns().getByRole('region', { name: /רעיון: ספק אחד/ })).toBeTruthy());
  });
});

describe('closing a vendor', () => {
  const closing = () =>
    raw({
      vendors: [
        vendor({
          id: V1,
          name: 'אולם הגן',
          category: 'venue',
          status: 'quote',
          quoteAmount: 30000,
          paymentTerms: '30% מקדמה, 70% ביום האירוע',
        }),
      ],
    });
  const startClose = async () => {
    const card = list().getByText('אולם הגן').closest('li')!;
    openMenu(within(card).getByRole('button', { name: 'פעולות עבור אולם הגן' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: T.card.closeVendor }));
    return screen.findByRole('dialog');
  };

  it('proposes the budget, the payments from the terms and the follow-up tasks; each part is its own choice', async () => {
    mount(makeView(closing()));
    const dialog = await startClose();
    // the budget item: the vendor's name, its category, its quote
    expect(
      (within(dialog).getByLabelText(new RegExp(T.close.budget.itemTitle)) as HTMLInputElement).value,
    ).toBe('אולם הגן');
    expect((within(dialog).getByLabelText(T.close.budget.category) as HTMLSelectElement).value).toBe(
      'key:venue',
    );
    const amounts = within(dialog).getAllByLabelText(T.close.budget.amount) as HTMLInputElement[];
    expect(amounts[0]!.value).toBe('30000');
    // the schedule, from "30% מקדמה, 70% ביום האירוע"
    const labels = within(dialog).getAllByLabelText(T.close.payments.label) as HTMLInputElement[];
    expect(labels.map((l) => l.value)).toEqual(['מקדמה', 'יתרה']);
    expect(amounts.slice(1).map((a) => a.value)).toEqual(['9000', '21000']);
    expect(within(dialog).getByText(T.close.payments.sumOk)).toBeTruthy();
    // the tasks: four, with dates, checked
    for (const title of ['לחתום על חוזה', 'להעביר מקדמה', 'לתאם הגעה, הקמה ושעות', 'אישור סופי לפני האירוע'])
      expect((within(dialog).getByLabelText(new RegExp(`^${title}`)) as HTMLInputElement).checked).toBe(true);
  });

  it('closes with the whole plan in one call; the toast offers Undo, and Undo sends what the close made', async () => {
    mount(makeView(closing()));
    const dialog = await startClose();
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.submit }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    const sent = vendorCalls()[0] as { op: string; id: string; plan: Record<string, unknown> };
    expect(sent.op).toBe('close');
    expect(sent.id).toBe(V1);
    expect(sent.plan.item).toEqual({ categoryKey: 'venue', title: 'אולם הגן', amount: 30000 });
    expect(sent.plan.payments).toEqual([
      { label: 'מקדמה', amount: 9000, dueDate: '2026-10-03', payOnEventDay: false },
      { label: 'יתרה', amount: 21000, dueDate: '2027-06-17', payOnEventDay: true },
    ]);
    const tasks = sent.plan.tasks as { title: string; dueDate: string | null; category: string }[];
    expect(tasks.map((t) => t.title)).toEqual([
      'לחתום על חוזה – אולם הגן',
      'להעביר מקדמה – אולם הגן',
      'לתאם הגעה, הקמה ושעות – אולם הגן',
      'אישור סופי לפני האירוע – אולם הגן',
    ]);
    expect(tasks.every((t) => t.dueDate && t.dueDate >= '2026-10-03' && t.category === 'venue')).toBe(true);
    // booked at once
    expect(columns().getByRole('region', { name: /סגרנו: ספק אחד/ })).toBeTruthy();
    expect(await screen.findByText(T.toast.closed)).toBeTruthy();
  });

  it('Undo takes the close back with the ids the server returned, and reads the plan again', async () => {
    mount(makeView(closing()));
    const dialog = await startClose();
    // the server answers with what it made
    const created = {
      categoryId: '77777777-7777-4777-8777-777777777771',
      itemId: '77777777-7777-4777-8777-777777777772',
      paymentIds: ['77777777-7777-4777-8777-777777777773'],
      taskIds: ['77777777-7777-4777-8777-777777777774'],
    };
    closeAnswer = {
      ok: true,
      vendor: vendor({ id: V1, status: 'booked', quoteAmount: 30000, category: 'venue' }),
      previous: { status: 'quote', quoteAmount: 30000 },
      created,
    };
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.submit }));
    const undo = await screen.findByRole('button', { name: 'ביטול' });
    expect(screen.getByText(T.toast.closedBody)).toBeTruthy();
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'GET' && c.url.endsWith('/planning'))).toBe(true),
    );
    const reads = calls.filter((c) => c.url.endsWith('/planning')).length;

    fireEvent.click(undo);
    await waitFor(() => expect(vendorCalls().some((b) => b.op === 'undo_close')).toBe(true));
    expect(vendorCalls().find((b) => b.op === 'undo_close')).toEqual({
      op: 'undo_close',
      id: V1,
      previous: { status: 'quote', quoteAmount: 30000 },
      created,
    });
    // back in "quote", and the plan was read again (the budget and the tasks are the server's)
    await waitFor(() => expect(columns().getByRole('region', { name: /הצעת מחיר: ספק אחד/ })).toBeTruthy());
    await waitFor(() =>
      expect(calls.filter((c) => c.url.endsWith('/planning')).length).toBeGreaterThan(reads),
    );
    expect(await screen.findByText(T.toast.closeUndone)).toBeTruthy();
  });

  it('with parts switched off only those that are on are sent; with none it is just the status', async () => {
    mount(makeView(closing()));
    let dialog = await startClose();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(T.close.payments.title) }));
    for (const box of within(dialog).getAllByRole('checkbox', { name: /^(לחתום|להעביר|לתאם|אישור)/ }))
      if ((box as HTMLInputElement).checked) fireEvent.click(box);
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.submit }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    const plan = (vendorCalls()[0] as { plan: Record<string, unknown> }).plan;
    expect(plan.item).toBeTruthy();
    expect(plan.payments).toBeUndefined();
    expect(plan.tasks).toBeUndefined();
    cleanup();

    mount(makeView(closing()));
    dialog = await startClose();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(T.close.budget.title) }));
    // payments need the item: they are off with it
    expect(within(dialog).getByText(T.close.payments.needsBudget)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(T.close.tasks.title) }));
    expect(within(dialog).getByText(T.close.statusOnly)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.submit }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'close', id: V1 });
  });

  it('payment rows are editable, and a schedule that does not add up says so', async () => {
    mount(makeView(closing()));
    const dialog = await startClose();
    const amounts = within(dialog).getAllByLabelText(T.close.budget.amount) as HTMLInputElement[];
    fireEvent.change(amounts[1]!, { target: { value: '5000' } });
    expect(within(dialog).queryByText(T.close.payments.sumOk)).toBeNull();
    expect(within(dialog).getByRole('status', { name: '' }).textContent).toContain('₪26,000');
    // an empty name blocks it, with a reason
    fireEvent.change(within(dialog).getAllByLabelText(T.close.payments.label)[0]!, { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.submit }));
    expect(within(dialog).getByText(T.close.payments.invalid)).toBeTruthy();
    expect(vendorCalls()).toHaveLength(0);
    // a row can be added and removed
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.payments.add }));
    expect(within(dialog).getAllByLabelText(T.close.payments.label)).toHaveLength(3);
    fireEvent.click(within(dialog).getByRole('button', { name: 'הסרת תשלום 3' }));
    expect(within(dialog).getAllByLabelText(T.close.payments.label)).toHaveLength(2);
  });

  it('changing the amount re-proposes the schedule until a row was edited by hand', async () => {
    mount(makeView(closing()));
    const dialog = await startClose();
    const amount = () => within(dialog).getAllByLabelText(T.close.budget.amount) as HTMLInputElement[];
    fireEvent.change(amount()[0]!, { target: { value: '50000' } });
    expect(
      amount()
        .slice(1)
        .map((a) => a.value),
    ).toEqual(['15000', '35000']);
    fireEvent.change(amount()[1]!, { target: { value: '16000' } });
    fireEvent.change(amount()[0]!, { target: { value: '60000' } });
    expect(
      amount()
        .slice(1)
        .map((a) => a.value),
    ).toEqual(['16000', '35000']);
    // "recalculate" starts again from the terms
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.payments.recompute }));
    expect(
      amount()
        .slice(1)
        .map((a) => a.value),
    ).toEqual(['18000', '42000']);
  });

  it('with the budget connection off there is no dialog: the status changes and Undo is offered', async () => {
    const state = closing();
    mount(
      makeView({
        ...state,
        settings: {
          ...settings,
          integrations: { mode: 'recommended', vendors: false },
        } as unknown as RawPlanState['settings'],
      }),
    );
    const card = list().getByText('אולם הגן').closest('li')!;
    openMenu(within(card).getByRole('button', { name: 'פעולות עבור אולם הגן' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: T.card.closeVendor }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(vendorCalls()[0]).toEqual({ op: 'close', id: V1 });
    expect(await screen.findByText(T.toast.closed)).toBeTruthy();
    expect(screen.queryByText(T.toast.closedBody)).toBeNull();
    expect(screen.getByRole('button', { name: 'ביטול' })).toBeTruthy();
  });

  it('moving a card to "booked" asks the same way, and cancelling leaves it where it was', async () => {
    mount(makeView(closing()));
    const card = list().getByText('אולם הגן').closest('li')!;
    openMenu(within(card).getByRole('button', { name: 'פעולות עבור אולם הגן' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'סגרנו' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(vendorCalls()).toHaveLength(0);
    expect(columns().getByRole('region', { name: /הצעת מחיר: ספק אחד/ })).toBeTruthy();
  });

  it('a close the server refuses is shown as it was, with the reason', async () => {
    mount(makeView(closing()));
    const dialog = await startClose();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'invalid_link' }), { status: 400 })),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: T.close.submit }));
    expect(await screen.findByText(T.toast.invalidLink)).toBeTruthy();
    await waitFor(() => expect(columns().getByRole('region', { name: /הצעת מחיר: ספק אחד/ })).toBeTruthy());
  });
});

describe('deleting a vendor', () => {
  it('takes it off at once, and Undo puts the same vendor back with the same id', async () => {
    mount(
      makeView(
        raw({
          vendors: [
            vendor({
              id: V2,
              name: 'דנה צילום',
              category: 'photographer',
              phone: '+972501234567',
              quoteAmount: 7500,
            }),
          ],
        }),
      ),
    );
    const card = list().getByText('דנה צילום').closest('li')!;
    openMenu(within(card).getByRole('button', { name: 'פעולות עבור דנה צילום' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: T.card.delete }));
    expect(screen.queryByText('דנה צילום')).toBeNull();
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'delete', ids: [V2] });

    fireEvent.click(await screen.findByRole('button', { name: 'ביטול' }));
    expect(await list().findByText('דנה צילום')).toBeTruthy();
    await waitFor(() => expect(vendorCalls()).toHaveLength(2));
    expect(vendorCalls()[1]).toMatchObject({
      op: 'save',
      vendor: {
        id: V2,
        name: 'דנה צילום',
        category: 'photographer',
        phone: '+972501234567',
        quoteAmount: 7500,
        status: 'idea',
      },
    });
    expect(await screen.findByText(T.toast.restored)).toBeTruthy();
  });
});

describe('comparing quotes', () => {
  const compare = () =>
    raw({
      vendors: [
        vendor({
          id: V2,
          name: 'דנה צילום',
          category: 'photographer',
          status: 'quote',
          quoteAmount: 8000,
          included: 'שמונה שעות',
          rating: 5,
          paymentTerms: '50/50',
        }),
        vendor({
          id: V3,
          name: 'סטודיו נועה',
          category: 'photographer',
          status: 'quote',
          quoteAmount: 7000,
          notes: 'ממליצים',
        }),
        vendor({ id: V4, name: 'DJ מקס', category: 'dj', status: 'contacted', quoteAmount: 3000 }),
      ],
    });
  const check = (name: string) =>
    fireEvent.click(list().getByRole('checkbox', { name: new RegExp(`^השוואה: ${name}$`) }));

  it('two or more of one category open a comparison with the lowest price calmly marked', async () => {
    mount(makeView(compare()));
    check('דנה צילום');
    expect(screen.getByText(T.compare.hint)).toBeTruthy();
    expect((screen.getByRole('button', { name: T.compare.open }) as HTMLButtonElement).disabled).toBe(true);
    check('סטודיו נועה');
    expect(screen.getByText('נבחרו 2 ספקים')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: T.compare.open }));
    const dialog = await screen.findByRole('dialog');
    const table = within(dialog).getByRole('table', { name: T.compare.caption });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    for (const row of [
      T.compare.price,
      T.compare.included,
      T.compare.rating,
      T.compare.terms,
      T.compare.notes,
    ])
      expect(within(table).getByRole('rowheader', { name: row })).toBeTruthy();
    const priceRow = within(table).getByRole('rowheader', { name: T.compare.price }).closest('tr')!;
    const cells = within(priceRow).getAllByRole('cell');
    expect(cells[0]!.textContent).toContain('₪8,000');
    expect(cells[0]!.className).not.toContain('bg-success-bg');
    expect(cells[1]!.textContent).toContain('₪7,000');
    expect(cells[1]!.className).toContain('bg-success-bg');
    expect(within(cells[1]!).getByText(T.compare.cheapest)).toBeTruthy();
    // what is included, rating and terms are side by side
    expect(table.textContent).toContain('שמונה שעות');
    expect(table.textContent).toContain('50/50');
    expect(within(table).getAllByRole('img', { name: /דירוג/ }).length).toBe(2);
  });

  it('picking a vendor of another category starts a new selection', () => {
    mount(makeView(compare()));
    check('דנה צילום');
    check('סטודיו נועה');
    expect(screen.getByText('נבחרו 2 ספקים')).toBeTruthy();
    check('DJ מקס');
    expect(screen.getByText('נבחר ספק אחד')).toBeTruthy();
    expect((list().getByRole('checkbox', { name: 'השוואה: דנה צילום' }) as HTMLInputElement).checked).toBe(
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: T.compare.clear }));
    expect(screen.queryByText('נבחר ספק אחד')).toBeNull();
  });
});

describe('the vendor’s details', () => {
  const detailed = () =>
    raw({
      vendors: [
        vendor({
          id: V2,
          name: 'דנה צילום',
          category: 'photographer',
          phone: '+972501234567',
          email: 'dana@example.com',
          url: 'https://example.com/dana',
          status: 'quote',
          quoteAmount: 7500,
          paymentTerms: '30% מקדמה',
          notes: 'ממליצים',
        }),
      ],
    });
  const openDetails = async () => {
    fireEvent.click(list().getByRole('button', { name: 'פתיחת הפרטים של דנה צילום' }));
    return screen.findByRole('dialog');
  };

  it('has plain links to call, WhatsApp (the wa tokens), email and the website', async () => {
    mount(makeView(detailed()));
    const dialog = await openDetails();
    const link = (name: string) => within(dialog).getByRole('link', { name }) as HTMLAnchorElement;
    expect(link(T.drawer.call).getAttribute('href')).toBe('tel:+972501234567');
    const wa = link(T.drawer.whatsapp);
    expect(wa.getAttribute('href')).toBe('https://wa.me/972501234567');
    expect(wa.className).toContain('bg-wa-soft');
    expect(wa.className).toContain('text-wa-ink');
    expect(wa.getAttribute('rel')).toContain('noopener');
    expect(link(T.drawer.mail).getAttribute('href')).toBe('mailto:dana@example.com');
    expect(link(T.drawer.site).getAttribute('href')).toBe('https://example.com/dana');
    // the phone is shown the way Israelis write it
    expect((within(dialog).getByLabelText(T.drawer.phone) as HTMLInputElement).value).toBe('050-123-4567');
  });

  it('a vendor with no way to reach has no links; a phone that is not a number has no WhatsApp', async () => {
    mount(makeView(raw({ vendors: [vendor({ id: V2, name: 'דנה צילום', phone: 'לשאול את דנה' })] })));
    const dialog = await openDetails();
    expect(within(dialog).queryByRole('link', { name: T.drawer.whatsapp })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: T.drawer.call })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: T.drawer.mail })).toBeNull();
  });

  it('saves only what changed, normalizes the website, and refuses a bad email or address', async () => {
    mount(makeView(detailed()));
    const dialog = await openDetails();
    fireEvent.change(within(dialog).getByLabelText(T.drawer.email), { target: { value: 'not an email' } });
    fireEvent.change(within(dialog).getByLabelText(T.drawer.url), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.change(within(dialog).getByLabelText(T.drawer.quote), {
      target: { value: 'הרבה' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: T.drawer.save }));
    expect(within(dialog).getByText(T.drawer.errors.email)).toBeTruthy();
    expect(within(dialog).getByText(T.drawer.errors.url)).toBeTruthy();
    expect(within(dialog).getByText(T.drawer.errors.amount)).toBeTruthy();
    expect(vendorCalls()).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText(T.drawer.email), {
      target: { value: 'dana@studio.co.il' },
    });
    fireEvent.change(within(dialog).getByLabelText(T.drawer.url), { target: { value: 'studio.co.il/dana' } });
    fireEvent.change(within(dialog).getByLabelText(T.drawer.quote), {
      target: { value: '8,200' },
    });
    fireEvent.change(within(dialog).getByLabelText(T.drawer.notes), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: T.drawer.save }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({
      op: 'save',
      vendor: {
        id: V2,
        email: 'dana@studio.co.il',
        url: 'https://studio.co.il/dana',
        quoteAmount: 8200,
        notes: null,
      },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(list().getByText('₪8,200')).toBeTruthy();
  });

  it('rating is five stars in a radio group, one tap saves, and the same star again clears it', async () => {
    mount(makeView(detailed()));
    const dialog = await openDetails();
    const group = within(dialog).getByRole('radiogroup', { name: T.drawer.rating });
    const stars = within(group).getAllByRole('radio');
    expect(stars).toHaveLength(5);
    expect(stars[3]!.getAttribute('aria-label')).toBe('4 כוכבים');
    fireEvent.click(stars[3]!);
    expect(stars[3]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: T.drawer.save }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'save', vendor: { id: V2, rating: 4 } });
    await waitFor(() => expect(list().getByRole('img', { name: 'דירוג 4 מתוך 5' })).toBeTruthy());
  });

  it('"close vendor" saves the edits and opens the closing dialog', async () => {
    mount(makeView(detailed()));
    const dialog = await openDetails();
    fireEvent.change(within(dialog).getByLabelText(T.drawer.notes), { target: { value: 'חדש' } });
    fireEvent.click(within(dialog).getByRole('button', { name: T.drawer.closeVendor }));
    const closeDialog = await screen.findByRole('dialog', { name: T.close.title });
    expect(closeDialog).toBeTruthy();
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'save', vendor: { id: V2, notes: 'חדש' } });
  });

  it('deleting from the details is the same delete with Undo', async () => {
    mount(makeView(detailed()));
    const dialog = await openDetails();
    fireEvent.click(within(dialog).getByRole('button', { name: T.drawer.delete }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'delete', ids: [V2] });
    expect(await screen.findByText(T.toast.deleted)).toBeTruthy();
  });
});

describe('files', () => {
  const withFile = () =>
    raw({
      vendors: [
        vendor({
          id: V2,
          name: 'דנה צילום',
          attachments: [
            { path: `owner/${ID}/old.pdf`, name: 'הצעה.pdf', size: 204800, type: 'application/pdf' },
          ],
        }),
      ],
    });
  const openDetails = async () => {
    fireEvent.click(list().getByRole('button', { name: 'פתיחת הפרטים של דנה צילום' }));
    return screen.findByRole('dialog');
  };

  it('without the Pro tool: a gentle card with the way to Pro, and what is attached is still openable', async () => {
    mount(makeView(withFile(), 'free'));
    const dialog = await openDetails();
    expect(within(dialog).getByText(T.files.locked.title)).toBeTruthy();
    const upgrade = within(dialog).getByRole('link', { name: 'מעבר ל-Pro' });
    expect(upgrade.getAttribute('href')).toBe('/app/billing?plan=pro');
    expect(within(dialog).queryByRole('button', { name: T.files.add })).toBeNull();
    const open = await within(dialog).findByRole('link', { name: 'פתיחת הצעה.pdf' });
    expect(open.getAttribute('href')).toBe(`https://signed.example/owner/${ID}/old.pdf`);
    expect(open.getAttribute('target')).toBe('_blank');
  });

  it('a vendor with no files on a free plan has only the card', async () => {
    mount(makeView(raw({ vendors: [vendor({ id: V2, name: 'דנה צילום' })] }), 'free'));
    const dialog = await openDetails();
    expect(within(dialog).getByText(T.files.locked.title)).toBeTruthy();
    expect(within(dialog).queryByText(T.files.none)).toBeNull();
  });

  it('with the tool: the file goes up with a signed URL and is saved with the vendor', async () => {
    mount(makeView(withFile(), 'pro'));
    const dialog = await openDetails();
    expect(within(dialog).queryByText(T.files.locked.title)).toBeNull();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['%PDF'], 'חוזה.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(within(dialog).getByText('חוזה.pdf')).toBeTruthy());
    const upload = calls.find((c) => c.url.endsWith('/planning/files') && c.body?.op === 'upload')!;
    expect(upload.body).toEqual({
      op: 'upload',
      purpose: 'attachment',
      contentType: 'application/pdf',
      size: 4,
    });
    const put = calls.find((c) => c.url.startsWith('https://storage.example'))!;
    expect(put.method).toBe('PUT');
    fireEvent.click(within(dialog).getByRole('button', { name: T.drawer.save }));
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    const saved = (vendorCalls()[0] as { vendor: { attachments: { path: string; name: string }[] } }).vendor;
    expect(saved.attachments.map((a) => a.name)).toEqual(['הצעה.pdf', 'חוזה.pdf']);
    expect(saved.attachments[1]!.path).toBe(`owner/${ID}/file-1.pdf`);
  });

  it('refuses a file of the wrong type or too large before asking for an upload', async () => {
    mount(makeView(withFile(), 'pro'));
    const dialog = await openDetails();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.zip', { type: 'application/zip' })] } });
    expect(await within(dialog).findByText(T.files.badType)).toBeTruthy();
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await within(dialog).findByText(T.files.tooLarge)).toBeTruthy();
    expect(calls.some((c) => c.body?.op === 'upload')).toBe(false);
  });
});

describe('after the event', () => {
  const past = () => {
    const state = pipeline();
    return {
      ...state,
      invitation: { ...state.invitation, date: '2026-09-01' },
      items: [
        {
          id: '99999999-9999-4999-8999-999999999991',
          categoryId: '99999999-9999-4999-8999-999999999992',
          vendorId: V1,
          title: 'אולם',
          estimate: null,
          quoted: null,
          final: 32000,
          status: 'booked' as const,
          vatIncluded: null,
          attachments: [],
          notes: null,
          sort: 10,
        },
      ],
    };
  };

  it('is a summary: what the booked vendors cost and a rating to give each, with no "what is missing"', async () => {
    mount(makeView(past()));
    const card = screen.getByRole('region', { name: T.summary.title });
    expect(within(card).getByText('אולם הגן')).toBeTruthy();
    expect(card.textContent).toContain('₪32,000');
    expect(within(card).getByText(T.summary.body)).toBeTruthy();
    expect(within(card).getByText('ספק אחד מחכה לדירוג')).toBeTruthy();
    expect(screen.queryByRole('region', { name: T.missing.title })).toBeNull();

    const stars = within(card).getByRole('radiogroup', { name: 'איך היה אולם הגן?' });
    fireEvent.click(within(stars).getAllByRole('radio')[4]!);
    await waitFor(() => expect(vendorCalls()).toHaveLength(1));
    expect(vendorCalls()[0]).toEqual({ op: 'save', vendor: { id: V1, rating: 5 } });
    await waitFor(() => expect(within(card).getByText(T.summary.allRated)).toBeTruthy());
  });

  it('says so when nothing was booked', () => {
    const state = past();
    mount(makeView({ ...state, vendors: state.vendors.map((v) => ({ ...v, status: 'idea' as const })) }));
    expect(
      within(screen.getByRole('region', { name: T.summary.title })).getByText(T.summary.none),
    ).toBeTruthy();
  });
});

describe('in English', () => {
  it('reads in English, left to right words, with the same structure', async () => {
    mount(makeView(pipeline()), 'en');
    const E = planningVendorsEn;
    expect(screen.getByRole('heading', { name: E.title })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Booked: 1' })).toBeTruthy();
    const card = screen.getByRole('region', { name: E.missing.title });
    expect(within(card).getByRole('button', { name: 'Add a vendor in Catering' })).toBeTruthy();
    expect(screen.getByText(E.dnd.instructions)).toBeTruthy();
  });
});
