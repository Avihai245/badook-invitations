import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// P4 responses functions (supabase/migrations/*_responses.sql): the dashboard's owner-scoped reads and
// deletes, the notification setting and what the notification / digest senders read.

const OWNER_A = '55555555-5555-4555-8555-555555555555';
const OWNER_B = '66666666-6666-4666-8666-666666666666';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let invA: string;
let invB: string;

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

const reply = (name: string, attending: boolean, adults: number, children: number) => ({
  attending,
  locale: 'he',
  primary_name: name,
  phone: '+972501234567',
  email: null,
  adults_count: adults,
  children_count: children,
  message: `hi from ${name}`,
  answers: { shuttle: 'tlv' },
  ip_hash: null,
});
const attendees = (adults: number, children: number) => [
  ...Array.from({ length: adults }, (_, i) => ({
    kind: 'adult',
    position: i,
    first_name: `A${i}`,
    last_name: 'Levi',
    full_name: null,
    age: null,
    phone: null,
    email: null,
    dietary: i === 0 ? ['vegan'] : [],
    dietary_notes: null,
  })),
  ...Array.from({ length: children }, (_, i) => ({
    kind: 'child',
    position: i,
    first_name: null,
    last_name: null,
    full_name: `C${i}`,
    age: 6,
    phone: null,
    email: null,
    dietary: ['kids_meal'],
    dietary_notes: null,
  })),
];

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')`, [
    OWNER_A,
    OWNER_B,
  ]);
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  invA = (
    await commit<{ id: string }>('create_invitation', [OWNER_A, 'sahar-bordeaux', 'wedding', 'resp-a', doc])
  ).id;
  invB = (
    await commit<{ id: string }>('create_invitation', [OWNER_B, 'sahar-bordeaux', 'wedding', 'resp-b', doc])
  ).id;
  await commit('submit_rsvp', [invA, reply('Dana', true, 2, 1), JSON.stringify(attendees(2, 1)), null, 'h1']);
  await c.query(`select pg_sleep(0.01)`);
  await commit('submit_rsvp', [invA, reply('Avi', false, 0, 0), '[]', null, 'h2']);
  await commit('submit_rsvp', [
    invB,
    reply('Other', true, 1, 0),
    JSON.stringify(attendees(1, 0)),
    null,
    'h3',
  ]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

type Responses = {
  notify: string;
  responses: {
    id: string;
    name: string;
    attending: boolean;
    adults: number;
    children: number;
    phone: string;
    answers: Record<string, string>;
    attendees: {
      kind: string;
      position: number;
      firstName: string | null;
      fullName: string | null;
      dietary: string[];
    }[];
  }[];
};

describe('owner_responses', () => {
  it("returns the owner's responses, newest first, with attendees (adults, then children)", async () => {
    const r = await call<Responses>('owner_responses', [invA, OWNER_A]);
    expect(r.notify).toBe('each');
    expect(r.responses.map((x) => x.name)).toEqual(['Avi', 'Dana']);
    const dana = r.responses[1]!;
    expect(dana).toMatchObject({ attending: true, adults: 2, children: 1, phone: '+972501234567' });
    expect(dana.answers).toEqual({ shuttle: 'tlv' });
    expect(dana.attendees.map((a) => [a.kind, a.position, a.firstName ?? a.fullName, a.dietary])).toEqual([
      ['adult', 0, 'A0', ['vegan']],
      ['adult', 1, 'A1', []],
      ['child', 0, 'C0', ['kids_meal']],
    ]);
  });

  it("is null for someone else's invitation", async () => {
    expect(await call('owner_responses', [invA, OWNER_B])).toBeNull();
  });
});

describe('owner_delete_response', () => {
  it("deletes only the owner's response, with its attendees", async () => {
    const { responses } = await call<Responses>('owner_responses', [invA, OWNER_A]);
    const dana = responses.find((x) => x.name === 'Dana')!;
    await as(c, 'service_role', null, async () => {
      expect(
        (await c.query(`select public.owner_delete_response($1, $2, $3) as r`, [invA, OWNER_B, dana.id]))
          .rows[0].r,
      ).toBe(false);
      expect(
        (await c.query(`select public.owner_delete_response($1, $2, $3) as r`, [invB, OWNER_B, dana.id]))
          .rows[0].r,
      ).toBe(false);
      expect(
        (await c.query(`select public.owner_delete_response($1, $2, $3) as r`, [invA, OWNER_A, dana.id]))
          .rows[0].r,
      ).toBe(true);
      expect(
        (await c.query(`select count(*)::int as n from rsvp_attendees where response_id = $1`, [dana.id]))
          .rows[0].n,
      ).toBe(0);
      const left = (await c.query(`select public.owner_responses($1, $2) as r`, [invA, OWNER_A])).rows[0].r;
      expect(left.responses.map((x: { name: string }) => x.name)).toEqual(['Avi']);
    });
  });
});

describe('notification settings', () => {
  it('only the owner sets a known mode; the invitation itself is not touched', async () => {
    const before = (await c.query(`select updated_at from invitations where id = $1`, [invA])).rows[0]
      .updated_at;
    await as(c, 'service_role', null, async () => {
      const set = async (id: string, owner: string, mode: string) =>
        (await c.query(`select public.set_invitation_notify($1, $2, $3) as r`, [id, owner, mode])).rows[0].r;
      expect(await set(invA, OWNER_A, 'weekly')).toBe(false);
      expect(await set(invA, OWNER_B, 'off')).toBe(false);
      expect(await set(invA, OWNER_A, 'digest')).toBe(true);
      expect(await set(invA, OWNER_A, 'off')).toBe(true);
      const r = (await c.query(`select public.owner_responses($1, $2) as r`, [invA, OWNER_A])).rows[0].r;
      expect(r.notify).toBe('off');
      const after = (await c.query(`select updated_at from invitations where id = $1`, [invA])).rows[0]
        .updated_at;
      expect(after).toEqual(before);
    });
  });

  it("the notification target is the owner's email and mode", async () => {
    expect(await call('rsvp_notification_target', [invB])).toEqual({
      id: invB,
      email: 'b@example.com',
      mode: 'each',
    });
    expect(await call('rsvp_notification_target', ['00000000-0000-4000-8000-000000000000'])).toBeNull();
  });
});

describe('daily digest', () => {
  it('lists digest invitations with replies since the last digest, then not again until a new reply', async () => {
    await commit('set_invitation_notify', [invB, OWNER_B, 'digest']);
    const now = (await c.query(`select now() + interval '1 second' as t`)).rows[0].t as Date;
    const due = await call<{ id: string; email: string; responses: { name: string }[] }[]>(
      'rsvp_digest_due',
      [now],
    );
    const b = due.find((d) => d.id === invB);
    expect(b).toMatchObject({ email: 'b@example.com' });
    expect(b!.responses.map((r) => r.name)).toEqual(['Other']);
    expect(due.some((d) => d.id === invA)).toBe(false); // mode 'off'

    await commit('mark_rsvp_digest_sent', [invB, now]);
    const later = new Date(now.getTime() + 60_000);
    expect((await call<{ id: string }[]>('rsvp_digest_due', [later])).some((d) => d.id === invB)).toBe(false);
    // a reply edited after that digest (the touch trigger would stamp the real clock)
    await c.query(`alter table rsvp_responses disable trigger rsvp_responses_touch`);
    await c.query(`update rsvp_responses set updated_at = $2 where invitation_id = $1`, [
      invB,
      new Date(now.getTime() + 30_000),
    ]);
    await c.query(`alter table rsvp_responses enable trigger rsvp_responses_touch`);
    expect((await call<{ id: string }[]>('rsvp_digest_due', [later])).some((d) => d.id === invB)).toBe(true);
  });
});

describe('privileges', () => {
  it('none of the functions or the settings table is reachable by anon or signed-in users', async () => {
    const calls = [
      [`select public.owner_responses($1, $2)`, [invA, OWNER_A]],
      [`select public.owner_delete_response($1, $2, $1)`, [invA, OWNER_A]],
      [`select public.set_invitation_notify($1, $2, 'off')`, [invA, OWNER_A]],
      [`select public.rsvp_notification_target($1)`, [invA]],
      [`select public.rsvp_digest_due(now())`, []],
      [`select public.mark_rsvp_digest_sent($1, now())`, [invA]],
      [`select * from public.invitation_notifications`, []],
    ] as const;
    for (const role of ['anon', 'authenticated'] as const) {
      for (const [sql, args] of calls) {
        await expect(as(c, role, OWNER_A, () => c.query(sql, [...args]))).rejects.toThrow(
          /permission denied/,
        );
      }
    }
  });
});
