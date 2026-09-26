import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Client } from 'pg';
import QRCode from 'qrcode';

// The event day (Phase 5A): a guest opens their table guide from their personal link on the phone (and
// again without signal); the entrance station checks families in by search and by the code on the
// guest's phone (a camera that sees it), and the host's live hall follows; telling guests their table,
// then re-seating — on the seating screen (the freeze) and live — tells only the moved family, and undo
// puts it back; without the package, or switched off, it is offered or gone, and the APIs refuse.

const LOCAL = !process.env.PW_BASE_URL;
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();
const WHATSAPP = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;
/** Screenshots to look at (gitignored; Playwright doesn't clear it between runs). */
const SCREENS = 'tests/.artifacts/qa/event-day';

test.skip(!LOCAL, 'needs the local stack (the database and the WhatsApp stand-in)');

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const toast = (page: Page, text: string) => page.locator('li').filter({ hasText: text });
/** Waits for what moves on the page to stop (dialogs opening, a drawn route) — not the looping ones. */
const settle = (page: Page) =>
  page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      null,
      { timeout: 3_000 },
    )
    // the app's own slow flourishes (the help button's) don't hold a screenshot back
    .catch(() => undefined);
const saved = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({ timeout: 15_000 });

/** A guest's entrance code: the same derivation as the server's (and the database's). */
const codeOf = (token: string) =>
  createHash('sha256').update(`badook-checkin:${token}`).digest('base64url').slice(0, 22);

type Plan = 'free' | 'pro' | 'business';
const setAccount = (email: string, plan: Plan, credits = 0) =>
  sql(
    `insert into accounts (user_id, plan, message_credits) select id, $2, $3 from auth.users where email = $1
     on conflict (user_id) do update set plan = excluded.plan, message_credits = excluded.message_credits`,
    [email, plan, credits],
  );

interface Family {
  name: string;
  party: number;
  /** the table it sits at (null: coming, no table yet) */
  table: number | null;
  phone: string;
  token: string;
  unitId: string;
}
interface Event {
  id: string;
  slug: string;
  email: string;
  families: Family[];
  tables: Record<number, string>;
}

/**
 * A host (signed in on `page`) with a published wedding: three families at tables 12 and 3, one coming
 * without a table, and table 7 empty; an entrance at the hall's side.
 */
async function eventWithTables(page: Page, prefix: string, plan: Plan, credits = 0): Promise<Event> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await setAccount(email, plan, credits);
  const inv = await page.evaluate(async () => {
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
    return (await res.json()) as { id: string; slug: string };
  });
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const list = [
    { name: 'משפחת כהן', party: 3, table: 12 },
    { name: 'משפחת לוי', party: 2, table: 12 },
    { name: 'משפחת פרץ', party: 4, table: 3 },
    { name: 'משפחת מזרחי', party: 2, table: null },
  ];
  const families: Family[] = [];
  for (const [i, f] of list.entries()) {
    const token = `day${randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const phone = `+9725${suffix}${i}1`;
    const [g] = await sql<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, phone, token)
       values ($1, $2, $3, $4, $5) returning id`,
      [inv.id, f.name, f.party, phone, token],
    );
    await sql(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id)
       values ($1, true, 'he', $2, $3, 0, $4, $5)`,
      [inv.id, f.name, f.party, `h-${Math.random()}`, g!.id],
    );
    families.push({ ...f, phone, token, unitId: '' });
  }
  await sql(
    `update invitations set status = 'published', published = draft, published_at = now() where id = $1`,
    [inv.id],
  );
  // the tables and who sits where: the seating screen's own save
  const seated = await page.evaluate(
    async ({ id, seats }) => {
      const state = (
        (await (await fetch(`/api/invitations/${id}/seating`)).json()) as {
          state: {
            version: number;
            plan: Record<string, unknown> & { layout: Record<string, unknown> };
            units: { id: string; name: string }[];
          };
        }
      ).state;
      const table = (number: number, x: number) => ({
        id: crypto.randomUUID(),
        number,
        label: null,
        shape: 'round',
        capacity: 10,
        x,
        y: 4,
        w: 1.8,
        h: 1.8,
        rotation: 0,
        zones: [],
        locked: false,
      });
      const tables = [table(12, 6), table(7, 11), table(3, 16)];
      const ids = Object.fromEntries(tables.map((t) => [t.number, t.id]));
      const assignments: Record<string, { tableId: string; source: 'host' }> = {};
      for (const s of seats) {
        const unit = state.units.find((u) => u.name === s.name)!;
        if (s.table) assignments[unit.id] = { tableId: ids[s.table]!, source: 'host' };
      }
      const plan = {
        ...state.plan,
        tables,
        assignments,
        layout: {
          ...state.plan.layout,
          landmarks: [
            {
              id: crypto.randomUUID(),
              kind: 'entrance',
              x: 2,
              y: 11,
              w: 2,
              h: 0.6,
              rotation: 0,
              label: null,
            },
            { id: crypto.randomUUID(), kind: 'stage', x: 11, y: 0.5, w: 6, h: 1.2, rotation: 0, label: null },
          ],
        },
      };
      const res = await fetch(`/api/invitations/${id}/seating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: state.version, plan }),
      });
      return {
        status: res.status,
        tables: ids,
        units: Object.fromEntries(state.units.map((u) => [u.name, u.id])),
      };
    },
    { id: inv.id, seats: list },
  );
  expect(seated.status).toBe(200);
  for (const f of families) f.unitId = seated.units[f.name]!;
  return { id: inv.id, slug: inv.slug, email, families, tables: seated.tables };
}

type Sent = { template: string; language: string; params: string[]; button: string };
const sentTo = async (request: APIRequestContext, phone: string) =>
  (await (await request.get(`${WHATSAPP}/__sent?to=${phone.replace(/^\+/, '')}`)).json()) as Sent[];

/** In the host's page: an API call as the signed-in host. */
const api = (page: Page, url: string, method = 'GET', body?: unknown) =>
  page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: res.status,
        body: (await res.json().catch(() => null)) as Record<string, unknown> | null,
      };
    },
    { url, method, body },
  );

/**
 * A camera that sees a QR code: a Y4M video (the fake capture device plays it in a loop) of the code,
 * black on white, in the middle of a grey frame.
 */
function qrVideo(text: string, file: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const W = 640;
  const H = 480;
  const quiet = 4;
  const scale = Math.floor((H * 0.8) / (n + 2 * quiet));
  const side = (n + 2 * quiet) * scale;
  const x0 = Math.floor((W - side) / 2);
  const y0 = Math.floor((H - side) / 2);
  const luma = Buffer.alloc(W * H, 150);
  for (let py = 0; py < side; py++)
    for (let px = 0; px < side; px++) {
      const mx = Math.floor(px / scale) - quiet;
      const my = Math.floor(py / scale) - quiet;
      const dark = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(my, mx);
      luma[(y0 + py) * W + x0 + px] = dark ? 16 : 235;
    }
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  writeFileSync(
    file,
    Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array(10).fill(frame)]),
  );
}

test('a guest opens their table from their personal link on the phone, and again without signal', async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'the guest’s phone');
  test.setTimeout(60_000);
  const ev = await eventWithTables(page, 'day-guide', 'business');
  const [cohen, , , mizrahi] = ev.families;
  const errors = collectErrors(page);

  await page.goto(`/e/${ev.slug}/table?g=${cohen!.token}`);
  await expect(page.getByTestId('guide-table-number')).toHaveText('12');
  await expect(page.getByTestId('guide-map')).toBeVisible();
  // the way from the entrance, and their table among the others (numbers only)
  await expect(page.getByTestId('guide-route')).toHaveCount(1);
  await expect(page.locator('[data-table-number]')).toHaveCount(3);
  await expect(page.locator('[data-table-number="12"][data-mine]')).toHaveCount(1);
  const text = await page.locator('body').innerText();
  for (const other of ['משפחת לוי', 'משפחת פרץ', 'משפחת מזרחי']) expect(text).not.toContain(other);
  // their entrance code (the event checks guests in)
  await expect(page.getByTestId('guide-qr')).toHaveAttribute('data-code', codeOf(cohen!.token));
  mkdirSync(SCREENS, { recursive: true });
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/guide-he-390.png`, fullPage: true });

  // kept on the phone for the evening: the page opens again without signal
  await expect(page.getByTestId('guide-offline')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 });
  const kept = await page.evaluate(async () => {
    const res = await caches.match(location.href, { ignoreVary: true });
    return res ? (await res.text()).includes('guide-table-number') : false;
  });
  expect(kept).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('guide-table-number')).toHaveText('12');
  await expect(page.getByTestId('guide-offline')).toHaveAttribute('data-state', 'offline');
  await context.setOffline(false);

  // English, and a family without a table yet
  await page.goto(`/e/${ev.slug}/table?g=${mizrahi!.token}&lang=en`);
  await expect(page.getByTestId('guide-waiting')).toBeVisible();
  await expect(page.getByTestId('guide-map')).toHaveCount(0);
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/guide-waiting-en-390.png`, fullPage: true });
  await page.goto(`/e/${ev.slug}/table?g=${cohen!.token}&lang=en`);
  await expect(page.getByTestId('guide-table-number')).toHaveText('12');
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/guide-en-390.png`, fullPage: true });

  // a link that isn't theirs
  await page.goto(`/e/${ev.slug}/table?g=not-a-real-token-at-all`);
  await expect(page.getByTestId('day-unavailable')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the entrance checks families in by search and by the code on their phone; the host sees it live', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run: the host at a desk, the stations on phones');
  test.setTimeout(90_000);
  const ev = await eventWithTables(page, 'day-station', 'business');
  const [cohen] = ev.families;
  const errors = collectErrors(page);

  await open(page, `/app/invitations/${ev.id}/live`);
  await expect(page.getByTestId('live-hall')).toBeVisible();
  await expect(page.getByTestId('kpi-arrived')).toHaveText('0');
  await expect(page.getByTestId('live-status')).toHaveAttribute('data-status', 'live', { timeout: 20_000 });
  const stationUrl = await page.getByTestId('station-link').inputValue();
  expect(stationUrl).toMatch(new RegExp(`/e/${ev.slug}/station\\?t=[A-Za-z0-9_-]{24}$`));

  // a phone at the door, no account: search, check the family in, see its table
  const door = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const station = await door.newPage();
  await station.goto(stationUrl);
  await expect(station.getByTestId('station')).toBeVisible();
  await station.getByTestId('station-search').fill('לוי');
  await station.locator('[data-party="משפחת לוי"]').click();
  await expect(station.getByTestId('party-table')).toContainText('12');
  await expect(station.getByTestId('party-count')).toHaveText('2');
  mkdirSync(SCREENS, { recursive: true });
  await settle(station);
  await station.screenshot({ path: `${SCREENS}/station-party-he-390.png` });
  await station.getByTestId('party-checkin').click();
  await expect(station.getByTestId('party-done-table')).toContainText('12');
  // the host's screen follows live (well before its polling)
  await expect(page.getByTestId('kpi-arrived')).toHaveText('2', { timeout: 10_000 });

  // the code on the guest's phone, held up to another station's camera
  const video = testInfo.outputPath('cohen-code.y4m');
  qrVideo(`BDK1.${codeOf(cohen!.token)}`, video);
  const camera = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
    ],
  });
  try {
    const context = await camera.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ['camera'],
    });
    const scanner = await context.newPage();
    await scanner.goto(stationUrl);
    await scanner.getByTestId('station-scan').click();
    await expect(scanner.getByTestId('party-card')).toBeVisible({ timeout: 20_000 });
    await expect(scanner.getByRole('dialog')).toContainText('משפחת כהן');
    await expect(scanner.getByTestId('party-count')).toHaveText('3');
    await scanner.getByTestId('party-checkin').click();
    await expect(scanner.getByTestId('party-done-table')).toContainText('12');
  } finally {
    await camera.close();
  }
  await expect(page.getByTestId('kpi-arrived')).toHaveText('5', { timeout: 10_000 });
  // the map: table 12 has everyone who came
  await expect(page.locator('[data-heat-table="12"]')).toHaveAttribute('data-arrived', '5');
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/live-he-1440.png`, fullPage: true });

  // a mistake at the door: undone from the host's screen, and the station follows
  await page.locator('[data-recent="משפחת לוי"]').getByRole('button', { name: 'ביטול' }).click();
  await expect(page.getByTestId('kpi-arrived')).toHaveText('3');
  await expect(station.getByTestId('station-arrived')).toContainText('3', { timeout: 15_000 });
  await door.close();
  expect(errors).toEqual([]);
});

test('telling guests their table, then re-seating: only the moved family hears again, and undo puts it back', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run: the messages are the WhatsApp stand-in’s');
  test.setTimeout(90_000);
  const ev = await eventWithTables(page, 'day-reseat', 'business', 20);
  const [cohen, levi, peretz] = ev.families;
  const errors = collectErrors(page);

  // the seating screen: every seated family gets its table from the system's number
  await open(page, `/app/invitations/${ev.id}/seating`);
  await page.getByTestId('seating-notices').click();
  const dialog = page.getByRole('dialog', { name: 'לשלוח לאורחים את מספר השולחן' });
  await expect(dialog.locator('[data-notice-state="unsent"]')).toHaveCount(3);
  mkdirSync(SCREENS, { recursive: true });
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/notices-he-1440.png` });
  await dialog.getByTestId('notices-send').click();
  await expect(toast(page, 'נשלח ל־3 משפחות')).toBeVisible();
  for (const f of [cohen!, levi!, peretz!]) {
    const messages = await sentTo(request, f.phone);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      template: 'badook_table',
      language: 'he',
      params: [f.name, 'נועה & איתי', String(f.table)],
      button: `${ev.slug}/table?g=${f.token}`,
    });
  }
  await expect(dialog.locator('[data-notice-state="unsent"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'סגירה' }).first().click();

  // the freeze: moving a family that was told asks first, and only that family hears the new table
  await page.getByRole('button', { name: 'אפשרויות למשפחת כהן' }).click();
  await page.getByRole('menuitem', { name: 'העברה לשולחן אחר' }).click();
  await page
    .getByRole('dialog', { name: 'איפה משפחת כהן יושבים?' })
    .locator('[data-table-choice="3"]')
    .click();
  const freeze = page.getByRole('dialog', { name: 'משפחה אחת כבר קיבלה את מספר השולחן' });
  await expect(freeze.getByTestId('freeze-list')).toContainText(
    'משפחת כהן: קיבלו את שולחן 12, יעברו לשולחן 3',
  );
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/freeze-he-1440.png` });
  await freeze.getByTestId('freeze-confirm').click();
  await saved(page);
  await expect.poll(async () => (await sentTo(request, cohen!.phone)).length, { timeout: 15_000 }).toBe(2);
  expect((await sentTo(request, cohen!.phone))[1]!.params[2]).toBe('3');
  expect(await sentTo(request, levi!.phone)).toHaveLength(1);
  expect(await sentTo(request, peretz!.phone)).toHaveLength(1);

  // on the event day: Levi moves from table 12 to table 7, and is told
  await open(page, `/app/invitations/${ev.id}/live`);
  await page.getByRole('radio', { name: 'שולחנות' }).click();
  await page.locator('[data-live-table="12"]').click();
  await page.getByTestId('table-sheet').locator('[data-party="משפחת לוי"]').locator('[data-move]').click();
  const move = page.getByRole('dialog', { name: 'העברת משפחת לוי' });
  await move.locator('[data-table-choice="7"]').click();
  await move.getByTestId('reseat-reason').fill('קרוב יותר לבמה');
  await move.getByTestId('move-confirm').click();
  await expect(toast(page, 'משפחת לוי עברו לשולחן 7')).toBeVisible();
  await expect.poll(async () => (await sentTo(request, levi!.phone)).length, { timeout: 15_000 }).toBe(2);
  expect((await sentTo(request, levi!.phone))[1]!.params[2]).toBe('7');
  expect(await sentTo(request, cohen!.phone)).toHaveLength(2);
  expect(await sentTo(request, peretz!.phone)).toHaveLength(1);

  // the history: the move with its reason — undone (without another message)
  const history = page.getByTestId('live-history');
  await expect(history).toContainText('משפחת לוי: משולחן 12 לשולחן 7');
  await expect(history).toContainText('למה: קרוב יותר לבמה');
  await settle(page);
  await page.screenshot({ path: `${SCREENS}/live-history-he-1440.png`, fullPage: true });
  await history.locator('[data-change="move"]').first().locator('[data-undo-change]').click();
  const undo = page.getByRole('dialog', { name: 'לבטל את השינוי?' });
  await undo.getByRole('checkbox').uncheck();
  await undo.getByTestId('undo-confirm').click();
  await expect(toast(page, 'השינוי בוטל')).toBeVisible();
  await expect(history.locator('[data-undone]')).toHaveCount(1);
  const [back] = await sql<{ number: number }>(
    `select t.number from seat_assignments a join seating_tables t on t.id = a.table_id where a.unit_id = $1`,
    [levi!.unitId],
  );
  expect(back!.number).toBe(12);
  expect(await sentTo(request, levi!.phone)).toHaveLength(2);

  // Levi was told table 7 and sits at 12 again: they need an update
  await open(page, `/app/invitations/${ev.id}/seating`);
  await expect(page.getByTestId('notices-stale')).toContainText('1');
  expect(errors).toEqual([]);
});

test('without the package the event day is offered, switched off it is gone, and the APIs refuse', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run: the server’s answers');
  test.setTimeout(60_000);
  const ev = await eventWithTables(page, 'day-off', 'free');
  const [cohen] = ev.families;

  // the free package: the tab offers the package; sending table numbers is offered, not there
  await open(page, `/app/invitations/${ev.id}/live`);
  await expect(page.getByTestId('upgrade-link')).toBeVisible();
  await open(page, `/app/invitations/${ev.id}/seating`);
  await expect(page.getByTestId('seating-notices-locked')).toBeVisible();
  await expect(page.getByTestId('seating-notices')).toHaveCount(0);
  const refused = { status: 403, body: { code: 'feature_off' } };
  expect(await api(page, `/api/invitations/${ev.id}/event-day`)).toMatchObject(refused);
  expect(await api(page, `/api/invitations/${ev.id}/seating/notices`)).toMatchObject(refused);
  expect(
    await api(page, `/api/invitations/${ev.id}/seating/notices`, 'POST', {
      action: 'mark',
      unitIds: [cohen!.unitId],
    }),
  ).toMatchObject(refused);
  expect(
    await api(page, `/api/invitations/${ev.id}/seating/live`, 'POST', {
      action: 'move',
      unitId: cohen!.unitId,
      tableId: ev.tables[7],
    }),
  ).toMatchObject(refused);
  expect(
    await api(page, `/api/invitations/${ev.id}/event-day/checkin`, 'POST', {
      id: randomUUID(),
      unitId: cohen!.unitId,
      count: 1,
    }),
  ).toMatchObject(refused);
  // the seating's own history stays (every package has seating)
  expect((await api(page, `/api/invitations/${ev.id}/seating/changes`)).status).toBe(200);
  // the guest's guide isn't there
  await page.goto(`/e/${ev.slug}/table?g=${cohen!.token}`);
  await expect(page.getByTestId('day-unavailable')).toBeVisible();

  // VIP: the station link works…
  await setAccount(ev.email, 'business');
  await open(page, `/app/invitations/${ev.id}/live`);
  const stationUrl = await page.getByTestId('station-link').inputValue();
  const token = new URL(stationUrl).searchParams.get('t')!;
  expect((await api(page, '/api/checkin/station', 'POST', { t: token })).status).toBe(200);

  // …until the host switches the event day off: the tab is gone, the page offers it back, all refuse
  expect(
    (await api(page, `/api/invitations/${ev.id}/features`, 'PATCH', { feature: 'checkin', off: true }))
      .status,
  ).toBe(200);
  await open(page, `/app/invitations/${ev.id}`);
  await expect(page.getByRole('link', { name: 'יום האירוע' })).toHaveCount(0);
  expect(await api(page, `/api/invitations/${ev.id}/event-day`)).toMatchObject(refused);
  expect((await api(page, '/api/checkin/station', 'POST', { t: token })).status).toBe(404);
  expect((await api(page, '/api/checkin/search', 'POST', { t: token, q: 'כהן' })).status).toBe(404);
  await page.goto(stationUrl);
  await expect(page.getByTestId('day-unavailable')).toBeVisible();
  // the guide stays (seating_guide is on), without the entrance code
  await page.goto(`/e/${ev.slug}/table?g=${cohen!.token}`);
  await expect(page.getByTestId('guide-table-number')).toHaveText('12');
  await expect(page.getByTestId('guide-qr')).toHaveCount(0);

  // switched back on from the page itself
  await open(page, `/app/invitations/${ev.id}/live`);
  await page.getByRole('button', { name: 'להפעיל את יום האירוע' }).click();
  // after the reload React may still hold a hidden copy of the streamed page for a moment
  await expect(page.locator('[data-testid="live-hall"]:visible')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'יום האירוע' })).toBeVisible();
});

test('the event day’s screens, in Hebrew and English (screenshots to look at)', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name === 'mobile';
  const width = mobile ? 390 : 1440;
  const ev = await eventWithTables(page, `day-qa-${testInfo.project.name}`, 'business');
  const [cohen, levi] = ev.families;
  const errors = collectErrors(page);
  // some arrivals: Cohen whole, Levi in part
  for (const [f, count] of [
    [cohen!, 3],
    [levi!, 1],
  ] as const)
    expect(
      (
        await api(page, `/api/invitations/${ev.id}/event-day/checkin`, 'POST', {
          id: randomUUID(),
          unitId: f.unitId,
          count,
        })
      ).status,
    ).toBe(200);
  mkdirSync(SCREENS, { recursive: true });
  for (const lang of ['he', 'en'] as const) {
    await page
      .context()
      .addCookies([{ name: 'ui_lang', value: lang, url: new URL('/', page.url()).toString() }]);
    await open(page, `/app/invitations/${ev.id}/live`);
    await expect(page.getByTestId('kpi-arrived')).toHaveText('4');
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/live-map-${lang}-${width}.png`, fullPage: true });
    await page.getByRole('radio', { name: lang === 'he' ? 'שולחנות' : 'Tables' }).click();
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/live-tables-${lang}-${width}.png`, fullPage: true });
    await page.getByRole('radio', { name: lang === 'he' ? 'הגעות' : 'Arrivals' }).click();
    await expect(page.getByTestId('live-arrivals')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/live-arrivals-${lang}-${width}.png`, fullPage: true });
    await page.getByRole('radio', { name: lang === 'he' ? 'שולחנות' : 'Tables' }).click();
    await page.locator('[data-live-table="12"]').click();
    await expect(page.getByTestId('table-sheet')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/live-sheet-${lang}-${width}.png` });
    await page.getByTestId('table-sheet').locator('[data-party="משפחת לוי"]').locator('[data-move]').click();
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/live-move-${lang}-${width}.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await open(page, `/app/invitations/${ev.id}/seating/cards`);
    await expect(page.locator('[data-card]')).toHaveCount(3);
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/cards-${lang}-${width}.png`, fullPage: true });
    await open(page, `/app/invitations/${ev.id}/seating`);
    await page.getByTestId('seating-notices').click();
    await expect(page.getByTestId('notices-dialog')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/notices-${lang}-${width}.png` });
  }
  const stationUrl = await (async () => {
    await open(page, `/app/invitations/${ev.id}/live`);
    return page.getByTestId('station-link').inputValue();
  })();
  for (const lang of ['he', 'en'] as const) {
    await page.goto(`${stationUrl}&lang=${lang}`);
    await expect(page.getByTestId('station')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${SCREENS}/station-${lang}-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
