import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { pipeline, type Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { OgPreview } from '../model/plan';
import { PreviewRequest } from '../model/schemas-ideas';
import { fail, gate, isRefusal, ok, type ApiResult, type PlanningDeps } from './types';

/**
 * The link preview of a card on the ideas board: the server reads the page of an address the host typed
 * (title, description, picture, site name) so the card can show it. That is a request the server makes
 * for a stranger's input, so every step is guarded against SSRF (reaching the server's own network):
 *
 * - only http / https, on the ordinary ports (80, 443, 8080, 8443), with no login in the address;
 * - the host name is resolved here, and every address it answers with must be a public one (not
 *   loopback, private, link-local — the cloud metadata address among them — CGNAT, unspecified,
 *   multicast, reserved, or the IPv6 equivalents, IPv4-mapped included); the request then goes to that
 *   address only (the connection's own lookup is pinned to it, so a second answer from the DNS cannot
 *   redirect it), with the host name kept for the Host header and TLS;
 * - at most three redirects, each followed by hand: its address goes through all of the above again;
 * - five seconds for the whole thing (an AbortSignal), at most 512 KB of the page read, only HTML,
 *   no cookies, no credentials, a neutral User-Agent, nothing logged.
 *
 * The DNS and the connection are injected (`PreviewFetchDeps`) so the tests can prove each refusal.
 */

export const PREVIEW_TIMEOUT_MS = 5000;
export const PREVIEW_MAX_BYTES = 512 * 1024;
export const PREVIEW_MAX_REDIRECTS = 3;
/** Previews an hour, per signed-in user. */
export const PREVIEW_LIMIT = { count: 30, windowSeconds: 3600 };
export const PREVIEW_TITLE_MAX = 160;
export const PREVIEW_DESCRIPTION_MAX = 300;
const SITE_MAX = 100;
const IMAGE_MAX = 1000;

export type PreviewFailure =
  | 'scheme'
  | 'port'
  | 'credentials'
  | 'host'
  | 'dns'
  | 'address'
  | 'redirects'
  | 'status'
  | 'type'
  | 'encoding'
  | 'empty'
  | 'timeout'
  | 'network';

/** Why a preview could not be made (for the tests: the answer to the host is always `preview_failed`). */
export class PreviewError extends Error {
  constructor(readonly reason: PreviewFailure) {
    super(reason);
  }
}

// ─── addresses ──────────────────────────────────────────────────────────────────────────────────

function parseIPv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number);
  // no leading zeros (010.0.0.1 is octal to some resolvers): not an address we vouch for
  if (m.slice(1, 5).some((p) => p.length > 1 && p.startsWith('0'))) return null;
  return octets.every((o) => o <= 255) ? octets : null;
}

/** Ranges that are not the public internet: [network, prefix length]. */
const BLOCKED_V4: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8], // "this network", unspecified
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, the cloud metadata address (169.254.169.254) included
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relays
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and the broadcast address
];
const v4Number = (o: readonly number[]) =>
  (((o[0]! << 24) | (o[1]! << 16) | (o[2]! << 8) | o[3]!) >>> 0) as number;
const BLOCKED_V4_NUMBERS = BLOCKED_V4.map(([net, bits]) => {
  const base = v4Number(parseIPv4(net)!);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { base: (base & mask) >>> 0, mask };
});

function publicV4(o: readonly number[]): boolean {
  const n = v4Number(o);
  return !BLOCKED_V4_NUMBERS.some((r) => (n & r.mask) >>> 0 === r.base);
}

/** Eight 16-bit groups, or null when it is not a well-formed IPv6 address (a zone id is not accepted). */
function parseIPv6(input: string): number[] | null {
  let s = input.toLowerCase();
  if (s.includes('%') || s.includes('[') || s.includes(']')) return null;
  if (s.includes('.')) {
    // the last 32 bits as a dotted quad
    const cut = s.lastIndexOf(':');
    const v4 = parseIPv4(s.slice(cut + 1));
    if (!v4) return null;
    s = `${s.slice(0, cut + 1)}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const part = (p: string) => (p === '' ? [] : p.split(':'));
  const head = part(halves[0]!);
  const tail = halves.length === 2 ? part(halves[1]!) : [];
  if (halves.length === 1 ? head.length !== 8 : head.length + tail.length > 7) return null;
  const groups = [
    ...head,
    ...(halves.length === 2 ? Array(8 - head.length - tail.length).fill('0') : []),
    ...tail,
  ];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Whether an address (IPv4 or IPv6, as the DNS or a URL writes it) is on the public internet. Anything
 * that cannot be read is not. For IPv6 only global unicast (2000::/3) qualifies — which leaves out
 * ::, ::1, fc00::/7, fe80::/10, ff00::/8 and everything else reserved — minus the documentation and
 * protocol-assignment ranges; IPv4-mapped (::ffff:a.b.c.d) and 6to4 (2002::/16) addresses are judged by
 * the IPv4 address they carry.
 */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const o = parseIPv4(ip);
    return !!o && publicV4(o);
  }
  if (family !== 6) return false;
  const g = parseIPv6(ip);
  if (!g) return false;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff)
    return publicV4([g6 >> 8, g6 & 255, g7 >> 8, g7 & 255]);
  if ((g0 & 0xe000) !== 0x2000) return false;
  if (g0 === 0x2001 && g1 < 0x0200) return false; // 2001::/23: protocol assignments, Teredo, ORCHID
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation
  if (g0 === 0x3fff && g1 < 0x1000) return false; // documentation
  if (g0 === 0x2002) return publicV4([g1 >> 8, g1 & 255, g2 >> 8, g2 & 255]); // 6to4
  return true;
}

// ─── addresses of the web ───────────────────────────────────────────────────────────────────────

const PORTS = new Set(['', '80', '443', '8080', '8443']);
/** Names that are never the public internet's, whatever a DNS says (the address check is the real gate). */
const INTERNAL_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'localdomain',
  'lan',
  'home',
  'corp',
  'intranet',
  'private',
  'invalid',
  'test',
  'example',
  'onion',
  'arpa',
];

/** The host as written in a URL, brackets and a trailing dot taken off. */
const hostOf = (url: URL) =>
  url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();

/**
 * What can be said about a URL without the network: only http(s), no login, an ordinary port, and a host
 * that is a public IP address or a public-looking name. Throws PreviewError otherwise.
 */
export function checkWebUrl(url: URL): { host: string; literal: boolean } {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new PreviewError('scheme');
  if (url.username || url.password) throw new PreviewError('credentials');
  if (!PORTS.has(url.port)) throw new PreviewError('port');
  const host = hostOf(url);
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new PreviewError('address');
    return { host, literal: true };
  }
  const labels = host.split('.');
  if (
    host.length > 253 ||
    labels.length < 2 ||
    !/^[a-z0-9._-]+$/.test(host) ||
    labels.some((l) => l === '' || l.length > 63) ||
    INTERNAL_SUFFIXES.includes(labels[labels.length - 1]!)
  )
    throw new PreviewError('host');
  return { host, literal: false };
}

// ─── the injected network ───────────────────────────────────────────────────────────────────────

export interface PreviewRequest {
  url: URL;
  /** the one address to connect to (already checked): the connection must not look the name up again */
  address: string;
  family: 4 | 6;
  headers: Record<string, string>;
  signal: AbortSignal;
}
export interface PreviewResponse {
  status: number;
  /** lower-case names */
  headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array> | null;
  /** gives the connection up (a redirect's body, or a page read as far as needed) */
  close?(): void;
}
export interface PreviewFetchDeps {
  /** every address (IPv4 and IPv6) the DNS gives for a host name */
  resolve(host: string): Promise<string[]>;
  fetch(request: PreviewRequest): Promise<PreviewResponse>;
}

const REQUEST_HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)',
  accept: 'text/html,application/xhtml+xml;q=0.9',
  'accept-language': 'he,en;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
  connection: 'close',
} as const;

/** The real DNS: getaddrinfo, every family, in the order the system gives. */
export async function liveResolve(host: string): Promise<string[]> {
  return (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);
}

/**
 * The real connection: node's http(s) client with its lookup replaced by the one checked address (so
 * the name is never resolved a second time), a fresh agent (no connection shared with another request),
 * no cookies, and the body decompressed as a stream (what is read of it is capped by the caller).
 */
export function liveFetch(req: PreviewRequest): Promise<PreviewResponse> {
  return new Promise((resolve, reject) => {
    const lib = req.url.protocol === 'https:' ? https : http;
    const pinned: LookupFunction = (_host, options, callback) => {
      if (options.all) callback(null, [{ address: req.address, family: req.family }]);
      else callback(null, req.address, req.family);
    };
    const request = lib.request(
      req.url,
      { method: 'GET', headers: req.headers, signal: req.signal, agent: false, lookup: pinned },
      (res) => {
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
        const encoding = (headers['content-encoding'] ?? '').toLowerCase().trim();
        const decoder =
          encoding === 'gzip' || encoding === 'x-gzip'
            ? createGunzip()
            : encoding === 'deflate'
              ? createInflate()
              : encoding === 'br'
                ? createBrotliDecompress()
                : null;
        let body: Readable = res;
        if (decoder) {
          delete headers['content-encoding'];
          pipeline(res, decoder, () => undefined);
          body = decoder;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers,
          body,
          close: () => {
            res.destroy();
            body.destroy();
          },
        });
      },
    );
    request.on('error', reject);
    request.end();
  });
}

// ─── reading the page ───────────────────────────────────────────────────────────────────────────

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Rejects when the signal does (a DNS lookup or a connection that never answers cannot hold us past it). */
function within<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new PreviewError('timeout'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new PreviewError('timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

/** The address to connect to: the checked one of a literal, else the DNS's (all of them public), IPv4 first. */
async function pin(
  url: URL,
  deps: PreviewFetchDeps,
  signal: AbortSignal,
): Promise<{ address: string; family: 4 | 6 }> {
  const { host, literal } = checkWebUrl(url);
  const addresses = literal ? [host] : await within(deps.resolve(host), signal);
  if (addresses.length === 0) throw new PreviewError('dns');
  // one private answer among public ones is still a refusal: the name is not ours to trust
  if (!addresses.every(isPublicAddress)) throw new PreviewError('address');
  const address = addresses.find((a) => isIP(a) === 4) ?? addresses[0]!;
  return { address, family: isIP(address) === 4 ? 4 : 6 };
}

async function readCapped(
  body: AsyncIterable<Uint8Array>,
  max: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    if (signal.aborted) throw new PreviewError('timeout');
    const room = max - total;
    if (chunk.byteLength >= room) {
      chunks.push(chunk.subarray(0, room));
      total = max;
      break;
    }
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** The page's text: the charset of the header, else of its <meta>, else UTF-8. */
export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
  const label =
    /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]{0,200}?charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// ─── parsing the page ───────────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  shy: '',
};

/** Basic HTML entities (the common named ones, and numeric): one pass, never decoded twice. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,8}|#[0-9]{1,10}|[a-z][a-z0-9]{1,9});/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1]!.toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
        return '';
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Decoded, with control and bidi-override characters out, whitespace collapsed, cut to `max` characters. */
export function cleanText(text: string | undefined, max: number): string | undefined {
  if (text === undefined) return undefined;
  const t = decodeEntities(text)
    .replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩​-‏﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return undefined;
  const chars = Array.from(t);
  return chars.length <= max
    ? t
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

/** The index of the '>' that closes a tag opened before `from` (quotes respected), or -1. */
function tagEnd(html: string, from: number): number {
  let quote = '';
  for (let i = from; i < html.length; i++) {
    const ch = html[i]!;
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i;
  }
  return -1;
}

const isSpace = (ch: string | undefined) =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';

function parseAttributes(s: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && (isSpace(s[i]) || s[i] === '/')) i++;
    let j = i;
    while (j < n && !isSpace(s[j]) && s[j] !== '/' && s[j] !== '=') j++;
    if (j === i) {
      i++;
      continue;
    }
    const name = s.slice(i, j).toLowerCase();
    i = j;
    while (i < n && isSpace(s[i])) i++;
    let value = '';
    if (s[i] === '=') {
      i++;
      while (i < n && isSpace(s[i])) i++;
      const q = s[i];
      if (q === '"' || q === "'") {
        const e = s.indexOf(q, i + 1);
        value = s.slice(i + 1, e === -1 ? n : e);
        i = e === -1 ? n : e + 1;
      } else {
        let k = i;
        while (k < n && !isSpace(s[k])) k++;
        value = s.slice(i, k);
        i = k;
      }
    }
    if (!out.has(name)) out.set(name, value);
  }
  return out;
}

/** An address for the card's picture: absolute https, no login, a public-looking host, short; else none. */
function pictureUrl(value: string | undefined, base: URL | string): string | undefined {
  const raw = value === undefined ? '' : decodeEntities(value).trim();
  if (!raw || raw.length > 4000) return undefined;
  try {
    const u = new URL(raw, base);
    if (u.protocol !== 'https:' || u.username || u.password) return undefined;
    checkWebUrl(u);
    const href = u.toString();
    return href.length <= IMAGE_MAX ? href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The preview a page offers: og:title / og:description / og:image / og:site_name, falling back to
 * twitter:* and <title> / the description meta. A linear scan of the head only (no regex over the whole
 * page, so a hostile page cannot make it slow): comments, scripts and styles skipped, entities decoded,
 * texts cut to sane lengths, the picture an absolute https address or none.
 */
export function parseHtml(html: string, base: URL | string): OgPreview {
  const meta = new Map<string, string>();
  let titleText: string | undefined;
  // lower-case (ASCII only, so indexes stay the same) to find closing tags
  const lower = html.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt + 4);
      if (e === -1) break;
      i = e + 3;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 40));
    if (!m) {
      i = lt + 1;
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2]!.toLowerCase();
    const end = tagEnd(html, lt + m[0].length);
    if (end === -1) break;
    const inner = html.slice(lt + m[0].length, end);
    i = end + 1;
    if (closing) {
      if (name === 'head') break;
      continue;
    }
    if (name === 'body') break;
    if (name === 'meta') {
      const attrs = parseAttributes(inner);
      const key = (attrs.get('property') ?? attrs.get('name') ?? attrs.get('itemprop'))?.trim().toLowerCase();
      const content = attrs.get('content');
      if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
    } else if (name === 'title') {
      const e = lower.indexOf('</title', i);
      if (titleText === undefined) titleText = html.slice(i, e === -1 ? Math.min(html.length, i + 1000) : e);
      if (e === -1) break;
      i = e;
    } else if (name === 'script' || name === 'style' || name === 'noscript' || name === 'template') {
      const e = lower.indexOf(`</${name}`, i);
      if (e === -1) break;
      i = e;
    }
  }
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k);
      if (v !== undefined && cleanText(v, 1000)) return v;
    }
    return undefined;
  };
  const preview: OgPreview = {};
  const title = cleanText(first('og:title', 'twitter:title') ?? titleText, PREVIEW_TITLE_MAX);
  const description = cleanText(
    first('og:description', 'twitter:description', 'description'),
    PREVIEW_DESCRIPTION_MAX,
  );
  const image = pictureUrl(
    first('og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'),
    base,
  );
  const site = cleanText(first('og:site_name'), SITE_MAX);
  if (title) preview.title = title;
  if (description) preview.description = description;
  if (image) preview.image = image;
  if (site) preview.site = site;
  return preview;
}

// ─── the fetch ──────────────────────────────────────────────────────────────────────────────────

/**
 * Reads the page at `rawUrl` and returns its preview, or throws a PreviewError (nothing about the
 * address or the page is logged). See the top of this file for what is refused.
 */
export async function fetchPreview(
  rawUrl: string,
  deps: PreviewFetchDeps,
  timeoutMs = PREVIEW_TIMEOUT_MS,
): Promise<OgPreview> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new PreviewError('scheme');
    }
    for (let redirects = 0; ;) {
      const { address, family } = await pin(url, deps, signal);
      const res = await within(
        deps.fetch({ url, address, family, headers: { ...REQUEST_HEADERS }, signal }),
        signal,
      );
      try {
        if (REDIRECTS.has(res.status)) {
          const location = res.headers.location;
          if (!location || redirects >= PREVIEW_MAX_REDIRECTS) throw new PreviewError('redirects');
          redirects++;
          try {
            url = new URL(location, url);
          } catch {
            throw new PreviewError('redirects');
          }
          continue;
        }
        if (res.status !== 200) throw new PreviewError('status');
        const contentType = res.headers['content-type'] ?? '';
        const type = contentType.split(';')[0]!.trim().toLowerCase();
        if (type !== 'text/html' && type !== 'application/xhtml+xml') throw new PreviewError('type');
        const encoding = (res.headers['content-encoding'] ?? 'identity').toLowerCase().trim();
        if (encoding !== 'identity' && encoding !== '') throw new PreviewError('encoding');
        if (!res.body) throw new PreviewError('empty');
        const bytes = await within(readCapped(res.body, PREVIEW_MAX_BYTES, signal), signal);
        const preview = parseHtml(decodeHtml(bytes, contentType), url);
        if (!preview.title && !preview.description && !preview.image && !preview.site)
          throw new PreviewError('empty');
        return preview;
      } finally {
        res.close?.();
      }
    }
  } catch (err) {
    if (err instanceof PreviewError) throw err;
    throw new PreviewError(signal.aborted ? 'timeout' : 'network');
  }
}

// ─── the route's handler ────────────────────────────────────────────────────────────────────────

export interface PreviewDeps extends PreviewFetchDeps {
  /** records one preview of this user's hour; false once it is spent (30 an hour) */
  rateHit(userId: string): Promise<boolean>;
}

/**
 * POST …/planning/ideas/preview { url } → `{ ok, preview: { title?, description?, image?, site? } }`.
 * 400 `invalid` (not an http(s) address), 429 `rate_limited` (30 an hour per user), and for any failure
 * to read the page 422 `preview_failed` — the card is saved either way, only without a preview.
 */
export async function previewOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
  preview: PreviewDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const parsed = PreviewRequest.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid', { fields: ['url'] });
  if (!(await preview.rateHit(userId))) return fail(429, 'rate_limited');
  try {
    return ok({ preview: await fetchPreview(parsed.data.url, preview) });
  } catch {
    return fail(422, 'preview_failed');
  }
}
