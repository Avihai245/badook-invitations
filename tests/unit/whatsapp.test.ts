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
  language: 'he',
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
    // Meta's other "slow down" answers wait too
    for (const code of [80007, 131048, 131056]) {
      const slow = answer(400, { error: { code, message: 'Rate limit' } });
      expect(await sendTemplate(message, slow as unknown as typeof fetch)).toMatchObject({ retryable: true });
    }
  });

  it('a request that may have reached Meta is never tried again; one that never connected is', async () => {
    const { sendTemplate } = await import('@/features/whatsapp/cloud-api');
    const refused = vi.fn(async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
      });
    });
    expect(await sendTemplate(message, refused as unknown as typeof fetch)).toEqual({
      ok: false,
      error: 'ECONNREFUSED',
      retryable: true,
    });
    const reset = vi.fn(async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
      });
    });
    const slow = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    for (const fetchImpl of [reset, slow])
      expect(await sendTemplate(message, fetchImpl as unknown as typeof fetch)).toEqual({
        ok: false,
        error: 'timeout',
        retryable: false,
      });
  });

  it('waits before a retry: a minute, then five', async () => {
    const { retryWait } = await import('@/features/whatsapp/sender');
    expect([1, 2, 3].map(retryWait)).toEqual([60, 300, 300]);
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
    // the right length but not hex: refused, never a crash (the webhook would answer 500)
    expect(validSignature(raw, `sha256=${'z'.repeat(64)}`, 'app-secret')).toBe(false);
    expect(validSignature(raw, `sha256=${'é'.repeat(64)}`, 'app-secret')).toBe(false);
    expect(validSignature(raw, sig.toUpperCase().replace('SHA256=', 'sha256='), 'app-secret')).toBe(true);
  });

  it('reads what guests write to the number; STOP-like words are a request to stop', async () => {
    const { inboundOf } = await import('@/features/whatsapp/cloud-api');
    const { isStopRequest } = await import('@/features/whatsapp/opt-out');
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: '972501234567', type: 'text', text: { body: 'STOP' } },
                  { from: '972501234568', type: 'button', button: { text: 'Stop promotions', payload: 'x' } },
                  { from: 'not-a-number', type: 'text', text: { body: 'stop' } },
                  { from: '972501234569', type: 'image', image: { id: '1' } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(inboundOf(payload)).toEqual([
      { from: '+972501234567', text: 'STOP' },
      { from: '+972501234568', text: 'Stop promotions' },
    ]);
    expect(inboundOf(null)).toEqual([]);
    for (const text of ['STOP', 'stop!', 'Unsubscribe', 'הסר', 'הסרה', 'הסירו אותי', 'עצור', 'בטל', 'הפסק.'])
      expect(isStopRequest(text), text).toBe(true);
    for (const text of ['', 'תודה רבה!', 'we will stop by', 'אנחנו מגיעים, בטל את ההודעה הקודמת'])
      expect(isStopRequest(text), text).toBe(false);
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
  const claimed = (doc: unknown, guestLanguage: string | null = null) => ({
    id: 'm1',
    invitationId: 'i1',
    toPhone: '+972501234567',
    guestName: 'דנה לוי',
    guestToken: 'AAAAAAAAAAAAAAAA',
    guestLanguage,
    slug: 'noa-and-itay',
    document: doc,
  });

  it('fills the template in its language from the invitation, with the personal link', async () => {
    const { templateMessage } = await import('@/features/whatsapp/sender');
    const { FIXTURES } = await import('@/features/invitations/templates/demo');
    const doc = FIXTURES['wedding-he-en'];
    const m = templateMessage(claimed(doc), doc, { locale: 'he', code: 'he' });
    expect(m.to).toBe('+972501234567');
    expect(m.language).toBe('he');
    expect(m.guestName).toBe('דנה לוי');
    expect(m.linkSuffix).toBe('noa-and-itay?g=AAAAAAAAAAAAAAAA');
    expect(m.event).toMatch(/^ל/);
    expect(m.hosts.length).toBeGreaterThan(0);
    expect(m.date).toMatch(/\d{4}/);
    // in English: English values, and the link opens the English page
    const en = templateMessage(claimed(doc), doc, { locale: 'en', code: 'en_US' });
    expect(en).toMatchObject({ language: 'en_US', linkSuffix: 'noa-and-itay?g=AAAAAAAAAAAAAAAA&lang=en' });
    expect(en.event).toMatch(/^to /);
    expect(en.hosts).toMatch(/[A-Za-z]/);
  });

  it('writes to each guest in their language — or the next approved one when Meta has none', async () => {
    vi.stubEnv('INVITES_WHATSAPP_TEMPLATE_LANGS', 'he,en,ru,ar');
    vi.resetModules();
    const rpc = vi.fn();
    vi.doMock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));
    const { processQueue } = await import('@/features/whatsapp/sender');
    const { worldDocument } = await import('@/features/invitations/dev/longer-demo');
    const doc = worldDocument('sahar-bordeaux');
    rpc.mockImplementation(async (fn: string) =>
      fn === 'whatsapp_claim'
        ? {
            data: [
              { ...claimed(doc, 'ru'), id: 'ru-guest' },
              { ...claimed(doc, 'ar'), id: 'ar-guest' },
              { ...claimed(doc, 'am'), id: 'am-guest' },
              { ...claimed(doc, null), id: 'default-guest' },
            ],
            error: null,
          }
        : { data: true, error: null },
    );
    const sent: { ref: string; language: string; linkSuffix: string; event: string }[] = [];
    // Meta approved everything but Arabic
    const send = vi.fn(async (m: { ref: string; language: string; linkSuffix: string; event: string }) => {
      sent.push(m);
      return m.language === 'ar'
        ? ({
            ok: false,
            error: '132001 · template name does not exist in the translation',
            retryable: false,
          } as const)
        : ({ ok: true, id: `wamid.${m.ref}` } as const);
    });
    expect(await processQueue('i1', 10, send as never)).toEqual({ sent: 4, failed: 0, retried: 0 });
    const by = (ref: string) => sent.filter((m) => m.ref === ref).map((m) => m.language);
    expect(by('ru-guest')).toEqual(['ru']);
    // Arabic isn't approved: the invitation's default (Hebrew) instead
    expect(by('ar-guest')).toEqual(['ar', 'he']);
    // no Amharic template configured at all: straight to the default
    expect(by('am-guest')).toEqual(['he']);
    expect(by('default-guest')).toEqual(['he']);
    const ru = sent.find((m) => m.ref === 'ru-guest')!;
    expect(ru.linkSuffix).toBe('noa-and-itay?g=AAAAAAAAAAAAAAAA&lang=ru');
    expect(ru.event).toMatch(/[а-я]/);
    vi.unstubAllEnvs();
    vi.doUnmock('@/lib/supabase/server');
    vi.resetModules();
  });

  it('the preview text is the approved template, filled in order', async () => {
    const { TEMPLATE_TEXT, fillTemplate } = await import('@/features/whatsapp/template-text');
    const text = fillTemplate(TEMPLATE_TEXT.he.body, ['דנה', 'נועה & איתי', 'לחתונה', 'יום חמישי']);
    expect(text).toContain('דנה');
    expect(text).toContain('נועה & איתי');
    expect(text).not.toMatch(/\{\{\d\}\}/);
  });
});
