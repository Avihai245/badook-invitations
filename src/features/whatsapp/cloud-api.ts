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

export type SendResult = { ok: true; id: string } | { ok: false; error: string; retryable: boolean };

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
  const url = `${env.INVITES_WHATSAPP_API_BASE}/${env.INVITES_WHATSAPP_API_VERSION}/${env.INVITES_WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: m.to.replace(/^\+/, ''),
    type: 'template',
    biz_opaque_callback_data: m.ref,
    template: {
      name: env.INVITES_WHATSAPP_TEMPLATE,
      language: { code: env.INVITES_WHATSAPP_TEMPLATE_LANG },
      components: [
        { type: 'body', parameters: [param(m.guestName), param(m.hosts), param(m.event), param(m.date)] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: m.linkSuffix }] },
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
    return { ok: false, error: err instanceof Error ? err.message : 'network', retryable: true };
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
  // throughput / rate limits and Meta's own hiccups: try again later; the rest won't get better
  const retryable = res.status >= 500 || res.status === 429 || e?.code === 130429 || e?.code === 131056;
  return { ok: false, error, retryable };
}

/** X-Hub-Signature-256: "sha256=" + hex HMAC-SHA256 of the raw body with the app secret. */
export function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export interface StatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
}

/** The message statuses in a webhook delivery (entry[].changes[].value.statuses[]). */
export function statusesOf(payload: unknown): StatusUpdate[] {
  const out: StatusUpdate[] = [];
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown[] } }).value?.statuses;
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
          error: e
            ? [e.code, e.error_data?.details ?? e.message ?? e.title].filter(Boolean).join(' · ')
            : null,
        });
      }
    }
  }
  return out;
}
