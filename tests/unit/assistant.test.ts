import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  fieldsFor,
  nextField,
  readyToCreate,
  sanitizeDraft,
  type Draft,
} from '@/features/invitations/assistant/model';
import { answerSchema, systemPrompt } from '@/features/invitations/assistant/prompt';
import { askAssistant, parseAnswer, resetAssistantAiState } from '@/features/invitations/assistant/server/ai';
import { assistantTurn, type AssistantDeps } from '@/features/invitations/assistant/server/api';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { createInvitation, type HostDeps } from '@/features/invitations/server/host-api';
import type { HostDb } from '@/features/invitations/server/host-db';
import { getTemplate, requireTemplate } from '@/features/invitations/templates/registry';

// The AI questionnaire (features/invitations/assistant): the questions that apply, the answers held to
// what the design takes, a turn with and without the AI, and the details on the created invitation.

const USER = { id: '11111111-1111-4111-8111-111111111111' };
const sahar = requireTemplate('sahar-bordeaux').manifest;

describe('the questions', () => {
  it('asks only what applies to the design and the event, in order', () => {
    expect(fieldsFor('sahar-bordeaux', { eventType: 'wedding' })).toEqual([
      'eventType',
      'primary',
      'secondary',
      'date',
      'startTime',
      'venue',
      'style',
      'story',
    ]);
    expect(fieldsFor('atara', { eventType: 'bar_mitzvah' })).toContain('parents');
    expect(fieldsFor('dino-hatch', { eventType: 'birthday' })).toEqual([
      'primary',
      'age',
      'date',
      'startTime',
      'venue',
      'style',
      'story',
    ]);
    // a v2 design without a story section: no personal line asked
    expect(fieldsFor('celestial', { eventType: 'wedding' })).not.toContain('story');
  });

  it('goes on to the next unanswered question; optional ones may be skipped, required ones never', () => {
    const d: Draft = { eventType: 'wedding', primary: 'נועה', secondary: 'איתי' };
    expect(nextField('sahar-bordeaux', d)).toBe('date');
    const timed = { ...d, date: '2027-03-12', startTime: '20:00' };
    expect(readyToCreate('sahar-bordeaux', timed)).toBe(true);
    expect(nextField('sahar-bordeaux', timed)).toBe('venue');
    expect(nextField('sahar-bordeaux', timed, ['venue', 'style'])).toBe('story');
    expect(nextField('sahar-bordeaux', timed, ['venue', 'style', 'story'])).toBeNull();
    expect(nextField('sahar-bordeaux', d, ['date'])).toBe('date');
  });

  it('holds the answers to the design: unknown events, bad dates and other palettes are dropped', () => {
    const d = sanitizeDraft(
      {
        eventType: 'brit',
        primary: '  נועה   כהן  ',
        date: '2027-02-30',
        startTime: '25:00',
        paletteId: 'nope',
        story: 'שורה\n\n\n\nועוד',
      },
      sahar,
    );
    expect(d).toMatchObject({
      eventType: null,
      primary: 'נועה כהן',
      secondary: null,
      date: null,
      startTime: null,
      paletteId: null,
      story: 'שורה\n\nועוד',
    });
    // names within the cover's limit; a single-category design knows its event
    expect(sanitizeDraft({ primary: 'א'.repeat(50) }, sahar).primary).toHaveLength(20);
    expect(sanitizeDraft({}, requireTemplate('dino-hatch').manifest).eventType).toBe('birthday');
    // the second name only for a couple, the age only for a birthday
    expect(
      sanitizeDraft(
        { eventType: 'birthday', secondary: 'x', age: 30 },
        requireTemplate('dino-hatch').manifest,
      ),
    ).toMatchObject({ secondary: null, age: 30 });
  });

  it('tells the model the design’s events and colors and asks for strict JSON', () => {
    const prompt = systemPrompt('Badook', sahar, 'he', 'he');
    expect(prompt).toContain('wedding');
    for (const p of sahar.palettePresets) expect(prompt).toContain(p.id);
    const schema = answerSchema(sahar) as { required: string[] };
    expect(schema.required).toEqual(['draft', 'skip', 'ask', 'reply']);
  });
});

function deps(over: Partial<AssistantDeps> = {}): AssistantDeps {
  return {
    template: getTemplate,
    admin: false,
    rateHit: vi.fn(async () => true),
    rateKey: (scope, value) => `${scope}:${value}`,
    ask: null,
    limits: { perHour: 60, perDay: 120, site: 2000 },
    ...over,
  };
}

const turn = (over: Record<string, unknown> = {}) => ({
  templateId: 'sahar-bordeaux',
  uiLocale: 'he',
  locale: 'he',
  today: '2026-10-04',
  draft: { eventType: 'wedding' },
  skipped: [],
  messages: [{ role: 'user', content: 'נועה ואיתי, 12 במרץ בשמונה בערב' }],
  ...over,
});

describe('a turn', () => {
  it('without the AI: the device asks the next question itself', async () => {
    const r = await assistantTurn(USER, turn(), deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      source: 'script',
      reason: 'no_ai',
      next: 'primary',
      reply: null,
    });
  });

  it('past a limit: the device asks', async () => {
    const ask = vi.fn();
    const r = await assistantTurn(USER, turn(), deps({ ask, rateHit: vi.fn(async () => false) }));
    expect(r.body).toMatchObject({ source: 'script', reason: 'limit' });
    expect(ask).not.toHaveBeenCalled();
  });

  it('with the AI: many details from one message, and the AI’s question when it is the next one', async () => {
    const ask = vi.fn(async () => ({
      status: 'ok' as const,
      answer: {
        draft: {
          eventType: 'wedding',
          primary: 'נועה',
          secondary: 'איתי',
          date: '2027-03-12',
          startTime: '20:00',
          paletteId: 'made-up',
          phone: '050',
        },
        skip: ['date', 'story'],
        ask: 'venue',
        reply: 'מעולה — איפה האירוע?',
      },
    }));
    const r = await assistantTurn(USER, turn(), deps({ ask }));
    expect(r.body).toMatchObject({
      ok: true,
      source: 'ai',
      next: 'venue',
      // no em dash, ever
      reply: 'מעולה, איפה האירוע?',
      draft: { primary: 'נועה', secondary: 'איתי', date: '2027-03-12', startTime: '20:00', paletteId: null },
      // a required field can't be skipped
      skipped: ['story'],
    });
    expect(JSON.stringify(r.body)).not.toContain('050');
  });

  it('keeps what is known when the AI leaves it out, and drops a reply that asks the wrong thing', async () => {
    const ask = vi.fn(async () => ({
      status: 'ok' as const,
      answer: { draft: { primary: null, date: '2027-03-12' }, skip: [], ask: 'style', reply: 'צבעים?' },
    }));
    const r = await assistantTurn(
      USER,
      turn({ draft: { eventType: 'wedding', primary: 'נועה' } }),
      deps({ ask }),
    );
    expect(r.body).toMatchObject({
      draft: { primary: 'נועה', date: '2027-03-12' },
      next: 'secondary',
      reply: null,
    });
  });

  it('the AI failing: the device asks', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ask = vi.fn(async () => ({ status: 'error' as const, error: '500' }));
    const r = await assistantTurn(USER, turn(), deps({ ask }));
    expect(r.body).toMatchObject({ source: 'script', reason: 'error' });
    spy.mockRestore();
  });

  it('refuses unknown designs, languages and shapes', async () => {
    expect((await assistantTurn(USER, turn({ templateId: 'nope' }), deps())).status).toBe(400);
    expect((await assistantTurn(USER, turn({ locale: 'ru' }), deps())).status).toBe(400);
    expect((await assistantTurn(USER, turn({ messages: [] }), deps())).status).toBe(400);
  });
});

describe('the model call', () => {
  it('sends the chat (opening with the host) and reads the JSON answer', async () => {
    resetAssistantAiState();
    const answer = { draft: { primary: 'דנה' }, skip: [], ask: 'date', reply: 'מתי?' };
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }] }), {
          status: 200,
        }),
    );
    const r = await askAssistant(
      {
        manifest: sahar,
        locale: 'he',
        uiLocale: 'he',
        today: '2026-10-04',
        draft: {},
        skipped: [],
        messages: [
          { role: 'assistant', content: 'איזה אירוע?' },
          { role: 'user', content: 'חתונה' },
          { role: 'user', content: 'של דנה' },
        ],
      },
      { apiKey: 'k', model: 'm', apiBase: 'https://ai.test', brand: 'Badook' },
      fetchImpl as unknown as typeof fetch,
    );
    expect(r).toMatchObject({ status: 'ok', answer: { reply: 'מתי?' } });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toContain('חתונה\nשל דנה');
    expect(body.output_config.format.type).toBe('json_schema');
    // current models always think: low effort, and room for the thinking besides the short reply
    expect(body.output_config.effort).toBe('low');
    expect(body.max_tokens).toBeGreaterThanOrEqual(4096);
  });

  it('a model without the effort setting is asked again without it (and still in JSON)', async () => {
    resetAssistantAiState();
    const answer = { draft: {}, skip: [], ask: 'date', reply: 'מתי?' };
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { output_config?: { effort?: string } };
      bodies.push(body);
      return body.output_config?.effort
        ? new Response(
            JSON.stringify({
              type: 'error',
              error: {
                type: 'invalid_request_error',
                message: 'output_config.effort: not supported by this model',
              },
            }),
            { status: 400 },
          )
        : new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }] }), {
            status: 200,
          });
    });
    const input = {
      manifest: sahar,
      locale: 'he' as const,
      uiLocale: 'he' as const,
      today: '2026-10-04',
      draft: {},
      skipped: [],
      messages: [{ role: 'user' as const, content: 'חתונה' }],
    };
    const config = { apiKey: 'k', model: 'm', apiBase: 'https://ai.test', brand: 'Badook' };
    expect(await askAssistant(input, config, fetchImpl as unknown as typeof fetch)).toMatchObject({
      status: 'ok',
    });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ output_config: { format: { type: 'json_schema' } } });
    expect((bodies[1] as { output_config: object }).output_config).not.toHaveProperty('effort');
    // remembered: the next turn asks without it at once
    await askAssistant(input, config, fetchImpl as unknown as typeof fetch);
    expect(bodies).toHaveLength(3);
    expect((bodies[2] as { output_config: object }).output_config).not.toHaveProperty('effort');
  });

  it('parses a JSON answer wrapped in words', () => {
    expect(parseAnswer('here: {"draft":{},"skip":[],"ask":"done","reply":"ok"} thanks')).toMatchObject({
      ask: 'done',
    });
    expect(parseAnswer('no json')).toBeNull();
  });
});

describe('creating from the answers', () => {
  function hostDeps() {
    const create = vi.fn(async (_u: string, _t: string, _e: string, slug: string, _doc: unknown) => ({
      id: 'x',
      slug,
    }));
    return {
      create,
      deps: {
        db: { create } as unknown as HostDb,
        template: getTemplate,
        revalidate: vi.fn(),
        now: () => Date.parse('2026-10-04T10:00:00Z'),
      } satisfies HostDeps,
    };
  }

  it('puts the place on the first venue and the personal line in the story', async () => {
    const { create, deps: d } = hostDeps();
    const r = await createInvitation(
      USER.id,
      {
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-03-12',
        startTime: '20:00',
        timezone: 'Asia/Jerusalem',
        venue: { name: { he: 'גני הדר' }, address: { he: 'ראשון לציון' } },
        story: { he: 'אחרי שבע שנים יחד, אנחנו מתחתנים!' },
      },
      d,
    );
    expect(r.status).toBe(201);
    const doc = create.mock.calls[0]![4] as unknown as InvitationDocument;
    const venues = doc.sections.find((s) => s.type === 'venues');
    expect(venues?.type === 'venues' && venues.data.items[0]).toMatchObject({
      name: { he: 'גני הדר' },
      address: { he: 'ראשון לציון' },
      mapsQuery: 'גני הדר, ראשון לציון',
    });
    const story = doc.sections.find((s) => s.id === 'story');
    expect(story?.type === 'text' && story.data.body).toEqual({ he: 'אחרי שבע שנים יחד, אנחנו מתחתנים!' });
  });

  it('a "where" design gets the place too', async () => {
    const { create, deps: d } = hostDeps();
    await createInvitation(
      USER.id,
      {
        templateId: 'celestial',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-03-12',
        startTime: '20:00',
        timezone: 'Asia/Jerusalem',
        venue: { name: { he: 'גני הדר' }, address: {} },
      },
      d,
    );
    const doc = create.mock.calls[0]![4] as unknown as InvitationDocument;
    const where = doc.sections.find((s) => s.type === 'where');
    expect(where?.type === 'where' && where.data.venue.name).toEqual({ he: 'גני הדר' });
  });
});
