// Stand-ins for outside APIs in end-to-end tests.
//
// The WhatsApp Cloud API (graph.facebook.com): accepts template messages, answers like Meta does, and
// remembers them (GET /__sent) so tests can check what went out. A number ending in 0000 isn't on
// WhatsApp (error 131026, not retried); one ending in 9999 hits the rate limit (130429) every time.
//
// The Anthropic Messages API (POST /v1/messages, streamed): answers the support assistant's questions
// with canned text, and remembers each request (GET /__ai) so tests can check what was sent. A question
// with "ארוכה" / "long" streams slowly (to stop it midway); one with "נפילה" / "crash" fails (overloaded).
//
// The live gallery's automatic check (POST /v1/messages with a photo, not streamed): answers JSON
// scores like the real model would, and remembers each request apart (GET /__ai/gallery). A square
// photo counts as suspicious (nsfw 0.62: held for the host), any other as fine — so tests can choose.
//
// The invitation's machine translation (POST /v1/messages, not streamed, the translation prompt):
// answers every text as "[<language code>] <text>" — placeholders and glossary words kept — and
// remembers each request (GET /__ai/translate).
//
// WhatsApp templates in languages Meta hasn't approved (MOCK_WHATSAPP_LANGS, e.g. "he,en,ru"; empty:
// all) answer error 132001, like Meta does.
//
// "Design it for me" (POST /v1/messages whose system prompt is the art director's, with the photos):
// answers three concepts on the first templates of the catalog it was sent, and remembers each request
// without the photos (GET /__ai/art). A mood with "crash" / "נפילה" fails (overloaded) and one with
// "garbage" / "זבל" answers something that isn't JSON — the app then composes the concepts itself.
//
// Event planning (POST /v1/messages, not streamed, the planning prompts — features/planning/server/ai.ts):
// a description answers a draft plan (a dozen tasks around the date and a budget split to 100%), a note
// answers a one-line summary and two next steps; a description with "crash" / "נפילה" fails (overloaded)
// and one with "garbage" / "זבל" answers something that isn't JSON. Each request is remembered
// (GET /__ai/planning).
//
// Seating rules in words (POST /v1/messages, the seating prompt — features/seating/words.ts): each
// comma-separated wish is matched to the units whose name (or group) it mentions — "near the stage" /
// "ליד הבמה" a zone wish, "not" / "לא" apart, else together; a wish that names nobody comes back as
// unclear. Each request is remembered (GET /__ai/seating).
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_WHATSAPP_PORT || 54340);
const token = process.env.MOCK_WHATSAPP_TOKEN || 'e2e-whatsapp-token';
const aiKey = process.env.MOCK_AI_KEY || 'e2e-anthropic-key';
const approvedLangs = (process.env.MOCK_WHATSAPP_LANGS || '')
  .split(',')
  .map((l) => l.trim())
  .filter(Boolean);
const sent = [];
const aiRequests = [];
const galleryAiRequests = [];
const translateRequests = [];
const artAiRequests = [];
const planningAiRequests = [];
const seatingAiRequests = [];
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
    match: /קישור לרשימת המוזמנים|guest list link/i,
    text: 'בשמחה, הנה הקישור: [רשימת האורחים](/app/invitations/:id/guests)',
  },
  {
    match: /עיצוב מתאים לחתונה|wedding design/i,
    text: 'לחתונה מתאים מאוד העיצוב [סהר בורדו](/app/invitations/new?template=sahar-bordeaux): אלגנטי וקלאסי.',
  },
  {
    // reproduces a real reported failure: the model named the screen but still wrote its raw technical
    // path in parentheses (twice) instead of a markdown link — SupportChat.client.tsx's
    // linkifyLabeledPaths() safety net must turn both into real links despite the bad model output.
    match: /סידור שולחנות|seating/i,
    text: [
      'ב-סידור שולחנות (/app/invitations/:id/seating) עושים את זה ככה:',
      '1. פותחים את הלשונית ומעלים או בוחרים את מפת האולם.',
      '2. מוסיפים שולחנות למפה.',
      '3. גוררים כל משפחה מהרשימה לשולחן המתאים.',
      'אפשר גם:',
      '* ללחוץ על שולחן כדי לערוך אותו.',
      '* לנעול שולחנות שלא רוצים להזיז.',
      '* להשתמש ב-סידור אוטומטי (/app/invitations/:id/seating) אם רוצים שהמערכת תנסה לסדר לבד.',
      'המשפחה נשארת יחד בשולחן אחד, לא מפצלים אותה.',
    ].join('\n'),
  },
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
  if (typeof body.system === 'string' && body.system.includes('art director')) return answerArt(res, body);
  if (typeof body.system === 'string' && body.system.startsWith('You help a host plan'))
    return answerPlanning(res, body);
  if (typeof body.system === 'string' && body.system.startsWith('You help a host seat'))
    return answerSeating(res, body);
  const photo = Array.isArray(body.messages?.[0]?.content)
    ? body.messages[0].content.find((c) => c?.type === 'image')
    : null;
  if (photo) return answerGalleryCheck(res, body, photo);
  if (
    typeof body.system === 'string' &&
    body.system.startsWith('You translate the texts of a digital invitation')
  )
    return answerTranslation(res, body);
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

/** A JPEG's width and height from its frame header (SOF). */
function jpegSize(bytes) {
  let p = 2;
  while (p + 9 < bytes.length && bytes[p] === 0xff) {
    const marker = bytes[p + 1];
    const length = bytes.readUInt16BE(p + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: bytes.readUInt16BE(p + 5), width: bytes.readUInt16BE(p + 7) };
    p += 2 + length;
  }
  return null;
}

function answerGalleryCheck(res, body, photo) {
  galleryAiRequests.push({
    model: body.model,
    system: body.system,
    structured: !!body.output_config?.format,
    mediaType: photo.source?.media_type,
    bytes: photo.source?.data ? Buffer.from(photo.source.data, 'base64').length : 0,
    text: body.messages[0].content.filter((c) => c.type === 'text').map((c) => c.text),
  });
  if (typeof body.system !== 'string' || !body.max_tokens || photo.source?.type !== 'base64')
    return json(res, 400, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'bad request' },
    });
  const size = jpegSize(Buffer.from(photo.source.data, 'base64'));
  const square = size && size.width === size.height;
  const scores = square
    ? { nsfw: 0.62, quality: 0.7, reason: 'test: a square photo counts as suspicious' }
    : { nsfw: 0.02, quality: 0.86, reason: 'happy guests at the event' };
  return json(res, 200, {
    id: `msg_e2e_gallery_${galleryAiRequests.length}`,
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: JSON.stringify(scores) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 420, output_tokens: 30 },
  });
}

function answerSeating(res, body) {
  let task = null;
  try {
    task = JSON.parse(String(body.messages?.[0]?.content ?? ''));
  } catch {
    // not the expected request
  }
  seatingAiRequests.push({ model: body.model, structured: !!body.output_config?.format, task });
  const units = Array.isArray(task?.units) ? task.units : [];
  const out = { rules: [], zones: [], accessible: [], unclear: [] };
  for (const wish of String(task?.wishes ?? '').split(/[,،]/)) {
    const w = wish.trim();
    if (!w) continue;
    const words = w.split(/\s+/).filter((x) => x.length > 2);
    const named = units
      .filter((u) => words.some((x) => u.name.includes(x) || (u.group && u.group.includes(x))))
      .map((u) => u.ref);
    if (!named.length) out.unclear.push(w);
    else if (/במה|stage/i.test(w)) out.zones.push({ units: named, zone: 'stage', near: true });
    else if (/(^|\s)(לא|not)(\s|$)/i.test(w)) out.rules.push({ kind: 'apart', units: named, hard: true });
    else out.rules.push({ kind: 'together', units: named, hard: true });
  }
  return json(res, 200, {
    id: `msg_e2e_seating_${seatingAiRequests.length}`,
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: JSON.stringify(out) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 500, output_tokens: 80 },
  });
}

function answerPlanning(res, body) {
  let task = null;
  try {
    task = JSON.parse(String(body.messages?.[0]?.content ?? ''));
  } catch {
    // not the expected request
  }
  const idea = body.system.includes('ideas board');
  planningAiRequests.push({ model: body.model, kind: idea ? 'idea' : 'plan', task });
  const text = String(task?.description ?? task?.note ?? '');
  if (/crash|נפילה/i.test(text))
    return json(res, 529, { type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } });
  const reply = (out) =>
    json(res, 200, {
      id: `msg_e2e_planning_${planningAiRequests.length}`,
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [{ type: 'text', text: out }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 600, output_tokens: 500 },
    });
  if (/garbage|זבל/i.test(text)) return reply('this is not json');
  if (idea)
    return reply(
      JSON.stringify({
        summary: 'A caterer worth a call',
        steps: [
          { title: 'Call the caterer and ask for a quote', category: 'catering' },
          { title: 'Book a tasting', category: 'catering' },
        ],
      }),
    );
  const he = task?.language === 'Hebrew';
  const t = (heText, enText) => (he ? heText : enText);
  const tasks = [
    ['לסגור מקום לאירוע', 'Book the place', -60, 'venue', 1],
    ['להזמין קייטרינג', 'Order the catering', -45, 'catering', 1],
    ['לבחור צלם', 'Choose a photographer', -40, 'photographer', 0],
    ['לתאם מוזיקה', 'Arrange the music', -30, 'dj', 0],
    ['לאשר תפריט סופי', 'Confirm the final menu', -14, 'catering', 0],
    ['לשלם יתרה לספקים', 'Pay the vendors’ balance', 0, null, 0],
    ['לשלוח מילות תודה', 'Send thank-yous', 7, null, 0],
  ].map(([he_, en_, offsetDays, category, priority]) => ({
    title: t(he_, en_),
    notes: null,
    offsetDays,
    category,
    priority,
  }));
  return reply(
    JSON.stringify({
      tasks,
      categories: [
        { key: 'venue', name: null, pct: 40, basis: 'fixed', required: true },
        { key: 'catering', name: null, pct: 40, basis: 'per_guest', required: true },
        { key: 'photographer', name: null, pct: 10, basis: 'fixed', required: false },
        { key: 'dj', name: null, pct: 10, basis: 'fixed', required: false },
      ],
      requiredVendors: ['venue', 'catering'],
    }),
  );
}

function answerTranslation(res, body) {
  let task = null;
  try {
    task = JSON.parse(String(body.messages?.[0]?.content ?? ''));
  } catch {
    // not the expected request
  }
  translateRequests.push({ model: body.model, structured: !!body.output_config?.format, task });
  if (!task || !Array.isArray(task.texts) || !body.max_tokens)
    return json(res, 400, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'bad request' },
    });
  const translations = task.texts.map((t) => ({ id: t.id, text: `[${task.to.code}] ${t.text}` }));
  return json(res, 200, {
    id: `msg_e2e_translate_${translateRequests.length}`,
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: JSON.stringify({ translations }) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 800, output_tokens: 600 },
  });
}

function answerArt(res, body) {
  const content = Array.isArray(body.messages?.[0]?.content) ? body.messages[0].content : [];
  const texts = content.filter((c) => c?.type === 'text').map((c) => c.text);
  const images = content.filter((c) => c?.type === 'image');
  const brief = texts[0] ?? '';
  const catalogJson = brief.startsWith('Catalog:\n') ? brief.slice(9).split('\n\n')[0] : '{}';
  let catalog = {};
  try {
    catalog = JSON.parse(catalogJson);
  } catch {
    catalog = {};
  }
  artAiRequests.push({
    model: body.model,
    structured: !!body.output_config?.format,
    images: images.length,
    mediaTypes: images.map((i) => i.source?.media_type),
    bytes: images.map((i) => (i.source?.data ? Buffer.from(i.source.data, 'base64').length : 0)),
    mood: catalog.mood ?? null,
    event: catalog.event ?? null,
    templates: (catalog.templates ?? []).map((t) => t.id),
    alreadyShown: catalog.alreadyShown ?? null,
  });
  if (!body.max_tokens || !images.length)
    return json(res, 400, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'bad request' },
    });
  const mood = String(catalog.mood ?? '');
  if (/crash|נפילה/i.test(mood))
    return json(res, 529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
  const reply = (text) =>
    json(res, 200, {
      id: `msg_e2e_art_${artAiRequests.length}`,
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 2400, output_tokens: 900 },
    });
  if (/garbage|זבל/i.test(mood)) return reply('I would love to help with that invitation!');
  const shown = new Set((catalog.alreadyShown ?? []).map((c) => c.templateId));
  const all = catalog.templates ?? [];
  const fresh = all.filter((t) => !shown.has(t.id));
  const pool = (fresh.length >= 3 ? fresh : all).slice(0, 3);
  const langs = (catalog.languages ?? ['he (Hebrew)']).map((l) => String(l).split(' ')[0]);
  const he = catalog.hostLanguage === 'Hebrew';
  const line = (heText, enText) => Object.fromEntries(langs.map((l) => [l, l === 'he' ? heText : enText]));
  const slots = Object.keys(catalog.slots ?? {});
  const concepts = pool.map((t, i) => ({
    name: he ? `קונספט בדיקה ${i + 1}` : `Test concept ${i + 1}`,
    rationale: he
      ? 'עיצוב מבדיקת הבינה המלאכותית, בצבעי התמונות.'
      : 'A design from the AI stand-in, in the photos’ colors.',
    templateId: t.id,
    palette: { ...t.palette, accent: ['#9c4a2f', '#2f5d8a', '#6b4f8a'][i % 3] },
    fontPairId: (t.fontPairs[i % t.fontPairs.length] ?? t.fontPairs[0]).id,
    opening: ['envelope', 'gate', 'curtain'][i % 3],
    motion: ['gentle', 'lively', 'calm'][i % 3],
    heroPhoto: i % images.length,
    placements: images
      .map((_, p) => p)
      .filter((p) => p !== i % images.length)
      .slice(0, 2)
      .map((photo, k) => {
        const slot = slots[(i + k) % Math.max(1, slots.length)] ?? 'band';
        return { slot, photo, layout: (catalog.slots?.[slot] ?? ['full_bleed'])[0] };
      }),
    copy: {
      eyebrow: line('בשמחה גדולה', 'With great joy'),
      closing: line('מחכים לראותכם', 'We can’t wait to see you'),
    },
  }));
  return reply(JSON.stringify({ concepts }));
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
  if (req.method === 'GET' && url.pathname === '/__ai/gallery') return json(res, 200, galleryAiRequests);
  if (req.method === 'GET' && url.pathname === '/__ai/translate') return json(res, 200, translateRequests);
  if (req.method === 'GET' && url.pathname === '/__ai/planning') return json(res, 200, planningAiRequests);
  if (req.method === 'GET' && url.pathname === '/__ai/seating') return json(res, 200, seatingAiRequests);
  if (req.method === 'GET' && url.pathname === '/__ai/art') return json(res, 200, artAiRequests);
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
  const language = body.template.language?.code;
  if (approvedLangs.length && !approvedLangs.includes(language))
    return json(res, 404, {
      error: {
        message: '(#132001) Template name does not exist in the translation',
        code: 132001,
        error_data: { details: `template name (${body.template.name}) does not exist in ${language}` },
      },
    });
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
    language,
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
