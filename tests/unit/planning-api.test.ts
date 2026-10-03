import { describe, expect, it, vi } from 'vitest';
import { NO_OVERRIDES, FEATURES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { RawPlanState } from '@/features/planning/model/plan';
import {
  loadPlan,
  planOperation,
  savePlanSettings,
  taskOperation,
  applyDates,
} from '@/features/planning/server/api';
import type { PlanSummary, PlanningDeps } from '@/features/planning/server/types';

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
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
  settings: null,
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

function deps(
  over: Partial<{
    state: RawPlanState | null;
    input: ReturnType<typeof input> | null;
    summary: PlanSummary | null;
  }> = {},
) {
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
      over.summary === undefined
        ? {
            eventType: 'wedding',
            status: 'published',
            unpublishedChanges: false,
            guests: 80,
            sent: 80,
            responses: 4,
          }
        : over.summary,
    now: () => NOW,
    newId: () => 'new-id',
  };
  return d;
}
const last = (d: ReturnType<typeof deps>, fn: string) => d.calls.filter((c) => c.fn === fn).at(-1)!;

describe('who may open the plan', () => {
  it('only the owner, only an event that has the planning feature, and never a save-the-date', async () => {
    expect((await loadPlan(OWNER, 'nope', deps())).status).toBe(404);
    expect((await loadPlan(STRANGER, ID, deps())).status).toBe(404);
    expect((await loadPlan(OWNER, ID, deps({ input: null }))).status).toBe(404);
    const off = await loadPlan(
      OWNER,
      ID,
      deps({ input: input({ overrides: { off: ['planning'], grant: [] } }) }),
    );
    expect(off).toMatchObject({
      status: 403,
      body: { code: 'feature_off', feature: 'planning', reason: 'switched_off' },
    });
    // not offered by this deployment at all: the section does not exist
    const missing = await loadPlan(
      OWNER,
      ID,
      deps({ input: input({ available: new Set(FEATURES.filter((f) => f !== 'planning')) }) }),
    );
    expect(missing.status).toBe(404);
    const std = raw({ invitation: { ...raw().invitation, eventType: 'save_the_date' } });
    expect((await loadPlan(OWNER, ID, deps({ state: std }))).status).toBe(404);
    expect((await loadPlan(OWNER, ID, deps({ state: null }))).status).toBe(404);
  });

  it('shows the plan with the system tasks judged by what the app knows, and what the package offers', async () => {
    const state = raw({
      settings,
      tasks: [
        {
          id: 'a',
          title: null,
          notes: null,
          dueDate: '2027-04-01',
          dueIsManual: false,
          offsetDays: -70,
          status: 'todo',
          category: null,
          priority: 0,
          assignee: null,
          budgetItemId: null,
          vendorId: null,
          systemKey: 'invitation_published',
          tplKey: null,
          suggestHide: false,
          completedAt: null,
          sort: 10,
        },
        {
          id: 'b',
          title: 'x',
          notes: null,
          dueDate: null,
          dueIsManual: false,
          offsetDays: null,
          status: 'todo',
          category: null,
          priority: 0,
          assignee: null,
          budgetItemId: null,
          vendorId: null,
          systemKey: null,
          tplKey: null,
          suggestHide: false,
          completedAt: null,
          sort: 20,
        },
      ],
    });
    const res = await loadPlan(OWNER, ID, deps({ state }));
    expect(res.status).toBe(200);
    const view = res.body.view as {
      today: string;
      tasks: { id: string; derived: boolean | null }[];
      features: Record<string, boolean>;
      dateChanged: boolean;
    };
    expect(view.today).toBe('2026-10-03');
    expect(view.tasks.map((t) => [t.id, t.derived])).toEqual([
      ['a', true],
      ['b', null],
    ]);
    expect(view.features).toMatchObject({ ai: true, export: true, templates: false });
    expect(view.dateChanged).toBe(false);
    const moved = await loadPlan(
      OWNER,
      ID,
      deps({ state: { ...state, invitation: { ...state.invitation, date: '2027-07-01' } } }),
    );
    expect((moved.body.view as { dateChanged: boolean }).dateChanged).toBe(true);
  });
});

describe('making the plan', () => {
  const body = {
    op: 'init',
    template: 'wedding',
    totalBudget: 120000,
    integrationsMode: 'full',
    remindersEmail: false,
  };

  it('stores the template’s tasks and categories with the host’s choices, once', async () => {
    const d = deps();
    d.results.planning_init = { ok: true };
    const res = await planOperation(OWNER, ID, body, d);
    expect(res.status).toBe(201);
    const call = last(d, 'planning_init').args as {
      p_settings: Record<string, unknown>;
      p_tasks: { systemKey: string | null }[];
      p_categories: { key: string }[];
    };
    expect(call.p_settings).toMatchObject({
      templateKey: 'wedding',
      totalBudget: 120000,
      guestBasis: 'invited',
      anchorDate: '2027-06-17',
      onboardingDone: true,
      reminders: { email: false },
      integrations: { mode: 'full', guests: true, seating: true, eventDay: true },
      // the numbers a plan that doesn't follow the guests starts from: the list's
      manualAdults: 80,
      manualChildren: 0,
    });
    expect(call.p_settings.vatPct).toBe(18);
    expect(call.p_tasks.length).toBeGreaterThan(50);
    expect(call.p_tasks.some((t) => t.systemKey === 'seating_done')).toBe(true);
    expect(call.p_categories.some((c) => c.key === 'catering')).toBe(true);
  });

  it('refuses a second plan, another kind of event’s template, a draft without the AI, and unknown keys', async () => {
    expect((await planOperation(OWNER, ID, body, deps({ state: raw({ settings }) }))).status).toBe(409);
    expect((await planOperation(OWNER, ID, { ...body, template: 'brit' }, deps())).status).toBe(400);
    expect((await planOperation(OWNER, ID, { ...body, template: 'nonsense_key' }, deps())).status).toBe(400);
    expect((await planOperation(OWNER, ID, { ...body, extra: 1 }, deps())).status).toBe(400);
    const draft = { tasks: [], categories: [], requiredVendors: [] };
    const free = input({ plan: 'free' });
    expect(
      (await planOperation(OWNER, ID, { ...body, template: 'draft', draft }, deps({ input: free }))).body,
    ).toMatchObject({ code: 'feature_off', feature: 'planning_ai' });
    // 'blank' fits any event; a private template needs the Business plan
    const d = deps();
    d.results.planning_init = { ok: true };
    expect((await planOperation(OWNER, ID, { ...body, template: 'blank' }, d)).status).toBe(201);
    expect(
      (
        await planOperation(
          OWNER,
          ID,
          { ...body, template: 'private:11111111-1111-4111-8111-111111111111' },
          deps(),
        )
      ).body,
    ).toMatchObject({ code: 'feature_off', feature: 'planning_templates' });
  });

  it('an event with no date cannot be planned yet, and the database’s refusal is passed on', async () => {
    const noDate = raw({ invitation: { ...raw().invitation, date: null } });
    expect((await planOperation(OWNER, ID, body, deps({ state: noDate }))).body).toMatchObject({
      code: 'no_date',
    });
    const d = deps();
    d.results.planning_init = { ok: false, code: 'exists' };
    expect((await planOperation(OWNER, ID, body, d)).status).toBe(409);
  });
});

describe('the settings', () => {
  it('a mode sets every switch, and the switches given win over it', async () => {
    const d = deps({ state: raw({ settings }) });
    d.results.planning_settings_save = settings;
    const res = await savePlanSettings(
      OWNER,
      ID,
      { integrations: { mode: 'full', seating: false }, totalBudget: 5 },
      d,
    );
    expect(res.status).toBe(200);
    expect(last(d, 'planning_settings_save').args.p_patch).toEqual({
      totalBudget: 5,
      integrations: {
        mode: 'full',
        vendors: true,
        tasks: true,
        guests: true,
        seating: false,
        eventDay: true,
        overview: true,
      },
    });
  });

  it('rejects what is not a setting and what is out of range', async () => {
    const d = deps({ state: raw({ settings }) });
    expect((await savePlanSettings(OWNER, ID, { nope: 1 }, d)).status).toBe(400);
    expect((await savePlanSettings(OWNER, ID, { vatPct: 400 }, d)).status).toBe(400);
    expect((await savePlanSettings(OWNER, ID, { totalBudget: -1 }, d)).status).toBe(400);
    expect((await savePlanSettings(STRANGER, ID, {}, d)).status).toBe(404);
  });
});

describe('when the event’s date changes', () => {
  it('moves only the tasks the host never dated, and not the two that come from data', async () => {
    const t = (id: string, over: Record<string, unknown>) => ({
      id,
      title: 'x',
      notes: null,
      dueDate: '2027-01-01',
      dueIsManual: false,
      offsetDays: -30,
      status: 'todo',
      category: null,
      priority: 0,
      assignee: null,
      budgetItemId: null,
      vendorId: null,
      systemKey: null,
      tplKey: null,
      suggestHide: false,
      completedAt: null,
      sort: 1,
      ...over,
    });
    const state = raw({
      settings: { ...settings, anchorDate: '2027-06-17' },
      invitation: { ...raw().invitation, date: '2027-07-01' },
      tasks: [
        t('moves', {}),
        t('mine', { dueIsManual: true }),
        t('deadline', { systemKey: 'rsvp_deadline' }),
        t('undated', { offsetDays: null }),
      ] as never,
    });
    const d = deps({ state });
    const res = await applyDates(OWNER, ID, d);
    expect(res.status).toBe(200);
    const args = last(d, 'planning_dates_apply').args as {
      p_dates: { id: string; due: string }[];
      p_anchor: string;
    };
    expect(args.p_dates).toEqual([{ id: 'moves', due: '2027-06-01' }]);
    expect(args.p_anchor).toBe('2027-07-01');
    expect((await applyDates(OWNER, ID, deps({ state: raw() }))).status).toBe(409);
  });
});

describe('the tasks', () => {
  const TASK = '44444444-4444-4444-8444-444444444444';

  it('saves one, and answers what the database refuses or does not know', async () => {
    const d = deps();
    d.results.planning_task_save = { id: TASK, title: 'x' };
    const res = await taskOperation(
      OWNER,
      ID,
      { op: 'save', task: { title: 'x', dueDate: '2027-01-01' } },
      d,
    );
    expect(res).toMatchObject({ status: 200, body: { ok: true, task: { id: TASK } } });
    expect(last(d, 'planning_task_save').args).toMatchObject({
      p_id: ID,
      p_owner: OWNER,
      p_task: { title: 'x', dueDate: '2027-01-01' },
    });
    d.results.planning_task_save = { ok: false, code: 'invalid_link' };
    expect((await taskOperation(OWNER, ID, { op: 'save', task: { vendorId: TASK } }, d)).status).toBe(400);
    d.results.planning_task_save = { ok: false, code: 'too_many' };
    expect((await taskOperation(OWNER, ID, { op: 'save', task: { title: 'y' } }, d)).status).toBe(422);
    d.results.planning_task_save = null;
    expect((await taskOperation(OWNER, ID, { op: 'save', task: { title: 'y' } }, d)).status).toBe(404);
  });

  it('deletes, reorders and changes several at once', async () => {
    const d = deps();
    d.results.planning_task_delete = 2;
    d.results.planning_tasks_reorder = 3;
    d.results.planning_tasks_bulk = [{ id: TASK }];
    expect((await taskOperation(OWNER, ID, { op: 'delete', ids: [TASK, TASK] }, d)).body).toMatchObject({
      deleted: 2,
    });
    expect((await taskOperation(OWNER, ID, { op: 'reorder', ids: [TASK] }, d)).body).toMatchObject({
      moved: 3,
    });
    expect(
      (await taskOperation(OWNER, ID, { op: 'bulk', ids: [TASK], patch: { status: 'skipped' } }, d)).body,
    ).toMatchObject({ tasks: [{ id: TASK }] });
  });

  it('rejects malformed input before the database sees it', async () => {
    const d = deps();
    for (const body of [
      { op: 'save', task: { title: '' } },
      { op: 'save', task: { status: 'finished' } },
      { op: 'save', task: { dueDate: 'tomorrow' } },
      { op: 'save', task: { category: 'a_made_up_one' } },
      { op: 'save', task: { id: 'not-a-uuid' } },
      { op: 'delete', ids: [] },
      { op: 'delete', ids: ['x'] },
      { op: 'bulk', ids: [TASK], patch: { title: 'no' } },
      { op: 'launch' },
    ])
      expect((await taskOperation(OWNER, ID, body, d)).status, JSON.stringify(body)).toBe(400);
    expect(d.calls.filter((c) => c.fn.startsWith('planning_task')).length).toBe(0);
    expect((await taskOperation(STRANGER, ID, { op: 'delete', ids: [TASK] }, d)).status).toBe(404);
  });
});
