import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';
import { PNG } from 'pngjs';

// Design QA for seating (not part of the regular run): a wedding hall with a floor plan, tables,
// landmarks and 30 families, photographed in Hebrew and English on a phone (390×844) and a desktop —
// the editor, the guest list, a table's panel, a family's settings, the floor plan, the automatic
// seating's result, the upgrade prompt and the print view.
//   SEATING_SCREENS=1 PW_PORT=… npx playwright test tests/e2e/seating-screens.spec.ts
// Screenshots: tests/.artifacts/qa/seating/ (gitignored).

const OUT = 'tests/.artifacts/qa/seating';
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const FAMILIES: [string, number, string | null, string[]][] = [
  ['משפחת כהן', 4, 'צד הכלה', ['רותי כהן', 'דני כהן', 'נועם כהן', 'מאיה כהן']],
  ['משפחת לוי', 3, 'צד הכלה', ['יעל לוי', 'אבי לוי', 'תמר לוי']],
  ['סבתא אסתר', 1, 'צד הכלה', ['אסתר ביטון']],
  ['משפחת ביטון', 5, 'צד הכלה', []],
  ['משפחת אזולאי', 4, 'צד החתן', ['שרון אזולאי', 'משה אזולאי']],
  ['משפחת פרץ', 2, 'צד החתן', []],
  ['משפחת אברהם', 6, 'צד החתן', []],
  ['דוד ושירה מזרחי', 2, 'צד החתן', ['דוד מזרחי', 'שירה מזרחי']],
  ['משפחת גבאי', 3, 'צד החתן', []],
  ['סבא וסבתא גולן', 2, 'צד החתן', ['יצחק גולן', 'רחל גולן']],
  ['חברים מהצבא', 5, 'צבא', []],
  ['הצוות מהעבודה', 6, 'עבודה', []],
  ['נועה וגיל', 2, 'חברים', []],
  ['עומר', 1, 'חברים', []],
  ['שני ואלון', 2, 'חברים', []],
  ['משפחת שמעוני', 4, 'צד הכלה', []],
  ['משפחת חדד', 3, 'צד הכלה', []],
  ['משפחת דהן', 5, 'צד החתן', []],
  ['משפחת עמר', 2, 'צד החתן', []],
  ['השכנים', 2, null, []],
  ['משפחת טל', 4, 'צד הכלה', []],
  ['משפחת רוזן', 3, 'צד החתן', []],
  ['יובל', 1, 'חברים', []],
  ['מיכל ורון', 2, 'חברים', []],
  ['משפחת קליין', 4, 'צד הכלה', []],
  ['משפחת נחום', 3, 'צד החתן', []],
  ['הדס', 1, 'עבודה', []],
  ['אורי ונטע', 2, 'עבודה', []],
  ['משפחת סויסה', 6, 'צד הכלה', []],
  ['משפחת אוחיון', 4, 'צד החתן', []],
];

/** A floor plan: walls, a stage, a dance floor, a bar and an entrance, drawn as a venue's plan is. */
function hallPlan(w = 1600, h = 1000): Buffer {
  const png = new PNG({ width: w, height: h });
  const set = (x: number, y: number, v: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    png.data[i] = v[0];
    png.data[i + 1] = v[1];
    png.data[i + 2] = v[2];
    png.data[i + 3] = 255;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, v: [number, number, number], line = 0) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (!line || x < x0 + line || x >= x1 - line || y < y0 + line || y >= y1 - line) set(x, y, v);
  };
  rect(0, 0, w, h, [252, 251, 248]);
  for (let x = 0; x < w; x += 40) rect(x, 0, x + 1, h, [240, 238, 234]);
  for (let y = 0; y < h; y += 40) rect(0, y, w, y + 1, [240, 238, 234]);
  rect(20, 20, w - 20, h - 20, [70, 64, 58], 10);
  rect(560, 30, 1040, 170, [226, 219, 247]);
  rect(560, 30, 1040, 170, [120, 90, 190], 4);
  rect(640, 360, 960, 640, [222, 238, 250]);
  rect(640, 360, 960, 640, [90, 150, 200], 3);
  rect(1330, 400, 1570, 480, [250, 236, 200]);
  rect(1330, 400, 1570, 480, [200, 150, 60], 3);
  rect(720, h - 30, 880, h - 10, [255, 255, 255]);
  return PNG.sync.write(png);
}

async function setup(page: Page) {
  const email = `seat-screens-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await sql(
    `insert into accounts (user_id, plan) select id, 'pro' from auth.users where email = $1
     on conflict (user_id) do update set plan = 'pro'`,
    [email],
  );
  const { id } = await page.evaluate(async () => {
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
  for (const [i, [name, coming, group, people]] of FAMILIES.entries()) {
    const [g] = await sql<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, group_name, token) values ($1, $2, $3, $4, $5) returning id`,
      [id, name, coming, group, `screen${i}${Math.random().toString(36).slice(2, 12)}xx`],
    );
    // two families haven't replied yet
    if (i === 26 || i === 27) continue;
    const [r] = await sql<{ id: string }>(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id)
       values ($1, true, 'he', $2, $3, 0, $4, $5) returning id`,
      [id, name, coming, `h-${Math.random()}`, g!.id],
    );
    for (const [k, person] of people.entries())
      await sql(
        `insert into rsvp_attendees (response_id, kind, position, full_name) values ($1, 'adult', $2, $3)`,
        [r!.id, k, person],
      );
  }
  // the plan: an uploaded floor plan, 13 tables, the hall's landmarks, some families seated, rules, wishes
  const plan = hallPlan().toString('base64');
  await page.evaluate(
    async ({ invitationId, png }) => {
      const state = (await (await fetch(`/api/invitations/${invitationId}/seating`)).json()) as {
        state: { version: number; units: { id: string; name: string; seats: number }[] };
      };
      const bytes = Uint8Array.from(atob(png), (ch) => ch.charCodeAt(0));
      const ticket = (await (
        await fetch(`/api/invitations/${invitationId}/seating/upload`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contentType: 'image/png', size: bytes.length }),
        })
      ).json()) as { url: string; path: string };
      await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: bytes });
      const uuid = () => crypto.randomUUID();
      const round = (n: number, x: number, y: number) => ({
        id: uuid(),
        number: n,
        label: null,
        shape: 'round',
        capacity: 10,
        x,
        y,
        w: 1.8,
        h: 1.8,
        rotation: 0,
        zones: [] as string[],
        locked: false,
      });
      const tables = [
        { ...round(1, 11, 7), zones: ['stage'] },
        { ...round(2, 29, 7), zones: ['stage'] },
        round(3, 6, 12),
        round(4, 11, 16.5),
        { ...round(5, 29, 16.5), zones: ['dance'] },
        round(6, 34, 12),
        round(7, 6, 21),
        { ...round(8, 11, 22), zones: ['accessible'] },
        round(9, 29, 22),
        round(10, 34, 21),
        {
          ...round(11, 20, 20.5),
          label: 'אבירים',
          shape: 'knights',
          capacity: 20,
          w: 6,
          h: 1,
        },
        { ...round(12, 20, 5.5), label: 'VIP', shape: 'rect', capacity: 8, w: 2.4, h: 0.9 },
        round(13, 14, 11.5),
      ];
      const units = state.state.units;
      const byName = (n: string) => units.find((u) => u.name === n)!.id;
      const seatAt: [string, number][] = [
        ['משפחת כהן', 0],
        ['משפחת לוי', 0],
        ['סבתא אסתר', 0],
        ['משפחת אזולאי', 1],
        ['משפחת פרץ', 1],
        ['דוד ושירה מזרחי', 1],
        ['חברים מהצבא', 4],
        ['נועה וגיל', 4],
        ['הצוות מהעבודה', 5],
        ['משפחת ביטון', 2],
        ['משפחת שמעוני', 2],
        ['סבא וסבתא גולן', 11],
        ['משפחת אברהם', 10],
        ['משפחת דהן', 10],
        ['משפחת סויסה', 6],
        ['משפחת טל', 6],
      ];
      const plan = {
        layout: {
          background: { path: ticket.path, type: 'image/png', width: 1600, height: 1000 },
          metersPerPixel: 0.025,
          source: 'upload',
          venuePlan: null,
          gridM: 0.5,
          landmarks: [
            { id: uuid(), kind: 'stage', x: 20, y: 2.5, w: 12, h: 3.5, rotation: 0, label: null },
            { id: uuid(), kind: 'dance', x: 20, y: 12.5, w: 8, h: 7, rotation: 0, label: null },
            { id: uuid(), kind: 'bar', x: 36, y: 11, w: 6, h: 2, rotation: 90, label: null },
            { id: uuid(), kind: 'entrance', x: 20, y: 24.5, w: 4, h: 0.6, rotation: 0, label: null },
          ],
          settings: { categories: 'group', minFill: 0.6, includePending: false },
        },
        tables,
        assignments: Object.fromEntries(
          seatAt.map(([n, t]) => [byName(n), { tableId: tables[t]!.id, source: 'host' }]),
        ),
        rules: [
          { id: uuid(), kind: 'together', a: byName('נועה וגיל'), b: byName('שני ואלון'), hard: true },
          { id: uuid(), kind: 'apart', a: byName('משפחת גבאי'), b: byName('משפחת דהן'), hard: true },
          { id: uuid(), kind: 'together', a: byName('עומר'), b: byName('יובל'), hard: false },
        ],
        units: {
          [byName('סבתא אסתר')]: {
            category: null,
            prefs: { stage: 1, dance: -1, exit: 0 },
            accessible: true,
          },
          [byName('משפחת אברהם')]: {
            category: null,
            prefs: { stage: 0, dance: 1, exit: 0 },
            accessible: false,
          },
        },
      };
      const saved = await fetch(`/api/invitations/${invitationId}/seating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: state.state.version, plan }),
      });
      if (!saved.ok) throw new Error(`save: ${saved.status} ${await saved.text()}`);
    },
    { invitationId: id, png: plan },
  );
  return { id, email };
}

/** The phone's "map | guests" switch. */
/** How many families are seated at the event (as saved). */
const seated = async (id: string) =>
  (
    await sql<{ n: number }>('select count(*)::int as n from seat_assignments where invitation_id = $1', [id])
  )[0]!.n;

const tabs = (page: Page) => page.getByRole('radiogroup', { name: /^(תצוגה|View)$/ }).first();

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

test.describe('seating screens', () => {
  test.skip(!process.env.SEATING_SCREENS, 'Design QA: SEATING_SCREENS=1');

  test('the seating screens in Hebrew and English', async ({ page, context }, testInfo) => {
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const vp = testInfo.project.name;
    const mobile = vp === 'mobile';
    const { id, email } = await setup(page);
    // the whole site's cookie (a cookie set by the page's URL only covers that page's folder)
    const setLang = (lang: 'he' | 'en') =>
      context.addCookies([{ name: 'ui_lang', value: lang, url: new URL('/', page.url()).toString() }]);
    // after the panels' and dialogs' opening animations
    const shot = async (name: string, lang: string, full = false) => {
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/${vp}-${lang}-${name}.png`, fullPage: full });
    };

    for (const lang of ['he', 'en'] as const) {
      await setLang(lang);
      await open(page, `/app/invitations/${id}/seating`);
      await expect(page.getByTestId('seating-canvas').locator('[data-table-number="13"]')).toBeVisible();
      await page.waitForTimeout(600);
      await shot('editor', lang, true);
      if (mobile) {
        await page.getByTestId('seating-editor').scrollIntoViewIfNeeded();
        await shot('map', lang);
        await tabs(page).getByRole('radio').nth(1).click();
        await shot('guests', lang);
        await tabs(page).getByRole('radio').nth(0).click();
        await page.getByTestId('full-screen-phone').click();
        await page.waitForTimeout(400);
        await shot('fullscreen', lang);
      }
      // a table's panel
      await page.getByTestId('seating-canvas').locator('[data-table-number="1"]').click();
      await expect(page.getByTestId('table-inspector')).toBeVisible();
      await shot('table', lang);
      await page.keyboard.press('Escape');
      if (mobile) await page.keyboard.press('Escape');
      // a family's settings (from the list)
      if (mobile) await tabs(page).getByRole('radio').nth(1).click();
      const grandma = page.locator('[data-unit-name="סבתא אסתר"]');
      await grandma.getByRole('button', { name: /אפשרויות|Options/ }).click();
      await page.getByRole('menuitem', { name: /הגדרות ובקשות|Settings and wishes/ }).click();
      await expect(page.getByTestId('unit-dialog')).toBeVisible();
      await shot('family', lang);
      await page.keyboard.press('Escape');
      // seat a family: the table picker
      await page.locator('[data-unit-name="משפחת גבאי"]').getByTestId('unit-seat').click();
      await expect(page.getByTestId('seat-picker')).toBeVisible();
      await shot('picker', lang);
      await page.keyboard.press('Escape');
      if (mobile) await tabs(page).getByRole('radio').nth(0).click();
      // the floor plan
      await page.getByTestId('plan-button').click();
      await expect(page.getByTestId('plan-dialog')).toBeVisible();
      await shot('plan', lang);
      await page.keyboard.press('Escape');
      // the automatic seating and its result
      const before = await seated(id);
      await page.getByTestId('auto-seat').click();
      await expect(page.getByTestId('auto-dialog')).toBeVisible();
      await shot('auto', lang);
      await page.getByTestId('run-auto').click();
      await expect(page.getByTestId('auto-result')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(400);
      await shot('auto-result', lang);
      await page.keyboard.press('Control+z');
      // the undo is saved before leaving (the next language starts from the same plan)
      await expect.poll(() => seated(id), { timeout: 15_000 }).toBe(before);
      // the print view
      await open(page, `/app/invitations/${id}/seating/print`);
      await page.waitForTimeout(500);
      await shot('print', lang, true);
    }
    // the upgrade prompt on the free package
    await sql(
      `update accounts set plan = 'free' where user_id = (select id from auth.users where email = $1)`,
      [email],
    );
    await setLang('he');
    await open(page, `/app/invitations/${id}/seating`);
    await page.getByTestId('auto-seat').click();
    await expect(page.getByTestId('upgrade-link')).toBeVisible();
    await shot('upgrade', 'he');
  });
});
