import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';

// Version 2 of the legal documents, on the local stack with PW_LEGAL_V2=1 (playwright.config.ts turns the
// switch on with a made-up operator): the six documents in both languages (axe, anchors, version line,
// 320 px reflow, an earlier version), the report and privacy-request forms (errors, focus, a stored
// record, no claim that an email was sent), and the guest gallery's first-upload notice (dialog, keyboard,
// acknowledgement record, shown once). Run: PW_LEGAL_V2=1 npx playwright test tests/e2e/legal-v2.spec.ts

const LOCAL = !process.env.PW_BASE_URL;
test.skip(!LOCAL || !process.env.PW_LEGAL_V2, 'needs the local stack with PW_LEGAL_V2=1');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const DOCS = ['terms', 'privacy', 'cookies', 'accessibility', 'refunds', 'gallery-rules'] as const;

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
async function setLang(page: Page, l: 'he' | 'en') {
  const base = (test.info().project.use.baseURL as string | undefined) ?? 'http://127.0.0.1:3100';
  await page.context().addCookies([{ name: 'ui_lang', value: l, url: base }]);
}

/** Each test its own address: the per-address limits never couple them. */
async function asVisitor(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join('.')}`,
  });
}

async function axe(page: Page, selector?: string) {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  if (selector) b = b.include(selector);
  const r = await b.analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('the six documents', () => {
  for (const l of ['he', 'en'] as const) {
    for (const doc of DOCS) {
      test(`/${doc} in ${l}: version 2, anchors, no axe violations`, async ({ page }) => {
        await setLang(page, l);
        const res = await page.goto(`/${doc}`);
        expect(res?.status()).toBe(200);
        await hydrated(page);
        await expect(page.locator('h1')).toBeVisible();
        await expect(
          page.getByText(l === 'he' ? /גרסה 2 · בתוקף מ/ : /Version 2 · in force from/),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', l === 'he' ? 'rtl' : 'ltr');
        // every section has its anchor and a contents link (the contents are hidden on narrow screens)
        const ids = await page.locator('article section[id]').evaluateAll((els) => els.map((e) => e.id));
        expect(ids.length).toBeGreaterThan(3);
        expect(new Set(ids).size).toBe(ids.length);
        await page.goto(`/${doc}#${ids[2]}`);
        await expect(page.locator(`#${ids[2]}`)).toBeInViewport();
        expect(await axe(page)).toEqual([]);
      });
    }
  }

  test('privacy keeps the anchors the app links to', async ({ page }) => {
    await setLang(page, 'en');
    await page.goto('/privacy');
    for (const id of ['faces', 'gallery', 'rights', 'reports'])
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await page.goto('/terms');
    for (const id of ['plans', 'cancel', 'reports'])
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
  });

  test('version 1 stays reachable at its own address, marked as an earlier version, not for search', async ({
    page,
  }) => {
    await setLang(page, 'en');
    const res = await page.goto('/legal/terms/1');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('note')).toContainText('earlier version');
    await expect(page.getByRole('link', { name: 'Go to the version in force' })).toHaveAttribute(
      'href',
      '/terms',
    );
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    // the frozen text still has the three-business-days promise it had
    await expect(page.locator('article')).toContainText('three business days');
    expect((await page.goto('/legal/terms/9'))?.status()).toBe(404);
    expect((await page.goto('/legal/nonsense/1'))?.status()).toBe(404);
    expect((await page.goto('/legal/refunds/1'))?.status()).toBe(404);
  });

  test('the footer links the new documents and every page reflows at 320 px', async ({ page }) => {
    await setLang(page, 'en');
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/terms');
    await expect(page.getByRole('link', { name: 'Refund and cancellation policy' }).last()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Event gallery and user-generated content rules/ }).last(),
    ).toBeVisible();
    for (const doc of DOCS) {
      await page.goto(`/${doc}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, doc).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('the report and privacy request forms', () => {
  test('a report: errors first (described, focus on the first), then a stored record, no claim of email', async ({
    page,
  }) => {
    await asVisitor(page);
    await setLang(page, 'en');
    await page.goto('/report');
    await hydrated(page);
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: /^(Send|Submit)/ }).click();
    await expect(page.getByTestId('form-errors')).toBeVisible();
    const invalid = page.locator('[aria-invalid="true"]').first();
    await expect(invalid).toBeFocused();
    const described = await invalid.getAttribute('aria-describedby');
    expect(described).toBeTruthy();

    await page.selectOption('select[name=category]', 'privacy');
    await page.selectOption('select[name=role]', 'depicted');
    await page.fill('textarea[name=description]', 'This is a synthetic report for the end to end test.');
    await page.fill('input[name=reference]', 'https://example.test/e/some-event');
    await page.getByRole('button', { name: /^(Send|Submit)/ }).click();
    const number = page.getByTestId('report-number');
    await expect(number).toBeVisible();
    const n = Number((await number.innerText()).replace(/\D+/g, ''));
    const rows = await sql<{ category: string; status: string; team_notified_at: string | null }>(
      `select category, status, team_notified_at from media_reports where number = $1`,
      [n],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'privacy', status: 'new' });
    // no mailbox is set up in the local stack: nothing was delivered, and the page doesn't say it was
    expect(rows[0]!.team_notified_at).toBeNull();
    await expect(page.locator('main')).not.toContainText(/emailed|email was sent|נשלח מייל/i);
    expect(await axe(page)).toEqual([]);
  });

  test('a privacy request from someone without an account: stored with a 30-day due date', async ({
    page,
  }) => {
    await asVisitor(page);
    await setLang(page, 'en');
    await page.goto('/privacy-request?kind=child_photo');
    await hydrated(page);
    expect(await axe(page)).toEqual([]);
    await expect(page.locator('select[name=kind]')).toHaveValue('child_photo');
    await page.fill('input[name=name]', 'Synthetic Parent');
    await page.fill('input[name=email]', `parent-${Date.now()}@example.test`);
    await page.fill(
      'textarea[name=details]',
      'Please remove the synthetic photo of my child from the gallery.',
    );
    await page.getByRole('button', { name: /^(Send|Submit)/ }).click();
    const number = page.getByTestId('request-number');
    await expect(number).toBeVisible();
    const n = Number((await number.innerText()).replace(/\D+/g, ''));
    const [row] = await sql<{ kind: string; days: number }>(
      `select kind, extract(day from due_at - created_at)::int as days from privacy_requests where number = $1`,
      [n],
    );
    expect(row).toMatchObject({ kind: 'child_photo', days: 30 });
  });
});

test.describe('the guest gallery', () => {
  /** A host with a gallery (turned on through the API's own function) and one published synthetic item. */
  async function galleryWithItem(page: Page) {
    const email = `legal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.goto('/signup');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'a-good-password');
    // version 2: sign-up asks for the terms, unticked
    const accept = page.locator('input[name=accept]');
    await expect(accept).not.toBeChecked();
    await page.click('form:has(input[name=password]) button[type=submit]');
    await expect(page.locator('[role=alert]').first()).toBeVisible();
    await expect(accept).toBeFocused();
    await accept.check();
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);
    await hydrated(page);
    const [user] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]);
    const accepted = await sql<{ doc_key: string; version: string; source: string }>(
      `select doc_key, version, source from legal_acceptances where user_id = $1 order by doc_key`,
      [user!.id],
    );
    expect(accepted).toEqual([
      { doc_key: 'privacy', version: '2', source: 'signup' },
      { doc_key: 'terms', version: '2', source: 'signup' },
    ]);
    await sql(
      `insert into accounts (user_id, plan, plan_status, plan_renews_at) values ($1, 'pro', 'active', now() + interval '30 days')
       on conflict (user_id) do update set plan = 'pro', plan_status = 'active', plan_renews_at = excluded.plan_renews_at`,
      [user!.id],
    );
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
    await page.goto(`/app/invitations/${created.id}/gallery`);
    await hydrated(page);
    await page.getByTestId('gallery-start').getByRole('button', { name: 'הפעלת הגלריה' }).click();
    await expect(page.getByTestId('gallery-screen')).toBeVisible();
    const link = await page.getByTestId('gallery-upload-link').inputValue();
    const token = new URL(link).searchParams.get('t')!;
    const itemId = crypto.randomUUID();
    const folder = `${created.id}/${itemId}`;
    await sql(`select public.gallery_reserve($1, $2, null, 'synthetic', $3::jsonb, 3000)`, [
      created.id,
      'f'.repeat(64),
      JSON.stringify([
        {
          id: itemId,
          kind: 'image',
          originalPath: `${folder}/original.jpg`,
          originalType: 'image/jpeg',
          originalSize: 1000,
          displayPath: `${folder}/display.jpg`,
          displaySize: 500,
          thumbPath: `${folder}/thumb.jpg`,
          thumbSize: 100,
          width: 100,
          height: 100,
          durationMs: null,
          takenAt: null,
        },
      ]),
    ]);
    await sql(`select public.gallery_complete($1, $2, $3, 'published', 'ok', '{}', '[]', '{}', true)`, [
      created.id,
      itemId,
      'f'.repeat(64),
    ]);
    return { invitationId: created.id, link, token, itemId };
  }

  test('first upload: a notice (once), linked rules, an acknowledgement record; and an urgent report hides an item', async ({
    page,
    browser,
  }) => {
    await asVisitor(page);
    const g = await galleryWithItem(page);

    const guest = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } });
    const phone = await guest.newPage();
    await phone.setExtraHTTPHeaders({ 'x-forwarded-for': '10.77.1.1' });
    await phone.goto(`${g.link}&lang=en`);
    await expect(phone.getByTestId('gallery-share')).toBeEnabled();
    await phone.getByTestId('gallery-share').click();
    const dialog = phone.getByTestId('upload-notice');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    expect(await axe(phone, '[data-testid=upload-notice]')).toEqual([]);
    await expect(dialog.getByRole('link', { name: /Gallery rules/ })).toHaveAttribute(
      'href',
      /\/gallery-rules/,
    );
    await expect(dialog.getByRole('link', { name: /Privacy policy/ })).toHaveAttribute('href', /\/privacy/);
    await expect(dialog).toContainText('not the consent of the people in your photos');
    // Escape cancels: no record, no file chooser
    await phone.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(
      await sql(`select 1 from gallery_acknowledgements where invitation_id = $1`, [g.invitationId]),
    ).toHaveLength(0);
    // acknowledging records it (the device's per-event hash, the version) and carries on
    await phone.getByTestId('gallery-share').click();
    await phone.getByTestId('upload-notice-ok').click();
    await expect
      .poll(
        async () =>
          (
            await sql(`select rules_version from gallery_acknowledgements where invitation_id = $1`, [
              g.invitationId,
            ])
          ).length,
      )
      .toBe(1);
    const [ack] = await sql<{ rules_version: string; uploader_hash: string }>(
      `select rules_version, uploader_hash from gallery_acknowledgements where invitation_id = $1`,
      [g.invitationId],
    );
    expect(ack!.rules_version).toBe('2');
    expect(ack!.uploader_hash).toMatch(/^[0-9a-f]{64}$/);
    // not asked again on this device
    await phone.reload();
    await expect(phone.getByTestId('gallery-share')).toBeEnabled();
    await phone.getByTestId('gallery-share').click();
    await expect(phone.getByTestId('upload-notice')).toHaveCount(0);

    // a report from someone who holds the link: a child → the item is hidden at once, reversibly
    const reporter = await guest.newPage();
    await reporter.setExtraHTTPHeaders({ 'x-forwarded-for': '10.77.2.2' });
    await reporter.goto(`/report?g=${g.token}&i=${g.itemId}&lang=en`);
    await hydrated(reporter);
    await expect(reporter.getByTestId('report-link-note')).toBeVisible();
    await reporter.selectOption('select[name=category]', 'child_safety');
    await reporter.selectOption('select[name=role]', 'guardian');
    await reporter.fill(
      'textarea[name=description]',
      'A synthetic photo of my child that should not be here.',
    );
    await reporter.getByRole('button', { name: /^(Send|Submit)/ }).click();
    await expect(reporter.getByTestId('report-number')).toBeVisible();
    const [item] = await sql<{ status: string; status_reason: string }>(
      `select status, status_reason from gallery_items where id = $1`,
      [g.itemId],
    );
    expect(item).toEqual({ status: 'hidden', status_reason: 'report' });
    // the guest's feed no longer holds it
    const feed = await reporter.request.post('/api/gallery/feed', { data: { t: g.token } });
    expect(JSON.stringify(await feed.json())).not.toContain(g.itemId);
    // a report with a link of another event's token and this item finds nothing
    const other = await reporter.request.post('/api/legal/report', {
      data: {
        g: 'x'.repeat(24),
        i: g.itemId,
        category: 'privacy',
        role: 'depicted',
        description: 'Synthetic: the wrong link must not find this item.',
      },
    });
    expect(other.status()).toBeGreaterThanOrEqual(400);
    await guest.close();
  });
});
