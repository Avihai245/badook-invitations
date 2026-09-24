// A stand-in for the WhatsApp Cloud API (graph.facebook.com) in end-to-end tests: accepts template
// messages, answers like Meta does, and remembers them (GET /__sent) so tests can check what went out.
// A number ending in 0000 isn't on WhatsApp (error 131026, not retried); one ending in 9999 hits the
// rate limit (130429) every time.
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_WHATSAPP_PORT || 54340);
const token = process.env.MOCK_WHATSAPP_TOKEN || 'e2e-whatsapp-token';
const sent = [];
let n = 0;

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/__sent') {
    const to = url.searchParams.get('to');
    return json(res, 200, to ? sent.filter((m) => m.to === to) : sent);
  }
  const match = url.pathname.match(/^\/v[\d.]+\/(\d+)\/messages$/);
  if (req.method !== 'POST' || !match) return json(res, 404, { error: { message: 'Unknown path', code: 100 } });
  if (req.headers.authorization !== `Bearer ${token}`)
    return json(res, 401, { error: { message: 'Invalid OAuth access token.', code: 190 } });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || '{}');
  if (body.messaging_product !== 'whatsapp' || body.type !== 'template' || !body.template?.name)
    return json(res, 400, { error: { message: 'Invalid parameter', code: 100 } });
  const to = String(body.to);
  if (to.endsWith('9999')) return json(res, 400, { error: { message: 'Rate limit hit', code: 130429 } });
  if (to.endsWith('0000'))
    return json(res, 400, {
      error: { message: 'Message undeliverable', code: 131026, error_data: { details: 'not a WhatsApp user' } },
    });
  const id = `wamid.e2e.${++n}`;
  const [bodyPart, button] = body.template.components ?? [];
  sent.push({
    id,
    to,
    template: body.template.name,
    language: body.template.language?.code,
    params: (bodyPart?.parameters ?? []).map((p) => p.text),
    button: button?.parameters?.[0]?.text ?? null,
    ref: body.biz_opaque_callback_data ?? null,
  });
  return json(res, 200, {
    messaging_product: 'whatsapp',
    contacts: [{ input: to, wa_id: to }],
    messages: [{ id, message_status: 'accepted' }],
  });
}).listen(port, '127.0.0.1', () => console.log(`mock WhatsApp on :${port}`));
