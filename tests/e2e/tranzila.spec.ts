import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';

// Tranzila end to end, against its local stand-in (tests/support/mock-tranzila.mjs): the billing screen
// opens Tranzila's card form in an iframe; paying there sends the card's token to our notify address,
// our server charges it on the token terminal (the API, signed), and the iframe's return page takes the
// screen to the result — a message pack, a plan (its card kept for the monthly charge), a card the form
// refuses, and the monthly charge made by the daily run.
//
// Runs only against a server in Tranzila mode (not INVITES_BILLING_TEST_MODE) — docs/billing-setup.md:
//   PW_TRANZILA_MOCK=http://127.0.0.1:55050 PW_BASE_URL=http://127.0.0.1:3200 npx playwright test tranzila

const MOCK = process.env.PW_TRANZILA_MOCK;
test.skip(!MOCK, 'needs the Tranzila stand-in and a server pointed at it (PW_TRANZILA_MOCK)');

const db = () =>
  new pg.Client({
    connectionString: Object.assign(
      new URL(process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres'),
      { pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}` },
    ).toString(),
  });
async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const c = db();
  await c.connect();
  try {
    return (await c.query(text, values)).rows as T[];
  } finally {
    await c.end();
  }
}
/** what the stand-in saw for this buyer (the two projects run side by side) */
const mock = async (email: string) => {
  const all = (await (await fetch(`${MOCK}/charges`)).json()) as {
    charges: { terminal: string; type: string; amount: number; approved: boolean; email: string | null }[];
    notices: { email: string | null; response: { status: number; text: string } }[];
  };
  return {
    charges: all.charges.filter((c) => c.email === email),
    notices: all.notices.filter((n) => n.email === email),
  };
};

async function signUp(page: Page) {
  const email = `tranzila-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  return email;
}

const kpi = (page: Page, label: string) =>
  page.locator('#main dl').filter({ has: page.getByText(label, { exact: true }) });

/** Opens the purchase, pays in Tranzila's form (inside the iframe), back to the billing screen. */
async function payInFrame(page: Page, open: () => Promise<void>, card?: string) {
  await open();
  const dialog = page.getByRole('dialog', { name: 'תשלום מאובטח' });
  await expect(dialog).toBeVisible();
  const frame = page.frameLocator('[data-testid="payment-frame"]');
  if (card) await frame.getByTestId('tz-card').fill(card);
  const before = page.url();
  await frame.getByTestId('tz-pay').click();
  // the iframe's return page takes the whole screen to this purchase's result
  await page.waitForURL((url) => /\/app\/billing\?status=/.test(url.href) && url.href !== before);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

test('Tranzila: a pack and a plan paid in the iframe, a refused card, and the monthly charge', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = await signUp(page);
  await page.goto('/app/billing');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  // payments are on: no "not enabled yet" notice, and Tranzila's line under the plans
  await expect(page.getByTestId('billing-disabled')).toHaveCount(0);
  await expect(page.getByText('הסליקה מאובטחת על ידי טרנזילה').first()).toBeVisible();

  // a message pack: the form shows the price; paid → the credits
  await payInFrame(page, async () => {
    await page.locator('[data-pack="100"]').getByRole('button', { name: 'קנייה' }).click();
    await expect(page.frameLocator('[data-testid="payment-frame"]').getByTestId('tz-sum')).toContainText(
      '16.00',
    );
  });
  await expect(page.getByTestId('billing-returned')).toContainText('התשלום התקבל');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('100');
  let seen = await mock(email);
  // the form held the price (VK); our server took that hold on the iframe terminal
  expect(seen.charges).toEqual([
    expect.objectContaining({ terminal: 'badookinvit', type: 'force', amount: 16, approved: true }),
  ]);
  // the notify charged it (the return page found it paid)
  expect(seen.notices.at(-1)!.response).toEqual({ status: 200, text: 'paid' });

  // Pro: the plan, and its card kept for the monthly charge (the token, never the number)
  await payInFrame(page, () => page.getByRole('button', { name: 'שדרוג ל־Pro' }).click());
  await expect(page.getByTestId('billing-returned')).toContainText('התשלום התקבל');
  await expect(page.getByTestId('current-plan')).toContainText('Pro');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('150');
  const [card] = await sql<{ token: string; last4: string; expire_month: number; expire_year: number }>(
    `select c.token, c.last4, c.expire_month, c.expire_year from billing_cards c
       join auth.users u on u.id = c.user_id where u.email = $1`,
    [email],
  );
  expect(card).toMatchObject({ last4: '4580', expire_month: 8, expire_year: 2029 });
  expect(card!.token).toMatch(/^Z[0-9a-f]+$/);

  // a card the form refuses: nothing is charged, the screen says it failed
  await payInFrame(
    page,
    () => page.locator('[data-pack="300"]').getByRole('button', { name: 'קנייה' }).click(),
    '4000000000000002',
  );
  await expect(page.getByTestId('billing-returned')).toContainText('התשלום לא עבר');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('150');
  seen = await mock(email);
  expect(seen.charges).toHaveLength(2);

  // a month later: the daily run charges the plan's card, another month and its credits
  await sql(
    `update accounts set plan_renews_at = now() - interval '1 hour'
       where user_id = (select id from auth.users where email = $1)`,
    [email],
  );
  const cron = await page.request.post('/api/cron/rsvp-digest', {
    headers: { authorization: `Bearer ${process.env.PW_CRON_SECRET || 'e2e-cron-secret-0123456789abcdef'}` },
  });
  expect(cron.status()).toBe(200);
  seen = await mock(email);
  expect(seen.charges.at(-1)).toEqual(
    expect.objectContaining({ terminal: 'badookinvittok', type: 'debit', amount: 49, approved: true }),
  );
  const [renewed] = await sql<{ plan_status: string; ahead: boolean }>(
    `select plan_status, plan_renews_at > now() + interval '25 days' as ahead from accounts
       where user_id = (select id from auth.users where email = $1)`,
    [email],
  );
  expect(renewed).toEqual({ plan_status: 'active', ahead: true });
  await page.reload();
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('200');
  await expect(page.locator('#main').getByTestId('payments').first()).toContainText('חידוש חודשי');
});
