import { beforeEach, describe, expect, it, vi } from 'vitest';

// Support tickets (features/support/tickets): the customer's and the console's API handlers over fake
// dependencies, the emails, who hears after an action, the contact form's ticket, the inbox's address.

vi.mock('server-only', () => ({}));
const env = {
  INVITES_PUBLIC_BASE_URL: 'https://invitations.example.com',
  INVITES_BRAND_NAME: 'Badook',
  INVITES_SUPPORT_EMAIL: 'team@example.com',
  INVITES_IP_HASH_SALT: 'unit-salt',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));
const sendEmail = vi.fn(
  async (_: { to: string; subject: string; html: string; text: string; replyTo?: string }) => true,
);
vi.mock('@/features/invitations/server/email', () => ({ sendEmail }));
const broadcastRefresh = vi.fn(async () => true);
vi.mock('@/lib/live/broadcast', () => ({
  broadcastRefresh,
  realtimeInfo: (channel: string) => ({ url: 'https://rt.example.com', key: 'k', channel }),
}));
const afterJobs: (() => unknown)[] = [];
vi.mock('next/server', () => ({ after: (job: () => unknown) => void afterJobs.push(job) }));
const adminNudge = vi.fn(async () => undefined);
vi.mock('@/features/admin/server/live', () => ({ adminNudge }));

const { AdminDbError } = await import('@/features/admin/server/db');
const { TicketDbError } = await import('@/features/support/tickets/server/db');
const api = await import('@/features/support/tickets/server/api');
const adminApi = await import('@/features/support/tickets/server/admin-api');
const { customerReplyEmail, teamTicketEmail } = await import('@/features/support/tickets/email');
const { subjectFrom } = await import('@/features/support/tickets/config');
const { inboxHref, parseInboxQuery } = await import('@/features/support/tickets/admin/query');

const USER = '11111111-1111-4111-8111-111111111111';
const TICKET = '22222222-2222-4222-8222-222222222222';
const INVITATION = '33333333-3333-4333-8333-333333333333';
const STAFF = {
  userId: '44444444-4444-4444-8444-444444444444',
  email: 'agent@example.com',
  role: 'support' as const,
  permissions: [],
};

const row = (over: Record<string, unknown> = {}) => ({
  id: TICKET,
  number: 1042,
  subject: 'The form is empty',
  category: 'bug' as const,
  status: 'open' as const,
  source: 'app' as const,
  createdAt: '2026-09-27T10:00:00Z',
  lastActivityAt: '2026-09-27T10:00:00Z',
  closedAt: null,
  unread: false,
  invitation: null,
  channel: 'channel_0123456789abcdef',
  chat: null,
  messages: [],
  ...over,
});

/** A customer's world: every call recorded; the jobs after the answer kept to run by hand. */
function customerDeps() {
  const later: (() => Promise<unknown>)[] = [];
  const deps = {
    db: {
      open: vi.fn(async () => row()),
      list: vi.fn(async () => [row()]),
      get: vi.fn(async () => row()),
      reply: vi.fn(async () => row()),
      close: vi.fn(async () => row({ status: 'closed' })),
    },
    rateHit: vi.fn(async () => true),
    realtime: (channel: string) => ({ url: 'https://rt.example.com', key: 'k', channel }),
    later: (job: () => Promise<unknown>) => void later.push(job),
    notifyTeam: vi.fn(async () => undefined),
    nudge: vi.fn(async () => undefined),
    broadcast: vi.fn(async () => true),
  };
  return { deps, runLater: () => Promise.all(later.map((job) => job())), later };
}

const open = {
  subject: 'The form is empty',
  category: 'bug',
  body: 'The RSVP form shows no fields',
  invitationId: INVITATION,
  locale: 'he',
  source: 'app',
};

describe('the customer’s tickets API', () => {
  it('opens a ticket: checked, limited, then the team hears and the console refreshes after the answer', async () => {
    const { deps, runLater } = customerDeps();
    const res = await api.openTicket(USER, open, deps);
    expect(res.status).toBe(201);
    expect(deps.rateHit).toHaveBeenCalledWith('ticket', `u:${USER}`);
    expect(deps.db.open).toHaveBeenCalledWith(USER, {
      subject: 'The form is empty',
      category: 'bug',
      body: 'The RSVP form shows no fields',
      invitationId: INVITATION,
      locale: 'he',
      source: 'app',
      chat: null,
    });
    // the page gets where to listen, never the raw channel
    const ticket = res.body.ticket as Record<string, unknown>;
    expect(ticket).not.toHaveProperty('channel');
    expect(ticket.realtime).toEqual({
      url: 'https://rt.example.com',
      key: 'k',
      channel: 'channel_0123456789abcdef',
    });
    // nothing is told before the answer is sent
    expect(deps.notifyTeam).not.toHaveBeenCalled();
    await runLater();
    expect(deps.notifyTeam).toHaveBeenCalledWith(TICKET, 'opened');
    expect(deps.nudge).toHaveBeenCalledTimes(1);
  });

  it('refuses what is wrong, in fields; the limit; the database’s rules', async () => {
    const { deps } = customerDeps();
    expect(await api.openTicket(USER, { ...open, subject: ' ', body: '' }, deps)).toEqual({
      status: 400,
      body: { ok: false, code: 'invalid', fields: ['subject', 'body'] },
    });
    expect((await api.openTicket(USER, { ...open, category: 'gossip' }, deps)).status).toBe(400);
    expect((await api.openTicket(USER, { ...open, body: 'x'.repeat(8001) }, deps)).status).toBe(400);
    expect((await api.openTicket(USER, { ...open, extra: 1 }, deps)).status).toBe(400);
    // an assistant's ticket comes with its conversation, and only then
    expect((await api.openTicket(USER, { ...open, source: 'chat' }, deps)).body).toMatchObject({
      fields: ['chat'],
    });
    expect(
      (await api.openTicket(USER, { ...open, chat: [{ role: 'user', content: 'hi' }] }, deps)).body,
    ).toMatchObject({ fields: ['chat'] });
    expect(deps.db.open).not.toHaveBeenCalled();
    deps.rateHit.mockResolvedValueOnce(false);
    expect(await api.openTicket(USER, open, deps)).toEqual({
      status: 429,
      body: { ok: false, code: 'rate' },
    });
    deps.db.open.mockRejectedValueOnce(new TicketDbError('invalid_invitation', 'x'));
    expect(await api.openTicket(USER, open, deps)).toEqual({
      status: 400,
      body: { ok: false, code: 'invalid', fields: ['invitationId'] },
    });
    // anything else is the server's problem (the route answers 500)
    deps.db.open.mockRejectedValueOnce(new Error('boom'));
    await expect(api.openTicket(USER, open, deps)).rejects.toThrow('boom');
  });

  it('from the assistant: the conversation, within the chat’s limits', async () => {
    const { deps } = customerDeps();
    const chat = [
      { role: 'user', content: 'How do I add a video?' },
      { role: 'assistant', content: 'Open the editor…' },
    ];
    expect((await api.openTicket(USER, { ...open, source: 'chat', chat }, deps)).status).toBe(201);
    expect(deps.db.open.mock.calls[0]![1]).toMatchObject({ source: 'chat', chat });
    const long = Array.from({ length: 9 }, () => ({ role: 'user', content: 'x'.repeat(1990) }));
    expect((await api.openTicket(USER, { ...open, source: 'chat', chat: long }, deps)).status).toBe(400);
    const many = Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' }));
    expect((await api.openTicket(USER, { ...open, source: 'chat', chat: many }, deps)).status).toBe(400);
  });

  it('reads one of theirs (seen unless the page is in the background); not theirs is not found', async () => {
    const { deps } = customerDeps();
    expect((await api.getTicket(USER, TICKET, true, deps)).status).toBe(200);
    expect(deps.db.get).toHaveBeenLastCalledWith(USER, TICKET, true);
    await api.getTicket(USER, TICKET, false, deps);
    expect(deps.db.get).toHaveBeenLastCalledWith(USER, TICKET, false);
    deps.db.get.mockResolvedValueOnce(null as never);
    expect(await api.getTicket(USER, TICKET, true, deps)).toEqual({
      status: 404,
      body: { ok: false, code: 'not_found' },
    });
    expect((await api.getTicket(USER, 'not-a-uuid', true, deps)).status).toBe(404);
    expect(deps.db.get).toHaveBeenCalledTimes(3);
    expect((await api.listTickets(USER, deps)).body).toMatchObject({ ok: true, tickets: [{ id: TICKET }] });
  });

  it('answers: limited to 30 an hour; then the team, the console and the customer’s other pages hear', async () => {
    const { deps, runLater } = customerDeps();
    expect((await api.replyTicket(USER, TICKET, { body: '  Still broken  ' }, deps)).status).toBe(200);
    expect(deps.rateHit).toHaveBeenCalledWith('reply', `u:${USER}`);
    expect(deps.db.reply).toHaveBeenCalledWith(USER, TICKET, 'Still broken');
    await runLater();
    expect(deps.notifyTeam).toHaveBeenCalledWith(TICKET, 'answered');
    expect(deps.nudge).toHaveBeenCalled();
    expect(deps.broadcast).toHaveBeenCalledWith('channel_0123456789abcdef', 'ticket');
    expect((await api.replyTicket(USER, TICKET, { body: '' }, deps)).status).toBe(400);
    deps.rateHit.mockResolvedValueOnce(false);
    expect((await api.replyTicket(USER, TICKET, { body: 'again' }, deps)).status).toBe(429);
    deps.db.reply.mockResolvedValueOnce(null as never);
    expect((await api.replyTicket(USER, TICKET, { body: 'not mine' }, deps)).status).toBe(404);
  });

  it('closes: the console and the other pages hear (no email to the team)', async () => {
    const { deps, runLater } = customerDeps();
    const res = await api.closeTicket(USER, TICKET, deps);
    expect(res.body).toMatchObject({ ok: true, ticket: { status: 'closed' } });
    await runLater();
    expect(deps.notifyTeam).not.toHaveBeenCalled();
    expect(deps.nudge).toHaveBeenCalled();
    expect(deps.broadcast).toHaveBeenCalledWith('channel_0123456789abcdef', 'ticket');
    deps.db.close.mockResolvedValueOnce(null as never);
    expect((await api.closeTicket(USER, TICKET, deps)).status).toBe(404);
  });
});

function adminDeps() {
  const later: (() => Promise<unknown>)[] = [];
  const deps = {
    db: {
      reply: vi.fn(async () => ({ messageId: 77, status: 'waiting' as const })),
      note: vi.fn(async () => ({ messageId: 78 })),
      status: vi.fn(async () => ({ status: 'closed' as const, changed: true })),
      priority: vi.fn(async () => ({ priority: 'high' as const, changed: true })),
      assign: vi.fn(async () => ({ assignee: { userId: STAFF.userId, email: STAFF.email }, changed: true })),
      remove: vi.fn(async () => true),
    },
    later: (job: () => Promise<unknown>) => void later.push(job),
    emailCustomer: vi.fn(async () => undefined),
    tellCustomer: vi.fn(async () => undefined),
    nudge: vi.fn(async () => undefined),
  };
  return { deps, runLater: () => Promise.all(later.map((job) => job())), later };
}

describe('the console’s ticket actions', () => {
  it('answers: then the customer’s email, their open page and the console hear', async () => {
    const { deps, runLater } = adminDeps();
    const res = await adminApi.adminReply(STAFF, TICKET, { body: ' Here is how ', close: true }, deps);
    expect(res).toEqual({ status: 200, body: { ok: true, status: 'waiting', messageId: 77 } });
    expect(deps.db.reply).toHaveBeenCalledWith(STAFF.userId, TICKET, 'Here is how', true);
    expect(deps.emailCustomer).not.toHaveBeenCalled();
    await runLater();
    expect(deps.emailCustomer).toHaveBeenCalledWith(TICKET, 77, 'Here is how');
    expect(deps.tellCustomer).toHaveBeenCalledWith(TICKET);
    expect(deps.nudge).toHaveBeenCalled();
    // `close` is optional
    await adminApi.adminReply(STAFF, TICKET, { body: 'x' }, deps);
    expect(deps.db.reply).toHaveBeenLastCalledWith(STAFF.userId, TICKET, 'x', false);
  });

  it('refuses nonsense; a ticket that is gone is not found; the database’s other rules go to the route', async () => {
    const { deps } = adminDeps();
    expect((await adminApi.adminReply(STAFF, 'x', { body: 'x' }, deps)).status).toBe(404);
    expect((await adminApi.adminReply(STAFF, TICKET, { body: '' }, deps)).status).toBe(400);
    expect((await adminApi.adminReply(STAFF, TICKET, { body: 'x', close: 'yes' }, deps)).status).toBe(400);
    deps.db.reply.mockRejectedValueOnce(new AdminDbError('not_found', 'x'));
    expect((await adminApi.adminReply(STAFF, TICKET, { body: 'x' }, deps)).status).toBe(404);
    // no_recipient, forbidden…: adminRoute answers 409 / 403
    deps.db.reply.mockRejectedValueOnce(new AdminDbError('no_recipient', 'x'));
    await expect(adminApi.adminReply(STAFF, TICKET, { body: 'x' }, deps)).rejects.toMatchObject({
      reason: 'no_recipient',
    });
  });

  it('a note tells only the console', async () => {
    const { deps, runLater } = adminDeps();
    expect((await adminApi.adminNote(STAFF, TICKET, { body: 'VIP' }, deps)).body).toEqual({
      ok: true,
      messageId: 78,
    });
    await runLater();
    expect(deps.nudge).toHaveBeenCalled();
    expect(deps.tellCustomer).not.toHaveBeenCalled();
    expect(deps.emailCustomer).not.toHaveBeenCalled();
  });

  it('one change at a time: the status tells the customer’s page; the priority and assignment only the console', async () => {
    const { deps, runLater, later } = adminDeps();
    expect((await adminApi.adminUpdate(STAFF, TICKET, { status: 'closed' }, deps)).body).toEqual({
      ok: true,
      status: 'closed',
      changed: true,
    });
    await runLater();
    expect(deps.tellCustomer).toHaveBeenCalledWith(TICKET);
    later.length = 0;
    deps.tellCustomer.mockClear();
    await adminApi.adminUpdate(STAFF, TICKET, { priority: 'high' }, deps);
    await adminApi.adminUpdate(STAFF, TICKET, { assignee: STAFF.userId }, deps);
    await adminApi.adminUpdate(STAFF, TICKET, { assignee: null }, deps);
    await runLater();
    expect(deps.db.assign).toHaveBeenLastCalledWith(STAFF.userId, TICKET, null);
    expect(deps.tellCustomer).not.toHaveBeenCalled();
    expect(deps.nudge).toHaveBeenCalledTimes(4);
    // nothing changed: nobody is told
    later.length = 0;
    deps.db.status.mockResolvedValueOnce({ status: 'closed', changed: false });
    await adminApi.adminUpdate(STAFF, TICKET, { status: 'closed' }, deps);
    expect(later).toHaveLength(0);
    for (const bad of [
      {},
      { status: 'solved' },
      { status: 'closed', priority: 'high' },
      { assignee: 'someone' },
    ])
      expect((await adminApi.adminUpdate(STAFF, TICKET, bad, deps)).status).toBe(400);
  });

  it('deletes spam with a reason', async () => {
    const { deps } = adminDeps();
    expect((await adminApi.adminDelete(STAFF, TICKET, { reason: '' }, deps)).body).toMatchObject({
      fields: ['reason'],
    });
    expect((await adminApi.adminDelete(STAFF, TICKET, { reason: 'spam' }, deps)).status).toBe(200);
    expect(deps.db.remove).toHaveBeenCalledWith(STAFF.userId, TICKET, 'spam');
    deps.db.remove.mockResolvedValueOnce(false);
    expect((await adminApi.adminDelete(STAFF, TICKET, { reason: 'spam' }, deps)).status).toBe(404);
  });
});

describe('the emails', () => {
  const base = {
    brand: 'Badook',
    number: 1042,
    subject: 'The <form> is empty',
    body: 'Try <b>refreshing</b>\nthen publish again',
    supportEmail: 'team@example.com',
    contactUrl: 'https://invitations.example.com/contact',
  };

  it('the customer with an account: the answer itself, a button to the ticket in the app, replies to the team', () => {
    const e = customerReplyEmail({
      ...base,
      locale: 'he',
      firstName: 'דנה',
      ticketUrl: `https://invitations.example.com/app/support/${TICKET}`,
    });
    expect(e.subject).toBe('תשובה מהצוות: The <form> is empty (#1042)');
    expect(e.html).toContain('dir="rtl"');
    expect(e.html).toContain('שלום דנה,');
    expect(e.html).toContain('Try &lt;b&gt;refreshing&lt;/b&gt;');
    expect(e.html).not.toContain('<b>refreshing');
    expect(e.html).toContain(`href="https://invitations.example.com/app/support/${TICKET}"`);
    expect(e.html).toContain('לפנייה באפליקציה');
    expect(e.text).toContain('Try <b>refreshing</b>\nthen publish again');
    expect(e.text).toContain('אפשר להשיב בעמוד הפנייה באפליקציה, או פשוט להשיב למייל הזה.');
  });

  it('a visitor: the answer by email, a reply button to the team; without a team address, the contact form', () => {
    const visitor = customerReplyEmail({ ...base, locale: 'en', firstName: null, ticketUrl: null });
    expect(visitor.subject).toBe('Our team replied: The <form> is empty (#1042)');
    expect(visitor.html).toContain('Hi,');
    expect(visitor.html).toContain(
      `href="mailto:team@example.com?subject=${encodeURIComponent('Re: Our team replied: The <form> is empty (#1042)').replace(/&/g, '&amp;')}"`,
    );
    expect(visitor.text).toContain('You can simply reply to this email.');
    expect(visitor.text).not.toContain('/app/support');
    const noTeam = customerReplyEmail({
      ...base,
      locale: 'en',
      firstName: 'Rina',
      ticketUrl: null,
      supportEmail: '',
    });
    expect(noTeam.html).toContain('href="https://invitations.example.com/contact"');
    expect(noTeam.text).toContain('To reply, write to us through the contact form on the site.');
  });

  it('the team: the subject and a link to the console — never the conversation', () => {
    const e = teamTicketEmail({
      kind: 'opened',
      brand: 'Badook',
      number: 1042,
      subject: 'The <form> is empty',
      category: 'bug',
      source: 'chat',
      firstName: 'דנה',
      visitor: false,
      consoleUrl: `https://invitations.example.com/app/admin/support/${TICKET}`,
    });
    expect(e.subject).toBe('[Badook] פנייה חדשה #1042: The <form> is empty');
    expect(e.html).toContain('The &lt;form&gt; is empty');
    expect(e.html).toContain('דיווח על תקלה');
    expect(e.html).toContain('העוזר (השיחה מצורפת)');
    expect(e.html).toContain(`href="https://invitations.example.com/app/admin/support/${TICKET}"`);
    const answered = teamTicketEmail({
      kind: 'answered',
      brand: 'Badook',
      number: 7,
      subject: 's',
      category: 'business',
      source: 'contact',
      firstName: null,
      visitor: true,
      consoleUrl: 'https://x.test/app/admin/support/1',
    });
    expect(answered.subject).toBe('[Badook] הלקוח השיב #7: s');
    expect(answered.text).toContain('מבקר באתר (בלי חשבון)');
  });

  it('a subject from a message: its first line, cut at a word', () => {
    expect(subjectFrom('\n  Hello there  \nmore')).toBe('Hello there');
    const long = subjectFrom('word '.repeat(40), 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith('…')).toBe(true);
    expect(subjectFrom('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('who hears after an action', () => {
  const target = {
    id: TICKET,
    number: 1042,
    subject: 'Help',
    category: 'support',
    source: 'app',
    status: 'waiting',
    locale: 'en',
    channel: 'channel_0123456789abcdef',
    userId: USER,
    email: 'dana@example.com',
    firstName: 'Dana',
  };
  beforeEach(() => {
    rpc.mockReset();
    sendEmail.mockClear();
    broadcastRefresh.mockClear();
    env.INVITES_SUPPORT_EMAIL = 'team@example.com';
  });
  const notify = () => import('@/features/support/tickets/server/notify');

  it('the customer gets the team’s answer; whether it went is kept on the answer', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'support_notify_target' ? { data: target, error: null } : { data: true, error: null },
    );
    const { emailCustomerReply } = await notify();
    await emailCustomerReply(TICKET, 77, 'Here is how');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0]![0];
    expect(mail).toMatchObject({ to: 'dana@example.com', replyTo: 'team@example.com' });
    expect(mail.html).toContain(`https://invitations.example.com/app/support/${TICKET}`);
    expect(rpc).toHaveBeenCalledWith('support_message_emailed', { p_message_id: 77, p_ok: true });
    // a failed send is kept as failed, and never throws
    sendEmail.mockResolvedValueOnce(false);
    await emailCustomerReply(TICKET, 78, 'x');
    expect(rpc).toHaveBeenCalledWith('support_message_emailed', { p_message_id: 78, p_ok: false });
    rpc.mockRejectedValueOnce(new Error('db down'));
    await expect(emailCustomerReply(TICKET, 79, 'x')).resolves.toBeUndefined();
  });

  it('the team hears of a new ticket (not without an address); the customer’s page gets a hint', async () => {
    rpc.mockResolvedValue({ data: target, error: null });
    const { emailTeam, tellCustomerPage } = await notify();
    await emailTeam(TICKET, 'opened');
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({ to: 'team@example.com' });
    expect(sendEmail.mock.calls[0]![0].html).toContain(`/app/admin/support/${TICKET}`);
    env.INVITES_SUPPORT_EMAIL = '';
    await emailTeam(TICKET, 'answered');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await tellCustomerPage(TICKET);
    expect(broadcastRefresh).toHaveBeenCalledWith('channel_0123456789abcdef', 'ticket', fetch, 'support');
  });
});

describe('the contact form opens a ticket', () => {
  beforeEach(() => {
    rpc.mockReset();
    sendEmail.mockClear();
    afterJobs.length = 0;
    env.INVITES_SUPPORT_EMAIL = 'team@example.com';
  });
  const form = {
    name: 'Rina Visitor',
    email: 'rina@example.com',
    phone: '050-1234567',
    topic: 'business',
    message: 'Do you do bar mitzvahs?\nWe are 200 guests.',
    locale: 'en',
  };

  it('a visitor’s: stored, a ticket with the message’s first line as its subject, the team emailed a link', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'support_rate_hit'
        ? { data: true, error: null }
        : fn === 'contact_submit'
          ? { data: 'contact-id', error: null }
          : fn === 'support_contact_ticket'
            ? { data: { id: TICKET, number: 1042 }, error: null }
            : {
                data: {
                  ...{ id: TICKET, number: 1042, subject: 'Do you do bar mitzvahs?' },
                  category: 'business',
                  source: 'contact',
                  userId: null,
                  email: 'rina@example.com',
                  firstName: 'Rina',
                  locale: 'en',
                  channel: 'c',
                },
                error: null,
              },
    );
    const { submitContact } = await import('@/features/site/contact');
    const res = await submitContact(form, { ip: '10.0.0.1', userId: null });
    expect(res).toEqual({
      status: 200,
      body: { ok: true, ticket: { id: TICKET, number: 1042, mine: false } },
    });
    expect(rpc).toHaveBeenCalledWith('support_contact_ticket', {
      p_user_id: null,
      p_name: 'Rina Visitor',
      p_email: 'rina@example.com',
      p_phone: '+972501234567',
      p_subject: 'Do you do bar mitzvahs?',
      p_category: 'business',
      p_body: 'Do you do bar mitzvahs?\nWe are 200 guests.',
      p_locale: 'en',
    });
    // the team's email and the console's hint come after the answer — a link, not the message
    expect(sendEmail).not.toHaveBeenCalled();
    await Promise.all(afterJobs.map((job) => job()));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]![0].to).toBe('team@example.com');
    expect(sendEmail.mock.calls[0]![0].text).not.toContain('200 guests');
    expect(adminNudge).toHaveBeenCalledWith('ticket');
  });

  it('new tickets an hour are limited per address; should the ticket fail, the message is emailed as before', async () => {
    let hits = 0;
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'support_rate_hit') return { data: ++hits !== 2, error: null };
      if (fn === 'contact_submit') return { data: 'contact-id', error: null };
      return { data: null, error: { code: 'XX000', message: 'down' } };
    });
    const { submitContact } = await import('@/features/site/contact');
    // the second counter (tickets) says no
    expect(await submitContact(form, { ip: '10.0.0.2', userId: null })).toEqual({
      status: 429,
      body: { ok: false, code: 'rate' },
    });
    const res = await submitContact(form, { ip: '10.0.0.2', userId: null });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({
      to: 'team@example.com',
      replyTo: 'rina@example.com',
    });
    expect(sendEmail.mock.calls[0]![0].text).toContain('200 guests');
  });
});

describe('the inbox’s address', () => {
  it('reads the query, anything unknown to its default', () => {
    expect(parseInboxQuery({})).toEqual({
      status: 'open',
      scope: 'all',
      category: null,
      priority: null,
      q: '',
      page: 1,
    });
    expect(
      parseInboxQuery({
        status: 'closed',
        scope: 'mine',
        category: 'bug',
        priority: 'high',
        q: ' #1042 ',
        page: '3',
      }),
    ).toEqual({ status: 'closed', scope: 'mine', category: 'bug', priority: 'high', q: '#1042', page: 3 });
    expect(
      parseInboxQuery({ status: 'x', scope: 'y', category: 'z', priority: 'p', page: '-1' }),
    ).toMatchObject({
      status: 'open',
      scope: 'all',
      category: null,
      priority: null,
      page: 1,
    });
  });

  it('writes it back, a new filter from the first page', () => {
    const q = parseInboxQuery({ status: 'all', page: '4' });
    expect(inboxHref(q)).toBe('/app/admin/support?status=all');
    expect(inboxHref(q, { page: 5 })).toBe('/app/admin/support?status=all&page=5');
    expect(inboxHref(q, { status: 'open', q: 'דנה' })).toBe(
      `/app/admin/support?q=${encodeURIComponent('דנה').replace(/%20/g, '+')}`,
    );
  });
});
