import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import { aiOperation } from '@/features/planning/server/ai-api';
import { planningAi, resetPlanningAiState, tidyDraft, tidySteps } from '@/features/planning/server/ai';
import type { PlanningAi, PlanningDeps } from '@/features/planning/server/types';

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const IDEA = '55555555-5555-4555-8555-555555555555';

const rawDraft = {
  tasks: [
    { title: ' לסגור מקום ', notes: 'שורה', offsetDays: -90.4, category: 'venue', priority: 1 },
    { title: 'לבחור תפריט', notes: '  ', offsetDays: -60, category: 'not_a_category', priority: 7 },
    { title: '', offsetDays: -1, category: null, priority: 0 },
    { title: 'בלי יום', category: null },
    { title: 'רחוק מדי', offsetDays: -9999, category: null, priority: 0 },
  ],
  categories: [
    { key: 'venue', name: null, pct: 30, basis: 'fixed', required: true },
    { key: 'catering', name: null, pct: 50, basis: 'per_guest', required: true },
    { key: 'catering', name: null, pct: 5, basis: 'fixed', required: false },
    { key: 'made_up', name: null, pct: 20, basis: 'fixed', required: false },
    { key: 'other', name: null, pct: 20, basis: 'weird', required: false },
  ],
  requiredVendors: ['venue', 'catering', 'dj', 'made_up'],
};

describe('tidying the model’s plan', () => {
  it('drops what is unknown, clamps the offsets, and makes the shares add up to exactly 100', () => {
    const d = tidyDraft(rawDraft)!;
    expect(d.tasks.map((t) => t.title)).toEqual(['לסגור מקום', 'לבחור תפריט', 'רחוק מדי']);
    expect(d.tasks[0]).toMatchObject({ offsetDays: -90, category: 'venue', priority: 1, notes: 'שורה' });
    expect(d.tasks[1]).toMatchObject({ category: null, priority: 0, notes: null });
    expect(d.tasks[2]!.offsetDays).toBe(-400);
    expect(d.categories.map((c) => c.key)).toEqual(['venue', 'catering', 'other']);
    expect(d.categories.reduce((n, c) => n + c.pct, 0)).toBe(100);
    expect(d.categories.find((c) => c.key === 'other')!.basis).toBe('fixed');
    // required vendors that have a budget line only
    expect(d.requiredVendors).toEqual(['venue', 'catering']);
  });

  it('nothing usable is nothing', () => {
    expect(tidyDraft(null)).toBeNull();
    expect(tidyDraft({ tasks: [] })).toBeNull();
    expect(tidyDraft({ tasks: [{ title: 'x' }] })).toBeNull();
    expect(tidyDraft('text')).toBeNull();
  });

  it('keeps at most forty tasks', () => {
    const many = {
      tasks: Array.from({ length: 60 }, (_, i) => ({
        title: `t${i}`,
        offsetDays: -i,
        category: null,
        priority: 0,
      })),
      categories: [],
      requiredVendors: [],
    };
    expect(tidyDraft(many)!.tasks.length).toBe(40);
  });

  it('tidies an idea’s steps', () => {
    expect(
      tidySteps({
        summary: ' סיכום ',
        steps: [{ title: ' א ', category: 'dj' }, { title: '' }, { title: 'ב', category: 'x' }],
      }),
    ).toEqual({
      summary: 'סיכום',
      steps: [
        { title: 'א', category: 'dj' },
        { title: 'ב', category: null },
      ],
    });
    expect(tidySteps({ summary: '', steps: [{ title: 'א' }] })).toBeNull();
    expect(tidySteps({ summary: 'x', steps: [] })).toBeNull();
  });
});

const config = { apiKey: 'k', model: 'm', apiBase: 'https://ai.example' };
const reply = (text: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', ...extra }), {
    status: 200,
  });

describe('asking the model', () => {
  beforeEach(() => resetPlanningAiState());
  const input = {
    description: 'מסיבת פרישה',
    locale: 'he' as const,
    today: '2027-01-01',
    eventDate: '2027-03-01',
  };

  it('sends the description as data, asks for structured output, and tidies the answer', async () => {
    const fetchMock = vi.fn(async () => reply(JSON.stringify(rawDraft)));
    const res = await planningAi(config, fetchMock as never)!.draftPlan(input);
    expect(res.status).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://ai.example/v1/messages');
    expect(init.headers['x-api-key']).toBe('k');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('m');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(JSON.parse(body.messages[0].content)).toMatchObject({
      language: 'Hebrew',
      description: 'מסיבת פרישה',
      daysLeft: 59,
    });
  });

  it('a model without structured output is asked again without it, and the answer may carry text around the JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { type: 'invalid_request_error', message: 'output_config is not supported' },
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(reply(`Here you go:\n${JSON.stringify(rawDraft)}\nEnjoy`));
    const res = await planningAi(config, fetchMock as never)!.draftPlan(input);
    expect(res.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse((fetchMock.mock.calls[1] as unknown as [string, { body: string }])[1].body).output_config,
    ).toBeUndefined();
  });

  it('reports a refusal, a failure and an unusable answer', async () => {
    const ai = (f: typeof fetch) => planningAi(config, f)!;
    expect(await ai((async () => reply('{}', { stop_reason: 'refusal' })) as never).draftPlan(input)).toEqual(
      { status: 'refused' },
    );
    expect(
      (await ai((async () => new Response('{}', { status: 401 })) as never).draftPlan(input)).status,
    ).toBe('error');
    expect((await ai((async () => reply('not json')) as never).draftPlan(input)).status).toBe('error');
    expect((await ai((async () => reply('{"tasks":[]}')) as never).draftPlan(input)).status).toBe('error');
    expect(planningAi(null)).toBeNull();
  });

  it('summarizes an idea', async () => {
    const res = await planningAi(config, (async () =>
      reply(
        JSON.stringify({ summary: 'סיכום', steps: [{ title: 'לשאול מחיר', category: 'dj' }] }),
      )) as never)!.summarizeIdea({ text: 'DJ נחמד', locale: 'he' });
    expect(res).toEqual({ status: 'ok', summary: 'סיכום', steps: [{ title: 'לשאול מחיר', category: 'dj' }] });
  });
});

describe('the AI route', () => {
  const ALL = new Set<Feature>(FEATURES);
  const input = (plan: 'free' | 'pro' = 'pro'): FeatureInput & { ownerId: string } => ({
    ownerId: OWNER,
    plan,
    admin: false,
    overrides: NO_OVERRIDES,
    available: ALL,
  });
  const state = {
    invitation: {
      id: ID,
      slug: 's',
      status: 'draft',
      eventType: 'other',
      date: '2027-03-01',
      timezone: 'Asia/Jerusalem',
      rsvpDeadline: null,
    },
    settings: null,
    ideas: [{ id: IDEA, title: 'DJ', body: 'מומלץ', url: null, items: [{ text: 'להתקשר', done: false }] }],
  };
  function deps(over: { plan?: 'free' | 'pro'; ai?: PlanningAi | null; hits?: boolean[] } = {}) {
    const ai: PlanningAi = {
      draftPlan: vi.fn(async () => ({
        status: 'ok' as const,
        draft: { tasks: [], categories: [], requiredVendors: [] },
      })),
      summarizeIdea: vi.fn(async () => ({
        status: 'ok' as const,
        summary: 's',
        steps: [{ title: 't', category: null }],
      })),
    };
    const hits = over.hits ?? [true, true];
    const d: PlanningDeps = {
      access: async (id) => (id === ID ? input(over.plan) : null),
      rpc: (async (fn: string) => (fn === 'planning_state' ? state : null)) as PlanningDeps['rpc'],
      summary: async () => null,
      now: () => Date.parse('2027-01-01T09:00:00Z'),
      newId: () => 'x',
      ai: over.ai === undefined ? ai : over.ai,
      rateHit: vi.fn(async () => hits.shift() ?? true),
      rateKey: (scope, value) => `${scope}:${value}`,
      aiLimits: { perAccount: 10, site: 2000 },
    };
    return { d, ai };
  }

  it('is a Pro tool, for the owner only', async () => {
    expect(
      (await aiOperation(OWNER, ID, { kind: 'plan', description: 'מסיבת פרישה' }, deps({ plan: 'free' }).d))
        .body,
    ).toMatchObject({ code: 'feature_off', feature: 'planning_ai', package: 'premium' });
    expect(
      (
        await aiOperation(
          '33333333-3333-4333-8333-333333333333',
          ID,
          { kind: 'plan', description: 'מסיבת פרישה' },
          deps().d,
        )
      ).status,
    ).toBe(404);
  });

  it('drafts a plan from the description, the event’s date and today', async () => {
    const { d, ai } = deps();
    const res = await aiOperation(
      OWNER,
      ID,
      { kind: 'plan', description: 'מסיבת פרישה לשלושים עובדים', locale: 'en' },
      d,
    );
    expect(res).toMatchObject({ status: 200, body: { ok: true, draft: { tasks: [] } } });
    expect(ai.draftPlan).toHaveBeenCalledWith({
      description: 'מסיבת פרישה לשלושים עובדים',
      locale: 'en',
      today: '2027-01-01',
      eventDate: '2027-03-01',
    });
  });

  it('suggests steps for a card of this event only', async () => {
    const { d, ai } = deps();
    const res = await aiOperation(OWNER, ID, { kind: 'idea', ideaId: IDEA }, d);
    expect(res.body).toMatchObject({ ok: true, summary: 's', steps: [{ title: 't' }] });
    expect(ai.summarizeIdea).toHaveBeenCalledWith({ text: 'DJ\nמומלץ\nלהתקשר', locale: 'he' });
    expect(
      (
        await aiOperation(
          OWNER,
          ID,
          { kind: 'idea', ideaId: '66666666-6666-4666-8666-666666666666' },
          deps().d,
        )
      ).status,
    ).toBe(404);
  });

  it('answers 503 without a model, 429 past either daily cap, and maps the model’s failures', async () => {
    const body = { kind: 'plan', description: 'מסיבת פרישה' };
    expect((await aiOperation(OWNER, ID, body, deps({ ai: null }).d)).status).toBe(503);
    expect((await aiOperation(OWNER, ID, body, deps({ hits: [false, true] }).d)).status).toBe(429);
    expect((await aiOperation(OWNER, ID, body, deps({ hits: [true, false] }).d)).status).toBe(429);
    const refused = deps();
    (refused.ai.draftPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'refused' });
    expect((await aiOperation(OWNER, ID, body, refused.d)).status).toBe(422);
    const broken = deps();
    (broken.ai.draftPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'error', error: 'x' });
    expect((await aiOperation(OWNER, ID, body, broken.d)).status).toBe(502);
  });

  it('rejects a description that is too short or too long, and an unknown kind', async () => {
    const d = deps().d;
    for (const b of [
      { kind: 'plan', description: 'קצר' },
      { kind: 'plan', description: 'x'.repeat(601) },
      { kind: 'x' },
      { kind: 'plan', description: 'מסיבת פרישה', extra: 1 },
    ])
      expect((await aiOperation(OWNER, ID, b, d)).status).toBe(400);
  });
});
