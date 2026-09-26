import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  changeEmail,
  lookupUser,
  provisionUser,
  type PartnerDeps,
  type PartnerUser,
} from '@/features/partner/api';
import { fetchPlanFile, PlanFetchError } from '@/features/partner/fetch-plan';
import { isPublicAddress, sniffPlan } from '@/features/partner/plan-file';
import {
  getVenue,
  MAX_PLAN_BYTES,
  putVenue,
  type VenueDeps,
  type VenueRecord,
} from '@/features/partner/venues';

// The partner's venues (src/features/partner/venues.ts): the floor plan by URL or base64 — what the
// bytes really are, the size cap, the SSRF guard of the fetcher (fetch-plan.ts) — and linking a
// partner's user to a venue on POST / PATCH /users.

/** A real PNG of w×h (one gray row per line). */
function png(w: number, h: number): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const rows = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w, 200)])),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A JPEG header: SOI, an EXIF APP1 with `orientation`, and a baseline frame of w×h. */
function jpeg(w: number, h: number, orientation = 1): Buffer {
  const tiff = Buffer.from([
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]),
    exif,
  ]);
  const sof = Buffer.from([
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    h >> 8,
    h & 0xff,
    w >> 8,
    w & 0xff,
    0x03,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof, Buffer.from([0xff, 0xd9])]);
}

function webp(kind: 'VP8X' | 'VP8L' | 'VP8 ', w: number, h: number): Buffer {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0);
  b.writeUInt32LE(32, 4);
  b.write('WEBP', 8);
  b.write(kind, 12);
  if (kind === 'VP8X') {
    b.writeUIntLE(w - 1, 24, 3);
    b.writeUIntLE(h - 1, 27, 3);
  } else if (kind === 'VP8L') {
    b[20] = 0x2f;
    b.writeUInt32LE(((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14), 21);
  } else {
    b[23] = 0x9d;
    b[24] = 0x01;
    b[25] = 0x2a;
    b.writeUInt16LE(w, 26);
    b.writeUInt16LE(h, 28);
  }
  return b;
}

describe('what a plan file really is', () => {
  it('reads PNG, JPEG (EXIF rotation included), WebP and PDF — and nothing else', () => {
    expect(sniffPlan(png(40, 30))).toEqual({ type: 'image/png', width: 40, height: 30 });
    expect(sniffPlan(jpeg(1200, 800))).toEqual({ type: 'image/jpeg', width: 1200, height: 800 });
    // a phone photo turned a quarter: the browser shows it 800 wide
    expect(sniffPlan(jpeg(1200, 800, 6))).toEqual({ type: 'image/jpeg', width: 800, height: 1200 });
    expect(sniffPlan(webp('VP8X', 3000, 2000))).toEqual({ type: 'image/webp', width: 3000, height: 2000 });
    expect(sniffPlan(webp('VP8L', 640, 480))).toEqual({ type: 'image/webp', width: 640, height: 480 });
    expect(sniffPlan(webp('VP8 ', 320, 200))).toEqual({ type: 'image/webp', width: 320, height: 200 });
    expect(sniffPlan(Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj'))).toEqual({
      type: 'application/pdf',
      width: null,
      height: null,
    });
    expect(sniffPlan(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffPlan(Buffer.from('GIF89a......'))).toBeNull();
  });
});

describe('addresses the server may fetch from', () => {
  it('only public ones — never loopback, private, link-local (cloud metadata), reserved, however written', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e'])
      expect(isPublicAddress(ip)).toBe(true);
    for (const ip of [
      '127.0.0.1',
      '127.5.6.7',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '198.18.0.1',
      '::1',
      '::',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:169.254.169.254',
      '64:ff9b::10.0.0.1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
      '2002:7f00:1::1',
      'not-an-ip',
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });
});

describe('fetching a plan by URL', () => {
  const noLookup = vi.fn();
  it('refuses anything but https on its port, and URLs with credentials — before any connection', async () => {
    for (const url of [
      'http://plans.example.com/a.png',
      'ftp://plans.example.com/a.png',
      'https://user:pass@plans.example.com/a.png',
      'https://plans.example.com:8443/a.png',
      'file:///etc/passwd',
      'not a url',
    ])
      await expect(fetchPlanFile(url, { maxBytes: 100, lookup: noLookup })).rejects.toMatchObject({
        code: 'bad_url',
      });
    expect(noLookup).not.toHaveBeenCalled();
  });

  it('refuses a name that resolves to an inner address (any of its addresses), and inner IP literals', async () => {
    const lookup = (
      _h: string,
      _o: unknown,
      cb: (e: null, a: { address: string; family: number }[]) => void,
    ) =>
      cb(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ]);
    await expect(
      fetchPlanFile('https://sneaky.example.com/plan.png', { maxBytes: 100, lookup }),
    ).rejects.toMatchObject({
      code: 'blocked_address',
    });
    for (const url of [
      'https://127.0.0.1/p.png',
      'https://[::1]/p.png',
      'https://169.254.169.254/latest/meta-data',
      'https://0x7f.1/p.png',
    ])
      await expect(fetchPlanFile(url, { maxBytes: 100 }), url).rejects.toMatchObject({
        code: 'blocked_address',
      });
  });

  describe('against a local HTTPS server', () => {
    let dir = '';
    let cert = '';
    let server: Server | null = null;
    let port = 0;
    const big = Buffer.alloc(64 * 1024, 7);
    const plan = png(20, 10);
    const haveOpenssl = (() => {
      try {
        execFileSync('openssl', ['version'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    })();

    beforeAll(async () => {
      if (!haveOpenssl) return;
      // a throwaway certificate for plans.test (never committed)
      dir = mkdtempSync(join(tmpdir(), 'venue-plan-tls-'));
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
          '2',
          '-subj',
          '/CN=plans.test',
          '-addext',
          'subjectAltName=DNS:plans.test',
        ],
        { stdio: 'ignore' },
      );
      cert = readFileSync(join(dir, 'cert.pem'), 'utf8');
      server = createServer({ key: readFileSync(join(dir, 'key.pem')), cert }, (req, res) => {
        if (req.url === '/plan.png') {
          res.writeHead(200, { 'content-type': 'image/png', 'content-length': plan.length });
          return res.end(plan);
        }
        if (req.url === '/moved') {
          res.writeHead(302, { location: '/plan.png' });
          return res.end();
        }
        if (req.url === '/to-inside') {
          res.writeHead(302, { location: 'https://inside.test/plan.png' });
          return res.end();
        }
        if (req.url === '/big') {
          // no Content-Length: the cap must hold while streaming
          res.writeHead(200, { 'content-type': 'image/png' });
          res.write(big);
          return res.end(big);
        }
        if (req.url === '/slow') return; // never answers
        res.writeHead(404);
        res.end();
      });
      await new Promise<void>((ok) => server!.listen(0, '127.0.0.1', ok));
      port = (server!.address() as { port: number }).port;
    });
    afterAll(() => {
      server?.close();
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    // plans.test is the local server; inside.test stands for an address inside the network
    const lookup = (
      host: string,
      _o: unknown,
      cb: (e: null, a: { address: string; family: number }[]) => void,
    ) => cb(null, [{ address: host === 'inside.test' ? '10.0.0.9' : '127.0.0.1', family: 4 }]);
    // the local server stands in for a public address
    const allowAddress = (ip: string) => ip === '127.0.0.1';
    // the fetcher only speaks to port 443; the test server is elsewhere
    const at = (path: string) => `https://plans.test${path}`;
    const opts = () => ({ maxBytes: 100_000, lookup, allowAddress, ca: cert, timeoutMs: 1500, port });

    it.skipIf(!haveOpenssl)('fetches the file and follows a redirect', async () => {
      const { bytes } = await fetchPlanFile(at('/plan.png'), opts());
      expect(Buffer.compare(bytes, plan)).toBe(0);
      const moved = await fetchPlanFile(at('/moved'), opts());
      expect(Buffer.compare(moved.bytes, plan)).toBe(0);
      await expect(fetchPlanFile(at('/nope'), opts())).rejects.toMatchObject({ code: 'failed', status: 404 });
    });

    it.skipIf(!haveOpenssl)('a redirect into the network is refused like the URL itself', async () => {
      await expect(fetchPlanFile(at('/to-inside'), opts())).rejects.toMatchObject({
        code: 'blocked_address',
      });
    });

    it.skipIf(!haveOpenssl)('stops at the size cap while streaming, and at the time limit', async () => {
      await expect(fetchPlanFile(at('/big'), opts())).rejects.toMatchObject({ code: 'too_large' });
      await expect(fetchPlanFile(at('/slow'), { ...opts(), timeoutMs: 400 })).rejects.toMatchObject({
        code: 'timeout',
      });
    });

    it.skipIf(!haveOpenssl)('checks the certificate: a server it can’t trust is a failure', async () => {
      await expect(fetchPlanFile(at('/plan.png'), { ...opts(), ca: undefined })).rejects.toMatchObject({
        code: 'failed',
      });
    });
  });
});

// ─── the venue API ───────────────────────────────────────────────────────────────────────────────

function venueWorld() {
  const venues = new Map<string, VenueRecord>();
  const stored = new Map<string, { bytes: Uint8Array; type: string }>();
  const removed: string[] = [];
  let n = 0;
  const deps: VenueDeps = {
    rateHit: vi.fn(async () => true),
    get: async (id) => venues.get(id) ?? null,
    put: vi.fn(async (id, fields, values, plan) => {
      const current = venues.get(id);
      if (!current && !fields.includes('name')) return { ok: false as const, code: 'name_required' as const };
      const v: VenueRecord = current ?? {
        venueId: id,
        name: values.name!,
        address: null,
        widthMeters: null,
        floorPlan: null,
        users: 0,
        createdAt: '2026-09-26T10:00:00Z',
        updatedAt: '2026-09-26T10:00:00Z',
      };
      const old = v.floorPlan?.path ?? null;
      const next: VenueRecord = {
        ...v,
        name: fields.includes('name') && values.name ? values.name : v.name,
        address: fields.includes('address') ? values.address : v.address,
        widthMeters: fields.includes('widthMeters') ? values.widthMeters : v.widthMeters,
        floorPlan: fields.includes('floorPlan')
          ? plan && { ...plan, updatedAt: '2026-09-26T10:00:00Z' }
          : v.floorPlan,
      };
      venues.set(id, next);
      return {
        ok: true as const,
        created: !current,
        venue: next,
        replacedPlan: old && old !== next.floorPlan?.path ? old : null,
      };
    }),
    fetchPlan: vi.fn(async (url: string) => {
      if (url.endsWith('/huge.png')) throw new PlanFetchError('too_large');
      if (url.includes('10.0.0.1')) throw new PlanFetchError('blocked_address');
      if (url.endsWith('/404.png')) throw new PlanFetchError('failed', 404);
      return url.endsWith('.pdf') ? Buffer.from('%PDF-1.4 plan') : png(300, 200);
    }),
    store: vi.fn(async (path, bytes, type) => void stored.set(path, { bytes, type })),
    remove: vi.fn(async (path) => void removed.push(path)),
    planUrl: (path) => `https://cdn.example.com/venue-plans/${path}`,
    folder: (id) => `f-${id}`,
    newId: () => `file-${++n}`,
  };
  return { deps, venues, stored, removed };
}

describe('PUT / GET /api/partner/v1/venues/{venueId}', () => {
  it('creates a venue with its plan from a URL: stored by what it really is, with its size', async () => {
    const { deps, stored } = venueWorld();
    const res = await putVenue(
      'hall-17',
      {
        name: 'אולמי הגן',
        address: 'הרצל 1, ראשון לציון',
        widthMeters: 36.5,
        floorPlan: { url: 'https://venues.example.com/hall.png' },
      },
      deps,
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ok: true,
      created: true,
      venue: {
        venueId: 'hall-17',
        name: 'אולמי הגן',
        widthMeters: 36.5,
        floorPlan: {
          url: 'https://cdn.example.com/venue-plans/venues/f-hall-17/file-1.png',
          contentType: 'image/png',
          width: 300,
          height: 200,
        },
      },
    });
    expect([...stored.keys()]).toEqual(['venues/f-hall-17/file-1.png']);
    // the partner never sees our storage path
    expect(JSON.stringify(res.body)).not.toContain('"path"');
  });

  it('takes base64 (a data: URL too), decides by the bytes, and replaces the old plan', async () => {
    const { deps, removed } = venueWorld();
    await putVenue('hall-1', { name: 'Loft', floorPlan: { url: 'https://venues.example.com/a.png' } }, deps);
    const pdf = Buffer.from('%PDF-1.7 the hall').toString('base64');
    // declared an image; it is a PDF — what the bytes are wins
    const res = await putVenue(
      'hall-1',
      { floorPlan: { base64: `data:image/png;base64,${pdf}`, contentType: 'image/png' } },
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      created: false,
      venue: { name: 'Loft', floorPlan: { contentType: 'application/pdf', width: null } },
    });
    expect(removed).toEqual(['venues/f-hall-1/file-1.png']);
  });

  it('only the fields sent change; null clears; nothing sent is invalid', async () => {
    const { deps } = venueWorld();
    await putVenue('v', { name: 'A', address: 'x', widthMeters: 20 }, deps);
    const res = await putVenue('v', { address: null }, deps);
    expect(res.body).toMatchObject({ venue: { name: 'A', address: null, widthMeters: 20 } });
    expect(await putVenue('v', {}, deps)).toMatchObject({
      status: 400,
      body: { code: 'invalid', fields: ['(body)'] },
    });
  });

  it('refuses: a new venue without a name (before fetching anything), bad ids, http, inner addresses, too big, not an image', async () => {
    const { deps } = venueWorld();
    expect(
      await putVenue('new', { floorPlan: { url: 'https://venues.example.com/a.png' } }, deps),
    ).toMatchObject({
      status: 400,
      body: { fields: ['name'] },
    });
    expect(deps.fetchPlan).not.toHaveBeenCalled();
    expect(await putVenue('bad id/../x', { name: 'A' }, deps)).toMatchObject({
      status: 400,
      body: { fields: ['venueId'] },
    });
    expect(
      await putVenue('v', { name: 'A', floorPlan: { url: 'http://venues.example.com/a.png' } }, deps),
    ).toMatchObject({
      status: 400,
      body: { fields: ['floorPlan.url'] },
    });
    expect(
      await putVenue('v', { name: 'A', floorPlan: { url: 'https://10.0.0.1/a.png' } }, deps),
    ).toMatchObject({
      status: 400,
      body: { fields: ['floorPlan.url'] },
    });
    expect(
      await putVenue('v', { name: 'A', floorPlan: { url: 'https://venues.example.com/huge.png' } }, deps),
    ).toMatchObject({
      status: 413,
      body: { code: 'too_large', max: MAX_PLAN_BYTES },
    });
    expect(
      await putVenue('v', { name: 'A', floorPlan: { url: 'https://venues.example.com/404.png' } }, deps),
    ).toMatchObject({
      status: 422,
      body: { code: 'fetch_failed', status: 404 },
    });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ).toString('base64');
    expect(await putVenue('v', { name: 'A', floorPlan: { base64: svg } }, deps)).toMatchObject({
      status: 415,
      body: { code: 'unsupported_type' },
    });
    expect(await putVenue('v', { name: 'A', floorPlan: { base64: '***not base64***' } }, deps)).toMatchObject(
      { status: 400 },
    );
    expect(await putVenue('v', { name: 'A', extra: 1 }, deps)).toMatchObject({ status: 400 });
  });

  it('a rate-limited partner gets 429; GET returns the venue or 404', async () => {
    const { deps } = venueWorld();
    await putVenue('v', { name: 'A' }, deps);
    expect(await getVenue('v', deps)).toMatchObject({
      status: 200,
      body: { ok: true, venue: { venueId: 'v', floorPlan: null } },
    });
    expect(await getVenue('nope', deps)).toMatchObject({ status: 404, body: { code: 'not_found' } });
    vi.mocked(deps.rateHit).mockResolvedValueOnce(false);
    expect(await getVenue('v', deps)).toMatchObject({ status: 429 });
  });
});

describe('a partner’s user and their venue', () => {
  const user = (over: Partial<PartnerUser> = {}): PartnerUser => ({
    userId: '00000000-0000-4000-8000-000000000011',
    email: 'dana@example.com',
    fullName: 'Dana',
    phone: null,
    plan: 'free',
    activeInvitations: 0,
    createdAt: '2026-09-26T00:00:00Z',
    userManaged: false,
    discount: null,
    ...over,
  });
  const world = () => {
    const links = new Map<string, string | null>();
    const venues = new Set(['hall-17']);
    let current = user();
    const deps: PartnerDeps = {
      site: 'https://invitations.example.com',
      findUserByEmail: async () => null,
      createUser: vi.fn(async () => ({ id: current.userId, created: true })),
      deleteUser: vi.fn(async () => {}),
      link: vi.fn(async () => current),
      find: async () => current,
      updateEmail: async () => true,
      setDiscount: async () => current,
      loginToken: async () => 'hash',
      rateHit: async () => true,
      venueOf: async (id) => links.get(id) ?? null,
      venueExists: async (v) => venues.has(v),
      setVenue: vi.fn(async (id, v) => {
        if (v && !venues.has(v)) return 'venue_not_found' as const;
        links.set(id, v);
        return 'ok' as const;
      }),
    };
    return { deps, links, manage: () => (current = user({ userManaged: true })) };
  };

  it('POST /users with venueId links the user; an unknown venue creates nothing', async () => {
    const { deps } = world();
    expect(
      await provisionUser({ email: 'dana@example.com', fullName: 'Dana', venueId: 'nope' }, deps),
    ).toEqual({
      status: 404,
      body: { ok: false, code: 'venue_not_found' },
    });
    expect(deps.createUser).not.toHaveBeenCalled();
    const res = await provisionUser(
      { email: 'dana@example.com', fullName: 'Dana', venueId: 'hall-17' },
      deps,
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ user: { venueId: 'hall-17' } });
  });

  it('PATCH /users with venueId (and no email) moves or unlinks the user — also one who signs in by themselves', async () => {
    const { deps, manage } = world();
    manage();
    const moved = await changeEmail({ externalId: 'be-1', venueId: 'hall-17' }, deps);
    expect(moved).toMatchObject({ status: 200, body: { ok: true, user: { venueId: 'hall-17' } } });
    expect(await changeEmail({ externalId: 'be-1', venueId: 'nope' }, deps)).toMatchObject({
      status: 404,
      body: { code: 'venue_not_found' },
    });
    expect(await changeEmail({ externalId: 'be-1', venueId: null }, deps)).toMatchObject({
      body: { user: { venueId: null } },
    });
    // neither email nor venue: nothing to do
    expect(await changeEmail({ externalId: 'be-1' }, deps)).toMatchObject({ status: 400 });
    expect(await lookupUser(new URLSearchParams({ externalId: 'be-1' }), deps)).toMatchObject({
      body: { user: { venueId: null } },
    });
  });
});
