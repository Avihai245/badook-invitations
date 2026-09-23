import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// P2 host-app functions (supabase/migrations/*_host_app.sql): owner scoping, autosave conflicts,
// slugs, versions, duplicate/archive — on a fresh database (shim → migrations → seed).

const OWNER_A = '33333333-3333-4333-8333-333333333333';
const OWNER_B = '44444444-4444-4444-8444-444444444444';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let doc: Record<string, unknown>;

/** Calls a function as service_role (how the server routes call them) and returns its jsonb result. */
async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}

/** Same, but committed (fixtures that later calls must see). */
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')`, [
    OWNER_A,
    OWNER_B,
  ]);
  doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('create_invitation', () => {
  it('creates a draft; a taken slug gets the first free -n suffix; share.slug and templateId follow the row', async () => {
    const first = await commit<{ id: string; slug: string }>('create_invitation', [
      OWNER_A,
      'sahar-bordeaux',
      'wedding',
      'noa-and-itay',
      { ...doc, templateId: 'papercut-gold' },
    ]);
    expect(first.slug).toBe('noa-and-itay-2'); // noa-and-itay is the seeded demo
    const second = await commit<{ slug: string }>('create_invitation', [
      OWNER_A,
      'sahar-bordeaux',
      'wedding',
      'noa-and-itay',
      doc,
    ]);
    expect(second.slug).toBe('noa-and-itay-3');
    const row = (
      await c.query(`select status, version, draft, published from invitations where id = $1`, [first.id])
    ).rows[0];
    expect(row).toMatchObject({ status: 'draft', version: 0, published: null });
    expect(row.draft.share.slug).toBe('noa-and-itay-2');
    expect(row.draft.templateId).toBe('sahar-bordeaux');
  });

  it('long slugs keep the suffix within 60 characters', async () => {
    const long = 'a'.repeat(60);
    await commit('create_invitation', [OWNER_B, 'atara', 'bar_mitzvah', long, doc]);
    const next = await call<{ slug: string }>('create_invitation', [
      OWNER_B,
      'atara',
      'bar_mitzvah',
      long,
      doc,
    ]);
    expect(next.slug).toBe(`${'a'.repeat(58)}-2`);
  });

  it('after -9 a popular slug gets a random 4-character suffix', async () => {
    const slugs = await as(c, 'service_role', null, async () => {
      const out: string[] = [];
      for (let i = 0; i < 11; i++)
        out.push(
          (
            await c.query(`select public.create_invitation($1, 'atara', 'bar_mitzvah', 'popular', $2) as r`, [
              OWNER_B,
              doc,
            ])
          ).rows[0].r.slug,
        );
      return out;
    });
    expect(slugs.slice(0, 9)).toEqual(['popular', ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `popular-${n}`)]);
    for (const s of slugs.slice(9)) expect(s).toMatch(/^popular-[0-9a-f]{4}$/);
    expect(new Set(slugs).size).toBe(11);
  });

  it('is not callable by anon or signed-in users directly', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, OWNER_A, () =>
          c.query(`select public.create_invitation($1, 'atara', 'bar_mitzvah', 'sneaky', $2)`, [
            OWNER_A,
            doc,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe('owner_invitations / owner_invitation', () => {
  it('lists only the owner’s invitations, newest first, with card fields and response counts', async () => {
    const list = await call<Record<string, unknown>[]>('owner_invitations', [OWNER_A]);
    expect(list.map((i) => i.slug)).toEqual(['noa-and-itay-3', 'noa-and-itay-2']);
    expect(list[0]).toMatchObject({
      status: 'draft',
      templateId: 'sahar-bordeaux',
      date: '2027-06-17',
      responses: 0,
      attending: 0,
      unpublishedChanges: false,
    });
    expect(list[0]).not.toHaveProperty('draft');
    expect(await call('owner_invitations', ['55555555-5555-4555-8555-555555555555'])).toEqual([]);
  });

  it('counts responses and attending heads', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-2'`)).rows[0].id;
    const counts = await as(c, 'service_role', null, async () => {
      await c.query(
        `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash)
         values ($1, true, 'he', 'A', 2, 1, 'x'), ($1, false, 'he', 'B', 0, 0, 'y')`,
        [id],
      );
      const rows = (await c.query(`select public.owner_invitations($1) as r`, [OWNER_A])).rows[0].r;
      return rows.find((r: { id: string }) => r.id === id);
    });
    expect(counts).toMatchObject({ responses: 2, attending: 3 });
  });

  it('owner_invitation returns the draft and updatedAt to the owner, null to anyone else', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-2'`)).rows[0].id;
    const mine = await call<Record<string, unknown>>('owner_invitation', [id, OWNER_A]);
    expect(mine).toMatchObject({ id, slug: 'noa-and-itay-2', status: 'draft', version: 0, published: null });
    expect(typeof mine.updatedAt).toBe('string');
    expect(await call('owner_invitation', [id, OWNER_B])).toBeNull();
  });
});

describe('save_invitation_draft', () => {
  it('saves when updatedAt matches, reports a conflict when it does not, null for another owner', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-3'`)).rows[0].id;
    const { updatedAt } = await commit<{ updatedAt: string }>('owner_invitation', [id, OWNER_A]);
    const edited = { ...doc, eventType: 'engagement', share: { ...(doc.share as object), slug: 'hijack' } };
    const ok = await commit<{ ok: boolean; updatedAt: string }>('save_invitation_draft', [
      id,
      OWNER_A,
      edited,
      updatedAt,
    ]);
    expect(ok.ok).toBe(true);
    expect(ok.updatedAt).not.toBe(updatedAt);
    const row = (await c.query(`select event_type, draft from invitations where id = $1`, [id])).rows[0];
    expect(row.event_type).toBe('engagement');
    expect(row.draft.share.slug).toBe('noa-and-itay-3'); // the slug only changes through set_invitation_slug

    const stale = await call<Record<string, unknown>>('save_invitation_draft', [id, OWNER_A, doc, updatedAt]);
    expect(stale).toMatchObject({ ok: false, code: 'conflict', updatedAt: ok.updatedAt });
    expect((stale.draft as { eventType: string }).eventType).toBe('engagement');

    expect(await call('save_invitation_draft', [id, OWNER_B, doc, ok.updatedAt])).toBeNull();
  });
});

describe('slugs', () => {
  it('slug_available checks format and uniqueness (the invitation’s own slug counts as free)', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-3'`)).rows[0].id;
    expect(await call('slug_available', ['noa-and-itay', null])).toBe(false);
    expect(await call('slug_available', ['noa-and-itay-3', id])).toBe(true);
    expect(await call('slug_available', ['Bad Slug', null])).toBe(false);
    expect(await call('slug_available', ['free-slug-123', null])).toBe(true);
  });

  it('set_invitation_slug updates the row and the draft; taken / invalid are reported', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-3'`)).rows[0].id;
    expect(await call('set_invitation_slug', [id, OWNER_A, 'noa-and-itay'])).toEqual({
      ok: false,
      code: 'taken',
    });
    expect(await call('set_invitation_slug', [id, OWNER_A, 'NO'])).toEqual({ ok: false, code: 'invalid' });
    expect(await call('set_invitation_slug', [id, OWNER_B, 'noa-itay-wedding'])).toBeNull();
    const draftSlug = await as(c, 'service_role', null, async () => {
      const r = (
        await c.query(`select public.set_invitation_slug($1, $2, 'noa-itay-wedding') as r`, [id, OWNER_A])
      ).rows[0].r;
      expect(r).toMatchObject({ ok: true, slug: 'noa-itay-wedding' });
      return (await c.query(`select draft->'share'->>'slug' s from invitations where id = $1`, [id])).rows[0]
        .s;
    });
    expect(draftSlug).toBe('noa-itay-wedding');
  });
});

describe('publish, versions, restore', () => {
  it('publish reports updatedAt; versions are listed newest first and readable by the owner only', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-2'`)).rows[0].id;
    const v1 = await commit<Record<string, unknown>>('publish_invitation', [id, OWNER_A]);
    expect(v1).toMatchObject({ slug: 'noa-and-itay-2', version: 1 });
    expect(typeof v1.updatedAt).toBe('string');
    await commit('publish_invitation', [id, OWNER_A]);
    const versions = await call<{ version: number }[]>('owner_invitation_versions', [id, OWNER_A]);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(await call('owner_invitation_versions', [id, OWNER_B])).toEqual([]);
    const v = await call<{ templateId: string }>('owner_invitation_version', [id, OWNER_A, 1]);
    expect(v.templateId).toBe('sahar-bordeaux');
    expect(await call('owner_invitation_version', [id, OWNER_B, 1])).toBeNull();
    // the public page now serves it
    const pub = await as(
      c,
      'anon',
      null,
      async () => (await c.query(`select public.get_published_invitation('noa-and-itay-2') as r`)).rows[0].r,
    );
    expect(pub.slug).toBe('noa-and-itay-2');
  });

  it('a published invitation with a newer draft shows unpublishedChanges in the list', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-2'`)).rows[0].id;
    const unchanged = (
      await call<{ id: string; unpublishedChanges: boolean }[]>('owner_invitations', [OWNER_A])
    ).find((i) => i.id === id);
    expect(unchanged?.unpublishedChanges).toBe(false);
    const changed = await as(c, 'service_role', null, async () => {
      await c.query(
        `update invitations set draft = jsonb_set(draft, '{event,startTime}', '"20:00"') where id = $1`,
        [id],
      );
      const rows = (await c.query(`select public.owner_invitations($1) as r`, [OWNER_A])).rows[0].r;
      return rows.find((i: { id: string }) => i.id === id);
    });
    expect(changed.unpublishedChanges).toBe(true);
  });
});

describe('duplicate / archive', () => {
  it('duplicates the draft as a new unpublished invitation with a -copy slug', async () => {
    const id = (await c.query(`select id from invitations where slug = 'noa-and-itay-2'`)).rows[0].id;
    const copy = await commit<{ id: string; slug: string }>('duplicate_invitation', [id, OWNER_A]);
    expect(copy.slug).toBe('noa-and-itay-2-copy');
    const again = await call<{ slug: string }>('duplicate_invitation', [id, OWNER_A]);
    expect(again.slug).toBe('noa-and-itay-2-copy-2');
    const row = (
      await c.query(`select status, version, published, owner_id from invitations where id = $1`, [copy.id])
    ).rows[0];
    expect(row).toMatchObject({ status: 'draft', version: 0, published: null, owner_id: OWNER_A });
    expect(await call('duplicate_invitation', [id, OWNER_B])).toBeNull();
  });

  it('archiving stops the public page; unarchiving restores the right status', async () => {
    const pubId = (await c.query(`select id from invitations where slug = 'noa-and-itay-2'`)).rows[0].id;
    const draftId = (await c.query(`select id from invitations where slug = 'noa-and-itay-2-copy'`)).rows[0]
      .id;
    await as(c, 'service_role', null, async () => {
      expect(
        (await c.query(`select public.set_invitation_archived($1, $2, true) as r`, [pubId, OWNER_A])).rows[0]
          .r,
      ).toMatchObject({ status: 'archived' });
      expect(
        (await c.query(`select public.get_published_invitation('noa-and-itay-2') as r`)).rows[0].r,
      ).toBeNull();
      expect(
        (await c.query(`select public.set_invitation_archived($1, $2, false) as r`, [pubId, OWNER_A])).rows[0]
          .r,
      ).toMatchObject({ status: 'published' });
      await c.query(`select public.set_invitation_archived($1, $2, true)`, [draftId, OWNER_A]);
      expect(
        (await c.query(`select public.set_invitation_archived($1, $2, false) as r`, [draftId, OWNER_A]))
          .rows[0].r,
      ).toMatchObject({ status: 'draft' });
      expect(
        (await c.query(`select public.set_invitation_archived($1, $2, true) as r`, [pubId, OWNER_B])).rows[0]
          .r,
      ).toBeNull();
    });
  });
});

describe('save-the-date → its full invitation (source_id)', () => {
  const std = { ...(null as unknown as Record<string, unknown>) };
  let stdId = '';

  it('only the owner’s own save-the-date can be the source; the full invitation remembers it', async () => {
    Object.assign(std, { ...doc, eventType: 'save_the_date' });
    stdId = (
      await commit<{ id: string }>('create_invitation', [
        OWNER_A,
        'sahar-bordeaux',
        'save_the_date',
        'fu-std',
        std,
      ])
    ).id;
    const wedding = await commit<{ id: string }>('create_invitation', [
      OWNER_A,
      'sahar-bordeaux',
      'wedding',
      'fu-wedding',
      doc,
    ]);
    await expect(
      call('create_invitation', [OWNER_A, 'sahar-bordeaux', 'wedding', 'fu-x', doc, wedding.id]),
    ).rejects.toThrow(/source/);
    await expect(
      call('create_invitation', [OWNER_B, 'sahar-bordeaux', 'wedding', 'fu-y', doc, stdId]),
    ).rejects.toThrow(/source/);
    const full = await commit<{ id: string }>('create_invitation', [
      OWNER_A,
      'sahar-bordeaux',
      'wedding',
      'fu-full',
      doc,
      stdId,
    ]);
    expect(
      (await call<{ sourceSlug: string | null }>('owner_invitation', [full.id, OWNER_A])).sourceSlug,
    ).toBe('fu-std');
    expect(
      (await call<{ sourceSlug: string | null }>('owner_invitation', [stdId, OWNER_A])).sourceSlug,
    ).toBeNull();
  });

  it('the public save-the-date links to its latest published full invitation — never a draft or an archived one', async () => {
    const publicView = (slug: string) =>
      as(
        c,
        'anon',
        null,
        async () => (await c.query(`select public.get_published_invitation($1) as r`, [slug])).rows[0].r,
      );
    await commit('publish_invitation', [stdId, OWNER_A]);
    expect((await publicView('fu-std')).followUp).toBeNull(); // fu-full is still a draft

    const full = (await c.query(`select id from invitations where slug = 'fu-full'`)).rows[0].id as string;
    const second = (
      await commit<{ id: string }>('create_invitation', [
        OWNER_A,
        'sahar-bordeaux',
        'engagement',
        'fu-second',
        doc,
        stdId,
      ])
    ).id;
    await commit('publish_invitation', [full, OWNER_A]);
    expect((await publicView('fu-std')).followUp).toEqual({ slug: 'fu-full', locales: doc.locales });
    await commit('publish_invitation', [second, OWNER_A]);
    expect((await publicView('fu-std')).followUp.slug).toBe('fu-second');
    await commit('set_invitation_archived', [second, OWNER_A, true]);
    expect((await publicView('fu-std')).followUp.slug).toBe('fu-full');
    await commit('set_invitation_archived', [full, OWNER_A, true]);
    expect((await publicView('fu-std')).followUp).toBeNull();
    // a published invitation that isn't anyone's save-the-date has no follow-up
    expect((await publicView('noa-and-itay')).followUp).toBeNull();
  });

  it('nobody can attach their invitation to someone else’s save-the-date (direct writes included)', async () => {
    const hijack = (sql: string, params: unknown[]) =>
      as(c, 'authenticated', OWNER_B, () => c.query(sql, params));
    await expect(
      hijack(
        `insert into invitations (owner_id, template_id, slug, status, event_type, draft, published, source_id)
         values ($1, 'sahar-bordeaux', 'fu-hijack', 'published', 'wedding', $2, $2, $3)`,
        [OWNER_B, doc, stdId],
      ),
    ).rejects.toThrow(/source_id/);
    const own = (await c.query(`select id from invitations where owner_id = $1 limit 1`, [OWNER_B])).rows[0]
      .id;
    await expect(hijack(`update invitations set source_id = $1 where id = $2`, [stdId, own])).rejects.toThrow(
      /source_id/,
    );
  });
});
