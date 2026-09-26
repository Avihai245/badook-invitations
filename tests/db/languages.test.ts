import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Seven languages (supabase/migrations/*_guest_languages.sql and *_translations.sql): a language per
// guest — typed, imported, on the personal link and the WhatsApp claim — and the machine
// translations with their review, glossary and rate limit. Owner checks everywhere; nothing for
// visitors or signed-in users directly.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let slug: string;

async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
let tokens = 0;
const token = () => `lang${String(++tokens).padStart(4, '0')}-abcdefghijklmnop`;
const row = (name: string, phone: string | null, language: string | null) => ({
  name,
  phone,
  email: null,
  partySize: null,
  group: null,
  language,
  token: token(),
});
type Guest = { id: string; name: string; token: string; language: string | null };
const guests = () => call<Guest[]>('owner_guests', [inv, OWNER]);
const byName = async (name: string) => (await guests()).find((g) => g.name === name)!;
const hash = (n: number) => n.toString(16).padStart(32, '0');

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'langs@example.com'), ($2, 'other-langs@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  const created = await commit<{ id: string; slug: string }>('create_invitation', [
    OWNER,
    'sahar-bordeaux',
    'wedding',
    'languages',
    doc,
  ]);
  inv = created.id;
  slug = (await c.query(`select slug from invitations where id = $1`, [inv])).rows[0].slug;
  await commit('publish_invitation', [inv, OWNER]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('a language per guest', () => {
  it('imports it, keeps it when a later import leaves the cell empty, and reads it back', async () => {
    const list = [
      row('Olga', '+972501230001', 'ru'),
      row('Samir', '+972501230002', 'ar'),
      row('Dana', null, null),
    ];
    expect(await commit('import_guests', [inv, OWNER, JSON.stringify(list), 500])).toMatchObject({
      added: 3,
    });
    expect((await byName('Olga')).language).toBe('ru');
    expect((await byName('Samir')).language).toBe('ar');
    expect((await byName('Dana')).language).toBeNull();
    // the same people again: an empty cell keeps the language, a new one replaces it
    const again = [row('Olga', '+972501230001', null), row('Samir', '+972501230002', 'en')];
    expect(await commit('import_guests', [inv, OWNER, JSON.stringify(again), 500])).toMatchObject({
      updated: 2,
    });
    expect((await byName('Olga')).language).toBe('ru');
    expect((await byName('Samir')).language).toBe('en');
  });

  it('adds a guest typed by hand with a language', async () => {
    const added = await commit<{ ok: boolean; guest: Guest }>('add_guest', [
      inv,
      OWNER,
      JSON.stringify({ ...row('Marie', '+33612345678', 'fr') }),
      500,
    ]);
    expect(added).toMatchObject({ ok: true, guest: { name: 'Marie', language: 'fr' } });
  });

  it('refuses a code outside the seven', async () => {
    await expect(
      commit('import_guests', [inv, OWNER, JSON.stringify([row('Hans', '+4915112345678', 'de')]), 500]),
    ).rejects.toThrow(/preferred_language/);
    const olga = await byName('Olga');
    await expect(commit('set_guests_language', [inv, OWNER, [olga.id], 'xx'])).rejects.toThrow(
      /preferred_language/,
    );
  });

  it('sets it for several guests at once — only the owner, only changes counted', async () => {
    const [olga, dana] = [await byName('Olga'), await byName('Dana')];
    expect(await commit('set_guests_language', [inv, OTHER, [olga.id], 'am'])).toBeNull();
    expect(await commit('set_guests_language', [inv, OWNER, [olga.id, dana.id], 'am'])).toBe(2);
    expect(await commit('set_guests_language', [inv, OWNER, [olga.id, dana.id], 'am'])).toBe(0);
    expect((await byName('Dana')).language).toBe('am');
    // back to the invitation's default
    expect(await commit('set_guests_language', [inv, OWNER, [dana.id], null])).toBe(1);
    expect((await byName('Dana')).language).toBeNull();
    expect(await commit('set_guests_language', [inv, OWNER, [olga.id], 'ru'])).toBe(1);
  });

  it('the personal link and the WhatsApp claim carry it', async () => {
    const olga = await byName('Olga');
    expect(await commit('guest_open', [slug, olga.token])).toEqual({
      name: 'Olga',
      phone: '+972501230001',
      partySize: null,
      language: 'ru',
    });
    await commit('credits_add', [OWNER, 5, 'admin', 'test']);
    // she opened her link already: sent again only when the host asks for it
    expect(await commit('whatsapp_queue', [inv, OWNER, [olga.id], 0.0353, true])).toMatchObject({
      ok: true,
      queued: 1,
    });
    const claimed = await commit<{ guestName: string; guestLanguage: string | null }[]>('whatsapp_claim', [
      inv,
      10,
    ]);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ guestName: 'Olga', guestLanguage: 'ru' });
  });

  it('visitors and signed-in users can call none of it', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, OWNER, () =>
          c.query(`select public.set_guests_language($1, $2, '{}', 'ru')`, [inv, OWNER]),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe('machine translations and their review', () => {
  const machine = (path: string, text: string, n = 1, locale = 'ru') => ({
    locale,
    path,
    sourceLocale: 'he',
    sourceHash: hash(n),
    text,
    status: 'auto',
  });
  type Row = { id: string; locale: string; path: string; status: string; text: string; sourceHash: string };
  const list = () => call<{ rows: Row[]; glossary: string[] }>('translations_list', [inv, OWNER]);

  it('stores a run — one row per language and text, replacing the current one — for the owner only', async () => {
    expect(await commit('translations_list', [inv, OTHER])).toBeNull();
    expect(await list()).toEqual({ rows: [], glossary: [] });
    const rows = [machine('hosts.parents', 'Родители'), machine('sections.hero.data.eyebrow', 'Приглашаем')];
    expect(await commit('translations_save', [inv, OTHER, JSON.stringify(rows)])).toBeNull();
    expect(await commit('translations_save', [inv, OWNER, JSON.stringify(rows)])).toBe(2);
    expect(
      await commit('translations_save', [
        inv,
        OWNER,
        JSON.stringify([machine('hosts.parents', 'Родители!', 2)]),
      ]),
    ).toBe(1);
    const stored = (await list()).rows;
    expect(stored.map((r) => [r.path, r.text, r.status])).toEqual([
      ['hosts.parents', 'Родители!', 'auto'],
      ['sections.hero.data.eyebrow', 'Приглашаем', 'auto'],
    ]);
    expect(stored[0]!.sourceHash).toBe(hash(2));
  });

  it('records the host’s approval — with the source it was approved against; anything else is a machine run', async () => {
    const approved = (path: string, text: string) => ({ ...machine(path, text, 5), status: 'approved' });
    expect(
      await commit('translations_save', [
        inv,
        OWNER,
        JSON.stringify([
          approved('hosts.parents', 'Родители!'),
          approved('sections.hero.data.eyebrow', 'Приглашаем'),
        ]),
      ]),
    ).toBe(2);
    const rows = (await list()).rows;
    expect(rows.every((r) => r.status === 'approved' && r.sourceHash === hash(5))).toBe(true);
    // a status the table doesn't know is taken as a machine run
    await commit('translations_save', [
      inv,
      OWNER,
      JSON.stringify([{ ...machine('hosts.parents', 'Родители!', 5), status: 'whatever' }]),
    ]);
    expect((await list()).rows[0]!.status).toBe('auto');
  });

  it('marks the ones whose source changed as stale, and discards what no longer applies', async () => {
    const [first] = (await list()).rows;
    expect(await commit('translations_mark_stale', [inv, OWNER, [first!.id]])).toBe(1);
    expect(await commit('translations_mark_stale', [inv, OWNER, [first!.id]])).toBe(0);
    expect((await list()).rows[0]!.status).toBe('stale');
    // a new run over it starts its review again
    await commit('translations_save', [inv, OWNER, JSON.stringify([machine(first!.path, 'Новое', 3)])]);
    expect((await list()).rows[0]).toMatchObject({ status: 'auto', text: 'Новое' });
    // the host's own words, saved from the review, count as approved
    await commit('translations_save', [
      inv,
      OWNER,
      JSON.stringify([{ ...machine(first!.path, 'Мои слова', 3), status: 'approved' }]),
    ]);
    expect((await list()).rows[0]).toMatchObject({ status: 'approved', text: 'Мои слова' });
    expect(await commit('translations_discard', [inv, OWNER, 'ru', [first!.path]])).toBe(1);
    expect((await list()).rows).toHaveLength(1);
    // a discarded path can be translated again
    expect(
      await commit('translations_save', [inv, OWNER, JSON.stringify([machine(first!.path, 'Снова', 4)])]),
    ).toBe(1);
    expect(await commit('translations_discard', [inv, OWNER, 'ru', null])).toBe(2);
    expect((await list()).rows).toEqual([]);
  });

  it('checks every row', async () => {
    const bad = [
      { ...machine('x', 'y'), locale: 'de' },
      { ...machine('x', 'y'), sourceLocale: 'ru' },
      { ...machine('x', 'y'), sourceHash: 'not-a-hash' },
      { ...machine('', 'y') },
      { ...machine('x', 'y'.repeat(4001)) },
    ];
    for (const r of bad)
      await expect(commit('translations_save', [inv, OWNER, JSON.stringify([r])])).rejects.toThrow();
    const many = Array.from({ length: 501 }, (_, i) => machine(`p${i}`, 't'));
    await expect(commit('translations_save', [inv, OWNER, JSON.stringify(many)])).rejects.toThrow(/bad rows/);
  });

  it('keeps a glossary: trimmed, once each, in order, at most 100 terms of 80 characters', async () => {
    expect(await commit('translation_glossary_set', [inv, OTHER, ['Noa']])).toBeNull();
    expect(
      await commit('translation_glossary_set', [inv, OWNER, [' Noa ', 'Itay', 'Noa', '', 'Ahuzat HaGefen']]),
    ).toEqual(['Noa', 'Itay', 'Ahuzat HaGefen']);
    expect((await list()).glossary).toEqual(['Noa', 'Itay', 'Ahuzat HaGefen']);
    await expect(commit('translation_glossary_set', [inv, OWNER, ['x'.repeat(81)]])).rejects.toThrow(
      /too long/,
    );
    const terms = Array.from({ length: 101 }, (_, i) => `term ${i}`);
    await expect(commit('translation_glossary_set', [inv, OWNER, terms])).rejects.toThrow(/too long/);
    expect(await commit('translation_glossary_set', [inv, OWNER, []])).toEqual([]);
  });

  it('limits the runs per owner in a window', async () => {
    expect(await commit('translation_run_begin', [inv, OTHER, 'ru', 2, 3600])).toBeNull();
    expect(await commit('translation_run_begin', [inv, OWNER, 'ru', 2, 3600])).toBe(true);
    expect(await commit('translation_run_begin', [inv, OWNER, 'ar', 2, 3600])).toBe(true);
    expect(await commit('translation_run_begin', [inv, OWNER, 'fr', 2, 3600])).toBe(false);
    // older runs fall out of the window
    await c.query(`update translation_runs set created_at = now() - interval '2 hours' where owner_id = $1`, [
      OWNER,
    ]);
    expect(await commit('translation_run_begin', [inv, OWNER, 'fr', 2, 3600])).toBe(true);
  });

  it('erases every owner’s run records two days after the run (the daily run)', async () => {
    await c.query(`delete from translation_runs`);
    expect(await commit('translation_run_begin', [inv, OWNER, 'ru', 5, 3600])).toBe(true);
    expect(await commit('translation_run_begin', [inv, OWNER, 'ar', 5, 3600])).toBe(true);
    await c.query(
      `update translation_runs set created_at = now() - interval '2 days 1 minute'
       where id = (select min(id) from translation_runs where owner_id = $1)`,
      [OWNER],
    );
    expect(await commit('translation_runs_purge', [])).toBe(1);
    const left = await c.query(`select locale from translation_runs where owner_id = $1`, [OWNER]);
    expect(left.rows).toEqual([{ locale: 'ar' }]);
    expect(await commit('translation_runs_purge', [])).toBe(0);
    for (const role of ['anon', 'authenticated'] as const)
      await expect(
        as(c, role, OWNER, () => c.query(`select public.translation_runs_purge()`)),
      ).rejects.toThrow(/permission denied/);
  });

  it('keeps the tables and functions away from visitors and signed-in users', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const table of ['translations', 'translation_glossaries', 'translation_runs'])
        await expect(as(c, role, OWNER, () => c.query(`select * from public.${table}`))).rejects.toThrow(
          /permission denied/,
        );
      await expect(
        as(c, role, OWNER, () => c.query(`select public.translations_list($1, $2)`, [inv, OWNER])),
      ).rejects.toThrow(/permission denied/);
    }
    const rls = await c.query(
      `select relname, relrowsecurity from pg_class
       where relname in ('translations', 'translation_glossaries', 'translation_runs') order by relname`,
    );
    expect(rls.rows.every((r: { relrowsecurity: boolean }) => r.relrowsecurity)).toBe(true);
  });

  it('goes with its invitation', async () => {
    await commit('translations_save', [inv, OWNER, JSON.stringify([machine('hosts.parents', 'Родители')])]);
    await c.query(`delete from invitations where id = $1`, [inv]);
    expect((await c.query(`select count(*)::int as n from translations`)).rows[0].n).toBe(0);
    expect((await c.query(`select count(*)::int as n from translation_runs`)).rows[0].n).toBe(0);
  });
});
