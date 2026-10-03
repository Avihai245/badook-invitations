import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { PlanTask, RawPlanState } from '@/features/planning/model/plan';
import { planToTemplateItems } from '@/features/planning/model/template-items';
import { templateOperation } from '@/features/planning/server/templates';
import type { PlanningDeps } from '@/features/planning/server/types';

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const T = '33333333-3333-4333-8333-333333333333';

const task = (over: Partial<PlanTask>): PlanTask => ({
  id: crypto.randomUUID(),
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
  sort: 1,
  ...over,
});
const cat = (id: string, key: PlanTask['category'], over: Record<string, unknown> = {}) => ({
  id,
  key,
  name: null,
  plannedAmount: 0,
  costBasis: 'fixed' as const,
  unitPrice: null,
  childPrice: null,
  required: false,
  sort: 1,
  ...over,
});

const raw = (over: Partial<RawPlanState> = {}) =>
  ({
    invitation: {
      id: ID,
      slug: 's',
      status: 'draft',
      eventType: 'wedding',
      date: '2027-06-17',
      timezone: 'Asia/Jerusalem',
      rsvpDeadline: null,
    },
    settings: { templateKey: 'wedding', requiredVendors: ['venue', 'catering', 'dj'] },
    tasks: [
      task({ title: 'לסגור אולם', offsetDays: -300, category: 'venue', priority: 1 }),
      task({ title: 'מהתאריך', dueDate: '2027-06-07', offsetDays: null }),
      task({ title: 'מוסתרת', status: 'skipped', offsetDays: -10 }),
      task({ title: null, tplKey: 'book_dj', offsetDays: -200, category: 'dj' }),
      task({ title: null, systemKey: 'invitation_published', offsetDays: -70 }),
      task({ title: 'בלי מקום בלוח' }),
    ],
    categories: [
      cat('c1', 'venue', { required: true }),
      cat('c2', 'catering', { costBasis: 'per_adult' }),
      cat('c3', 'dj'),
    ],
    totals: {
      byCategory: [
        { id: 'c1', planned: 50000, expected: 0, committed: 0, paid: 0 },
        { id: 'c2', planned: 30000, expected: 0, committed: 0, paid: 0 },
        { id: 'c3', planned: 20000, expected: 0, committed: 0, paid: 0 },
      ],
    },
    ...over,
  }) as unknown as RawPlanState;

describe('a plan as a template', () => {
  it('keeps the host’s own tasks in the language they read, with their place on the calendar; not system, hidden or undated ones', () => {
    const items = planToTemplateItems(
      raw(),
      (t) => t.title ?? (t.tplKey === 'book_dj' ? 'Book the DJ' : null),
      () => null,
    );
    expect(items.tasks.map((t) => [t.title, t.offsetDays])).toEqual([
      ['לסגור אולם', -300],
      ['מהתאריך', -10],
      ['Book the DJ', -200],
    ]);
    expect(items.tasks[0]).toMatchObject({ category: 'venue', priority: 1 });
  });

  it('turns the planned amounts into shares that add up to exactly 100, and keeps the required vendors that have a line', () => {
    const items = planToTemplateItems(
      raw(),
      (t) => t.title,
      () => null,
    );
    expect(items.categories.map((c) => [c.key, c.pct])).toEqual([
      ['venue', 50],
      ['catering', 30],
      ['dj', 20],
    ]);
    expect(items.categories.find((c) => c.key === 'catering')!.basis).toBe('per_adult');
    expect(items.requiredVendors).toEqual(['venue', 'catering', 'dj']);
    const odd = planToTemplateItems(
      raw({
        totals: {
          byCategory: [
            { id: 'c1', planned: 1, expected: 0, committed: 0, paid: 0 },
            { id: 'c2', planned: 1, expected: 0, committed: 0, paid: 0 },
            { id: 'c3', planned: 1, expected: 0, committed: 0, paid: 0 },
          ],
        } as never,
      }),
      (t) => t.title,
      () => null,
    );
    expect(odd.categories.reduce((n, c) => n + c.pct, 0)).toBe(100);
    const none = planToTemplateItems(
      raw({ totals: { byCategory: [] } as never }),
      (t) => t.title,
      () => null,
    );
    expect(none.categories.reduce((n, c) => n + c.pct, 0)).toBe(100);
  });
});

describe('the templates route', () => {
  const ALL = new Set<Feature>(FEATURES);
  const input = (plan: 'pro' | 'business'): FeatureInput & { ownerId: string } => ({
    ownerId: OWNER,
    plan,
    admin: false,
    overrides: NO_OVERRIDES,
    available: ALL,
  });
  function deps(plan: 'pro' | 'business' = 'business', results: Record<string, unknown> = {}) {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const d: PlanningDeps = {
      access: async (id) => (id === ID ? input(plan) : null),
      rpc: (async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        if (fn === 'planning_state') return raw();
        return results[fn] ?? null;
      }) as PlanningDeps['rpc'],
      summary: async () => null,
      now: () => 0,
      newId: () => 'x',
    };
    return { d, calls };
  }

  it('is a Business tool', async () => {
    expect((await templateOperation(OWNER, ID, { op: 'list' }, deps('pro').d)).body).toMatchObject({
      code: 'feature_off',
      feature: 'planning_templates',
      package: 'vip',
    });
  });

  it('saves the plan as a template, lists and deletes', async () => {
    const { d, calls } = deps('business', {
      planning_template_save: { id: T, name: 'n', tasks: 3 },
      planning_templates_list: [{ id: T }],
      planning_template_delete: true,
    });
    const saved = await templateOperation(OWNER, ID, { op: 'save', name: ' חתונה בגן ', locale: 'he' }, d);
    expect(saved).toMatchObject({ status: 201, body: { ok: true, template: { id: T } } });
    const call = calls.find((c) => c.fn === 'planning_template_save')!.args as {
      p_name: string;
      p_event_type: string;
      p_items: { tasks: unknown[] };
    };
    expect(call).toMatchObject({ p_name: 'חתונה בגן', p_event_type: 'wedding' });
    expect(call.p_items.tasks.length).toBe(3);
    expect((await templateOperation(OWNER, ID, { op: 'list' }, d)).body).toMatchObject({
      templates: [{ id: T }],
    });
    expect((await templateOperation(OWNER, ID, { op: 'delete', templateId: T }, d)).status).toBe(200);
    expect(
      (
        await templateOperation(
          OWNER,
          ID,
          { op: 'delete', templateId: T },
          deps('business', { planning_template_delete: false }).d,
        )
      ).status,
    ).toBe(404);
  });

  it('refuses the twenty-first, and bad input', async () => {
    const { d } = deps('business', { planning_template_save: { ok: false, code: 'too_many' } });
    expect((await templateOperation(OWNER, ID, { op: 'save', name: 'x' }, d)).body).toMatchObject({
      code: 'too_many',
    });
    for (const body of [
      { op: 'save', name: '' },
      { op: 'save', name: 'x'.repeat(81) },
      { op: 'delete', templateId: 'no' },
      { op: 'nope' },
    ])
      expect((await templateOperation(OWNER, ID, body, d)).status).toBe(400);
    expect(
      (await templateOperation('44444444-4444-4444-8444-444444444444', ID, { op: 'list' }, d)).status,
    ).toBe(404);
  });
});
