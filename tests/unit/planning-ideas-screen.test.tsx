// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HintProvider, ToastProvider } from '@/components/app';
import type { PlanIdea, PlanView } from '@/features/planning/model/plan';
import { IdeasScreen } from '@/features/planning/ui/IdeasScreen';
import { PlanProvider } from '@/features/planning/ui/PlanProvider';
import { UiProvider } from '@/lib/i18n/provider';
import { planningIdeasHe as T } from '@/lib/i18n/planning-ideas.he';

// The ideas board as the host uses it: the composer, link cards with their preview, ticking a checklist,
// deleting with Undo, turning a card into a task / vendor / budget line, search and tags — every change
// shown at once (before the server has answered) and taken back with a message when it is refused.

const ID = '11111111-1111-4111-8111-111111111111';
const BASE = `/app/invitations/${ID}/plan`;

const settings: NonNullable<PlanView['settings']> = {
  templateKey: 'wedding',
  variant: 'default',
  totalBudget: 100000,
  vatMode: 'included',
  vatPct: 18,
  guestBasis: 'invited',
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

const idea = (over: Partial<PlanIdea> & { id: string }): PlanIdea => ({
  type: 'note',
  title: null,
  body: null,
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
  createdAt: '2026-10-01T10:00:00+00:00',
  ...over,
});
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const view = (ideas: PlanIdea[], over: Partial<PlanView> = {}): PlanView => ({
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
  categories: [],
  items: [],
  payments: [],
  vendors: [],
  ideas,
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
  today: '2026-10-03',
  summary: { guests: 80, sent: 0, responses: 0, unpublishedChanges: false },
  dateChanged: false,
  features: { ai: true, export: true, templates: false, seating: true, checkin: true },
  ...over,
});

// ─── a fake server ──────────────────────────────────────────────────────────────────────────────

type Reply = { status?: number; body: unknown };
type Handler = (body: Record<string, any>) => Reply | Promise<Reply>; // eslint-disable-line @typescript-eslint/no-explicit-any
let calls: { path: string; body: Record<string, any> }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
let handlers: Record<string, Handler>;

const calledWith = (path: string) => calls.filter((c) => c.path === path).map((c) => c.body);

function stubServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).replace(`/api/invitations/${ID}/planning`, '');
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ path, body });
      const reply = (await handlers[path]?.(body)) ?? { status: 404, body: { ok: false, code: 'not_found' } };
      const status = reply.status ?? 200;
      return { ok: status < 400, status, json: async () => reply.body } as Response;
    }),
  );
}

/** A request held until the test lets it answer (to look at the screen in between). */
function hold() {
  let release!: (r: Reply) => void;
  const promise = new Promise<Reply>((resolve) => (release = resolve));
  return { promise, release };
}

beforeEach(() => {
  calls = [];
  handlers = {};
  stubServer();
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => undefined;
  vi.stubGlobal('crypto', {
    randomUUID: (() => {
      let n = 100;
      return () => uuid(++n);
    })(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ideas: PlanIdea[], over: Partial<PlanView> = {}, locale: 'he' | 'en' = 'he') {
  return render(
    <UiProvider locale={locale}>
      <ToastProvider label="התראה" viewportLabel="התראות" closeLabel="סגירה">
        <HintProvider>
          <PlanProvider id={ID} initial={view(ideas, over)}>
            <IdeasScreen />
          </PlanProvider>
        </HintProvider>
      </ToastProvider>
    </UiProvider>,
  );
}

const composer = () => screen.getByRole('textbox', { name: T.composer.label }) as HTMLInputElement;
async function type(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  await act(async () => {
    fireEvent.submit(composer().closest('form')!);
  });
}
const open = (button: HTMLElement) => fireEvent.keyDown(button, { key: 'Enter' });
const saved = (over: Record<string, unknown>) => ({ body: { ok: true, idea: idea(over as never) } });

// ─── tests ──────────────────────────────────────────────────────────────────────────────────────

describe('an empty board', () => {
  it('says what to do in one step, and has the composer and one primary action', () => {
    mount([]);
    expect(screen.getByRole('heading', { level: 1, name: T.title })).toBeTruthy();
    expect(screen.getByText(T.empty.title)).toBeTruthy();
    expect(screen.getByText(T.empty.body)).toBeTruthy();
    expect(composer().placeholder).toBe(T.composer.placeholder);
    // no search or tags with nothing to search
    expect(screen.queryByRole('searchbox')).toBeNull();
    // the header's "new idea" is the primary action (the empty state's is a secondary button)
    const primary = screen.getAllByRole('button', { name: T.new });
    expect(primary[0]!.getAttribute('data-variant')).toBe('primary');
    expect(primary.filter((b) => b.getAttribute('data-variant') === 'primary')).toHaveLength(1);
  });

  it('the header’s action focuses the composer on a desktop', () => {
    mount([]);
    fireEvent.click(screen.getAllByRole('button', { name: T.new })[0]!);
    expect(document.activeElement).toBe(composer());
  });

  it('speaks English with the same screen', () => {
    mount([], {}, 'en');
    expect(screen.getByText('No ideas yet')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'New idea' })).toBeTruthy();
  });
});

describe('adding a note', () => {
  it('shows the card at once, clears the line, and keeps the server’s version', async () => {
    const held = hold();
    handlers['/ideas'] = () => held.promise;
    mount([]);
    await type('לבדוק צבעים לפרחים');
    // before the server answers: the card is there and the composer is empty
    expect(screen.getByText('לבדוק צבעים לפרחים')).toBeTruthy();
    expect(composer().value).toBe('');
    expect(screen.queryByText(T.empty.title)).toBeNull();
    expect(calledWith('/ideas')).toEqual([
      { op: 'save', idea: { id: uuid(101), type: 'note', body: 'לבדוק צבעים לפרחים' } },
    ]);
    await act(async () =>
      held.release(saved({ id: uuid(101), body: 'לבדוק צבעים לפרחים', title: 'כותרת מהשרת' })),
    );
    expect(screen.getByText('כותרת מהשרת')).toBeTruthy();
    // a note is not asked for a preview
    expect(calledWith('/ideas/preview')).toEqual([]);
  });

  it('takes the card back, with a message and the text, when it is refused', async () => {
    handlers['/ideas'] = () => ({ status: 422, body: { ok: false, code: 'too_many' } });
    mount([]);
    await type('לא ייכנס');
    await waitFor(() => expect(screen.queryByText('לא ייכנס', { selector: 'span' })).toBeNull());
    expect(await screen.findByText(T.toast.tooMany)).toBeTruthy();
    expect(composer().value).toBe('לא ייכנס');
    expect(screen.getByText(T.empty.title)).toBeTruthy();
  });

  it('adds nothing for an empty line', async () => {
    mount([]);
    await type('   ');
    expect(calls).toEqual([]);
  });
});

describe('pasting a link', () => {
  const url = 'https://example.com/hall';

  it('makes a link card, reads the page for its preview, and shows it (the link opens in a new tab, safely)', async () => {
    const preview = hold();
    handlers['/ideas'] = (b) =>
      saved({ id: b.idea.id, type: 'link', url, ogPreview: b.idea.ogPreview ?? null });
    handlers['/ideas/preview'] = () => preview.promise;
    mount([]);
    await type(url);
    expect(calledWith('/ideas')[0]).toEqual({ op: 'save', idea: { id: uuid(101), type: 'link', url } });
    expect(calledWith('/ideas/preview')).toEqual([{ url }]);
    // waiting for the page: a placeholder, and the host name already
    expect(screen.getByText(T.card.loadingPreview)).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();

    const ogPreview = {
      title: 'אולם בגליל',
      description: 'מקום לאירועים',
      image: 'https://cdn.example.com/a.jpg',
      site: 'אולמי הגליל',
    };
    await act(async () => preview.release({ body: { ok: true, preview: ogPreview } }));
    // the preview is kept on the card
    await waitFor(() => expect(calledWith('/ideas')).toHaveLength(2));
    expect(calledWith('/ideas')[1]).toEqual({ op: 'save', idea: { id: uuid(101), ogPreview } });
    const link = await screen.findByRole('link', { name: new RegExp(T.card.open) });
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer noopener');
    expect(within(link).getByText('אולם בגליל')).toBeTruthy();
    expect(within(link).getByText('מקום לאירועים')).toBeTruthy();
    expect(within(link).getByText('אולמי הגליל')).toBeTruthy();
    const img = link.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.queryByText(T.card.loadingPreview)).toBeNull();
  });

  it('keeps the card, and says so, when the page cannot be read', async () => {
    handlers['/ideas'] = (b) => saved({ id: b.idea.id, type: 'link', url });
    handlers['/ideas/preview'] = () => ({ status: 422, body: { ok: false, code: 'preview_failed' } });
    mount([]);
    await type(url);
    expect(await screen.findByText(T.preview.failed)).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();
    expect(calledWith('/ideas')).toHaveLength(1);
    expect(screen.queryByText(T.card.loadingPreview)).toBeNull();
  });

  it('says when the hour’s previews are used up', async () => {
    handlers['/ideas'] = (b) => saved({ id: b.idea.id, type: 'link', url });
    handlers['/ideas/preview'] = () => ({ status: 429, body: { ok: false, code: 'rate_limited' } });
    mount([]);
    await type(url);
    expect(await screen.findByText(T.preview.limit)).toBeTruthy();
  });

  it('a card with no address works without any preview', async () => {
    mount([idea({ id: uuid(1), type: 'link', url: 'https://www.example.com/x', title: 'שם משלי' })]);
    expect(screen.getByText('שם משלי')).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();
    expect(calledWith('/ideas/preview')).toEqual([]);
  });

  it('reads the page of a link added a moment ago elsewhere (the quick-add), once', async () => {
    handlers['/ideas'] = (b) => saved({ id: b.idea.id, type: 'link', url, ogPreview: b.idea.ogPreview });
    handlers['/ideas/preview'] = () => ({ body: { ok: true, preview: { title: 'עמוד' } } });
    mount([idea({ id: uuid(1), type: 'link', url, createdAt: new Date().toISOString() })]);
    await waitFor(() => expect(calledWith('/ideas/preview')).toEqual([{ url }]));
    expect(await screen.findByText('עמוד')).toBeTruthy();
    expect(calledWith('/ideas/preview')).toHaveLength(1);
  });
});

describe('a checklist', () => {
  const list = idea({
    id: uuid(1),
    type: 'list',
    title: 'לקנות',
    items: [
      { text: 'נרות', done: false },
      { text: 'מפיות', done: true },
    ],
  });

  it('ticks a line at once and keeps it', async () => {
    const held = hold();
    handlers['/ideas'] = () => held.promise;
    mount([list]);
    expect(screen.getByText(`1 מתוך 2`)).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: 'נרות' }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect((screen.getByRole('checkbox', { name: 'נרות' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('2 מתוך 2')).toBeTruthy();
    expect(calledWith('/ideas')).toEqual([
      {
        op: 'save',
        idea: {
          id: uuid(1),
          items: [
            { text: 'נרות', done: true },
            { text: 'מפיות', done: true },
          ],
        },
      },
    ]);
    await act(async () =>
      held.release(
        saved({
          id: uuid(1),
          type: 'list',
          title: 'לקנות',
          items: [
            { text: 'נרות', done: true },
            { text: 'מפיות', done: true },
          ],
        }),
      ),
    );
    expect((screen.getByRole('checkbox', { name: 'נרות' }) as HTMLInputElement).checked).toBe(true);
  });

  it('two quick ticks end with both ticked, whichever answer comes back last', async () => {
    const first = hold();
    const second = hold();
    const queue = [first, second];
    handlers['/ideas'] = () => queue.shift()!.promise;
    const three = {
      ...list,
      items: [
        { text: 'נרות', done: false },
        { text: 'מפיות', done: false },
        { text: 'בלונים', done: false },
      ],
    };
    mount([three]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'נרות' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'מפיות' }));
    expect(calledWith('/ideas')[1]!.idea.items.map((l: { done: boolean }) => l.done)).toEqual([
      true,
      true,
      false,
    ]);
    const both = [
      { text: 'נרות', done: true },
      { text: 'מפיות', done: true },
      { text: 'בלונים', done: false },
    ];
    await act(async () => second.release(saved({ ...three, items: both })));
    // the older answer (only the first tick) must not undo the second
    await act(async () =>
      first.release(saved({ ...three, items: [{ text: 'נרות', done: true }, ...three.items.slice(1)] })),
    );
    expect((screen.getByRole('checkbox', { name: 'נרות' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'מפיות' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'בלונים' }) as HTMLInputElement).checked).toBe(false);
  });

  it('unticks a line the same way, and takes a tick back when the server refuses it', async () => {
    handlers['/ideas'] = () => ({ status: 500, body: { ok: false } });
    mount([list]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'מפיות' }));
    expect(await screen.findByText(T.toast.saveFailed)).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'מפיות' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('1 מתוך 2')).toBeTruthy();
  });
});

describe('deleting', () => {
  const card = idea({
    id: uuid(1),
    title: 'למחוק',
    body: 'תוכן',
    color: 'success',
    tags: ['א'],
    pinned: true,
    sort: 3,
    createdAt: '2026-10-01T10:00:00+00:00',
  });
  const other = idea({ id: uuid(2), title: 'נשאר' });

  async function remove() {
    open(screen.getAllByRole('button', { name: T.card.actions })[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: T.card.delete }));
  }

  it('deletes at once, and Undo puts the same card back with the same id and fields', async () => {
    handlers['/ideas'] = (b) =>
      b.op === 'delete' ? { body: { ok: true, deleted: 1 } } : saved({ ...b.idea, id: b.idea.id });
    mount([card, other]);
    await remove();
    await waitFor(() => expect(screen.queryByText('למחוק')).toBeNull());
    expect(calledWith('/ideas')[0]).toEqual({ op: 'delete', ids: [uuid(1)] });
    expect(await screen.findByText(T.toast.deleted)).toBeTruthy();
    expect(screen.getByText('נשאר')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(await screen.findByText('למחוק')).toBeTruthy();
    const restore = calledWith('/ideas')[1]!;
    expect(restore.op).toBe('save');
    expect(restore.idea).toMatchObject({
      id: uuid(1),
      type: 'note',
      title: 'למחוק',
      body: 'תוכן',
      color: 'success',
      tags: ['א'],
      pinned: true,
      sort: 3,
    });
    expect(await screen.findByText(T.toast.restored)).toBeTruthy();
  });

  it('keeps the card, with a message, when the delete is refused', async () => {
    handlers['/ideas'] = () => ({ status: 500, body: { ok: false } });
    mount([card, other]);
    await remove();
    expect(await screen.findByText(T.toast.deleteFailed)).toBeTruthy();
    expect(screen.getByText('למחוק')).toBeTruthy();
  });
});

describe('turning a card into something', () => {
  const note = idea({ id: uuid(1), title: 'להזמין חופה', body: 'לשאול את דנה' });
  const menu = () => screen.getByRole('button', { name: T.makeInto.label });
  async function pick(name: string) {
    open(menu());
    fireEvent.click(await screen.findByRole('menuitem', { name }));
  }

  it('a task: the card’s title, an optional date, and the link both ways', async () => {
    const task = { id: uuid(900), title: 'להזמין חופה' };
    handlers['/ideas'] = () => ({
      body: { ok: true, idea: { ...note, linkedTaskId: task.id }, created: { taskId: task.id } },
    });
    handlers[''] = () => ({ body: { ok: true, view: view([{ ...note, linkedTaskId: task.id }]) } });
    mount([note]);
    await pick(T.makeInto.task);
    const dialog = await screen.findByRole('dialog', { name: T.convert.task.title });
    const name = within(dialog).getByRole('textbox', { name: T.convert.task.name }) as HTMLInputElement;
    expect(name.value).toBe('להזמין חופה');
    fireEvent.change(within(dialog).getByLabelText(T.convert.task.date), { target: { value: '2027-03-01' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.task.submit }));
    });
    expect(calledWith('/ideas')).toEqual([
      {
        op: 'convert',
        id: uuid(1),
        kind: 'task',
        data: { title: 'להזמין חופה', dueDate: '2027-03-01', notes: 'לשאול את דנה' },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // the card links to the task (by the name given, until the plan is read again), and the entry is gone
    const chip = screen.getByRole('link', { name: 'משימה: להזמין חופה' });
    expect(chip.getAttribute('href')).toBe(`${BASE}/tasks`);
    expect(await screen.findByText(T.convert.task.done)).toBeTruthy();
    open(menu());
    expect(await screen.findByRole('menuitem', { name: T.makeInto.vendor })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: T.makeInto.task })).toBeNull();
    // the plan is read again for the new row
    await waitFor(() => expect(calledWith('')).toHaveLength(1));
  });

  it('a task without a date sends none, and a name is required', async () => {
    handlers['/ideas'] = () => ({
      body: { ok: true, idea: { ...note, linkedTaskId: uuid(9) }, created: { taskId: uuid(9) } },
    });
    handlers[''] = () => ({ body: { ok: true, view: view([note]) } });
    mount([note]);
    await pick(T.makeInto.task);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: T.convert.task.name }), {
      target: { value: '  ' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.task.submit }));
    });
    expect(within(dialog).getByText(T.convert.nameRequired)).toBeTruthy();
    expect(calls).toEqual([]);
    fireEvent.change(within(dialog).getByRole('textbox', { name: T.convert.task.name }), {
      target: { value: 'משימה' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.task.submit }));
    });
    expect(calledWith('/ideas')[0]!.data).toEqual({ title: 'משימה', dueDate: null, notes: 'לשאול את דנה' });
  });

  it('a vendor: the name, a category, the address of a link card; the chip goes to the vendors', async () => {
    const link = idea({
      id: uuid(1),
      type: 'link',
      url: 'https://example.com/p',
      ogPreview: { title: 'סטודיו אור' },
      body: 'מצאתי באינסטגרם',
    });
    handlers['/ideas'] = () => ({
      body: { ok: true, idea: { ...link, linkedVendorId: uuid(800) }, created: { vendorId: uuid(800) } },
    });
    handlers[''] = () => ({ body: { ok: true, view: view([{ ...link, linkedVendorId: uuid(800) }]) } });
    mount([link]);
    await pick(T.makeInto.vendor);
    const dialog = await screen.findByRole('dialog', { name: T.convert.vendor.title });
    expect(
      (within(dialog).getByRole('textbox', { name: T.convert.vendor.name }) as HTMLInputElement).value,
    ).toBe('מצאתי באינסטגרם');
    fireEvent.change(within(dialog).getByRole('textbox', { name: T.convert.vendor.name }), {
      target: { value: 'סטודיו אור' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: T.convert.vendor.category }), {
      target: { value: 'photographer' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.vendor.submit }));
    });
    expect(calledWith('/ideas')[0]).toEqual({
      op: 'convert',
      id: uuid(1),
      kind: 'vendor',
      data: {
        name: 'סטודיו אור',
        category: 'photographer',
        url: 'https://example.com/p',
        notes: 'מצאתי באינסטגרם',
      },
    });
    expect((await screen.findByRole('link', { name: 'ספק: סטודיו אור' })).getAttribute('href')).toBe(
      `${BASE}/vendors`,
    );
  });

  it('a budget line: only when the event has budget categories, in one of them', async () => {
    mount([note]);
    open(menu());
    expect(await screen.findByRole('menuitem', { name: T.makeInto.task })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: T.makeInto.item })).toBeNull();
    cleanup();

    const categories = [
      {
        id: uuid(500),
        key: 'venue',
        name: null,
        plannedAmount: 0,
        costBasis: 'fixed',
        unitPrice: null,
        childPrice: null,
        required: false,
        sort: 0,
      },
      {
        id: uuid(501),
        key: null,
        name: 'קטגוריה שלי',
        plannedAmount: 0,
        costBasis: 'fixed',
        unitPrice: null,
        childPrice: null,
        required: false,
        sort: 1,
      },
    ] as PlanView['categories'];
    handlers['/ideas'] = () => ({
      body: { ok: true, idea: { ...note, linkedBudgetItemId: uuid(700) }, created: { itemId: uuid(700) } },
    });
    handlers[''] = () => ({
      body: { ok: true, view: view([{ ...note, linkedBudgetItemId: uuid(700) }], { categories }) },
    });
    mount([note], { categories });
    await pick(T.makeInto.item);
    const dialog = await screen.findByRole('dialog', { name: T.convert.item.title });
    const select = within(dialog).getByRole('combobox', {
      name: T.convert.item.category,
    }) as HTMLSelectElement;
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['אולם / מקום', 'קטגוריה שלי']);
    fireEvent.change(select, { target: { value: uuid(501) } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: T.convert.item.estimate }), {
      target: { value: '1,500' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.item.submit }));
    });
    expect(calledWith('/ideas')[0]).toEqual({
      op: 'convert',
      id: uuid(1),
      kind: 'item',
      data: { title: 'להזמין חופה', categoryId: uuid(501), estimate: 1500 },
    });
    expect((await screen.findByRole('link', { name: 'סעיף תקציב: להזמין חופה' })).getAttribute('href')).toBe(
      `${BASE}/budget`,
    );
  });

  it('an estimate must be a number', async () => {
    const categories = [
      {
        id: uuid(500),
        key: 'venue',
        name: null,
        plannedAmount: 0,
        costBasis: 'fixed',
        unitPrice: null,
        childPrice: null,
        required: false,
        sort: 0,
      },
    ] as PlanView['categories'];
    mount([note], { categories });
    await pick(T.makeInto.item);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: T.convert.item.estimate }), {
      target: { value: 'הרבה' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.item.submit }));
    });
    expect(within(dialog).getByText(T.convert.item.estimateInvalid)).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('says why when the server refuses, and keeps the dialog', async () => {
    handlers['/ideas'] = () => ({ status: 422, body: { ok: false, code: 'too_many' } });
    mount([note]);
    await pick(T.makeInto.task);
    const dialog = await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: T.convert.task.submit }));
    });
    expect(await screen.findByText(T.convert.errors.too_many)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows what a card became with names from the plan, and offers only what is left', () => {
    const linked = idea({
      id: uuid(1),
      title: 'הכול',
      linkedTaskId: uuid(11),
      linkedVendorId: uuid(12),
      linkedBudgetItemId: uuid(13),
    });
    mount([linked], {
      tasks: [{ id: uuid(11), title: 'לסגור אולם' } as PlanView['tasks'][number]],
      vendors: [{ id: uuid(12), name: 'אולמי הגליל' } as PlanView['vendors'][number]],
      items: [{ id: uuid(13), title: 'מקדמה' } as PlanView['items'][number]],
    });
    expect(screen.getByRole('link', { name: 'משימה: לסגור אולם' }).getAttribute('href')).toBe(
      `${BASE}/tasks`,
    );
    expect(screen.getByRole('link', { name: 'ספק: אולמי הגליל' }).getAttribute('href')).toBe(
      `${BASE}/vendors`,
    );
    expect(screen.getByRole('link', { name: 'סעיף תקציב: מקדמה' }).getAttribute('href')).toBe(
      `${BASE}/budget`,
    );
    // everything is linked: nothing left to turn it into
    expect(screen.queryByRole('button', { name: T.makeInto.label })).toBeNull();
  });
});

describe('colors, pins, tags and search', () => {
  const cards = [
    idea({
      id: uuid(1),
      title: 'אולם בגליל',
      body: 'נראה מקסים',
      tags: ['אולם', 'חשוב'],
      color: 'brand',
      sort: 0,
    }),
    idea({ id: uuid(2), title: 'פרחים', body: 'ורדים לבנים', tags: ['פרחים'], color: 'info', sort: 1 }),
    idea({ id: uuid(3), title: 'מוזיקה', tags: ['חשוב'], pinned: true, color: 'warning', sort: 2 }),
    idea({ id: uuid(4), title: 'עוגה', color: 'success', sort: 3 }),
    idea({ id: uuid(5), title: 'רגיל' }),
  ];
  // the card whose title (the first line of its text) is this
  const card = (title: string) =>
    screen.getAllByRole('article').find((a) => a.querySelector('button > span')?.textContent === title)!;

  it('colors a card with the palette’s tokens only', () => {
    mount(cards);
    expect(card('אולם בגליל').className).toContain('bg-brand-soft');
    expect(card('אולם בגליל').className).toContain('border-brand-line');
    expect(card('פרחים').className).toContain('bg-info-bg');
    expect(card('מוזיקה').className).toContain('bg-warning-bg');
    expect(card('עוגה').className).toContain('bg-success-bg');
    expect(card('רגיל').className).toContain('bg-surface');
    expect(card('רגיל').className).toContain('border-line');
    // never a raw color
    for (const a of document.querySelectorAll('article'))
      expect(a.className).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|\[#/i);
  });

  it('keeps pinned cards in their own group at the top', () => {
    mount(cards);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([T.groups.pinned, T.groups.others]);
    const titles = [...document.querySelectorAll('article')].map((a) => a.querySelector('span')?.textContent);
    expect(titles[0]).toBe('מוזיקה');
  });

  it('pins and unpins with the pin button, and colors from the menu', async () => {
    handlers['/ideas'] = (b) => saved({ ...cards[3], ...b.idea });
    mount(cards);
    const own = within(card('עוגה'));
    const pin = own.getByRole('button', { name: T.card.pin });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pin);
    expect(calledWith('/ideas')[0]).toEqual({ op: 'save', idea: { id: uuid(4), pinned: true } });
    await waitFor(() =>
      expect(
        within(card('עוגה')).getByRole('button', { name: T.card.unpin }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );

    open(within(card('פרחים')).getByRole('button', { name: T.card.actions }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: T.card.colors.warning }));
    expect(calledWith('/ideas')[1]).toEqual({ op: 'save', idea: { id: uuid(2), color: 'warning' } });
    await waitFor(() => expect(card('פרחים').className).toContain('bg-warning-bg'));
  });

  it('filters by tag (chips that are on or off) and by search, together', () => {
    mount(cards);
    const group = screen.getByRole('group', { name: T.filter.label });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([T.filter.all, 'חשוב2', 'אולם1', 'פרחים1']);
    const chip = within(group).getByRole('button', { name: /^חשוב/ });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('ורדים לבנים')).toBeNull();
    expect(screen.getByText('אולם בגליל')).toBeTruthy();
    expect(screen.getByText('מוזיקה')).toBeTruthy();
    expect(screen.getByText('נמצאו 2 רעיונות')).toBeTruthy();
    // search inside the tag
    fireEvent.change(screen.getByRole('searchbox', { name: T.search.label }), { target: { value: 'מקסים' } });
    expect(screen.queryByText('מוזיקה')).toBeNull();
    expect(screen.getByText('אולם בגליל')).toBeTruthy();
    expect(screen.getByText('נמצא רעיון אחד')).toBeTruthy();
    // nothing found: a way back
    fireEvent.change(screen.getByRole('searchbox', { name: T.search.label }), {
      target: { value: 'לא קיים' },
    });
    expect(screen.getByText(T.empty.filtered)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: T.empty.clear }));
    expect(screen.getAllByRole('article').length).toBe(5);
    expect(within(group).getByRole('button', { name: T.filter.all }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('searches the card’s text and tags', () => {
    mount(cards);
    const search = screen.getByRole('searchbox', { name: T.search.label });
    fireEvent.change(search, { target: { value: 'ורדים' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'פרחים' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });
});

describe('pictures', () => {
  it('reads the signed address of a picture from the files route and shows it, lazily, with the title as its text', async () => {
    const path = `u/${ID}/a.png`;
    handlers['/files'] = () => ({
      body: { ok: true, urls: { [path]: 'https://storage.example.com/signed/a.png?token=1' } },
    });
    mount([idea({ id: uuid(1), type: 'image', title: 'שמלה בסגנון וינטג׳', imagePath: path })]);
    const img = (await screen.findByRole('img', { name: 'שמלה בסגנון וינטג׳' })) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://storage.example.com/signed/a.png?token=1');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(calledWith('/files')).toEqual([{ op: 'read', paths: [path] }]);
  });

  it('asks again, once, when a picture’s address has run out', async () => {
    const path = `u/${ID}/a.png`;
    let n = 0;
    handlers['/files'] = () => ({
      body: { ok: true, urls: { [path]: `https://storage.example.com/signed/a.png?token=${++n}` } },
    });
    mount([idea({ id: uuid(1), type: 'image', title: 'תמונה', imagePath: path })]);
    const img = await screen.findByRole('img', { name: 'תמונה' });
    fireEvent.error(img);
    await waitFor(() => expect(calledWith('/files')).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'תמונה' }).getAttribute('src')).toContain('token=2'),
    );
  });
});

describe('the full editor', () => {
  it('"more options" opens it; a new card is added with all it holds, and it stays open until saved', async () => {
    const held = hold();
    handlers['/ideas'] = () => held.promise;
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: T.composer.more }));
    const drawer = await screen.findByRole('dialog', { name: T.editor.newTitle });
    fireEvent.click(within(drawer).getByRole('radio', { name: T.types.list }));
    fireEvent.change(within(drawer).getByRole('textbox', { name: T.editor.title }), {
      target: { value: 'לקנות' },
    });
    fireEvent.change(within(drawer).getByRole('textbox', { name: 'שורה 1' }), { target: { value: 'נרות' } });
    fireEvent.click(within(drawer).getByRole('button', { name: T.editor.addLine }));
    fireEvent.change(within(drawer).getByRole('textbox', { name: 'שורה 2' }), { target: { value: 'מפיות' } });
    // tags: typed and committed with Enter
    const tag = within(drawer).getByRole('textbox', { name: T.editor.tags });
    fireEvent.change(tag, { target: { value: 'חשוב' } });
    fireEvent.keyDown(tag, { key: 'Enter' });
    expect(within(drawer).getByText('חשוב')).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('radio', { name: T.card.colors.brand }));
    fireEvent.click(within(drawer).getByRole('checkbox', { name: T.editor.pinned }));
    await act(async () => {
      fireEvent.click(within(drawer).getByRole('button', { name: T.editor.create }));
    });
    expect(calledWith('/ideas')[0]).toEqual({
      op: 'save',
      idea: {
        id: uuid(101),
        type: 'list',
        title: 'לקנות',
        body: null,
        url: null,
        imagePath: null,
        color: 'brand',
        tags: ['חשוב'],
        pinned: true,
        items: [
          { text: 'נרות', done: false },
          { text: 'מפיות', done: false },
        ],
      },
    });
    // the card is on the board while the editor waits for the server
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () =>
      held.release(
        saved({
          id: uuid(101),
          type: 'list',
          title: 'לקנות',
          items: [
            { text: 'נרות', done: false },
            { text: 'מפיות', done: false },
          ],
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('checkbox', { name: 'נרות' })).toBeTruthy();
  });

  it('will not save an empty card, and says so', async () => {
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: T.composer.more }));
    const drawer = await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(within(drawer).getByRole('button', { name: T.editor.create }));
    });
    expect(within(drawer).getByText(T.editor.empty)).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('a link needs an http(s) address', async () => {
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: T.composer.more }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.click(within(drawer).getByRole('radio', { name: T.types.link }));
    fireEvent.change(within(drawer).getByLabelText(T.editor.url), {
      target: { value: 'javascript:alert(1)' },
    });
    await act(async () => {
      fireEvent.click(within(drawer).getByRole('button', { name: T.editor.create }));
    });
    expect(within(drawer).getByText(T.editor.urlInvalid)).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('edits a card by clicking its text: only what changed is sent, and a new address asks for a new preview', async () => {
    const card = idea({
      id: uuid(1),
      type: 'link',
      title: 'אולם',
      body: 'הערה',
      url: 'https://a.example.com/',
      ogPreview: { title: 'ישן' },
      tags: ['א'],
    });
    handlers['/ideas'] = (b) => saved({ ...card, ...b.idea });
    handlers['/ideas/preview'] = () => ({ body: { ok: true, preview: { title: 'חדש' } } });
    mount([card]);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${T.card.edit}: אולם`) }));
    const drawer = await screen.findByRole('dialog', { name: T.editor.editTitle });
    expect((within(drawer).getByLabelText(T.editor.url) as HTMLInputElement).value).toBe(
      'https://a.example.com/',
    );
    fireEvent.change(within(drawer).getByLabelText(T.editor.url), {
      target: { value: 'https://b.example.com/' },
    });
    await act(async () => {
      fireEvent.click(within(drawer).getByRole('button', { name: T.editor.save }));
    });
    expect(calledWith('/ideas')[0]).toEqual({
      op: 'save',
      idea: { id: uuid(1), url: 'https://b.example.com/', ogPreview: null },
    });
    await waitFor(() => expect(calledWith('/ideas/preview')).toEqual([{ url: 'https://b.example.com/' }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('nothing is sent when nothing changed', async () => {
    const card = idea({ id: uuid(1), title: 'אולם', body: 'הערה' });
    mount([card]);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${T.card.edit}: אולם`) }));
    const drawer = await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(within(drawer).getByRole('button', { name: T.editor.save }));
    });
    expect(calls).toEqual([]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('the assistant: summarize and suggest steps', () => {
  const note = idea({ id: uuid(1), title: 'קייטרינג', body: 'המלצה מדנה על שף' });
  const A = T.ai;
  async function ask() {
    open(screen.getByRole('button', { name: T.card.actions }));
    fireEvent.click(await screen.findByRole('menuitem', { name: A.action }));
  }
  const answer = {
    body: {
      ok: true,
      summary: 'המלצה על שף לאירוע',
      steps: [
        { title: 'להתקשר לשף ולבקש הצעה', category: 'catering' },
        { title: 'לקבוע טעימות', category: null },
        { title: 'לשאול על כשרות', category: 'catering' },
      ],
    },
  };

  it('reads the card, shows the summary and the steps ticked, and keeps nothing until asked', async () => {
    handlers['/ai'] = () => answer;
    mount([note]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    expect(await within(dialog).findByText('המלצה על שף לאירוע')).toBeTruthy();
    expect(calledWith('/ai')).toEqual([{ kind: 'idea', ideaId: uuid(1), locale: 'he' }]);
    const boxes = within(dialog).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(3);
    // the primary button counts what is ticked
    expect(within(dialog).getByRole('button', { name: 'להוסיף 3 משימות' })).toBeTruthy();
    // asking is not a change of the plan: nothing was saved
    expect(calledWith('/tasks')).toEqual([]);
  });

  it('adds the ticked steps as tasks (with their category), then reads the plan again and closes', async () => {
    handlers['/ai'] = () => answer;
    handlers['/tasks'] = () => ({ body: { ok: true, task: { id: uuid(500) } } });
    handlers[''] = () => ({ body: { ok: true, view: view([note]) } });
    mount([note]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    await within(dialog).findByText('המלצה על שף לאירוע');
    // untick the second step
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'לקבוע טעימות' }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'להוסיף 2 משימות' }));
    });
    expect(calledWith('/tasks')).toEqual([
      { op: 'save', task: { title: 'להתקשר לשף ולבקש הצעה', category: 'catering' } },
      { op: 'save', task: { title: 'לשאול על כשרות', category: 'catering' } },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('נוספו 2 משימות')).toBeTruthy();
    await waitFor(() => expect(calledWith('')).toHaveLength(1));
  });

  it('keeps the dialog and says so when a task was not saved', async () => {
    handlers['/ai'] = () => answer;
    handlers['/tasks'] = () => ({ status: 422, body: { ok: false, code: 'too_many' } });
    mount([note]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    await within(dialog).findByText('המלצה על שף לאירוע');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'להוסיף 3 משימות' }));
    });
    expect(await within(dialog).findByText(A.addFailed)).toBeTruthy();
    expect(screen.getByRole('dialog', { name: A.title })).toBeTruthy();
  });

  it('with no steps to offer it says so and has nothing to add', async () => {
    handlers['/ai'] = () => ({ body: { ok: true, summary: 'פתק קצר', steps: [] } });
    mount([note]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    expect(await within(dialog).findByText(A.noSteps)).toBeTruthy();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
  });

  it('explains a failed answer, a spent day and a missing model, and tries again', async () => {
    let n = 0;
    handlers['/ai'] = () => (++n === 1 ? { status: 502, body: { ok: false, code: 'ai_failed' } } : answer);
    mount([note]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    expect(await within(dialog).findByText(A.failed)).toBeTruthy();
    // a failed read is not a failed save: the plan's save line stays calm
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: A.retry }));
    });
    expect(await within(dialog).findByText('המלצה על שף לאירוע')).toBeTruthy();
    expect(n).toBe(2);
  });

  it.each([
    ['rate_limited', 429, A.limit],
    ['ai_unavailable', 503, A.unavailable],
  ])('%s: says what happened, without a retry', async (code, status, text) => {
    handlers['/ai'] = () => ({ status, body: { ok: false, code } });
    mount([note]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    expect(await within(dialog).findByText(text)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: A.retry })).toBeNull();
  });

  it('a card with nothing written asks for nothing', async () => {
    mount([idea({ id: uuid(1), type: 'list', items: [], tags: ['חשוב'] })]);
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    expect(within(dialog).getByText(A.empty)).toBeTruthy();
    expect(calledWith('/ai')).toEqual([]);
  });

  it('on the free plan it is a soft lock with the way to Pro, and asks for nothing', async () => {
    mount([note], { features: { ai: false, export: false, templates: false, seating: true, checkin: true } });
    await ask();
    const dialog = await screen.findByRole('dialog', { name: A.title });
    expect(within(dialog).getByText(A.locked.title)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'מעבר ל-Pro' }).getAttribute('href')).toBe(
      '/app/billing?plan=pro',
    );
    expect(calledWith('/ai')).toEqual([]);
  });

  it('speaks English', async () => {
    handlers['/ai'] = () => ({ body: { ok: true, summary: 'A caterer worth a call', steps: [] } });
    mount([note], {}, 'en');
    open(screen.getByRole('button', { name: 'Idea actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Summarize and suggest steps' }));
    const dialog = await screen.findByRole('dialog', { name: 'Summarize and suggest steps' });
    expect(await within(dialog).findByText('A caterer worth a call')).toBeTruthy();
    expect(calledWith('/ai')[0]).toMatchObject({ locale: 'en' });
  });
});
