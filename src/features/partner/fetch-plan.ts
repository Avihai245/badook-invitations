import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import { isPublicAddress } from './plan-file';

/**
 * Fetches a venue's floor plan from the URL the partner sent — without letting that URL reach inside our
 * network (SSRF): https only, on the default port, no credentials in the URL; the host name is resolved
 * once and every address it resolves to must be public (plan-file.ts isPublicAddress), and the
 * connection goes to that checked address (a second lookup can't swap in another — DNS rebinding);
 * redirects (up to 3) are checked the same way; the whole transfer has a time limit, and the body is cut
 * off as soon as it passes the size cap (a lying Content-Length changes nothing).
 */

export class PlanFetchError extends Error {
  constructor(
    readonly code: 'bad_url' | 'blocked_address' | 'too_large' | 'timeout' | 'failed',
    readonly status?: number,
  ) {
    super(code);
  }
}

type Lookup = (
  hostname: string,
  options: { all: true },
  cb: (err: Error | null, addresses: LookupAddress[]) => void,
) => void;

export interface FetchPlanOptions {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** tests: resolve names differently */
  lookup?: Lookup;
  /** tests: which addresses may be reached (default: public ones only) */
  allowAddress?: (ip: string) => boolean;
  /** tests: a certificate authority to trust */
  ca?: string;
  /** tests: the port to connect to (the URL's is always 443) */
  port?: number;
}

async function resolve(
  hostname: string,
  lookup: Lookup,
  allow: (ip: string) => boolean,
): Promise<LookupAddress> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  const family = isIP(literal);
  const addresses: LookupAddress[] = family
    ? [{ address: literal, family }]
    : await new Promise((ok, fail) =>
        lookup(hostname, { all: true }, (err, list) => (err ? fail(new PlanFetchError('failed')) : ok(list))),
      );
  if (!addresses.length) throw new PlanFetchError('failed');
  // every address the name resolves to, not just the one a connection would try first
  if (!addresses.every((a) => allow(a.address))) throw new PlanFetchError('blocked_address');
  return addresses[0]!;
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PlanFetchError('bad_url');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new PlanFetchError('bad_url');
  return url;
}

/** The body of the plan's URL (at most `maxBytes`) and the Content-Type the server declared. */
export async function fetchPlanFile(
  raw: string,
  {
    maxBytes,
    timeoutMs = 15_000,
    maxRedirects = 3,
    lookup = dnsLookup as Lookup,
    allowAddress = isPublicAddress,
    ca,
    port = 443,
  }: FetchPlanOptions,
): Promise<{ bytes: Buffer; contentType: string | null }> {
  const deadline = Date.now() + timeoutMs;
  let url = checkUrl(raw);
  for (let hop = 0; ; hop++) {
    const pinned = await resolve(url.hostname, lookup, allowAddress);
    const left = deadline - Date.now();
    if (left <= 0) throw new PlanFetchError('timeout');
    const answer = await new Promise<{
      status: number;
      location: string | null;
      bytes: Buffer;
      contentType: string | null;
    }>((ok, fail) => {
      const options: RequestOptions = {
        method: 'GET',
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port,
        path: `${url.pathname}${url.search}`,
        headers: {
          accept: 'image/png,image/jpeg,image/webp,application/pdf;q=0.9,*/*;q=0.1',
          'user-agent': 'Badook-Venue-Plans/1',
        },
        // connect to the address that was checked, whatever the name resolves to by then (Node asks
        // for every address when it tries IPv4 and IPv6 in parallel)
        lookup: (_host, opts, cb) =>
          (opts as { all?: boolean }).all
            ? (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, [pinned])
            : (cb as (e: null, a: string, f: number) => void)(null, pinned.address, pinned.family),
        ...(ca ? { ca } : {}),
        timeout: left,
      };
      const req = request(options, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return ok({
            status,
            location: res.headers.location ?? null,
            bytes: Buffer.alloc(0),
            contentType: null,
          });
        }
        if (status !== 200) {
          res.resume();
          return fail(new PlanFetchError('failed', status));
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return fail(new PlanFetchError('too_large'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            req.destroy();
            fail(new PlanFetchError('too_large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          ok({
            status,
            location: null,
            bytes: Buffer.concat(chunks),
            contentType: res.headers['content-type'] ?? null,
          }),
        );
        res.on('error', () => fail(new PlanFetchError('failed')));
      });
      const timer = setTimeout(() => {
        req.destroy();
        fail(new PlanFetchError('timeout'));
      }, left);
      req.on('timeout', () => {
        req.destroy();
        fail(new PlanFetchError('timeout'));
      });
      req.on('error', (err) => fail(err instanceof PlanFetchError ? err : new PlanFetchError('failed')));
      req.on('close', () => clearTimeout(timer));
      req.end();
    });
    if (!answer.location) return { bytes: answer.bytes, contentType: answer.contentType };
    if (hop >= maxRedirects) throw new PlanFetchError('failed', answer.status);
    url = checkUrl(new URL(answer.location, url).toString());
  }
}
