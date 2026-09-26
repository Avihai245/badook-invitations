import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { Client } from 'pg';
import { PNG } from 'pngjs';
import readXlsxFile from 'read-excel-file/node';

// Seating (/app/invitations/[id]/seating): tables on the map, a floor plan uploaded and calibrated,
// families seated whole — a table too small refuses them — the automatic seating (and its upgrade
// prompt), locked tables, the print view and the Excel file; and the partner's venue: its floor plan
// (a PDF, turned into an image in the browser) is where its user's seating starts.

const LOCAL = !process.env.PW_BASE_URL;
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();
/** Same value as INVITES_PARTNER_API_KEY in playwright.config.ts. */
const auth = { authorization: 'Bearer e2e-partner-key-0123456789abcdef0123' };
/** Screenshots to look at (gitignored; Playwright doesn't clear it between runs). */
const SCREENS = 'tests/.artifacts/qa/seating';

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

async function signUp(page: Page, prefix = 'seat') {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return email;
}

const createInvitation = (page: Page) =>
  page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return (await res.json()) as { id: string; slug: string };
  });

/** Guests on the list who replied "coming" (adults named), and one reply without a guest. */
async function seedGuests(
  invitationId: string,
  families: { name: string; party: number; coming: number; group?: string; people?: string[] }[],
) {
  for (const [i, f] of families.entries()) {
    const [g] = await sql<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, group_name, token)
       values ($1, $2, $3, $4, $5) returning id`,
      [
        invitationId,
        f.name,
        f.party,
        f.group ?? null,
        `seat${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 10)}`,
      ],
    );
    if (!f.coming) continue;
    const [r] = await sql<{ id: string }>(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id)
       values ($1, true, 'he', $2, $3, 0, $4, $5) returning id`,
      [invitationId, f.name, f.coming, `h-${Math.random()}`, g!.id],
    );
    for (const [k, person] of (f.people ?? []).entries())
      await sql(
        `insert into rsvp_attendees (response_id, kind, position, full_name) values ($1, 'adult', $2, $3)`,
        [r!.id, k, person],
      );
  }
}

const setPlan = (email: string, plan: 'free' | 'pro') =>
  sql(
    `insert into accounts (user_id, plan) select id, $2 from auth.users where email = $1
     on conflict (user_id) do update set plan = excluded.plan`,
    [email, plan],
  );

/** A floor plan image: a hall's outline with a stage and a few marks. */
function planPng(w = 1200, h = 700): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x < 8 || y < 8 || x >= w - 8 || y >= h - 8;
      const stage = y < 120 && x > w * 0.3 && x < w * 0.7;
      const grid = x % 150 === 0 || y % 150 === 0;
      const v = edge ? 60 : stage ? 190 : grid ? 225 : 250;
      const i = (y * w + x) * 4;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = stage ? 230 : v;
      png.data[i + 3] = 255;
    }
  return PNG.sync.write(png);
}

/** A one-page PDF (600×300 points): a hall's outline and a stage. */
function planPdf(): Buffer {
  const content = 'q 0.25 0.25 0.25 RG 3 w 10 10 580 280 re S 0.6 0.5 0.9 rg 200 230 200 50 re f Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 300] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const toast = (page: Page, text: string | RegExp) => page.locator('li').filter({ hasText: text });
const saved = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({ timeout: 15_000 });
const tableOnMap = (page: Page, n: number) =>
  page.locator(`[data-testid=seating-canvas] [data-table-number="${n}"]`);
const unitRow = (page: Page, name: string) => page.locator(`[data-unit-name="${name}"]`);

/** Phones show the map and the guests one at a time. */
async function show(page: Page, pane: 'map' | 'guests', mobile: boolean) {
  if (!mobile) return;
  await page
    .getByRole('radiogroup', { name: 'תצוגה' })
    .first()
    .getByRole('radio', { name: pane === 'map' ? 'מפה' : /^אורחים/ })
    .click();
}

async function addRoundTable(page: Page) {
  await page.getByRole('button', { name: 'הוספת שולחן' }).click();
  await page.getByRole('menuitem', { name: /עגול/ }).click();
}

async function center(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function shot(page: Page, name: string, project: string) {
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: `${SCREENS}/${project}-${name}.png` });
}

test.describe('seating', () => {
  test.skip(!LOCAL, 'seeds the local database');

  test('tables, a floor plan calibrated, a family seated whole, a table too small refuses', async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    const mobile = testInfo.project.name === 'mobile';
    const errors = collectErrors(page);
    await signUp(page);
    const { id } = await createInvitation(page);
    await seedGuests(id, [
      { name: 'משפחת כהן', party: 4, coming: 3, group: 'עבודה', people: ['רותי כהן', 'דני כהן', 'נועם כהן'] },
      { name: 'משפחת לוי', party: 6, coming: 5, group: 'צבא' },
      { name: 'יעל מזרחי', party: 1, coming: 0 },
    ]);

    // the workspace has the tab
    await open(page, `/app/invitations/${id}`);
    await page.locator('[data-tab="seating"]').click();
    await page.waitForURL(/\/seating$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByRole('heading', { level: 1, name: 'סידור שולחנות' })).toBeVisible();
    await expect(page.getByTestId('seating-summary')).toContainText('0 מתוך 8 מאשרי הגעה יושבים');

    // a round table of 10, down to 6 seats
    await addRoundTable(page);
    await expect(tableOnMap(page, 1)).toBeVisible();
    const inspector = page.getByTestId('table-inspector');
    await expect(inspector.getByRole('heading', { name: 'שולחן 1' })).toBeVisible();
    for (let i = 0; i < 4; i++) await inspector.getByRole('button', { name: 'פחות מקומות' }).click();
    await expect(inspector.getByTestId('table-capacity')).toHaveText('6');
    await inspector.getByRole('button', { name: 'סגירת חלון השולחן' }).click();

    // the floor plan: an image, then its width in meters
    await page.getByTestId('plan-button').click();
    let dialog = page.getByRole('dialog', { name: 'תוכנית האולם' });
    await dialog
      .getByTestId('plan-file')
      .setInputFiles({ name: 'hall.png', mimeType: 'image/png', buffer: planPng() });
    await expect(toast(page, 'תוכנית האולם עודכנה')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('seating-plan-image')).toHaveCount(1);
    await expect(page.getByText('קנה המידה של התוכנית עוד לא כויל')).toBeVisible();
    await page.getByTestId('plan-button').click();
    dialog = page.getByRole('dialog', { name: 'תוכנית האולם' });
    await expect(dialog.getByTestId('plan-scale')).toContainText('לא כויל');
    await dialog.getByTestId('plan-width').fill('40');
    await dialog.getByRole('button', { name: 'עדכון' }).click();
    await expect(toast(page, 'הכיול עודכן')).toBeVisible();
    await expect(page.getByText('קנה המידה של התוכנית עוד לא כויל')).toHaveCount(0);

    // …or a line of known length drawn on the plan
    if (!mobile) {
      await page.getByTestId('plan-button').click();
      await page.getByRole('dialog', { name: 'תוכנית האולם' }).getByTestId('draw-line').click();
      await expect(page.getByText('ציירו קו על התוכנית')).toBeVisible();
      // the dialog's closing animation keeps the page from taking pointer events for a moment
      await expect(page.getByTestId('plan-dialog')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.pointerEvents)).not.toBe('none');
      // across the middle of the map (a toast may sit at its bottom corner)
      const canvas = (await page.getByTestId('seating-canvas').boundingBox())!;
      const y = canvas.y + canvas.height / 2;
      await page.mouse.move(canvas.x + canvas.width * 0.25, y);
      await page.mouse.down();
      await page.mouse.move(canvas.x + canvas.width * 0.75, y, { steps: 8 });
      await page.mouse.up();
      await page.getByTestId('line-length').fill('10');
      await page.getByRole('button', { name: 'עדכון' }).click();
      await expect(toast(page, 'הכיול עודכן').first()).toBeVisible();
    }
    await saved(page);

    // Cohen (3) to table 1 with "Seat" — the keyboard and touch way
    await show(page, 'guests', mobile);
    await unitRow(page, 'משפחת כהן').getByTestId('unit-seat').click();
    let picker = page.getByRole('dialog', { name: 'איפה משפחת כהן יושבים?' });
    await picker.locator('[data-table-choice="1"]').click();
    await expect(toast(page, 'משפחת כהן יושבים בשולחן 1')).toBeVisible();
    await expect(unitRow(page, 'משפחת כהן').getByTestId('unit-table')).toHaveText('שולחן 1');

    // Levi (5) can't: 3 seats left — the choice is refused, and so is a drop
    await unitRow(page, 'משפחת לוי').getByTestId('unit-seat').click();
    picker = page.getByRole('dialog', { name: 'איפה משפחת לוי יושבים?' });
    await expect(picker.locator('[data-table-choice="1"]')).toBeDisabled();
    await expect(picker.locator('[data-table-choice="1"]')).toContainText('3 מקומות פנויים · אין מספיק מקום');
    await picker.getByRole('button', { name: 'סגירה' }).click();
    if (!mobile) {
      const from = await center(unitRow(page, 'משפחת לוי').getByTestId('unit-drag'));
      const to = await center(tableOnMap(page, 1));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 20, from.y + 5, { steps: 3 });
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await page.mouse.up();
      await expect(toast(page, 'בשולחן 1 נשארו 3 מקומות, ומשפחת לוי הם 5')).toBeVisible();
      // a table of their own, by dragging
      await addRoundTable(page);
      await expect(tableOnMap(page, 2)).toBeVisible();
      await inspector.getByRole('button', { name: 'סגירת חלון השולחן' }).click();
      const from2 = await center(unitRow(page, 'משפחת לוי').getByTestId('unit-drag'));
      const to2 = await center(tableOnMap(page, 2));
      await page.mouse.move(from2.x, from2.y);
      await page.mouse.down();
      await page.mouse.move(from2.x + 20, from2.y + 5, { steps: 3 });
      await page.mouse.move(to2.x, to2.y, { steps: 10 });
      await page.mouse.up();
      await expect(toast(page, 'משפחת לוי יושבים בשולחן 2')).toBeVisible();
    }
    await expect(unitRow(page, 'משפחת לוי').getByTestId(mobile ? 'unit-seat' : 'unit-table')).toBeVisible();
    await saved(page);
    await shot(page, 'editor-he', testInfo.project.name);

    // it was all saved: a reload shows the same
    await open(page, `/app/invitations/${id}/seating`);
    await show(page, 'guests', mobile);
    await expect(unitRow(page, 'משפחת כהן').getByTestId('unit-table')).toHaveText('שולחן 1');
    await expect(page.getByTestId('seating-summary')).toContainText(mobile ? '3 מתוך 8' : '8 מתוך 8');
    const [layout] = await sql<{ source: string; meters_per_pixel: string }>(
      `select source, meters_per_pixel from venue_layouts where invitation_id = $1`,
      [id],
    );
    expect(layout!.source).toBe('upload');
    expect(Number(layout!.meters_per_pixel)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('auto-seating: offered with the package that has it; runs, keeps a locked table on "Rearrange"', async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    const mobile = testInfo.project.name === 'mobile';
    const errors = collectErrors(page);
    const email = await signUp(page, 'seat-auto');
    const { id } = await createInvitation(page);
    await seedGuests(id, [
      { name: 'משפחת כהן', party: 4, coming: 4, group: 'צד הכלה' },
      { name: 'משפחת לוי', party: 3, coming: 3, group: 'צד הכלה' },
      { name: 'משפחת פרץ', party: 2, coming: 2, group: 'צד החתן' },
      { name: 'משפחת אזולאי', party: 5, coming: 5, group: 'צד החתן' },
      { name: 'חברים מהצבא', party: 4, coming: 4, group: 'צבא' },
      { name: 'עבודה של איתי', party: 3, coming: 3, group: 'עבודה' },
      { name: 'משפחת ביטון', party: 2, coming: 2, group: 'צד הכלה' },
      { name: 'שכנים', party: 2, coming: 2 },
    ]);

    // the free package: an upgrade prompt that names the package
    await open(page, `/app/invitations/${id}/seating`);
    await page.getByTestId('auto-seat').click();
    const upgrade = page.getByRole('dialog', { name: 'סידור אוטומטי' });
    await expect(upgrade).toContainText('חבילת Premium (תוכנית Pro)');
    await expect(upgrade.getByRole('link', { name: 'לחבילות' })).toHaveAttribute('href', '/app/billing');
    await upgrade.getByRole('button', { name: 'לא עכשיו' }).click();

    // with Pro: three tables of 10, then everyone seated by the rules
    await setPlan(email, 'pro');
    await open(page, `/app/invitations/${id}/seating`);
    for (let i = 0; i < 3; i++) await addRoundTable(page);
    await expect(tableOnMap(page, 3)).toBeVisible();
    // Esc closes the picked table's panel
    await expect(page.getByTestId('table-inspector')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('table-inspector')).toHaveCount(0);
    await page.getByTestId('auto-seat').click();
    const dialog = page.getByRole('dialog', { name: 'סידור אוטומטי' });
    await expect(dialog.getByRole('radio', { name: 'כל קטגוריה ביחד' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await dialog.getByTestId('run-auto').click();
    const result = page.getByTestId('auto-result');
    await expect(result).toHaveAttribute('data-run', '1', { timeout: 20_000 });
    await expect(result).toContainText('הסידור מוכן');
    await expect(result).toContainText('הושבו 25 אנשים');
    await expect(result.getByTestId('auto-score')).toContainText('ציון:');
    await expect(page.getByTestId('seating-summary')).toContainText('כל מאשרי ההגעה יושבים');
    await saved(page);
    await shot(page, 'auto-he', testInfo.project.name);

    // lock table 1, rearrange: table 1 keeps exactly who it had
    const before = await sql<{ unit_id: string }>(
      `select a.unit_id from seat_assignments a join seating_tables t on t.id = a.table_id
       where t.invitation_id = $1 and t.number = 1 and t.deleted_at is null order by a.unit_id`,
      [id],
    );
    expect(before.length).toBeGreaterThan(0);
    if (mobile) {
      // on a phone the map is roomier on the full screen
      await result.getByRole('button', { name: 'סגירה' }).click();
      await page.getByTestId('full-screen-phone').click();
    }
    await tableOnMap(page, 1).click();
    const inspector = page.getByTestId('table-inspector');
    await inspector.getByTestId('lock-table').click();
    await expect(inspector.getByTestId('lock-table')).toHaveAttribute('aria-pressed', 'true');
    await inspector.getByRole('button', { name: 'סגירת חלון השולחן' }).click();
    if (mobile) {
      await page.getByRole('button', { name: 'יציאה ממסך מלא' }).first().click();
      await page.getByTestId('auto-seat').click();
      await expect(page.getByRole('dialog', { name: 'סידור אוטומטי' })).toContainText(
        'שולחן נעול אחד יישאר בדיוק כמו שהוא',
      );
      await page.getByTestId('run-auto').click();
    } else await result.getByTestId('rerun').click();
    await expect(page.getByTestId('auto-result')).toHaveAttribute('data-run', '2', { timeout: 20_000 });
    await saved(page);
    const after = await sql<{ unit_id: string; locked: boolean }>(
      `select a.unit_id, t.locked from seat_assignments a join seating_tables t on t.id = a.table_id
       where t.invitation_id = $1 and t.number = 1 and t.deleted_at is null order by a.unit_id`,
      [id],
    );
    expect(after.map((r) => r.unit_id)).toEqual(before.map((r) => r.unit_id));
    expect(after.every((r) => r.locked)).toBe(true);
    // no table over its seats, every family whole (one row per unit)
    const over = await sql(
      `select t.number from seating_tables t
       join seat_assignments a on a.table_id = t.id
       join rsvp_responses r on r.id = (select response_id from seating_units u where u.id = a.unit_id)
       where t.invitation_id = $1 and t.deleted_at is null
       group by t.id, t.number, t.capacity having sum(r.adults_count + r.children_count) > t.capacity`,
      [id],
    );
    expect(over).toEqual([]);

    // print: the map, everyone A–Z with a table number, the tables
    const printPage = await page.context().newPage();
    await open(printPage, `/app/invitations/${id}/seating/print`);
    await expect(printPage.getByTestId('print-map').locator('svg')).toBeVisible();
    const list = printPage.getByTestId('print-list');
    await expect(list).toContainText('משפחת כהן');
    await expect(list.locator('li').filter({ hasText: 'משפחת כהן' })).toContainText(/שולחן \d/);
    await expect(printPage.getByTestId('print-tables')).toContainText('שולחן 1');
    await expect(printPage.getByRole('button', { name: 'הדפסה / שמירה כ־PDF' })).toBeVisible();
    await printPage.getByRole('radio', { name: 'A3' }).click();
    await printPage.getByRole('radio', { name: 'לרוחב' }).click();
    const pageRule = await printPage.evaluate(() =>
      [...document.querySelectorAll('style')]
        .map((x) => x.textContent ?? '')
        .find((x) => x.includes('@page')),
    );
    expect(pageRule).toContain('size: A3 landscape');
    await shot(printPage, 'print-he', testInfo.project.name);
    await printPage.close();

    // Excel: the guests A–Z with their tables, and the tables
    const res = await page.request.get(`/api/invitations/${id}/seating/export`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('spreadsheetml');
    const sheets = await readXlsxFile(await res.body());
    expect(sheets.map((s) => s.sheet)).toEqual(['אורחים', 'שולחנות']);
    expect(sheets[0]!.data[0]).toEqual([
      'שם',
      'משפחה / הזמנה',
      'מספר אנשים',
      'שולחן',
      'שם השולחן',
      'קטגוריה',
      'סטטוס',
    ]);
    const cohen = sheets[0]!.data.find((r) => r[0] === 'משפחת כהן')!;
    expect(cohen[2]).toBe(4);
    expect(typeof cohen[3]).toBe('number');
    expect(sheets[1]!.data.length).toBe(4);
    expect(errors).toEqual([]);
  });

  test('switched off for an event: no tab, and a way to switch it back on', async ({ page }) => {
    await signUp(page, 'seat-off');
    const { id } = await createInvitation(page);
    const off = await page.evaluate(async (invitationId) => {
      const res = await fetch(`/api/invitations/${invitationId}/features`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feature: 'seating', off: true }),
      });
      return res.status;
    }, id);
    expect(off).toBe(200);
    await open(page, `/app/invitations/${id}`);
    await expect(page.locator('[data-tab="responses"]')).toBeVisible();
    await expect(page.locator('[data-tab="seating"]')).toHaveCount(0);
    expect((await page.request.get(`/api/invitations/${id}/seating`)).status()).toBe(403);
    await open(page, `/app/invitations/${id}/seating`);
    await expect(page.getByRole('heading', { name: 'סידור השולחנות כבוי בהזמנה הזו' })).toBeVisible();
    await page.getByRole('button', { name: 'הפעלת סידור השולחנות' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'סידור שולחנות' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-tab="seating"]')).toBeVisible();
  });
});

test.describe('the partner’s venue', () => {
  test.skip(!LOCAL, 'the key is the local stack’s');

  const put = (request: APIRequestContext, venueId: string, data: Record<string, unknown>) =>
    request.put(`/api/partner/v1/venues/${venueId}`, { data, headers: auth });

  test('its floor plan (a PDF) is where its user’s seating starts, calibrated by its width', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(150_000);
    const errors = collectErrors(page);
    const tag = `${testInfo.project.name}-${Date.now()}`;
    const venueId = `hall-${tag}`;

    // refused: a plan the server may not fetch, an unknown venue for a user
    expect((await request.put(`/api/partner/v1/venues/${venueId}`, { data: { name: 'x' } })).status()).toBe(
      401,
    );
    const insecure = await put(request, venueId, {
      name: 'אולם',
      floorPlan: { url: 'http://files.example.com/p.png' },
    });
    expect(insecure.status()).toBe(400);
    expect(await insecure.json()).toMatchObject({ code: 'invalid', fields: ['floorPlan.url'] });
    const inside = await put(request, venueId, {
      name: 'אולם',
      floorPlan: { url: 'https://127.0.0.1/p.png' },
    });
    expect(await inside.json()).toMatchObject({ code: 'invalid', fields: ['floorPlan.url'] });
    const notAPlan = await put(request, venueId, {
      name: 'אולם',
      floorPlan: { base64: Buffer.from('<svg/>').toString('base64') },
    });
    expect(notAPlan.status()).toBe(415);
    const unknown = await request.post('/api/partner/v1/users', {
      data: { email: `nobody-${tag}@example.com`, fullName: 'x', venueId: `nope-${tag}` },
      headers: auth,
    });
    expect(unknown.status()).toBe(404);
    expect(await unknown.json()).toEqual({ ok: false, code: 'venue_not_found' });

    // the venue with its plan (a PDF) and its real width
    const created = await put(request, venueId, {
      name: 'אולמי הגן',
      address: 'הרצל 1, ראשון לציון',
      widthMeters: 36.5,
      floorPlan: { base64: planPdf().toString('base64') },
    });
    expect(created.status()).toBe(201);
    const venue = (await created.json()) as { venue: { floorPlan: { url: string; contentType: string } } };
    expect(venue).toMatchObject({
      ok: true,
      created: true,
      venue: {
        venueId,
        name: 'אולמי הגן',
        widthMeters: 36.5,
        users: 0,
        floorPlan: { contentType: 'application/pdf', width: null },
      },
    });
    expect((await request.get(venue.venue.floorPlan.url)).status()).toBe(200);
    const got = await request.get(`/api/partner/v1/venues/${venueId}`, { headers: auth });
    expect(await got.json()).toMatchObject({ ok: true, venue: { venueId, address: 'הרצל 1, ראשון לציון' } });

    // a customer of the venue: opened with the venue, signs in, opens seating for their event
    const email = `venue-${tag}@example.com`;
    const opened = await request.post('/api/partner/v1/users', {
      data: { email, fullName: 'לקוחת האולם', externalId: `be-v-${tag}`, venueId },
      headers: auth,
    });
    expect(opened.status()).toBe(201);
    const body = (await opened.json()) as { loginUrl: string; user: { venueId: string } };
    expect(body.user.venueId).toBe(venueId);
    await page.goto(body.loginUrl);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'המשך ל־Badook' }).click();
    await page.waitForURL(/\/app\/invitations$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    const { id } = await createInvitation(page);
    await open(page, `/app/invitations/${id}/seating`);
    // the PDF is drawn to an image in the browser once, and stored for the event
    await expect(page.getByTestId('seating-plan-image')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByText('קנה המידה של התוכנית עוד לא כויל')).toHaveCount(0);
    await saved(page);
    await page.getByTestId('plan-button').click();
    const dialog = page.getByRole('dialog', { name: 'תוכנית האולם' });
    await expect(dialog).toContainText('התוכנית של אולמי הגן');
    await expect(dialog).toContainText('בשימוש עכשיו');
    await expect(dialog.getByTestId('plan-scale')).toContainText('כויל: התוכנית ברוחב 36.5 מטר');
    await dialog.getByRole('button', { name: 'סגירה' }).click();
    await shot(page, 'venue-plan-he', testInfo.project.name);
    const [layout] = await sql<{ background_type: string; source: string; venue_plan_path: string }>(
      `select background_type, source, venue_plan_path from venue_layouts where invitation_id = $1`,
      [id],
    );
    expect(layout).toMatchObject({ background_type: 'image/png', source: 'partner' });
    expect(layout!.venue_plan_path).toMatch(/^venues\/.+\.pdf$/);
    expect(
      await (await request.get(`/api/partner/v1/venues/${venueId}`, { headers: auth })).json(),
    ).toMatchObject({
      venue: { users: 1 },
    });

    // the partner moves the user to no venue
    const unlinked = await request.patch('/api/partner/v1/users', {
      data: { externalId: `be-v-${tag}`, venueId: null },
      headers: auth,
    });
    expect(await unlinked.json()).toMatchObject({ ok: true, user: { venueId: null } });
    expect(errors).toEqual([]);
  });
});
