import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Support tickets (supabase/migrations/*_support_tickets.sql): the customers' side (their own tickets
// only, never a team note), the console's (roles, masking, the numbers), the statuses, the record of
// actions and the purge.

const OWNER = '88888888-8888-4888-8888-888888888801';
const AGENT = '88888888-8888-4888-8888-888888888802';
const FINANCE = '88888888-8888-4888-8888-888888888803';
const VIEWER = '88888888-8888-4888-8888-888888888804';
const DANA = '88888888-8888-4888-8888-888888888805';
const YOSSI = '88888888-8888-4888-8888-888888888806';
const RONI = '88888888-8888-4888-8888-888888888807';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let danaInvitation: string;
let yossiInvitation: string;

/** As the server (the service role), rolled back. */
async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
/** As the server, kept. */
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: { message?: string }) => e.message ?? 'error',
  );

type CustomerTicket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  unread: boolean;
  invitation: { id: string; title: string | null } | null;
  channel?: string;
  chat?: unknown;
  messages?: { author: string; body: string | null; event: string | null; by: string | null }[];
};

/** A ticket the customer opens in the app (kept). */
const open = (user: string, subject: string, body = 'hello', invitation: string | null = null) =>
  commit<CustomerTicket>('support_ticket_open', [
    user,
    subject,
    'support',
    body,
    invitation,
    'he',
    'app',
    null,
  ]);

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, raw_app_meta_data, created_at) values
       ($1, 'owner@example.com', '{}', now()),
       ($2, 'agent@example.com', '{}', now()),
       ($3, 'finance@example.com', '{}', now()),
       ($4, 'viewer@example.com', '{}', now()),
       ($5, 'dana@example.com', '{}', '2026-03-01T10:00:00Z'),
       ($6, 'yossi@example.com', '{}', now()),
       ($7, 'roni@example.com', '{}', now())`,
    [OWNER, AGENT, FINANCE, VIEWER, DANA, YOSSI, RONI],
  );
  await c.query(`insert into public.admin_staff (email, role) values
    ('owner@example.com', 'owner'), ('agent@example.com', 'support'),
    ('finance@example.com', 'finance'), ('viewer@example.com', 'viewer')`);
  await c.query(
    `insert into public.accounts (user_id, full_name, phone, plan, message_credits, source) values
       ($1, 'דנה כהן', '+972501234567', 'pro', 40, 'partner:badook-events'),
       ($2, 'Yossi Levi', null, 'free', 0, 'signup')`,
    [DANA, YOSSI],
  );
  const draft = (he: string) => ({
    defaultLocale: 'he',
    hosts: { primary: { he }, secondary: { he: 'איתי' } },
  });
  danaInvitation = (
    await c.query(
      `insert into invitations (owner_id, template_id, slug, event_type, draft)
       values ($1, 'sahar-bordeaux', 'dana-support', 'wedding', $2) returning id`,
      [DANA, draft('דנה')],
    )
  ).rows[0].id;
  yossiInvitation = (
    await c.query(
      `insert into invitations (owner_id, template_id, slug, event_type, draft)
       values ($1, 'sahar-bordeaux', 'yossi-support', 'wedding', $2) returning id`,
      [YOSSI, draft('יוסי')],
    )
  ).rows[0].id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('the customer’s tickets', () => {
  it('opens one about their own invitation, never someone else’s', async () => {
    const t = await call<CustomerTicket>('support_ticket_open', [
      DANA,
      '  The RSVP form is empty  ',
      'bug',
      'The form shows no fields',
      danaInvitation,
      'he',
      'app',
      null,
    ]);
    expect(t).toMatchObject({
      subject: 'The RSVP form is empty',
      category: 'bug',
      status: 'open',
      source: 'app',
      unread: false,
      invitation: { id: danaInvitation, slug: 'dana-support', title: 'דנה & איתי' },
      chat: null,
      messages: [{ author: 'customer', body: 'The form shows no fields', event: null, by: null }],
    });
    expect(t.number).toBeGreaterThanOrEqual(1001);
    expect(t.channel).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(
      await reason(
        call('support_ticket_open', [DANA, 'x', 'support', 'y', yossiInvitation, 'he', 'app', null]),
      ),
    ).toContain('invalid_invitation');
    // an unknown user gets nothing
    expect(
      await call('support_ticket_open', [
        '88888888-8888-4888-8888-888888888899',
        'x',
        'support',
        'y',
        null,
        'he',
        'app',
        null,
      ]),
    ).toBeNull();
  });

  it('names the invitation as the app does: its hosts, with their joiner', async () => {
    const title = async (draft: unknown) => {
      await c.query('begin');
      try {
        const r = await c.query(
          `with i as (
             insert into invitations (owner_id, template_id, slug, event_type, draft)
             values ($1, 'sahar-bordeaux', 'x-title', 'wedding', $2) returning *
           )
           select public.support_invitation_title(i) as t from i`,
          [DANA, JSON.stringify(draft)],
        );
        return r.rows[0].t;
      } finally {
        await c.query('rollback');
      }
    };
    const hosts = { primary: { en: 'Noa' }, secondary: { en: 'Itay' } };
    expect(await title({ defaultLocale: 'en', hosts })).toBe('Noa & Itay');
    expect(await title({ defaultLocale: 'en', hosts: { ...hosts, joiner: { en: 'and' } } })).toBe(
      'Noa and Itay',
    );
    expect(await title({ defaultLocale: 'en', hosts: { primary: { en: 'Dana' }, secondary: null } })).toBe(
      'Dana',
    );
    expect(await title({ defaultLocale: 'he', hosts })).toBeNull();
  });

  it('checks what it is given', async () => {
    const bad = async (args: unknown[]) => reason(call('support_ticket_open', args));
    expect(await bad([DANA, ' ', 'support', 'y', null, 'he', 'app', null])).toContain('invalid_subject');
    expect(await bad([DANA, 'x'.repeat(201), 'support', 'y', null, 'he', 'app', null])).toContain(
      'invalid_subject',
    );
    expect(await bad([DANA, 'x', 'gossip', 'y', null, 'he', 'app', null])).toContain('invalid_category');
    expect(await bad([DANA, 'x', 'support', '  ', null, 'he', 'app', null])).toContain('invalid_body');
    expect(await bad([DANA, 'x', 'support', 'y'.repeat(8001), null, 'he', 'app', null])).toContain(
      'invalid_body',
    );
    expect(await bad([DANA, 'x', 'support', 'y', null, 'fr', 'app', null])).toContain('invalid_locale');
    expect(await bad([DANA, 'x', 'support', 'y', null, 'he', 'contact', null])).toContain('invalid_source');
  });

  it('from the assistant: the conversation comes with it, checked', async () => {
    const chat = [
      { role: 'user', content: 'How do I add a video?' },
      { role: 'assistant', content: 'Open the editor…' },
    ];
    const t = await call<CustomerTicket>('support_ticket_open', [
      DANA,
      'A video',
      'support',
      'It still fails',
      null,
      'en',
      'chat',
      JSON.stringify(chat),
    ]);
    expect(t).toMatchObject({ source: 'chat', chat });
    const bad = async (source: string, value: unknown) =>
      reason(
        call('support_ticket_open', [
          DANA,
          'x',
          'support',
          'y',
          null,
          'he',
          source,
          value === null ? null : JSON.stringify(value),
        ]),
      );
    expect(await bad('chat', null)).toContain('invalid_chat');
    expect(await bad('app', chat)).toContain('invalid_chat');
    expect(await bad('chat', [{ role: 'system', content: 'x' }])).toContain('invalid_chat');
    expect(await bad('chat', [{ role: 'user', content: 'x'.repeat(2001) }])).toContain('invalid_chat');
    expect(
      await bad(
        'chat',
        Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })),
      ),
    ).toContain('invalid_chat');
    expect(await bad('chat', { role: 'user', content: 'x' })).toContain('invalid_chat');
  });

  it('a customer never reads, answers or closes another’s ticket', async () => {
    const mine = await open(DANA, 'Mine');
    expect(await call('support_ticket_get', [YOSSI, mine.id, true])).toBeNull();
    expect(await call('support_ticket_reply', [YOSSI, mine.id, 'hi'])).toBeNull();
    expect(await call('support_ticket_close', [YOSSI, mine.id])).toBeNull();
    const yossis = await call<CustomerTicket[]>('support_ticket_list', [YOSSI]);
    expect(yossis.map((t) => t.id)).not.toContain(mine.id);
    expect((await call<CustomerTicket[]>('support_ticket_list', [DANA])).map((t) => t.id)).toContain(mine.id);
    // the list has no conversation
    expect((await call<CustomerTicket[]>('support_ticket_list', [DANA]))[0]).not.toHaveProperty('messages');
  });

  it('never sees a team note or who on the team wrote; the answer is new until they look', async () => {
    const t = await open(DANA, 'Notes', 'first');
    await commit('admin_support_note', [AGENT, t.id, 'She is a VIP — refund if asked']);
    await commit('admin_support_assign', [AGENT, t.id, AGENT]);
    await commit('admin_support_priority', [AGENT, t.id, 'high']);
    let seen = await call<CustomerTicket>('support_ticket_get', [DANA, t.id, false]);
    expect(seen.messages).toEqual([
      {
        id: expect.any(Number),
        author: 'customer',
        body: 'first',
        event: null,
        by: null,
        at: expect.any(String),
      },
    ]);
    expect(seen.status).toBe('open');
    expect(seen.unread).toBe(false);
    await commit('admin_support_reply', [AGENT, t.id, 'Here is how', false]);
    seen = await call<CustomerTicket>('support_ticket_get', [DANA, t.id, false]);
    expect(seen.messages?.map((m) => [m.author, m.body])).toEqual([
      ['customer', 'first'],
      ['team', 'Here is how'],
    ]);
    expect(JSON.stringify(seen)).not.toContain('agent@example.com');
    expect(JSON.stringify(seen)).not.toContain('VIP');
    expect(seen).toMatchObject({ status: 'waiting', unread: true });
    expect(await commit('support_unread', [DANA])).toBeGreaterThanOrEqual(1);
    const before = await commit<number>('support_unread', [DANA]);
    // looking at it (the page) marks it seen
    await commit('support_ticket_get', [DANA, t.id, true]);
    expect(await commit('support_unread', [DANA])).toBe(before - 1);
    expect((await call<CustomerTicket>('support_ticket_get', [DANA, t.id, false])).unread).toBe(false);
  });
});

describe('the statuses', () => {
  it('open → answered (waiting) → the customer’s answer opens it → answered and closed → reopened by writing', async () => {
    const t = await open(YOSSI, 'Statuses');
    const status = async () =>
      (await call<CustomerTicket>('support_ticket_get', [YOSSI, t.id, false])).status;
    expect(await commit('admin_support_reply', [AGENT, t.id, 'Try this', false])).toMatchObject({
      status: 'waiting',
    });
    expect(await status()).toBe('waiting');
    await commit('support_ticket_reply', [YOSSI, t.id, 'Did not work']);
    expect(await status()).toBe('open');
    expect(await commit('admin_support_reply', [AGENT, t.id, 'Fixed now', true])).toMatchObject({
      status: 'closed',
    });
    expect(await status()).toBe('closed');
    const reopened = await commit<CustomerTicket>('support_ticket_reply', [YOSSI, t.id, 'Thanks, one more']);
    expect(reopened.status).toBe('open');
    expect(reopened.messages?.map((m) => [m.author, m.event, m.by])).toEqual([
      ['customer', null, null],
      ['team', null, null],
      ['customer', null, null],
      ['team', null, null],
      ['system', 'closed', 'team'],
      ['system', 'reopened', 'customer'],
      ['customer', null, null],
    ]);
  });

  it('the customer closes; the team closes, reopens and moves it by hand', async () => {
    const t = await open(YOSSI, 'By hand');
    const closed = await commit<CustomerTicket>('support_ticket_close', [YOSSI, t.id]);
    expect(closed).toMatchObject({ status: 'closed' });
    expect(closed.messages?.at(-1)).toMatchObject({ author: 'system', event: 'closed', by: 'customer' });
    // closing again changes nothing
    expect((await commit<CustomerTicket>('support_ticket_close', [YOSSI, t.id])).messages).toHaveLength(2);
    expect(await commit('admin_support_status', [AGENT, t.id, 'open'])).toEqual({
      status: 'open',
      changed: true,
    });
    expect(await commit('admin_support_status', [AGENT, t.id, 'open'])).toEqual({
      status: 'open',
      changed: false,
    });
    expect(await commit('admin_support_status', [AGENT, t.id, 'waiting'])).toMatchObject({ changed: true });
    expect(await commit('admin_support_status', [AGENT, t.id, 'closed'])).toMatchObject({ changed: true });
    expect(await reason(call('admin_support_status', [AGENT, t.id, 'solved']))).toContain('invalid_status');
    // the customer sees the closings and the reopening, not the internal move
    const seen = await call<CustomerTicket>('support_ticket_get', [YOSSI, t.id, false]);
    expect(seen.messages?.map((m) => [m.event, m.by])).toEqual([
      [null, null],
      ['closed', 'customer'],
      ['reopened', 'team'],
      ['closed', 'team'],
    ]);
    // the team sees all of it, with who did it
    const full = await call<{ messages: { event: string | null; internal: boolean; authorEmail: string }[] }>(
      'admin_support_get',
      [OWNER, t.id],
    );
    expect(full.messages.map((m) => [m.event, m.internal, m.authorEmail])).toEqual([
      [null, false, null],
      ['closed', false, null],
      ['reopened', false, 'agent@example.com'],
      ['status', true, 'agent@example.com'],
      ['closed', false, 'agent@example.com'],
    ]);
  });
});

describe('the console', () => {
  it('only staff with support.view read tickets; only support.reply answers', async () => {
    const t = await open(YOSSI, 'Roles');
    for (const actor of [YOSSI, VIEWER, FINANCE])
      for (const [fn, args] of [
        ['admin_support_list', [actor, 'all', 'all', null, null, null, 10, 0]],
        ['admin_support_get', [actor, t.id]],
        ['admin_support_summary', [actor]],
        ['admin_support_reply_time', [actor, 30]],
        ['admin_support_activity', [actor, 10]],
        ['admin_support_user_tickets', [actor, YOSSI]],
        ['admin_support_reply', [actor, t.id, 'x', false]],
        ['admin_support_note', [actor, t.id, 'x']],
        ['admin_support_status', [actor, t.id, 'closed']],
        ['admin_support_priority', [actor, t.id, 'high']],
        ['admin_support_assign', [actor, t.id, null]],
        ['admin_support_delete', [actor, t.id, 'spam']],
      ] as const)
        expect(await reason(call(fn, [...args])), `${fn} as ${actor}`).toContain('forbidden');
    // support answers
    expect(await reason(call('admin_support_reply', [AGENT, t.id, 'x', false]))).toBe('ok');
  });

  it('shows the customer’s account; contact details only to roles with users.pii', async () => {
    const t = await open(DANA, 'The panel', 'hi', danaInvitation);
    const full = await call<Record<string, unknown>>('admin_support_get', [OWNER, t.id]);
    expect(full).toMatchObject({
      subject: 'The panel',
      status: 'open',
      priority: 'normal',
      source: 'app',
      invitation: { id: danaInvitation, slug: 'dana-support', status: 'draft', title: 'דנה & איתי' },
      customer: {
        kind: 'account',
        userId: DANA,
        name: 'דנה כהן',
        email: 'dana@example.com',
        phone: '+972501234567',
        plan: 'pro',
        credits: 40,
        invitations: 1,
        joinedAt: expect.any(String),
        source: 'partner:badook-events',
      },
      agents: [
        { userId: AGENT, email: 'agent@example.com', role: 'support' },
        { userId: OWNER, email: 'owner@example.com', role: 'owner' },
      ],
    });
    expect(new Date((full.customer as { joinedAt: string }).joinedAt).toISOString()).toBe(
      '2026-03-01T10:00:00.000Z',
    );
    // (the viewer doesn't see tickets at all; a role that did without users.pii would get these)
    expect((await c.query(`select public.support_mask_email('dana@example.com') as m`)).rows[0].m).toBe(
      'd***@example.com',
    );
    expect((await c.query(`select public.support_mask_phone('+972501234567') as m`)).rows[0].m).toBe(
      '+972 5X-XXX-X567',
    );
    expect((await c.query(`select public.support_mask_phone('+14155550123') as m`)).rows[0].m).toBe(
      '+14XXXXXX123',
    );
    const masked = (
      await c.query(`select public.admin_support_item(t, false) as r from support_tickets t where id = $1`, [
        t.id,
      ])
    ).rows[0].r;
    expect(masked.customer).toEqual({
      kind: 'account',
      userId: DANA,
      name: 'דנה כהן',
      email: 'd***@example.com',
    });
    expect(JSON.stringify(masked)).not.toContain('dana@example.com');
  });

  it('assigns to a team member who may answer — not to finance, a customer or a stranger', async () => {
    const t = await open(YOSSI, 'Assign');
    expect(await commit('admin_support_assign', [OWNER, t.id, AGENT])).toEqual({
      assignee: { userId: AGENT, email: 'agent@example.com' },
      changed: true,
    });
    for (const who of [FINANCE, YOSSI, '88888888-8888-4888-8888-888888888899'])
      expect(await reason(call('admin_support_assign', [OWNER, t.id, who]))).toContain('invalid_assignee');
    const mine = await call<{ items: { id: string }[] }>('admin_support_list', [
      AGENT,
      'all',
      'mine',
      null,
      null,
      null,
      100,
      0,
    ]);
    expect(mine.items.map((i) => i.id)).toContain(t.id);
    expect(await commit('admin_support_assign', [OWNER, t.id, null])).toEqual({
      assignee: null,
      changed: true,
    });
  });

  it('a visitor’s ticket (the contact form): answered by email; a signed-in visitor’s is theirs in the app', async () => {
    const visitor = await commit<{ id: string; number: number }>('support_contact_ticket', [
      null,
      'Rina Visitor',
      'Rina@Example.com ',
      '+972521112233',
      'Do you do bar mitzvahs?',
      'business',
      'Do you do bar mitzvahs? We are 200 guests.',
      'en',
    ]);
    const got = await call<Record<string, unknown>>('admin_support_get', [AGENT, visitor.id]);
    expect(got).toMatchObject({
      source: 'contact',
      locale: 'en',
      category: 'business',
      customer: {
        kind: 'visitor',
        userId: null,
        name: 'Rina Visitor',
        email: 'rina@example.com',
        phone: '+972521112233',
      },
    });
    expect(await call('support_notify_target', [visitor.id])).toMatchObject({
      userId: null,
      email: 'rina@example.com',
      firstName: 'Rina',
      locale: 'en',
    });
    const signedIn = await commit<{ id: string }>('support_contact_ticket', [
      RONI,
      'Roni',
      'other-address@example.com',
      '',
      'Billing',
      'billing',
      'A question',
      'he',
    ]);
    expect((await call<CustomerTicket[]>('support_ticket_list', [RONI])).map((t) => t.id)).toEqual([
      signedIn.id,
    ]);
    // the answer goes to the address the form was sent with
    expect(await call('support_notify_target', [signedIn.id])).toMatchObject({
      userId: RONI,
      email: 'other-address@example.com',
    });
    expect(
      await reason(
        call('support_contact_ticket', [null, 'x', 'not-an-email', '', 's', 'support', 'b', 'he']),
      ),
    ).toContain('invalid_email');
    expect(
      await reason(
        call('support_contact_ticket', [null, 'x', 'a@example.com', '0501234567', 's', 'support', 'b', 'he']),
      ),
    ).toContain('invalid_phone');
  });

  it('an account since deleted, without an address, can’t be answered; its ticket stays for the team', async () => {
    const t = await open(RONI, 'Gone soon');
    await c.query(`update support_tickets set user_id = null where id = $1`, [t.id]);
    expect(await reason(call('admin_support_reply', [AGENT, t.id, 'x', false]))).toContain('no_recipient');
    expect(await call('admin_support_get', [AGENT, t.id])).toMatchObject({ customer: { kind: 'gone' } });
    expect(await reason(call('admin_support_note', [AGENT, t.id, 'account deleted']))).toBe('ok');
  });

  it('records every change: who, what, before and after — never the message itself', async () => {
    const t = await open(YOSSI, 'Audit');
    await commit('admin_support_reply', [AGENT, t.id, 'secret answer text', false]);
    await commit('admin_support_note', [AGENT, t.id, 'secret note text']);
    await commit('admin_support_priority', [AGENT, t.id, 'high']);
    await commit('admin_support_assign', [AGENT, t.id, AGENT]);
    await commit('admin_support_status', [AGENT, t.id, 'closed']);
    const rows = await call<{ action: string; actorEmail: string; details: Record<string, unknown> }[]>(
      'admin_audit_list',
      [OWNER, 20, null, 'ticket', t.id],
    );
    expect(rows.map((r) => [r.action, r.actorEmail, r.details])).toEqual([
      ['support.status', 'agent@example.com', { number: t.number, from: 'waiting', to: 'closed' }],
      ['support.assign', 'agent@example.com', { number: t.number, from: null, to: 'agent@example.com' }],
      ['support.priority', 'agent@example.com', { number: t.number, from: 'normal', to: 'high' }],
      ['support.note', 'agent@example.com', { number: t.number }],
      ['support.reply', 'agent@example.com', { number: t.number, close: false, before: 'open' }],
    ]);
    expect(JSON.stringify(rows)).not.toContain('secret');
  });

  it('deletes spam with a reason: gone from the customer and the inbox', async () => {
    const t = await open(YOSSI, 'Spam spam');
    expect(await reason(call('admin_support_delete', [AGENT, t.id, '  ']))).toContain('invalid_reason');
    expect(await commit('admin_support_delete', [AGENT, t.id, 'spam'])).toBe(true);
    expect(await commit('admin_support_delete', [AGENT, t.id, 'spam'])).toBe(false);
    expect(await call('support_ticket_get', [YOSSI, t.id, true])).toBeNull();
    expect(await call('admin_support_get', [OWNER, t.id])).toBeNull();
    expect((await call<CustomerTicket[]>('support_ticket_list', [YOSSI])).map((x) => x.id)).not.toContain(
      t.id,
    );
    expect(await reason(call('admin_support_reply', [AGENT, t.id, 'x', false]))).toContain('not_found');
    const [log] = await call<{ action: string; details: Record<string, unknown> }[]>('admin_audit_list', [
      OWNER,
      1,
      null,
      'ticket',
      t.id,
    ]);
    expect(log).toMatchObject({ action: 'support.delete', details: { reason: 'spam', source: 'app' } });
  });

  it('marks whether a team answer’s email went out', async () => {
    const t = await open(YOSSI, 'Email');
    const { messageId } = await commit<{ messageId: number }>('admin_support_reply', [
      AGENT,
      t.id,
      'Hi',
      false,
    ]);
    expect(await commit('support_message_emailed', [messageId, true])).toBe(true);
    const got = await call<{ messages: { id: number; emailed: string | null }[] }>('admin_support_get', [
      AGENT,
      t.id,
    ]);
    expect(got.messages.find((m) => m.id === messageId)?.emailed).toBe('sent');
    // a note is never emailed
    const note = await commit<{ messageId: number }>('admin_support_note', [AGENT, t.id, 'n']);
    expect(await commit('support_message_emailed', [note.messageId, true])).toBeNull();
  });
});

describe('the numbers, exact on a known inbox', () => {
  /** The inbox emptied and filled with these tickets (times relative to now). */
  let ids: Record<string, string>;
  const day = 86_400_000;
  const threeDaysAgo = new Date(Date.now() - 3 * day);

  beforeAll(async () => {
    await c.query('delete from support_tickets');
    const add = async (
      key: string,
      o: {
        user?: string | null;
        name?: string | null;
        email?: string | null;
        subject: string;
        category?: string;
        status?: string;
        priority?: string;
        assigned?: string | null;
        created: Date;
        customerAt?: Date | null;
        teamAt?: Date | null;
      },
    ) => {
      const r = await c.query(
        `insert into support_tickets (user_id, name, email, subject, category, status, priority, assigned_to, source,
           created_at, last_customer_at, last_team_at, last_activity_at, closed_at)
         values ($1, $2, $3, $4, $5, $6::text, $7, $8, $9, $10::timestamptz, $11::timestamptz, $12::timestamptz,
           greatest($10::timestamptz, $11::timestamptz, $12::timestamptz),
           case when $6::text = 'closed' then coalesce($12::timestamptz, $10::timestamptz) end)
         returning id`,
        [
          o.user ?? null,
          o.name ?? null,
          o.email ?? null,
          o.subject,
          o.category ?? 'support',
          o.status ?? 'open',
          o.priority ?? 'normal',
          o.assigned ?? null,
          o.user ? 'app' : 'contact',
          o.created,
          o.customerAt === undefined ? o.created : o.customerAt,
          o.teamAt ?? null,
        ],
      );
      ids = { ...ids, [key]: r.rows[0].id };
      await c.query(
        `insert into support_messages (ticket_id, author, author_id, body, created_at) values ($1, 'customer', $2, 'q', $3)`,
        [r.rows[0].id, o.user ?? null, o.created],
      );
    };
    const now = Date.now();
    // open: the oldest waits 3 days (Dana's, high, unassigned); a visitor's today; Yossi's, assigned
    await add('old', { user: DANA, subject: 'Oldest open', priority: 'high', created: threeDaysAgo });
    await add('visitor', {
      name: 'Rina Visitor',
      email: 'rina@example.com',
      subject: 'Pricing for 300 guests',
      category: 'business',
      created: new Date(now - 1000),
    });
    await add('assigned', {
      user: YOSSI,
      subject: 'WhatsApp failed',
      assigned: AGENT,
      created: new Date(now - 2 * day - 3_600_000),
    });
    // waiting for the customer: answered 30 and 90 minutes after opening
    await add('w1', {
      user: DANA,
      subject: 'Billing twice',
      category: 'billing',
      status: 'waiting',
      created: new Date(now - 1.5 * day),
      teamAt: new Date(now - 1.5 * day + 30 * 60_000),
    });
    await add('w2', {
      user: YOSSI,
      subject: 'Change the date',
      status: 'waiting',
      created: new Date(now - 2 * day),
      teamAt: new Date(now - 2 * day + 90 * 60_000),
    });
    // closed, answered 10 minutes after opening; and one from 40 days ago (outside the median)
    await add('c1', {
      user: DANA,
      subject: 'Font question',
      status: 'closed',
      created: new Date(now - 5 * day),
      teamAt: new Date(now - 5 * day + 10 * 60_000),
    });
    await add('c2', {
      user: YOSSI,
      subject: 'Ancient',
      status: 'closed',
      created: new Date(now - 40 * day),
      teamAt: new Date(now - 40 * day + 5 * 60_000),
    });
    // the team's answers (a note before one of them doesn't count as an answer)
    const answer = (key: string, minutes: number, internal = false) =>
      c.query(
        `insert into support_messages (ticket_id, author, author_id, author_email, body, internal, created_at)
         select id, 'staff', $2, 'agent@example.com', 'a', $3, created_at + make_interval(mins => $4)
         from support_tickets where id = $1`,
        [ids[key], AGENT, internal, minutes],
      );
    await answer('w1', 1, true);
    await answer('w1', 30);
    await answer('w2', 90);
    await answer('c1', 10);
    await answer('c2', 5);
  });

  it('the summary: open, waiting, unassigned, high, the oldest, today', async () => {
    const s = await call<Record<string, unknown>>('admin_support_summary', [AGENT]);
    expect(s).toEqual({
      open: 3,
      waiting: 2,
      unassigned: 2,
      highOpen: 1,
      oldestOpenAt: expect.any(String),
      openedToday: 1,
    });
    expect(new Date(s.oldestOpenAt as string).getTime()).toBe(threeDaysAgo.getTime());
  });

  it('the time to the team’s first answer: the median over the days asked', async () => {
    // 10, 30, 90 minutes (the 40-day-old one is outside the 30 days; a note isn't an answer)
    expect(await call('admin_support_reply_time', [AGENT, 30])).toEqual({ medianMinutes: 30, answered: 3 });
    expect(await call('admin_support_reply_time', [AGENT, 60])).toEqual({ medianMinutes: 20, answered: 4 });
    expect(await call('admin_support_reply_time', [AGENT, 1])).toEqual({ medianMinutes: null, answered: 0 });
  });

  it('the inbox: a tab, its counts under the filters, the newest activity first, the waiting time', async () => {
    const list = (
      status: string,
      scope = 'all',
      category: string | null = null,
      priority: string | null = null,
      q: string | null = null,
      limit = 50,
      offset = 0,
    ) =>
      call<{
        items: { id: string; subject: string; waitingSince: string | null; customer: { email: string } }[];
        counts: Record<string, number>;
        total: number;
      }>('admin_support_list', [AGENT, status, scope, category, priority, q, limit, offset]);
    const all = await list('all');
    expect(all.counts).toEqual({ open: 3, waiting: 2, closed: 2, all: 7 });
    expect(all.total).toBe(7);
    expect(all.items.map((i) => i.subject)).toEqual([
      'Pricing for 300 guests',
      'Billing twice',
      'Change the date',
      'WhatsApp failed',
      'Oldest open',
      'Font question',
      'Ancient',
    ]);
    const open = await list('open');
    expect(open.items.map((i) => i.id)).toEqual([ids.visitor, ids.assigned, ids.old]);
    expect(open.total).toBe(3);
    expect(new Date(open.items[2]!.waitingSince!).getTime()).toBe(threeDaysAgo.getTime());
    expect((await list('open', 'mine')).items.map((i) => i.id)).toEqual([ids.assigned]);
    expect((await list('all', 'unassigned')).counts).toEqual({ open: 2, waiting: 2, closed: 2, all: 6 });
    expect((await list('all', 'all', 'billing')).items.map((i) => i.id)).toEqual([ids.w1]);
    expect((await list('all', 'all', null, 'high')).items.map((i) => i.id)).toEqual([ids.old]);
    // search: the subject, the name, the address, the number
    expect((await list('all', 'all', null, null, 'whatsapp')).items.map((i) => i.id)).toEqual([ids.assigned]);
    expect((await list('all', 'all', null, null, 'דנה')).counts.all).toBe(3);
    expect((await list('all', 'all', null, null, 'rina@')).items.map((i) => i.id)).toEqual([ids.visitor]);
    const { number } = (await c.query('select number from support_tickets where id = $1', [ids.w2])).rows[0];
    expect((await list('all', 'all', null, null, `#${number}`)).items.map((i) => i.id)).toEqual([ids.w2]);
    // a search for "%" is only a percent sign
    expect((await list('all', 'all', null, null, '%')).counts.all).toBe(0);
    // a page at a time
    const page2 = await list('all', 'all', null, null, null, 3, 3);
    expect(page2.items.map((i) => i.subject)).toEqual(['WhatsApp failed', 'Oldest open', 'Font question']);
    expect(page2.total).toBe(7);
    expect(await reason(list('pending'))).toContain('invalid_status');
  });

  it('the live feed: tickets opened and the team’s answers, first names only', async () => {
    const feed = await call<{ kind: string; actor: string | null; subject: string; ticketId: string }[]>(
      'admin_support_activity',
      [AGENT, 4],
    );
    // (the note before the first answer isn't an answer)
    expect(feed.map((f) => [f.kind, f.actor, f.subject])).toEqual([
      ['ticket_opened', 'Rina', 'Pricing for 300 guests'],
      ['ticket_reply', 'דנה', 'Billing twice'],
      ['ticket_opened', 'דנה', 'Billing twice'],
      ['ticket_reply', 'Yossi', 'Change the date'],
    ]);
    expect(JSON.stringify(feed)).not.toContain('@');
  });

  it('a user’s tickets on their console page', async () => {
    const rows = await call<{ id: string }[]>('admin_support_user_tickets', [OWNER, DANA]);
    expect(rows.map((r) => r.id)).toEqual([ids.w1, ids.old, ids.c1]);
  });

  it('the purge: answered and silent for 14 days closes; closed two years ago and deleted 30 days ago go', async () => {
    await c.query(`update support_tickets set last_team_at = now() - interval '15 days' where id = $1`, [
      ids.w2,
    ]);
    await c.query(`update support_tickets set closed_at = now() - interval '2 years 1 day' where id = $1`, [
      ids.c2,
    ]);
    await c.query(`update support_tickets set deleted_at = now() - interval '31 days' where id = $1`, [
      ids.c1,
    ]);
    expect(await commit('support_maintenance', [])).toEqual({ autoClosed: 1, erased: 1, deleted: 1 });
    const left = (await c.query('select id, status from support_tickets order by number')).rows;
    expect(left.map((r) => r.id)).not.toContain(ids.c2);
    expect(left.map((r) => r.id)).not.toContain(ids.c1);
    expect(left.find((r) => r.id === ids.w2)?.status).toBe('closed');
    // their messages went with them
    expect(
      (
        await c.query('select count(*)::int as n from support_messages where ticket_id = any($1)', [
          [ids.c1, ids.c2],
        ])
      ).rows[0].n,
    ).toBe(0);
    const auto = await call<CustomerTicket>('support_ticket_get', [YOSSI, ids.w2, false]);
    expect(auto.messages?.at(-1)).toMatchObject({ author: 'system', event: 'closed', by: 'auto' });
    expect(await commit('support_maintenance', [])).toEqual({ autoClosed: 0, erased: 0, deleted: 0 });
  });
});

describe('privileges', () => {
  it('only the server calls the functions; the helpers not even the server; the tables are closed', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      expect(
        await reason(as(c, role, DANA, () => c.query(`select public.support_ticket_list($1)`, [DANA]))),
      ).toContain('permission denied');
      expect(
        await reason(as(c, role, DANA, () => c.query(`select public.admin_support_summary($1)`, [OWNER]))),
      ).toContain('permission denied');
    }
    for (const helper of [
      `public.support_mask_email('a@example.com')`,
      `public.support_mask_phone('+972501234567')`,
      `public.support_check('a', 'support', 'b')`,
      `public.support_event('${DANA}', 'closed', '{}', null, false)`,
    ])
      expect(await reason(as(c, 'service_role', null, () => c.query(`select ${helper}`)))).toContain(
        'permission denied',
      );
    for (const table of ['support_tickets', 'support_messages'])
      expect(
        await reason(as(c, 'authenticated', DANA, () => c.query(`select * from public.${table}`))),
      ).toContain('permission denied');
  });
});
