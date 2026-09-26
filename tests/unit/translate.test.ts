import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc: vi.fn() }) }));

import type { Feature } from '@/features/flags/features';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { worldDocument } from '@/features/invitations/dev/longer-demo';
import { moveAt, setAt } from '@/features/invitations/editor/paths';
import { publish, type HostDeps } from '@/features/invitations/server/host-api';
import type { HostDb, OwnerInvitation } from '@/features/invitations/server/host-db';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { getTemplate } from '@/features/invitations/templates/registry';
import {
  checkAnswers,
  parseTranslations,
  resetTranslateState,
  translateTexts,
  type TranslateRequest,
} from '@/features/invitations/translate/ai';
import {
  blockedLocales,
  docPathOf,
  sourceHash,
  stablePath,
  textFields,
  translationState,
  valueAt,
  type TranslationRow,
} from '@/features/invitations/translate/fields';
import {
  approveTranslations,
  listTranslations,
  translateLocale,
  type NewRow,
  type TranslateDeps,
} from '@/features/invitations/translate/server';

const USER = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const AI = { apiKey: 'test-key', model: 'test-model', apiBase: 'https://ai.test' };

/** Hebrew + English + Russian, the Russian texts left empty (what "translate" fills). */
function trilingual(): InvitationDocument {
  const doc = structuredClone(FIXTURES['wedding-he-en']);
  doc.locales = ['he', 'en', 'ru'];
  return doc;
}

/** The document with its Russian written: the machine's "RU <Hebrew>", the names as in English. */
function withRussian(doc: InvitationDocument): InvitationDocument {
  const out = structuredClone(doc);
  for (const f of textFields(out)) {
    const from = f.value.he ?? f.value.en ?? '';
    Object.assign(f.value, { ru: f.name ? (f.value.en ?? from) : `RU ${from.trim()}` });
  }
  return out;
}

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const modelSays = (translations: { id: string; text: string }[], stop = 'end_turn') =>
  answer(200, { content: [{ type: 'text', text: JSON.stringify({ translations }) }], stop_reason: stop });

describe('the texts to translate', () => {
  it('addresses each text by ids, not positions: sections and items can move', () => {
    const doc = worldDocument('sahar-bordeaux');
    const fields = textFields(doc);
    const faq = fields.find((f) => f.field === 'faq.q')!;
    expect(faq.path).toMatch(/^sections\.@[^.]+\.data\.items\.@q1\.q$/);
    expect(docPathOf(doc, faq.path)).toBe(faq.docPath);
    const faqIndex = doc.sections.findIndex((s) => s.type === 'faq');
    const moved = moveAt(doc, 'sections', faqIndex, 1);
    const at = docPathOf(moved, faq.path)!;
    expect(at).not.toBe(faq.docPath);
    expect(valueAt(moved, faq.path)?.en).toBe('Is there parking at the venue?');
    expect(stablePath(moved, at)).toBe(faq.path);
    expect(docPathOf(doc, 'sections.@nope.data.title')).toBeNull();
  });

  it('marks names — never sent to the machine', () => {
    const names = textFields(worldDocument('sahar-bordeaux'))
      .filter((f) => f.name)
      .map((f) => f.field);
    expect(names).toEqual(expect.arrayContaining(['hosts.primary', 'hosts.secondary', 'venue.name']));
    expect(names).not.toContain('hero.eyebrow');
  });

  it('fingerprints a source text the same way everywhere, and any change changes it', () => {
    expect(sourceHash('שלום')).toMatch(/^[0-9a-f]{16}$/);
    expect(sourceHash('שלום')).toBe(sourceHash('שלום'));
    expect(sourceHash('שלום')).not.toBe(sourceHash('שלום!'));
  });
});

describe('where a translation stands', () => {
  const doc = trilingual();
  const eyebrow = textFields(doc).find((f) => f.field === 'hero.eyebrow')!;
  const withRu = setAt(doc, `${eyebrow.docPath}.ru`, 'С радостью приглашаем вас');
  const row = (over: Partial<TranslationRow> = {}): TranslationRow => ({
    id: 'r1',
    locale: 'ru',
    path: eyebrow.path,
    sourceLocale: 'he',
    sourceHash: sourceHash(eyebrow.value.he!.trim()),
    text: 'С радостью приглашаем вас',
    status: 'auto',
    updatedAt: 'x',
    ...over,
  });

  it('machine text waits for the host; approved, it doesn’t; changed by the host, it is theirs', () => {
    expect(translationState(withRu, row())).toBe('machine');
    expect(blockedLocales(withRu, [row()])).toEqual(['ru']);
    expect(translationState(withRu, row({ status: 'approved' }))).toBe('approved');
    expect(blockedLocales(withRu, [row({ status: 'approved' })])).toEqual([]);
    const edited = setAt(withRu, `${eyebrow.docPath}.ru`, 'Мы приглашаем вас');
    expect(translationState(edited, row())).toBe('own');
    expect(blockedLocales(edited, [row()])).toEqual([]);
  });

  it('goes stale when its source changes — even an approved one', () => {
    const changed = setAt(withRu, `${eyebrow.docPath}.he`, 'בשמחה גדולה מאוד');
    expect(translationState(changed, row({ status: 'approved' }))).toBe('stale');
    expect(blockedLocales(changed, [row({ status: 'approved' })])).toEqual(['ru']);
    expect(translationState(withRu, row({ status: 'stale' }))).toBe('stale');
  });

  it('is gone with its language or its text', () => {
    const removed = { ...withRu, locales: ['he', 'en'] as Locale[] };
    expect(translationState(removed, row())).toBe('gone');
    expect(translationState(withRu, row({ path: 'sections.@nope.data.eyebrow' }))).toBe('gone');
    expect(blockedLocales(removed, [row()])).toEqual([]);
  });
});

describe('the machine translation call', () => {
  const request: TranslateRequest = {
    to: 'ru',
    eventType: 'wedding',
    texts: [
      { id: 't1', from: 'he', field: 'hero.eyebrow', text: 'שמחים להזמין אתכם לחתונה של {primary}', max: 40 },
      { id: 't2', from: 'he', field: 'faq.a', text: 'חניה חינם באחוזת הגפן' },
      { id: 't3', from: 'he', field: 'footer.closingLine', text: 'נתראה!' },
    ],
    glossary: ['אחוזת הגפן'],
    names: ['נועה', 'איתי'],
  };

  it('reads the answer as the whole text or the JSON inside it', () => {
    expect(parseTranslations('{"translations":[{"id":"t1","text":"a"}]}')?.get('t1')).toBe('a');
    expect(parseTranslations('Here: {"translations":[{"id":"t1","text":"a"}]} done')?.get('t1')).toBe('a');
    expect(parseTranslations('no json')).toBeNull();
    expect(parseTranslations('{"translations":"nope"}')).toBeNull();
  });

  it('keeps only answers with the original’s placeholders and glossary words', () => {
    const { texts, rejected } = checkAnswers(
      request,
      new Map([
        ['t1', 'Рады пригласить вас на свадьбу'], // lost {primary}
        ['t2', 'Бесплатная парковка в אחוזת הגפן'],
        ['t4', 'never asked'],
      ]),
    );
    expect([...texts]).toEqual([['t2', 'Бесплатная парковка в אחוזת הגפן']]);
    expect(rejected).toEqual(['t1', 't3']);
    // a glossary word translated away is rejected too
    expect(checkAnswers(request, new Map([['t2', 'Бесплатная парковка в Ахузат']])).rejected).toContain('t2');
  });

  it('asks once, with the texts as data and the structured-output format; falls back without it', async () => {
    resetTranslateState();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        answer(400, { error: { type: 'invalid_request_error', message: 'output_config: not supported' } }),
      )
      .mockResolvedValueOnce(
        modelSays([
          { id: 't1', text: 'Рады пригласить вас на свадьбу {primary}' },
          { id: 't2', text: 'Бесплатная парковка: אחוזת הגפן' },
          { id: 't3', text: 'До встречи!' },
        ]),
      );
    const result = await translateTexts(request, AI, fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.texts.get('t3')).toBe('До встречи!');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ai.test/v1/messages');
    const first = JSON.parse(String(init.body));
    expect(first).toMatchObject({ model: 'test-model', output_config: { format: { type: 'json_schema' } } });
    const task = JSON.parse(first.messages[0].content);
    expect(task.to).toMatchObject({ code: 'ru', language: 'Russian' });
    expect(task.keep).toEqual(['אחוזת הגפן', 'נועה', 'איתי']);
    expect(task.texts[0]).toEqual({
      id: 't1',
      from: 'Hebrew',
      field: 'hero.eyebrow',
      max: 40,
      text: 'שמחים להזמין אתכם לחתונה של {primary}',
    });
    expect(
      JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body)).output_config,
    ).toBeUndefined();
    resetTranslateState();
  });

  it('a refusal, a cut-short answer and a busy model are no translation', async () => {
    const refused = vi.fn().mockResolvedValue(answer(200, { content: [], stop_reason: 'refusal' }));
    expect(await translateTexts(request, AI, refused as unknown as typeof fetch)).toEqual({
      status: 'refused',
    });
    const cut = vi.fn().mockResolvedValue(
      answer(200, {
        content: [{ type: 'text', text: '{"translations":[{"id":"t1"' }],
        stop_reason: 'max_tokens',
      }),
    );
    expect(await translateTexts(request, AI, cut as unknown as typeof fetch)).toEqual({
      status: 'error',
      error: 'cut short',
    });
    const busy = vi.fn().mockResolvedValue(answer(401, { error: { type: 'authentication_error' } }));
    expect((await translateTexts(request, AI, busy as unknown as typeof fetch)).status).toBe('error');
    expect(busy).toHaveBeenCalledTimes(1);
  });
});

describe('translating an invitation (server)', () => {
  function deps(doc: InvitationDocument, over: Partial<TranslateDeps> = {}) {
    let stored: TranslationRow[] = [];
    const db = {
      list: vi.fn(async () => ({ rows: stored, glossary: ['אחוזת הגפן'] })),
      save: vi.fn(async (_id: string, _o: string, rows: NewRow[]) => {
        stored = [
          ...stored.filter((s) => !rows.some((r) => r.locale === s.locale && r.path === s.path)),
          ...rows.map((r, i) => ({ ...r, id: `r${stored.length + i}`, updatedAt: 'now' })),
        ];
        return rows.length;
      }),
      markStale: vi.fn(async () => 1),
      discard: vi.fn(async () => 1),
      glossary: vi.fn(async (_i: string, _o: string, terms: string[]) => terms),
      runBegin: vi.fn(async () => true),
    };
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const task = JSON.parse(JSON.parse(String(init.body)).messages[0].content) as {
        texts: { id: string; text: string }[];
      };
      return modelSays(task.texts.map((t) => ({ id: t.id, text: `RU ${t.text}` })));
    });
    const d: TranslateDeps = {
      db,
      draft: vi.fn(async () => doc),
      features: vi.fn(async () => new Set<Feature>(['translate_ai', 'languages'])),
      ai: AI,
      fetch: fetchImpl as unknown as typeof fetch,
      ...over,
    };
    return { d, db, fetchImpl, rows: () => stored };
  }

  it('fills the language’s missing texts — never the names — and records each with its source', async () => {
    const doc = trilingual();
    const { d, db, fetchImpl, rows } = deps(doc);
    const res = await translateLocale(USER, ID, { locale: 'ru' }, d);
    expect(res.status).toBe(200);
    const body = res.body as { texts: { path: string; text: string }[]; rejected: string[] };
    expect(body.texts.length).toBeGreaterThan(5);
    const task = JSON.parse(JSON.parse(String(fetchImpl.mock.calls[0]![1].body)).messages[0].content);
    const sentFields = task.texts.map((t: { field: string }) => t.field);
    expect(sentFields).not.toContain('hosts.primary');
    expect(sentFields).not.toContain('venue.name');
    expect(task.keep).toContain('אחוזת הגפן');
    expect(db.runBegin).toHaveBeenCalledWith(ID, USER, 'ru', 30, 86400);
    const eyebrow = textFields(doc).find((f) => f.field === 'hero.eyebrow')!;
    const saved = rows().find((r) => r.path === eyebrow.path)!;
    expect(saved).toMatchObject({ locale: 'ru', sourceLocale: 'he', status: 'auto' });
    expect(saved.sourceHash).toBe(sourceHash(eyebrow.value.he!.trim()));
    expect(saved.text).toBe(`RU ${eyebrow.value.he!.trim()}`);
  });

  it('refuses without the feature, past the day’s runs, and for a language the invitation doesn’t have', async () => {
    const doc = trilingual();
    const off = deps(doc, { features: vi.fn(async () => new Set<Feature>(['languages'])) });
    expect((await translateLocale(USER, ID, { locale: 'ru' }, off.d)).status).toBe(402);
    const none = deps(doc, { ai: null });
    expect((await translateLocale(USER, ID, { locale: 'ru' }, none.d)).status).toBe(402);
    const limited = deps(doc);
    limited.db.runBegin.mockResolvedValue(false);
    expect((await translateLocale(USER, ID, { locale: 'ru' }, limited.d)).body).toMatchObject({
      code: 'rate_limited',
    });
    expect((await translateLocale(USER, ID, { locale: 'fr' }, deps(doc).d)).status).toBe(400);
    expect((await translateLocale(USER, 'nope', { locale: 'ru' }, deps(doc).d)).status).toBe(404);
  });

  it('lists the translations: a changed source marks them stale, a removed language drops them', async () => {
    const doc = trilingual();
    const { d, db } = deps(doc);
    await translateLocale(USER, ID, { locale: 'ru' }, d);
    const eyebrow = textFields(doc).find((f) => f.field === 'hero.eyebrow')!;
    // the machine's Russian is in the draft; then the host rewrites the Hebrew
    const withRu = setAt(withRussian(doc), `${eyebrow.docPath}.he`, 'טקסט חדש לגמרי');
    d.draft = vi.fn(async () => withRu);
    const listed = (await listTranslations(USER, ID, d)).body as {
      rows: TranslationRow[];
      translate: boolean;
    };
    expect(listed.translate).toBe(true);
    expect(listed.rows.find((r) => r.path === eyebrow.path)?.status).toBe('stale');
    expect(db.markStale).toHaveBeenCalledTimes(1);
    d.draft = vi.fn(async () => ({ ...withRu, locales: ['he', 'en'] as Locale[] }));
    await listTranslations(USER, ID, d);
    expect(db.discard).toHaveBeenCalledWith(ID, USER, 'ru', expect.any(Array));
  });

  it('approves what the saved draft says, against its current source', async () => {
    const doc = trilingual();
    const { d, rows } = deps(doc);
    const res = await translateLocale(USER, ID, { locale: 'ru' }, d);
    const texts = (res.body as { texts: { path: string; text: string }[] }).texts;
    let saved = doc;
    for (const t of texts) saved = setAt(saved, `${docPathOf(saved, t.path)}.ru`, t.text);
    d.draft = vi.fn(async () => saved);
    expect(blockedLocales(saved, rows())).toEqual(['ru']);
    const approved = await approveTranslations(
      USER,
      ID,
      { locale: 'ru', paths: texts.map((t) => t.path) },
      d,
    );
    expect(approved.body).toMatchObject({ ok: true, approved: texts.length });
    expect(blockedLocales(saved, rows())).toEqual([]);
  });
});

describe('publishing waits for the review', () => {
  it('422 translations_unreviewed while a language has machine text; published once approved', async () => {
    const doc = withRussian(trilingual());
    const eyebrow = textFields(doc).find((f) => f.field === 'hero.eyebrow')!;
    const machine: TranslationRow = {
      id: 'r1',
      locale: 'ru',
      path: eyebrow.path,
      sourceLocale: 'he',
      sourceHash: sourceHash(eyebrow.value.he!.trim()),
      text: eyebrow.value.ru!,
      status: 'auto',
      updatedAt: 'x',
    };
    const inv: OwnerInvitation = {
      id: ID,
      slug: doc.share.slug,
      status: 'draft',
      templateId: doc.templateId,
      eventType: doc.eventType,
      draft: doc,
      published: null,
      version: 0,
      publishedAt: null,
      updatedAt: 'u',
      createdAt: 'c',
      sourceSlug: null,
    };
    const db = {
      get: vi.fn(async () => inv),
      publish: vi.fn(async () => ({ slug: inv.slug, version: 1, publishedAt: 'p', updatedAt: 'u' })),
    } as unknown as HostDb;
    const host = (rows: TranslationRow[]): HostDeps => ({
      db,
      template: getTemplate,
      revalidate: vi.fn(),
      now: () => Date.parse('2026-09-23T10:00:00Z'),
      translations: vi.fn(async () => rows),
    });
    expect(await publish(USER, ID, {}, host([machine]))).toEqual({
      status: 422,
      body: { ok: false, code: 'translations_unreviewed', locales: ['ru'] },
    });
    expect((await publish(USER, ID, {}, host([{ ...machine, status: 'approved' }]))).status).toBe(200);
  });
});
