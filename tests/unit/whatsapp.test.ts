import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc: vi.fn() }) }));

beforeAll(() => {
  vi.stubEnv('INVITES_WHATSAPP_TOKEN', 'test-token');
  vi.stubEnv('INVITES_WHATSAPP_PHONE_NUMBER_ID', '1234567890');
  vi.stubEnv('INVITES_WHATSAPP_API_BASE', 'https://wa.test');
});

const message = {
  to: '+972501234567',
  guestName: 'דנה\nלוי',
  hosts: 'נועה & איתי',
  event: 'לחתונה',
  date: 'יום חמישי, 17 ביוני 2027',
  linkSuffix: 'noa-and-itay?g=AAAAAAAAAAAAAAAA',
  ref: 'msg-1',
};

const answer = (status: number, body: unknown) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );

describe('WhatsApp Cloud API client', () => {
  it('sends the fixed template: the guest, hosts, event and date, and the personal link on the button', async () => {
    const { sendTemplate } = await import('@/features/whatsapp/cloud-api');
    const fetchImpl = answer(200, { messages: [{ id: 'wamid.X' }] });
    expect(await sendTemplate(message, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: true,
      id: 'wamid.X',
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://wa.test/v26.0/1234567890/messages');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '972501234567',
      type: 'template',
      biz_opaque_callback_data: 'msg-1',
      template: { name: 'badook_invitation', language: { code: 'he' } },
    });
    const [bodyParams, button] = body.template.components;
    // Meta rejects newlines inside a parameter
    expect(bodyParams.parameters.map((p: { text: string }) => p.text)).toEqual([
      'דנה לוי',
      'נועה & איתי',
      'לחתונה',
      'יום חמישי, 17 ביוני 2027',
    ]);
    expect(button).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: 'noa-and-itay?g=AAAAAAAAAAAAAAAA' }],
    });
  });

  it('rate limits and server errors are retried later; a bad number is not', async () => {
    const { sendTemplate } = await import('@/features/whatsapp/cloud-api');
    const limited = answer(400, { error: { code: 130429, message: 'Rate limit hit' } });
    expect(await sendTemplate(message, limited as unknown as typeof fetch)).toEqual({
      ok: false,
      error: '130429 · Rate limit hit',
      retryable: true,
    });
    const down = answer(503, {});
    expect(await sendTemplate(message, down as unknown as typeof fetch)).toMatchObject({
      ok: false,
      retryable: true,
    });
    const invalid = answer(400, {
      error: {
        code: 131026,
        message: 'Message undeliverable',
        error_data: { details: 'not a WhatsApp user' },
      },
    });
    expect(await sendTemplate(message, invalid as unknown as typeof fetch)).toEqual({
      ok: false,
      error: '131026 · not a WhatsApp user',
      retryable: false,
    });
    const offline = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    expect(await sendTemplate(message, offline as unknown as typeof fetch)).toEqual({
      ok: false,
      error: 'ECONNRESET',
      retryable: true,
    });
  });

  it('checks the webhook signature (hex HMAC-SHA256 of the raw body)', async () => {
    const { validSignature } = await import('@/features/whatsapp/cloud-api');
    const raw = '{"entry":[]}';
    const sig = `sha256=${createHmac('sha256', 'app-secret').update(raw).digest('hex')}`;
    expect(validSignature(raw, sig, 'app-secret')).toBe(true);
    expect(validSignature(raw + ' ', sig, 'app-secret')).toBe(false);
    expect(validSignature(raw, sig, 'other')).toBe(false);
    expect(validSignature(raw, null, 'app-secret')).toBe(false);
    expect(validSignature(raw, 'sha256=zz', 'app-secret')).toBe(false);
    expect(validSignature(raw, sig, '')).toBe(false);
  });

  it('reads message statuses from a webhook delivery, ignoring anything else', async () => {
    const { statusesOf } = await import('@/features/whatsapp/cloud-api');
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: 'wamid.A', status: 'delivered' },
                  {
                    id: 'wamid.B',
                    status: 'failed',
                    errors: [{ code: 131026, title: 'Message undeliverable' }],
                  },
                  { id: 'wamid.C', status: 'deleted' },
                  { status: 'read' },
                ],
              },
            },
            { value: { messages: [{ from: '972501234567', text: { body: 'hi' } }] } },
          ],
        },
      ],
    };
    expect(statusesOf(payload)).toEqual([
      { id: 'wamid.A', status: 'delivered', error: null },
      { id: 'wamid.B', status: 'failed', error: '131026 · Message undeliverable' },
    ]);
    expect(statusesOf(null)).toEqual([]);
    expect(statusesOf({ entry: 'x' })).toEqual([]);
  });
});

describe('the invitation message', () => {
  it('fills the template in its language from the invitation, with the personal link', async () => {
    const { templateMessage } = await import('@/features/whatsapp/sender');
    const { FIXTURES } = await import('@/features/invitations/templates/demo');
    const doc = Object.values(FIXTURES)[0]!;
    const m = templateMessage(
      {
        id: 'm1',
        invitationId: 'i1',
        toPhone: '+972501234567',
        guestName: 'דנה לוי',
        guestToken: 'AAAAAAAAAAAAAAAA',
        slug: 'noa-and-itay',
        document: doc,
      },
      doc,
    );
    expect(m.to).toBe('+972501234567');
    expect(m.guestName).toBe('דנה לוי');
    expect(m.linkSuffix).toBe('noa-and-itay?g=AAAAAAAAAAAAAAAA');
    expect(m.event).toMatch(/^ל/);
    expect(m.hosts.length).toBeGreaterThan(0);
    expect(m.date).toMatch(/\d{4}/);
  });

  it('the preview text is the approved template, filled in order', async () => {
    const { TEMPLATE_TEXT, fillTemplate } = await import('@/features/whatsapp/template-text');
    const text = fillTemplate(TEMPLATE_TEXT.he.body, ['דנה', 'נועה & איתי', 'לחתונה', 'יום חמישי']);
    expect(text).toContain('דנה');
    expect(text).toContain('נועה & איתי');
    expect(text).not.toMatch(/\{\{\d\}\}/);
  });
});
