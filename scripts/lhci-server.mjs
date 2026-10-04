#!/usr/bin/env node
/**
 * The server Lighthouse CI runs against (lighthouserc.cjs): `next start` behind an HTTP/2 TLS front, the way the
 * site is served in production (a CDN speaks HTTP/2 to the browser) — https://localhost:3443.
 *
 * It matters for the numbers. Lighthouse's mobile preset simulates Slow 4G from a load it records on the machine,
 * and over plain HTTP/1.1 (what `next start` speaks) the simulation gives every request its own connection —
 * a handshake and a slow start each, six at a time — where over HTTP/2 they share one: the same pages score
 * ~0.9 s worse in LCP over HTTP/1.1 than over HTTP/2. A budget measured the first way would fail pages that
 * pass in production.
 *
 * One more thing a CDN does: a page it can cache is sent whole, with its length, and compressed (Brotli). That is
 * what /i/<slug>/<lang> is in production (ISR) — but the dev render route that stands for it in the CI
 * (/dev/invitations/render/…, no database needed) is rendered per request and streams its HTML, which Next
 * compresses a chunk at a time: ~100 KB where the cached page is ~20. This front sends that route the way a CDN
 * sends the cached page. The home page is rendered per request in production too (the UI language is a cookie),
 * so it is passed through as it is.
 *
 * Needs `openssl` for a throw-away certificate (Lighthouse's Chrome is started with --ignore-certificate-errors).
 * Prints "Ready in …" when it listens. Usage (after `npm run build`): node scripts/lhci-server.mjs
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const origin = Number(process.env.LHCI_ORIGIN_PORT || 3000);
const front = Number(process.env.LHCI_PORT || 3443);

// a certificate for localhost, good for a day
const dir = mkdtempSync(join(tmpdir(), 'lhci-'));
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    join(dir, 'key.pem'),
    '-out',
    join(dir, 'cert.pem'),
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ],
  { stdio: 'ignore' },
);

// the site itself
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(origin)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
process.on('exit', () => {
  next.kill();
  rmSync(dir, { recursive: true, force: true });
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));

// the HTTP/2 front: every request goes to the site, its answer comes back as it is (compressed by Next)
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
const server = http2.createSecureServer({
  key: readFileSync(join(dir, 'key.pem')),
  cert: readFileSync(join(dir, 'cert.pem')),
  allowHTTP1: true,
});
/** The pages a CDN would hold: what the invitations' dev render route stands for (see above). */
const cached = (req) => req.method === 'GET' && req.url.startsWith('/dev/invitations/render/');

server.on('request', (req, res) => {
  const headers = { ...req.headers, host: `127.0.0.1:${origin}` };
  for (const name of [':method', ':path', ':scheme', ':authority']) delete headers[name];
  const whole = cached(req);
  const accepts = String(req.headers['accept-encoding'] ?? '');
  // a page sent whole is compressed by this front: the site hands it over as it is
  if (whole) headers['accept-encoding'] = 'identity';
  const upstream = http.request(
    { host: '127.0.0.1', port: origin, path: req.url, method: req.method, headers, agent },
    (answer) => {
      const out = { ...answer.headers };
      for (const name of ['connection', 'keep-alive', 'transfer-encoding', 'upgrade']) delete out[name];
      if (!whole || answer.statusCode !== 200) {
        res.writeHead(answer.statusCode ?? 502, out);
        answer.pipe(res);
        return;
      }
      const parts = [];
      answer.on('data', (chunk) => parts.push(chunk));
      answer.on('end', () => {
        const body = Buffer.concat(parts);
        const br = /\bbr\b/.test(accepts);
        const packed = br
          ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
          : /\bgzip\b/.test(accepts)
            ? gzipSync(body)
            : body;
        res.writeHead(200, {
          ...out,
          ...(packed === body ? {} : { 'content-encoding': br ? 'br' : 'gzip' }),
          'content-length': packed.length,
          vary: 'accept-encoding',
        });
        res.end(packed);
      });
    },
  );
  upstream.on('error', () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});

let listening = false;
next.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (listening || !String(chunk).includes('Ready in')) return;
  listening = true;
  server.listen(front, () =>
    console.log(`Ready in https://localhost:${front} (HTTP/2 → next start :${origin})`),
  );
});
next.on('exit', (code) => process.exit(code ?? 1));
