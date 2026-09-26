// A stand-in for Azure AI Speech's text to speech (REST) in end-to-end tests (features/voice).
//
// POST /cognitiveservices/v1 with the subscription key, SSML in and the MP3 output format asked:
// answers a few seconds of silent MP3 (MPEG-2 layer III, 24 kHz mono, 48 kbit/s — what the app asks
// for), and remembers each request (GET /__tts): the voice, the language and the words read, so tests
// can check what was sent. Words with "tts-fail" get a 500 (the app tries again later).
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_TTS_PORT || 55041);
const key = process.env.MOCK_TTS_KEY || 'e2e-tts-key';
const requests = [];

/** Silent frames: header FF F3 64 C0 (MPEG-2 L3, 48 kbit/s, 24 kHz, mono), 144 bytes each, 24 ms. */
function silence(seconds) {
  const frame = Buffer.alloc(144);
  frame.set([0xff, 0xf3, 0x64, 0xc0]);
  const frames = Math.ceil((seconds * 24000) / 576);
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}
const AUDIO = silence(6);

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/__tts') return json(res, 200, requests);
  if (req.method !== 'POST' || url.pathname !== '/cognitiveservices/v1')
    return json(res, 404, { error: 'not found' });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (req.headers['ocp-apim-subscription-key'] !== key) {
    res.writeHead(401);
    return res.end();
  }
  const voice = raw.match(/<voice name="([^"]+)"/)?.[1] ?? null;
  const lang = raw.match(/xml:lang="([^"]+)"/)?.[1] ?? null;
  const text = raw
    .replace(/<break[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  requests.push({
    voice,
    lang,
    format: req.headers['x-microsoft-outputformat'] ?? null,
    contentType: req.headers['content-type'] ?? null,
    text,
  });
  if (!raw.startsWith('<speak') || !voice || req.headers['content-type'] !== 'application/ssml+xml') {
    res.writeHead(400);
    return res.end();
  }
  if (text.includes('tts-fail')) {
    res.writeHead(500);
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': AUDIO.length });
  res.end(AUDIO);
}).listen(port, '127.0.0.1', () => console.log(`mock text to speech on :${port}`));
