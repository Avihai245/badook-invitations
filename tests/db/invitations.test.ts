import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_OWNER_ID, demoInvitations } from '../../scripts/seed';
import { TEMPLATES } from '../../src/features/invitations/templates/registry';
import { as, createTestDatabase } from './harness';

// §4 contract + §12.10 RLS tests, on a fresh database (shim → migrations → seed).

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let draftId: string;
let publishedId: string;
let responseId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  // committed fixtures (as the table owner): two hosts, A owns a draft + a published invitation
  await c.query(`insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')`, [
    OWNER_A,
    OWNER_B,
  ]);
  const doc = (await c.query(`select published from invitations where slug = 'noa-and-itay'`)).rows[0]
    .published;
  draftId = (
    await c.query(
      `insert into invitations (owner_id, template_id, slug, event_type, draft) values ($1, 'sahar-bordeaux', 'a-draft', 'wedding', $2) returning id`,
      [OWNER_A, doc],
    )
  ).rows[0].id;
  publishedId = (
    await c.query(
      `insert into invitations (owner_id, template_id, slug, status, event_type, draft, published, version)
       values ($1, 'sahar-bordeaux', 'a-published', 'published', 'wedding', $2, $2, 1) returning id`,
      [OWNER_A, doc],
    )
  ).rows[0].id;
  responseId = (
    await c.query(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, edit_token_hash) values ($1, true, 'he', 'Dana Levi', 'x') returning id`,
      [publishedId],
    )
  ).rows[0].id;
  await c.query(
    `insert into rsvp_attendees (response_id, kind, position, first_name) values ($1, 'adult', 0, 'Dana')`,
    [responseId],
  );
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('seed', () => {
  it('has every template and every sample invitation, published with a version', async () => {
    expect((await c.query('select count(*)::int n from invitation_templates')).rows[0].n).toBe(
      TEMPLATES.size,
    );
    const rows = (
      await c.query(`select slug, status, version from invitations where owner_id = $1`, [DEMO_OWNER_ID])
    ).rows;
    expect(rows).toHaveLength(demoInvitations().length);
    // the home page's two samples: without and with a background video
    expect(rows.map((r) => r.slug)).toEqual(expect.arrayContaining(['noa-and-itay', 'noa-and-itay-video']));
    expect(rows.every((r) => r.status === 'published' && r.version === 1)).toBe(true);
  });
});

describe('anonymous', () => {
  it('cannot read the templates table — a published invitation carries its template', async () => {
    // (an unlisted design — manifest `listed: false` — is seeded inactive)
    const all = (await c.query('select count(*)::int as n from invitation_templates where is_active')).rows[0]
      .n as number;
    expect(all).toBe(TEMPLATES.size - [...TEMPLATES.values()].filter((t) => !t.manifest.listed).length);
    for (const role of ['anon', 'authenticated'] as const)
      await expect(
        as(c, role, role === 'anon' ? null : OWNER_A, () => c.query('select id from invitation_templates')),
      ).rejects.toThrow(/permission denied/);
  });

  it('cannot read invitations, versions, responses or attendees', async () => {
    for (const table of ['invitations', 'invitation_versions', 'rsvp_responses', 'rsvp_attendees']) {
      await expect(as(c, 'anon', null, () => c.query(`select * from ${table}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it('cannot write responses directly', async () => {
    await expect(
      as(c, 'anon', null, () =>
        c.query(
          `insert into rsvp_responses (invitation_id, attending, locale, primary_name, edit_token_hash) values ($1, true, 'he', 'x', 'x')`,
          [publishedId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('get_published_invitation returns only id, slug, document, template and a follow-up link', async () => {
    const r = await as(
      c,
      'anon',
      null,
      async () => (await c.query(`select get_published_invitation('a-published') r`)).rows[0].r,
    );
    expect(Object.keys(r).sort()).toEqual(['document', 'followUp', 'id', 'slug', 'template']);
    // a save-the-date's full invitation: only its slug and languages (null here)
    expect(r.followUp).toBeNull();
    expect(r.id).toBe(publishedId);
    expect(r.template.id).toBe('sahar-bordeaux');
    expect(JSON.stringify(r)).not.toContain(OWNER_A);
  });

  it('get_published_invitation returns null for drafts and unknown slugs', async () => {
    const [draft, unknown] = await as(c, 'anon', null, async () => [
      (await c.query(`select get_published_invitation('a-draft') r`)).rows[0].r,
      (await c.query(`select get_published_invitation('nope') r`)).rows[0].r,
    ]);
    expect(draft).toBeNull();
    expect(unknown).toBeNull();
  });

  it('cannot call the server-only functions', async () => {
    const calls = [
      `select submit_rsvp('${publishedId}', '{}', '[]', null, 'h')`,
      `select rsvp_rate_hit('${publishedId}', 'ip', 10, 60)`,
      `select publish_invitation('${draftId}', '${OWNER_A}')`,
      `select restore_invitation_version('${draftId}', '${OWNER_A}', 1)`,
    ];
    for (const role of ['anon', 'authenticated'] as const) {
      for (const sql of calls) {
        await expect(as(c, role, OWNER_A, () => c.query(sql))).rejects.toThrow(/permission denied/);
      }
    }
  });
});

describe('signed-in users (the Data API)', () => {
  // The app reads and writes through the service role with the verified user's id; a user's own JWT
  // reaches no table directly (20261113000100_data_api_lockdown.sql) — no paid features granted,
  // documents published or premium designs taken by writing a row.
  const TABLES = [
    'invitations',
    'invitation_versions',
    'rsvp_responses',
    'rsvp_attendees',
    'rsvp_rate_events',
    'invitation_templates',
    'billing_cards',
    'billing_claims',
  ];

  it('cannot read any of the tables, not even their own rows', async () => {
    for (const table of TABLES)
      await expect(as(c, 'authenticated', OWNER_A, () => c.query(`select * from ${table}`))).rejects.toThrow(
        /permission denied/,
      );
  });

  it('cannot change, publish or grant features to their own invitation', async () => {
    const writes = [
      [`update invitations set features = '{"grant":["ai_photos","voice"]}' where id = $1`, [draftId]],
      [`update invitations set status = 'published', published = draft where id = $1`, [draftId]],
      [`update invitations set template_id = 'celestial' where id = $1`, [draftId]],
      [`delete from invitations where id = $1`, [draftId]],
      [`delete from rsvp_responses where id = $1`, [responseId]],
    ] as const;
    for (const [sql, params] of writes)
      await expect(as(c, 'authenticated', OWNER_A, () => c.query(sql, [...params]))).rejects.toThrow(
        /permission denied/,
      );
    const row = (await c.query(`select status, features from invitations where id = $1`, [draftId])).rows[0];
    expect(row.status).toBe('draft');
    expect(JSON.stringify(row.features ?? {})).not.toContain('ai_photos');
  });

  it('cannot create invitations directly, for themselves or anyone else', async () => {
    const doc = (await c.query(`select draft from invitations where id = $1`, [draftId])).rows[0].draft;
    for (const owner of [OWNER_A, OWNER_B])
      await expect(
        as(c, 'authenticated', OWNER_B, () =>
          c.query(
            `insert into invitations (owner_id, template_id, slug, status, event_type, draft, published)
             values ($1, 'sahar-bordeaux', 'b-direct', 'published', 'wedding', $2, $2)`,
            [owner, doc],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
  });

  it('cannot insert responses or truncate the billing tables', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, role === 'anon' ? null : OWNER_A, () =>
          c.query(
            `insert into rsvp_responses (invitation_id, attending, locale, primary_name, edit_token_hash) values ($1, true, 'he', 'x', 'x')`,
            [publishedId],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
      for (const table of ['billing_cards', 'billing_claims'])
        await expect(
          as(c, role, role === 'anon' ? null : OWNER_A, () => c.query(`truncate ${table}`)),
        ).rejects.toThrow(/permission denied/);
    }
  });
});

describe('the Data API surface', () => {
  it('anon and authenticated hold no privilege on any table or sequence of public', async () => {
    const granted = (
      await c.query(`
        select c.relname, a.grantee::regrole::text as grantee, a.privilege_type
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(c.relacl) a
        where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
          and a.grantee in ('anon'::regrole, 'authenticated'::regrole)`)
    ).rows;
    expect(granted).toEqual([]);
  });

  it('a table or sequence created later starts with nothing for them either', async () => {
    await c.query('begin');
    try {
      await c.query('create table public.zz_later (id bigserial primary key)');
      const rows = (
        await c.query(`
          select c.relname from pg_class c cross join lateral aclexplode(c.relacl) a
          where c.relname in ('zz_later', 'zz_later_id_seq')
            and a.grantee in ('anon'::regrole, 'authenticated'::regrole)`)
      ).rows;
      expect(rows).toEqual([]);
    } finally {
      await c.query('rollback');
    }
  });

  it('the one function they may call is get_published_invitation', async () => {
    const callable = (
      await c.query(`
        select p.oid::regprocedure::text as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute'))`)
    ).rows.map((r) => r.fn);
    expect(callable).toEqual(['get_published_invitation(text)']);
  });
});

describe('submit_rsvp (service role)', () => {
  const response = (name: string, adults: number, children: number) => ({
    attending: true,
    locale: 'he',
    primary_name: name,
    phone: '0501234567',
    email: null,
    adults_count: adults,
    children_count: children,
    message: 'מזל טוב',
    answers: { shuttle: 'tlv' },
    ip_hash: 'ip',
  });
  const attendees = (adults: number, children: number) => [
    ...Array.from({ length: adults }, (_, i) => ({
      kind: 'adult',
      position: i,
      first_name: `A${i}`,
      last_name: 'Levi',
      full_name: null,
      age: null,
      phone: i === 0 ? '0501234567' : null,
      email: null,
      dietary: i === 0 ? ['vegan'] : [],
      dietary_notes: null,
    })),
    ...Array.from({ length: children }, (_, i) => ({
      kind: 'child',
      position: i,
      first_name: null,
      last_name: null,
      full_name: `Child ${i}`,
      age: 6,
      phone: null,
      email: null,
      dietary: ['kids_meal'],
      dietary_notes: null,
    })),
  ];

  it('yes with 2 adults + 1 child → 1 response + 3 attendees; the edit token replaces it in place', async () => {
    await as(c, 'service_role', null, async () => {
      const first = (
        await c.query(`select submit_rsvp($1, $2, $3, null, $4) r`, [
          publishedId,
          response('Dana Levi', 2, 1),
          JSON.stringify(attendees(2, 1)),
          sha('token-1'),
        ])
      ).rows[0].r;
      expect(first.replaced).toBe(false);
      const counts = async () =>
        (
          await c.query(
            `select (select count(*)::int from rsvp_responses where invitation_id = $1) responses,
                    (select count(*)::int from rsvp_attendees a join rsvp_responses r on r.id = a.response_id where r.invitation_id = $1) attendees`,
            [publishedId],
          )
        ).rows[0];
      const before = await counts();
      const stored = (
        await c.query(`select * from rsvp_attendees where response_id = $1 order by kind, position`, [
          first.id,
        ])
      ).rows;
      expect(stored.map((a) => [a.kind, a.position])).toEqual([
        ['adult', 0],
        ['adult', 1],
        ['child', 0],
      ]);
      expect(stored[0].dietary).toEqual(['vegan']);

      const edit = (
        await c.query(`select submit_rsvp($1, $2, $3, $4, $5) r`, [
          publishedId,
          response('Dana Levi', 1, 0),
          JSON.stringify(attendees(1, 0)),
          sha('token-1'),
          sha('token-2'),
        ])
      ).rows[0].r;
      expect(edit).toEqual({ id: first.id, replaced: true });
      const after = await counts();
      expect(after.responses).toBe(before.responses);
      expect(after.attendees).toBe(before.attendees - 2);

      const fresh = (
        await c.query(`select submit_rsvp($1, $2, $3, $4, $5) r`, [
          publishedId,
          response('Someone Else', 1, 0),
          JSON.stringify(attendees(1, 0)),
          sha('unknown-token'),
          sha('token-3'),
        ])
      ).rows[0].r;
      expect(fresh.replaced).toBe(false);
      expect(fresh.id).not.toBe(first.id);
    });
  });

  it('rate limit: 10 attempts per window pass, the 11th does not; other IPs are unaffected', async () => {
    await as(c, 'service_role', null, async () => {
      const hit = async (ip: string) =>
        (await c.query(`select rsvp_rate_hit($1, $2, 10, 60) ok`, [publishedId, ip])).rows[0].ok;
      for (let i = 0; i < 10; i++) expect(await hit('ip-1')).toBe(true);
      expect(await hit('ip-1')).toBe(false);
      expect(await hit('ip-2')).toBe(true);
    });
  });
});

describe('publish / restore (service role)', () => {
  it('publishes the draft for its owner only, snapshots a version, and restores it', async () => {
    await as(c, 'service_role', null, async () => {
      expect((await c.query(`select publish_invitation($1, $2) r`, [draftId, OWNER_B])).rows[0].r).toBeNull();
      const r = (await c.query(`select publish_invitation($1, $2) r`, [draftId, OWNER_A])).rows[0].r;
      expect(r).toEqual({
        slug: 'a-draft',
        version: 1,
        publishedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const inv = (
        await c.query('select status, published = draft same, published_at from invitations where id = $1', [
          draftId,
        ])
      ).rows[0];
      expect(inv.status).toBe('published');
      expect(inv.same).toBe(true);
      expect(inv.published_at).not.toBeNull();
      await c.query(`update invitations set draft = jsonb_set(draft, '{timezone}', '"UTC"') where id = $1`, [
        draftId,
      ]);
      expect(
        (await c.query(`select restore_invitation_version($1, $2, 1) ok`, [draftId, OWNER_A])).rows[0].ok,
      ).toBe(true);
      expect(
        (await c.query(`select restore_invitation_version($1, $2, 9) ok`, [draftId, OWNER_A])).rows[0].ok,
      ).toBe(false);
      const tz = (await c.query(`select draft->>'timezone' tz from invitations where id = $1`, [draftId]))
        .rows[0].tz;
      expect(tz).toBe('Asia/Jerusalem');
    });
  });

  it('deleting an invitation deletes its responses and attendees', async () => {
    await as(c, 'service_role', null, async () => {
      await c.query(
        `select submit_rsvp($1, '{"attending":true,"locale":"en","primary_name":"X","adults_count":1,"children_count":0}', '[{"kind":"adult","position":0,"first_name":"X"}]', null, 'h')`,
        [draftId],
      );
      await c.query('delete from invitations where id = $1', [draftId]);
      const n = (
        await c.query('select count(*)::int n from rsvp_responses where invitation_id = $1', [draftId])
      ).rows[0].n;
      expect(n).toBe(0);
    });
  });
});
