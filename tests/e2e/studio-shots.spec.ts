import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';
import { stubExternalMedia } from '../support/external';

// Screenshots of the studio (Phase 5C) to look at — the host's screens in Hebrew and English, the
// family's review page, the guest's "listen" — on a phone (390×844) and a desktop. Only with
// QA_SHOTS=1 (tests/.artifacts/studio-shots); the behaviour itself is tested in studio.spec.ts.

const SHOTS = process.env.QA_SHOTS ? 'tests/.artifacts/studio-shots' : null;
test.skip(!SHOTS || !!process.env.PW_BASE_URL, 'screenshots on the local stack only (QA_SHOTS=1)');

const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();

async function sql(text: string, params: unknown[] = []) {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

const hydrated = (page: Page) => page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
const settle = (page: Page) =>
  page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      null,
      { timeout: 4_000 },
    )
    .catch(() => undefined);

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS!, { recursive: true });
  await settle(page);
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  await page.screenshot({ path: `${SHOTS}/${phone ? 'phone' : 'desktop'}-${name}.png` });
}

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

for (const ui of ['he', 'en'] as const)
  test(`the studio's screens (${ui})`, async ({ page, browser }) => {
    test.setTimeout(240_000);
    const phone = (page.viewportSize()?.width ?? 0) < 1024;
    const email = `shots-${ui}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    await page.context().addCookies([{ name: 'ui_lang', value: ui, url: 'http://127.0.0.1' }]);
    await page.goto('/signup');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'a-good-password');
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);
    await hydrated(page);
    await sql(
      `insert into accounts (user_id, plan, plan_status, plan_renews_at)
         select id, 'business', 'active', now() + interval '30 days' from auth.users where email = $1
       on conflict (user_id) do update set plan = 'business', plan_status = 'active'`,
      [email],
    );
    const id = await page.evaluate(async () => {
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
      return ((await res.json()) as { id: string }).id;
    });

    // the gallery's card
    await page.goto('/app/invitations/new');
    await hydrated(page);
    await expect(page.getByTestId('studio-entry')).toBeVisible();
    await shot(page, `${ui}-gallery-studio`);

    // the editor: "design it for me", the concepts
    await page.goto(`/app/invitations/${id}/edit`);
    await hydrated(page);
    const design = ui === 'he' ? 'עצבו לי' : 'Design it for me';
    if (phone) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name: ui === 'he' ? 'עיצוב' : 'Design' })
        .click();
      await page.getByRole('dialog').getByRole('button', { name: design }).click();
    } else {
      await page.getByRole('tab', { name: ui === 'he' ? 'עיצוב' : 'Design' }).click();
      await page.getByRole('button', { name: design, exact: true }).click();
    }
    const panel = page.getByTestId('studio-panel');
    await panel
      .getByTestId('studio-file')
      .setInputFiles(
        ['couple', 'sunset', 'venue', 'candles'].map((n) => `tests/fixtures/media/cine-${n}.jpg`),
      );
    await expect(panel.locator('li img')).toHaveCount(4, { timeout: 20_000 });
    await panel.getByTestId('studio-mood').fill(ui === 'he' ? 'ים ושקיעה' : 'sea and sunset');
    await shot(page, `${ui}-studio-panel`);
    await panel.getByTestId('studio-create').click();
    await expect(page.getByTestId('studio-concepts')).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(2500);
    await shot(page, `${ui}-studio-concepts`);
    await page.keyboard.press('Escape');

    // the review drawer with a comment, the pins
    const made = await api(page, `/api/invitations/${id}/review`, 'POST', { expiresInDays: 30 });
    const url = (made.body!.link as { url: string }).url;
    const family = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const fam = await family.newPage();
    await stubExternalMedia(fam);
    await fam.goto(`${new URL(url).pathname}/${ui}`);
    await expect(fam.getByTestId('review-banner')).toBeVisible();
    if (await fam.locator('.cover').count()) {
      await fam.locator('.cover > button.cover-tap').click();
      await expect(fam.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    }
    await fam.getByRole('button', { name: ui === 'he' ? 'הוספת הערה' : 'Add a comment' }).click();
    await fam.locator('h1.names').click();
    const compose = fam.getByTestId('review-compose');
    await compose
      .getByLabel(ui === 'he' ? 'השם שלכם' : 'Your name')
      .fill(ui === 'he' ? 'דודה רותי' : 'Aunt Ruth');
    await compose
      .getByLabel(ui === 'he' ? 'ההערה' : 'Comment')
      .fill(ui === 'he' ? 'אפשר שהשמות יהיו גדולים יותר?' : 'Could the names be bigger?');
    await fam.screenshot({ path: `${SHOTS}/phone-${ui}-review-compose.png` });
    await compose.getByRole('button', { name: ui === 'he' ? 'שליחת ההערה' : 'Send the comment' }).click();
    await expect(fam.getByTestId('review-thread')).toBeVisible();
    await fam.keyboard.press('Escape');
    await settle(fam);
    await fam.screenshot({ path: `${SHOTS}/phone-${ui}-review-page.png` });
    // a save of the draft (an edit), for the versions drawer
    const got = await api(page, `/api/invitations/${id}`);
    const draft = got.body!.draft as { sections: { data: Record<string, unknown> }[] };
    draft.sections[0]!.data.eyebrow = { he: 'בשעה טובה', en: 'With great joy' };
    await api(page, `/api/invitations/${id}`, 'PATCH', { draft, updatedAt: got.body!.updatedAt });
    await page.reload();
    await hydrated(page);
    if (phone) {
      await page.getByRole('button', { name: ui === 'he' ? 'פעולות נוספות' : 'More actions' }).click();
      await page.getByRole('menuitem', { name: new RegExp(ui === 'he' ? 'הערות' : 'Comments') }).click();
    } else await page.getByTestId('review-button').click();
    await expect(page.getByTestId('review-comment')).toHaveCount(1, { timeout: 20_000 });
    await shot(page, `${ui}-review-drawer`);
    await page.keyboard.press('Escape');
    if (!phone) await shot(page, `${ui}-review-pins`);

    // versions
    if (!phone) {
      await page.getByRole('button', { name: ui === 'he' ? 'גרסאות' : 'Versions', exact: true }).click();
      await expect(page.getByTestId('history-list')).toBeVisible({ timeout: 20_000 });
      await page
        .getByTestId('history-entry')
        .first()
        .getByRole('button', { name: ui === 'he' ? 'מה ישתנה בשחזור' : 'What restoring changes' })
        .click();
      await expect(page.getByTestId('history-changes')).toBeVisible({ timeout: 20_000 });
      await shot(page, `${ui}-versions`);
      await page.keyboard.press('Escape');
    }
    await family.close();
  });
