import { readFile } from 'node:fs/promises';
import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import pg from 'pg';

// The live gallery end to end, on the local stack (private storage, resumable uploads and the live
// channel are played by tests/support/rest-shim.mjs; the automatic check by the AI stand-in in
// tests/support/mock-whatsapp.mjs, which holds square photos as suspicious): a guest's phone uploads
// three photos while the network drops midway and all arrive; the host's review (the automatic check,
// approval mode) shows up live on the guest's phone; the venue screen shows a new photo within
// seconds; and the ZIP of the originals downloads with the very bytes the guest sent.

const LOCAL = !process.env.PW_BASE_URL;
test.skip(!LOCAL, 'sets plans and reads files and rows of the local stack');

const SHIM = `http://127.0.0.1:${process.env.PW_SHIM_PORT || 54329}`;
const MOCKS = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;
const e2eDb = () => {
  const admin = new URL(
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  );
  return Object.assign(new URL(admin), { pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}` }).toString();
};

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: e2eDb() });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

const hydrated = (page: Page) => page.locator('html[data-hydrated]').waitFor({ state: 'attached' });

/** A host with an invitation (Hebrew and English) on the given plan. */
async function host(page: Page, plan: 'free' | 'pro' | 'business') {
  const email = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await hydrated(page);
  const created = await page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he', 'en'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return (await res.json()) as { id: string };
  });
  if (plan !== 'free') await setPlan(email, plan);
  return { email, id: created.id };
}

async function setPlan(email: string, plan: 'pro' | 'business') {
  await sql(
    `insert into accounts (user_id, plan, plan_status, plan_renews_at)
       select id, $2, 'active', now() + interval '30 days' from auth.users where email = $1
     on conflict (user_id) do update
       set plan = excluded.plan, plan_status = 'active', plan_renews_at = excluded.plan_renews_at`,
    [email, plan],
  );
}

/** The Gallery tab, turned on: its link for guests. */
async function turnOn(page: Page, id: string): Promise<string> {
  await page.goto(`/app/invitations/${id}/gallery`);
  await hydrated(page);
  await page.getByTestId('gallery-start').getByRole('button', { name: 'הפעלת הגלריה' }).click();
  await expect(page.getByTestId('gallery-screen')).toBeVisible();
  await expect(page.getByTestId('gallery-state')).toHaveText('פתוחה להעלאה');
  const link = await page.getByTestId('gallery-upload-link').inputValue();
  expect(link).toMatch(/\/e\/[a-z0-9-]+\/upload\?t=[A-Za-z0-9_-]{24}$/);
  return link;
}

/** A phone of a guest: its own browser context (its own IndexedDB queue). */
async function phone(browser: Browser): Promise<BrowserContext> {
  const iphone = devices['iPhone 13'];
  return browser.newContext({
    userAgent: iphone.userAgent,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'he-IL',
  });
}

async function openGallery(page: Page, link: string) {
  await page.goto(link);
  // the queue is ready (IndexedDB opened, the uploader started)
  await expect(page.getByRole('button', { name: 'בחירת תמונות וסרטונים' })).toBeEnabled();
}

type Photo = { name: string; mimeType: string; buffer: Buffer };

/**
 * Photos made in the page (JPEG, sharp and bright enough to pass the phone's checks), each with its
 * own look so none is taken for a duplicate: 0 darkens to the right, 1 to the left, 2 has vertical
 * bands, 3 a checkerboard. A square one is what the AI stand-in holds as suspicious.
 */
async function photos(page: Page, specs: { look: number; w?: number; h?: number }[]): Promise<Photo[]> {
  const encoded = await page.evaluate(async (list) => {
    const out: string[] = [];
    for (const { look, w = 1600, h = 1200 } of list) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d')!;
      const hue = (look * 83) % 360;
      if (look === 0 || look === 1) {
        const grad = g.createLinearGradient(look === 0 ? w : 0, 0, look === 0 ? 0 : w, 0);
        grad.addColorStop(0, `hsl(${hue} 60% 22%)`);
        grad.addColorStop(1, `hsl(${(hue + 50) % 360} 75% 78%)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      } else {
        const cells = look === 2 ? 9 : 4;
        for (let x = 0; x < cells; x++)
          for (let y = 0; y < (look === 2 ? 1 : cells); y++) {
            g.fillStyle = (x + y) % 2 ? `hsl(${hue} 70% 30%)` : `hsl(${(hue + 40) % 360} 80% 76%)`;
            g.fillRect(
              (x * w) / cells,
              look === 2 ? 0 : (y * h) / cells,
              w / cells + 1,
              look === 2 ? h : h / cells + 1,
            );
          }
      }
      // fine detail everywhere: a sharp photo
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 3;
      for (let x = -h; x < w; x += 28) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + h * 0.4, h);
        g.stroke();
      }
      g.fillStyle = '#ffffff';
      g.font = `bold ${Math.round(h / 7)}px sans-serif`;
      g.fillText(`Guest photo ${look}`, w * 0.08, h * 0.56);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out.push(btoa(s));
    }
    return out;
  }, specs);
  return encoded.map((b64, i) => ({
    name: `IMG_${4100 + specs[i]!.look}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(b64, 'base64'),
  }));
}

const choose = (page: Page, files: Photo[]) => page.getByTestId('gallery-files').setInputFiles(files);
const progressTitle = (page: Page) => page.getByTestId('upload-progress').locator('#gallery-progress');

interface ItemRow {
  id: string;
  status: string;
  status_reason: string;
  original_done: boolean;
  original_path: string;
  original_size: string;
}
const itemsOf = (invitationId: string) =>
  sql<ItemRow>(
    `select id, status, status_reason, original_done, original_path, original_size
       from gallery_items where invitation_id = $1 and deleted_at is null order by created_at, id`,
    [invitationId],
  );

/** A stored original, read with the service key (the bucket is private). */
async function stored(path: string): Promise<Buffer | null> {
  const res = await fetch(`${SHIM}/storage/v1/object/gallery-originals/${path}`, {
    headers: { apikey: 'local-secret', authorization: 'Bearer local-secret' },
  });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

// ─── a guest's phone ────────────────────────────────────────────────────────────────────────────

test('a guest’s phone: three photos, the network drops midway, all of them arrive', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'a phone');
  test.setTimeout(150_000);
  const { id } = await host(page, 'pro');
  const link = await turnOn(page, id);

  const context = await phone(browser);
  const guest = await context.newPage();
  await openGallery(guest, link);
  await expect(guest.getByRole('heading', { level: 1 })).toContainText('נועה');
  await expect(guest.getByRole('heading', { level: 1 })).toContainText('איתי');
  await expect(guest.getByText('עוד אין כאן תמונות. היו הראשונים לשתף!')).toBeVisible();
  const files = await photos(guest, [{ look: 0 }, { look: 1 }, { look: 2 }]);

  // the network goes away as the second file goes up (the first photo's thumbnail is through, its
  // display version is on its way: nothing is complete yet)
  let puts = 0;
  let dropped = false;
  await guest.route('**/storage/v1/object/upload/sign/**', async (route) => {
    if (route.request().method() === 'PUT' && !dropped && ++puts === 2) {
      dropped = true;
      await context.setOffline(true);
      return route.abort('internetdisconnected');
    }
    return route.continue();
  });
  await guest.getByLabel('השם שלכם').fill('דנה ויואב');
  await choose(guest, files);
  await expect.poll(() => dropped, { timeout: 30_000 }).toBe(true);
  await expect(guest.getByText('אין חיבור לאינטרנט. הכל שמור בטלפון')).toBeVisible();
  await expect(progressTitle(guest)).toHaveText('0 מתוך 3 הועלו');
  expect((await itemsOf(id)).filter((i) => i.status !== 'uploading')).toHaveLength(0);

  // a while offline, then back: the queue goes on by itself
  await guest.waitForTimeout(1_500);
  await context.setOffline(false);
  await expect(progressTitle(guest)).toHaveText('3 מתוך 3 הועלו', { timeout: 60_000 });
  await expect(guest.getByText('הכל עלה. תודה ששיתפתם!')).toBeVisible();

  // all three are in the gallery, with their originals — byte for byte what the phone had
  const rows = await itemsOf(id);
  expect(rows.map((r) => [r.status, r.status_reason, r.original_done])).toEqual([
    ['published', 'ok', true],
    ['published', 'ok', true],
    ['published', 'ok', true],
  ]);
  const originals = await Promise.all(rows.map((r) => stored(r.original_path)));
  const sent = new Set(files.map((f) => f.buffer.toString('base64')));
  for (const o of originals) expect(o && sent.has(o.toString('base64'))).toBe(true);
  expect(new Set(originals.map((o) => o!.toString('base64'))).size).toBe(3);

  // the feed has them; the story view goes through them
  const feed = guest.getByTestId('gallery-feed');
  await expect(feed.locator('[data-item]')).toHaveCount(3);
  await feed.locator('[data-item]').first().click();
  const viewer = guest.getByTestId('media-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('1 מתוך 3')).toBeVisible();
  await expect(viewer.getByText('צולם על ידי דנה ויואב')).toBeVisible();
  await guest.keyboard.press('ArrowLeft');
  await expect(viewer.getByText('2 מתוך 3')).toBeVisible();
  await guest.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  // the host's tab counts them
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId('gallery-items').locator('li')).toHaveCount(3);
  await context.close();
});

// ─── the host's review ──────────────────────────────────────────────────────────────────────────

test('the host’s review: the automatic check holds a suspicious photo, approval mode holds all, approving shows it live', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the host at a computer, the guest on a phone');
  test.setTimeout(150_000);
  const { email, id } = await host(page, 'free');

  // the free plan: the tab offers the package that has the gallery
  await page.goto(`/app/invitations/${id}/gallery`);
  await hydrated(page);
  const upgrade = page.getByTestId('gallery-upgrade');
  await expect(upgrade).toContainText('הגלריה החיה כלולה בחבילת Pro');
  await expect(upgrade.getByRole('link', { name: 'שדרוג ל־Pro' })).toHaveAttribute(
    'href',
    '/app/billing?plan=pro',
  );

  await setPlan(email, 'pro');
  const link = await turnOn(page, id);
  const settings = page.getByTestId('gallery-settings');
  await expect(settings.getByRole('switch', { name: 'בדיקה אוטומטית' })).toBeChecked();
  // Pro has no venue screen: the card offers Business
  await expect(page.getByTestId('gallery-projector')).toContainText('המסך באולם כלול בחבילת Business');

  const context = await phone(browser);
  const guest = await context.newPage();
  await openGallery(guest, link);
  const [square, plain] = await photos(guest, [{ look: 3, w: 1200, h: 1200 }, { look: 0 }]);

  // instant mode, but the automatic check finds the square photo suspicious: it waits for the host
  await choose(guest, [square!]);
  await expect(progressTitle(guest)).toHaveText('1 מתוך 1 הועלו', { timeout: 30_000 });
  const mine = guest.getByTestId('gallery-mine');
  await expect(mine).toContainText('ממתין לאישור המארחים');
  await expect(guest.getByTestId('gallery-feed')).toHaveCount(0);
  const review = page.getByTestId('gallery-review');
  await expect(review).toContainText('ייתכן שאינו מתאים', { timeout: 20_000 });
  const checks = (await (await fetch(`${MOCKS}/__ai/gallery`)).json()) as {
    structured: boolean;
    mediaType: string;
    system: string;
    bytes: number;
  }[];
  expect(checks.length).toBeGreaterThanOrEqual(1);
  expect(checks.at(-1)).toMatchObject({ structured: true, mediaType: 'image/jpeg' });
  expect(checks.at(-1)!.system).toContain('live gallery');
  // the thumbnail only (about 480 px), never the original
  expect(checks.at(-1)!.bytes).toBeLessThan(square!.buffer.length);
  await review.getByRole('button', { name: 'דחייה' }).click();
  await expect(review).toBeHidden();
  await expect(mine).toContainText('לא יופיע בגלריה', { timeout: 20_000 });

  // approval mode: everything waits
  await settings.getByRole('radio', { name: 'אחרי אישור שלכם' }).click();
  await expect(settings.getByRole('radio', { name: 'אחרי אישור שלכם' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(guest.getByText('המארחים יאשרו אותם לפני שיופיעו בגלריה.')).toBeVisible({ timeout: 20_000 });
  await choose(guest, [plain!]);
  await expect(progressTitle(guest)).toHaveText('2 מתוך 2 הועלו', { timeout: 30_000 });
  await expect(review).toContainText('ממתין לאישור שלכם', { timeout: 20_000 });
  const [held] = (await itemsOf(id)).filter((r) => r.status === 'pending');
  expect(held).toMatchObject({ status_reason: 'approval' });

  // approved: the guest's phone shows it by itself
  await review.getByRole('button', { name: 'אישור', exact: true }).click();
  await expect(review).toBeHidden();
  await expect(guest.getByTestId('gallery-feed').locator(`[data-item="${held!.id}"]`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(guest.getByTestId('gallery-live')).toBeVisible();
  expect((await itemsOf(id)).map((r) => r.status).sort()).toEqual(['published', 'rejected']);
  await context.close();
});

// ─── the venue's screen and the download ────────────────────────────────────────────────────────

test('the venue screen shows a new photo within seconds; the ZIP of the originals downloads', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a screen at the venue, a computer at home');
  test.setTimeout(150_000);
  // no "save as" stream here: the archive is built in the page and saved as a download
  await page.addInitScript(() => {
    delete (Window.prototype as unknown as Record<string, unknown>).showSaveFilePicker;
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  });
  const { id } = await host(page, 'business');
  const link = await turnOn(page, id);

  // the screen: the link from the tab, on another computer
  const href = await page.getByTestId('gallery-projector-open').getAttribute('href');
  expect(href).toMatch(/\/e\/[a-z0-9-]+\/projector\?t=[A-Za-z0-9_-]{24}$/);
  const venue = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const screen = await venue.newPage();
  await screen.goto(href!);
  const projector = screen.getByTestId('projector');
  await expect(projector).toHaveAttribute('data-state', 'open');
  await expect(projector).toContainText('התמונות של האורחים יופיעו כאן');
  // the screen and the host's tab listen on the gallery's live channel
  const [gallery] = await sql<{ channel: string }>('select channel from galleries where invitation_id = $1', [
    id,
  ]);
  const channel = gallery!.channel;
  const listeners = async () => {
    const topics = (await (await fetch(`${SHIM}/realtime/v1/api/broadcast`)).json()) as Record<
      string,
      number
    >;
    return topics[`realtime:${channel}`] ?? 0;
  };
  await expect.poll(listeners, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

  const context = await phone(browser);
  const guest = await context.newPage();
  await openGallery(guest, link);
  const files = await photos(guest, [{ look: 1 }, { look: 2 }]);
  await choose(guest, [files[0]!]);
  await expect(progressTitle(guest)).toHaveText('1 מתוך 1 הועלו', { timeout: 30_000 });
  const [first] = await itemsOf(id);
  // live: on the screen well before its polling would have brought it
  await expect(projector.locator(`[data-current][data-item="${first!.id}"]`)).toBeVisible({ timeout: 5_000 });
  await expect(projector.locator('[data-current] img').last()).toHaveJSProperty('complete', true);

  await choose(guest, [files[1]!]);
  await expect(progressTitle(guest)).toHaveText('2 מתוך 2 הועלו', { timeout: 30_000 });
  const second = (await itemsOf(id)).find((r) => r.id !== first!.id)!;
  await expect(projector.locator(`[data-current][data-item="${second.id}"]`)).toBeVisible({
    timeout: 10_000,
  });

  // the host downloads everything: one ZIP with both originals, named by when they were taken
  await page.reload();
  await hydrated(page);
  await page.getByTestId('gallery-download').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: 'הכל (2)' })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByTestId('gallery-download-start').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^[a-z0-9-]+-gallery.*\.zip$/);
  await expect(dialog.getByTestId('gallery-download-progress')).toContainText('ההורדה הסתיימה: 2 קבצים');
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const names = Object.keys(zip).sort();
  expect(names).toHaveLength(2);
  for (const name of names) expect(name).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[0-9a-f]{8}\.jpg$/);
  const inside = new Set(names.map((n) => Buffer.from(zip[n]!).toString('base64')));
  expect(inside).toEqual(new Set(files.map((f) => f.buffer.toString('base64'))));
  await context.close();
  await venue.close();
});
