import { createHash, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import pg from 'pg';
import sharp from 'sharp';

/**
 * What Phase 5B's end-to-end specs share (tests/e2e/film, faces, gallery-section, insights,
 * flags-off): the local stack's database, a signed-in host with an invitation on a given plan, the
 * gallery turned on and filled with photos straight through the database and the storage stand-in
 * (tests/support/rest-shim.mjs) — no phone uploads needed — and a synthetic song.
 */

export const LOCAL = !process.env.PW_BASE_URL;
export const SHIM = `http://127.0.0.1:${process.env.PW_SHIM_PORT || 54329}`;

const e2eDb = () => {
  const admin = new URL(
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  );
  return Object.assign(new URL(admin), { pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}` }).toString();
};

export async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: e2eDb() });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

export const hydrated = (page: Page) => page.locator('html[data-hydrated]').waitFor({ state: 'attached' });

export async function open(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
}

/** A same-origin JSON call as the signed-in host. */
export function api<T = Record<string, unknown>>(
  page: Page,
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      });
      return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
    },
    { url, method, body },
  );
}

export type Plan = 'free' | 'pro' | 'business';

export async function setPlan(email: string, plan: Plan) {
  if (plan === 'free') return;
  await sql(
    `insert into accounts (user_id, plan, plan_status, plan_renews_at)
       select id, $2, 'active', now() + interval '30 days' from auth.users where email = $1
     on conflict (user_id) do update
       set plan = excluded.plan, plan_status = 'active', plan_renews_at = excluded.plan_renews_at`,
    [email, plan],
  );
}

export interface Host {
  email: string;
  id: string;
  slug: string;
}

/** A new host signed in on `page`, with a Hebrew-and-English wedding on `plan`. */
export async function newHost(
  page: Page,
  prefix: string,
  plan: Plan,
  event: { date?: string; startTime?: string } = {},
): Promise<Host> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await hydrated(page);
  const created = await page.evaluate(async (event) => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he', 'en'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
        date: event.date ?? '2027-06-17',
        startTime: event.startTime ?? '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return (await res.json()) as { id: string; slug: string };
  }, event);
  await setPlan(email, plan);
  return { email, id: created.id, slug: created.slug };
}

/** Publishes the draft as it is (the database's own publish, like the app's). */
export async function publish(id: string) {
  await sql(
    `update invitations set status = 'published', published = draft, published_at = now() where id = $1`,
    [id],
  );
}

/** The gallery on: its guests' link. */
export async function galleryOn(page: Page, id: string): Promise<string> {
  const res = await api<{ view?: { gallery?: { uploadUrl: string | null } } }>(
    page,
    `/api/invitations/${id}/gallery`,
    'POST',
    {},
  );
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const url = res.body.view?.gallery?.uploadUrl;
  expect(url).toMatch(/\/e\/[a-z0-9-]+\/upload\?t=[A-Za-z0-9_-]{24}$/);
  return url!;
}

/** A JPEG: `color` with a lighter band across it (sharp enough, bright enough). */
export async function jpeg(color: [number, number, number], width = 1200, height = 1600): Promise<Buffer> {
  const band = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="0" y="${height * 0.4}" width="${width}" height="${height * 0.2}" fill="rgb(${color
      .map((c) => Math.min(255, c + 90))
      .join(
        ',',
      )})"/><circle cx="${width / 2}" cy="${height * 0.3}" r="${width * 0.12}" fill="rgb(240,210,180)"/></svg>`,
  );
  return sharp({
    create: { width, height, channels: 3, background: { r: color[0], g: color[1], b: color[2] } },
  })
    .composite([{ input: band }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function store(bucket: string, path: string, bytes: Buffer, type = 'image/jpeg') {
  const res = await fetch(`${SHIM}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: 'local-secret', authorization: 'Bearer local-secret', 'content-type': type },
    body: new Uint8Array(bytes),
  });
  expect(res.status, await res.clone().text()).toBe(200);
}

export interface SeedPhoto {
  color: [number, number, number];
  /** minutes after the event's start it was taken */
  minute?: number;
  width?: number;
  height?: number;
  status?: 'published' | 'pending';
}

/**
 * Photos in the gallery as if guests had uploaded them: their files in storage, reserved and finished
 * through the gallery's own database functions (published, with the phone's checks' numbers).
 */
export async function seedPhotos(invitationId: string, photos: SeedPhoto[]): Promise<string[]> {
  const uploader = createHash('sha256').update(`e2e-phone-${invitationId}`).digest('hex');
  const ids: string[] = [];
  for (const [i, p] of photos.entries()) {
    const id = randomUUID();
    const folder = `${invitationId}/${id}`;
    const width = p.width ?? 1200;
    const height = p.height ?? 1600;
    const bytes = await jpeg(p.color, width, height);
    const thumb = await sharp(bytes).resize({ width: 360 }).jpeg({ quality: 80 }).toBuffer();
    await store('gallery-originals', `${folder}/original.jpg`, bytes);
    await store('gallery-media', `${folder}/display.jpg`, bytes);
    await store('gallery-media', `${folder}/thumb.jpg`, thumb);
    const taken = new Date(Date.parse('2027-06-17T16:30:00Z') + (p.minute ?? i * 7) * 60_000).toISOString();
    const item = {
      id,
      kind: 'image',
      originalPath: `${folder}/original.jpg`,
      originalType: 'image/jpeg',
      originalSize: bytes.length,
      displayPath: `${folder}/display.jpg`,
      displaySize: bytes.length,
      thumbPath: `${folder}/thumb.jpg`,
      thumbSize: thumb.length,
      width,
      height,
      durationMs: null,
      takenAt: taken,
    };
    const [reserved] = await sql<{ r: { ok: boolean } }>(
      `select public.gallery_reserve($1, $2, null, 'אורחת', $3, 3000) as r`,
      [invitationId, uploader, JSON.stringify([item])],
    );
    expect(reserved!.r.ok).toBe(true);
    const phash = createHash('sha256').update(id).digest('hex').slice(0, 16);
    await sql(`select public.gallery_complete($1, $2, $3, $4, 'ok', $5, '[]', '{}', true)`, [
      invitationId,
      id,
      uploader,
      p.status ?? 'published',
      JSON.stringify({ sharpness: 220 + i, brightness: 0.5, phash, enhanced: false }),
    ]);
    ids.push(id);
  }
  return ids;
}

/**
 * A song for the film: a click track (a short 1 kHz click on every beat, a low thump on each bar's
 * first) as a 16-bit mono WAV.
 */
export function clickTrackWav(seconds = 16, bpm = 120, rate = 22_050): Buffer {
  const n = Math.round(seconds * rate);
  const samples = new Int16Array(n);
  const period = 60 / bpm;
  for (let beat = 0, t = 0.25; t < seconds - 0.1; beat++, t += period) {
    const at = Math.round(t * rate);
    for (let k = 0; k < rate * 0.08 && at + k < n; k++) {
      const s = k / rate;
      let v = 0.45 * Math.sin(2 * Math.PI * 1000 * s) * Math.exp(-s / 0.012);
      if (beat % 4 === 0) v += 0.5 * Math.sin(2 * Math.PI * 60 * s) * Math.exp(-s / 0.05);
      samples[at + k] = Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + n * 2, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(n * 2, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer)]);
}

/** A phone's browser context (its own storage), as a guest has it. */
export const PHONE = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'he-IL',
};
