// Stand-ins for outside APIs in end-to-end tests.
//
// The WhatsApp Cloud API (graph.facebook.com): accepts template messages, answers like Meta does, and
// remembers them (GET /__sent) so tests can check what went out. A number ending in 0000 isn't on
// WhatsApp (error 131026, not retried); one ending in 9999 hits the rate limit (130429) every time.
//
// The Anthropic Messages API (POST /v1/messages, streamed): answers the support assistant's questions
// with canned text, and remembers each request (GET /__ai) so tests can check what was sent. A question
// with "ארוכה" / "long" streams slowly (to stop it midway); one with "נפילה" / "crash" fails (overloaded).
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_WHATSAPP_PORT || 54340);
const token = process.env.MOCK_WHATSAPP_TOKEN || 'e2e-whatsapp-token';
const aiKey = process.env.MOCK_AI_KEY || 'e2e-anthropic-key';
const sent = [];
const aiRequests = [];
let n = 0;

const ANSWERS = [
  {
    match: /אקסל|excel/i,
    text: [
      'בשמחה! כך מעלים רשימת מוזמנים:',
      '1. פותחים את ההזמנה ובוחרים **מוזמנים**.',
      '2. לוחצים על "ייבוא מקובץ" ובוחרים את קובץ האקסל.',
      '3. בודקים שהעמודות של השם והטלפון זוהו, ולוחצים על ייבוא.',
      '',
      'אם משהו לא מסתדר, כתבו לנו: /contact',
      'ולא ללחוץ על זה: https://evil.example/login',
    ].join('\n'),
  },
  { match: /מתכון|recipe/i, text: 'אני יכול לעזור רק בנושאים של Badook. רוצים עזרה עם ההזמנה שלכם?' },
  {
    match: /ארוכה|long/i,
    text: Array.from({ length: 60 }, (_, i) => `זו שורה מספר ${i + 1} בתשובה ארוכה.`).join('\n'),
    slow: true,
  },
];

async function answerAi(req, res) {
  if (req.headers['x-api-key'] !== aiKey)
    return json(res, 401, {
      type: 'error',
      error: { type: 'authentication_error', message: 'invalid x-api-key' },
    });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || '{}');
  aiRequests.push({ headers: { version: req.headers['anthropic-version'] ?? null }, body });
  const question = String(body.messages?.at(-1)?.content ?? '');
  if (!body.stream || !Array.isArray(body.system) || body.messages?.at(-1)?.role !== 'user')
    return json(res, 400, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'bad request' },
    });
  if (/נפילה|crash/i.test(question))
    return json(res, 529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
  const found = ANSWERS.find((a) => a.match.test(question));
  const text = found?.text ?? `שאלה טובה! הנה מה שחשוב לדעת על "${question.slice(0, 40)}".`;
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  send('message_start', { message: { id: `msg_e2e_${aiRequests.length}`, role: 'assistant', content: [] } });
  send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  send('ping', {});
  // a few characters at a time, split anywhere (even inside a line)
  const step = found?.slow ? 12 : 9;
  for (let i = 0; i < text.length; i += step) {
    if (res.destroyed) return;
    send('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(i, i + step) } });
    await new Promise((r) => setTimeout(r, found?.slow ? 120 : 8));
  }
  send('content_block_stop', { index: 0 });
  send('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 42 } });
  send('message_stop', {});
  res.end();
}

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
  if (req.method === 'GET' && url.pathname === '/__ai') return json(res, 200, aiRequests);
  if (req.method === 'POST' && url.pathname === '/v1/messages') return answerAi(req, res);
  const match = url.pathname.match(/^\/v[\d.]+\/(\d+)\/messages$/);
  if (req.method !== 'POST' || !match)
    return json(res, 404, { error: { message: 'Unknown path', code: 100 } });
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
      error: {
        message: 'Message undeliverable',
        code: 131026,
        error_data: { details: 'not a WhatsApp user' },
      },
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
}).listen(port, '127.0.0.1', () => console.log(`mock WhatsApp + AI on :${port}`));
