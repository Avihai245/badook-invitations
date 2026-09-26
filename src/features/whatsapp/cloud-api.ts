import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * WhatsApp Business Platform — Cloud API (graph.facebook.com), from the system's official number.
 * One fixed, Meta-approved MARKETING template (INVITES_WHATSAPP_TEMPLATE, e.g. "badook_invitation"):
 *   body     שלום {{1}}! {{2}} מזמינים אותך {{3}} ב־{{4}}. …
 *   button   URL  https://<public address>/i/{{1}}   ← "<slug>?g=<guest token>"
 * The body is positional: 1 = the guest's name, 2 = the hosts, 3 = the event ("לחתונה"),
 * 4 = the date. See docs/whatsapp-setup.md for the template to submit.
 */

export interface TemplateMessage {
  /** E.164 (+9725…) — the API wants it without the plus */
  to: string;
  guestName: string;
  hosts: string;
  event: string;
  date: string;
  /** appended to the template's URL button: "<slug>?g=<token>" */
  linkSuffix: string;
  /** our message id, echoed back in the status webhooks */
  ref: string;
}

/**
 * `retryable`: tried again later (with a wait). A request that may have reached Meta (a timeout, a
 * dropped connection) never is — Meta may have sent it already: it fails as 'timeout'.
 */
export type SendResult = { ok: true; id: string } | { ok: false; error: string; retryable: boolean };

/** Meta's "slow down" answers and its own hiccups (API, WABA and pair rate limits, maintenance). */
const RETRY_LATER = new Set([4, 80007, 130429, 131016, 131048, 131056, 131057]);
/** Connections that never opened: the request didn't reach Meta. */
const NOT_CONNECTED = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
]);

export function cloudApiConfigured(): boolean {
  const env = serverEnv();
  return !!(env.INVITES_WHATSAPP_TOKEN && env.INVITES_WHATSAPP_PHONE_NUMBER_ID);
}

/** Meta caps a text parameter at 1024 characters and rejects newlines and tabs in it. */
const param = (text: string) => ({
  type: 'text',
  text:
    text
      .replace(/[\n\t]+/g, ' ')
      .replace(/ {4,}/g, '   ')
      .trim()
      .slice(0, 1000) || '-',
});

export async function sendTemplate(m: TemplateMessage, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const env = serverEnv();
  return postTemplate(
    {
      to: m.to,
      template: env.INVITES_WHATSAPP_TEMPLATE,
      lang: env.INVITES_WHATSAPP_TEMPLATE_LANG,
      body: [m.guestName, m.hosts, m.event, m.date],
      button: m.linkSuffix,
      ref: m.ref,
    },
    fetchImpl,
  );
}

/**
 * Any of the system's approved templates (the invitation's, and the table number's —
 * features/event-day): its body's positional parameters and the URL button's suffix.
 */
export interface TemplateSend {
  /** E.164 */
  to: string;
  template: string;
  lang: string;
  body: string[];
  /** appended to the template's URL button */
  button: string;
  /** our message id, echoed back in the status webhooks */
  ref: string;
}

export async function postTemplate(m: TemplateSend, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const env = serverEnv();
  const url = `${env.INVITES_WHATSAPP_API_BASE}/${env.INVITES_WHATSAPP_API_VERSION}/${env.INVITES_WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: m.to.replace(/^\+/, ''),
    type: 'template',
    biz_opaque_callback_data: m.ref,
    template: {
      name: m.template,
      language: { code: m.lang },
      components: [
        { type: 'body', parameters: m.body.map(param) },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: m.button }] },
      ],
    },
  };
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.INVITES_WHATSAPP_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
    const code = e?.cause?.code ?? e?.code;
    if (typeof code === 'string' && NOT_CONNECTED.has(code))
      return { ok: false, error: code, retryable: true };
    return { ok: false, error: 'timeout', retryable: false };
  }
  const json = (await res.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number; error_data?: { details?: string } };
  } | null;
  const id = json?.messages?.[0]?.id;
  if (res.ok && id) return { ok: true, id };
  const e = json?.error;
  const error =
    [e?.code, e?.error_data?.details ?? e?.message].filter(Boolean).join(' · ') || `HTTP ${res.status}`;
  // rate limits and Meta's own hiccups: try again later; the rest won't get better
  const retryable = res.status >= 500 || res.status === 429 || RETRY_LATER.has(Number(e?.code));
  return { ok: false, error, retryable };
}

/** X-Hub-Signature-256: "sha256=" + hex HMAC-SHA256 of the raw body with the app secret. */
export function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const given = header.slice(7);
  // anything but 64 hex digits isn't a signature (and would make timingSafeEqual throw)
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest();
  return timingSafeEqual(Buffer.from(given, 'hex'), expected);
}

/** The `value` of every change in a webhook delivery (entry[].changes[].value). */
function changeValues(payload: unknown): Record<string, unknown>[] {
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const changes = (entry as { changes?: unknown[] } | null)?.changes;
    if (!Array.isArray(changes)) return [];
    return changes.flatMap((change) => {
      const value = (change as { value?: unknown } | null)?.value;
      return value && typeof value === 'object' ? [value as Record<string, unknown>] : [];
    });
  });
}

export interface StatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
}

/** The message statuses in a webhook delivery (entry[].changes[].value.statuses[]). */
export function statusesOf(payload: unknown): StatusUpdate[] {
  const out: StatusUpdate[] = [];
  for (const value of changeValues(payload)) {
    const statuses = value.statuses;
    if (!Array.isArray(statuses)) continue;
    for (const s of statuses) {
      const st = s as {
        id?: unknown;
        status?: unknown;
        errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
      };
      if (typeof st.id !== 'string' || !['sent', 'delivered', 'read', 'failed'].includes(String(st.status)))
        continue;
      const e = st.errors?.[0];
      out.push({
        id: st.id,
        status: st.status as StatusUpdate['status'],
        error: e ? [e.code, e.error_data?.details ?? e.message ?? e.title].filter(Boolean).join(' · ') : null,
      });
    }
  }
  return out;
}

export interface InboundMessage {
  /** the sender, E.164 */
  from: string;
  /** what they wrote, or the label of the button they tapped */
  text: string;
}

/** Messages guests sent to the system's number (entry[].changes[].value.messages[]). */
export function inboundOf(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const value of changeValues(payload)) {
    const messages = value.messages;
    if (!Array.isArray(messages)) continue;
    for (const m of messages) {
      const msg = m as {
        from?: unknown;
        text?: { body?: unknown };
        button?: { text?: unknown; payload?: unknown };
        interactive?: { button_reply?: { title?: unknown } };
      };
      const from = typeof msg.from === 'string' ? msg.from.replace(/^\+/, '') : '';
      const text = [
        msg.text?.body,
        msg.button?.text,
        msg.button?.payload,
        msg.interactive?.button_reply?.title,
      ].find((v): v is string => typeof v === 'string');
      if (/^[1-9]\d{6,14}$/.test(from) && text) out.push({ from: `+${from}`, text });
    }
  }
  return out;
}
