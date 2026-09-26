import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL, PHONE, newHost, open, publish, sql } from '../support/phase5b';

// The invitation's insights (feature analytics): a guest's scripted visit from their personal link —
// the cover opened, the page read to the end, the RSVP started and sent — is counted once, with no
// cookie and nothing kept on the phone, and the host's Insights tab shows it in the funnel. A visitor
// whose browser asks not to be tracked (Global Privacy Control) is not counted at all.

test.skip(!LOCAL, 'reads rows of the local database');

const BEACON_KEYS = [
  'calendar',
  'depth',
  'device',
  'gallery',
  'lang',
  'langSwitch',
  'map',
  'opened',
  'rsvpSent',
  'rsvpStarted',
  'slug',
  'source',
  'visibleMs',
  'visit',
];

/** Fills whichever of the RSVP's fields this design asks for. */
async function reply(page: Page) {
  const form = page.locator('.form');
  await form.scrollIntoViewIfNeeded();
  await form.locator('.opt').first().click();
  for (const [field, value] of [
    ['a0.firstName', 'דנה'],
    ['a0.lastName', 'כהן'],
    ['a0.fullName', 'דנה כהן'],
    ['a0.phone', '050-123-4567'],
  ] as const) {
    const input = form.locator(`[id$="-${field}"]`);
    if (await input.count()) await input.fill(value);
  }
  await form.locator('button.btn-primary').click();
  await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
}

test('a guest’s visit is counted once in the funnel, without cookies; a “do not track” visit is not', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the host on a computer, the guest on a phone');
  test.setTimeout(120_000);
  const host = await newHost(page, 'insights', 'free');
  await publish(host.id);
  const token = `in${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  await sql(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, 'דנה כהן', 1, null, $2)`,
    [host.id, token],
  );

  // the guest, from their personal link
  const phone = await browser.newContext(PHONE);
  // what each beacon carries, as the page hands it to the browser
  await phone.addInitScript(() => {
    const send = navigator.sendBeacon.bind(navigator);
    const kept: string[] = [];
    (window as unknown as { __beacons: string[] }).__beacons = kept;
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (String(url).includes('/api/insights') && data instanceof Blob)
        void data.text().then((t) => kept.push(t));
      return send(url, data);
    };
  });
  const guest = await phone.newPage();
  await guest.goto(`/i/${host.slug}/he?g=${token}`);
  await guest.locator('.cover-tap').click();
  await expect(guest.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
  // read to the end, a little at a time
  for (let i = 0; i < 30; i++) {
    const end = await guest.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    });
    if (end) break;
    await guest.waitForTimeout(80);
  }
  await reply(guest);

  await expect
    .poll(
      async () =>
        (
          await sql(
            `select visits, opened, read_end, rsvp_started, rsvp_sent, by_source, by_device
               from insight_daily where invitation_id = $1`,
            [host.id],
          )
        )[0] ?? null,
      { timeout: 20_000 },
    )
    .toMatchObject({
      visits: 1,
      opened: 1,
      read_end: 1,
      rsvp_started: 1,
      rsvp_sent: 1,
      by_source: { personal: { visits: 1, sent: 1 } },
      by_device: { phone: { visits: 1, sent: 1 } },
    });
  // what went: the page load's state only — no address, no browser, no name
  const beacons = await guest.evaluate(() => (window as unknown as { __beacons: string[] }).__beacons);
  expect(beacons.length).toBeGreaterThan(0);
  const last = JSON.parse(beacons.at(-1)!) as Record<string, unknown>;
  expect(Object.keys(last).sort()).toEqual(BEACON_KEYS);
  expect(last).toMatchObject({
    slug: host.slug,
    source: 'personal',
    device: 'phone',
    opened: true,
    depth: 100,
  });
  // no cookie, nothing kept on the phone for it
  expect((await phone.cookies()).filter((c) => /insight|visit/i.test(c.name))).toEqual([]);
  const kept = await guest.evaluate(() =>
    [...Object.keys(localStorage), ...Object.keys(sessionStorage)].join(' '),
  );
  expect(kept).not.toMatch(/insight|visit/i);
  await phone.close();

  // a visitor whose browser asks not to be tracked: nothing at all
  const quiet = await browser.newContext(PHONE);
  await quiet.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }),
  );
  const visitor = await quiet.newPage();
  const sent: string[] = [];
  visitor.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/insights') sent.push(r.url());
  });
  await visitor.goto(`/i/${host.slug}/he?open=1`);
  await visitor.mouse.wheel(0, 3000);
  await visitor.waitForTimeout(3500);
  expect(sent).toEqual([]);
  await quiet.close();

  // the host's Insights tab
  await open(page, `/app/invitations/${host.id}/insights`);
  await expect(page.getByTestId('insights-screen')).toBeVisible();
  const funnel = page.getByTestId('insights-funnel');
  for (const step of ['opened', 'readEnd', 'rsvpStarted', 'rsvpSent'])
    await expect(funnel.locator(`[data-step="${step}"] strong`)).toHaveText('1');
  await expect(page.getByTestId('insights-sources')).toContainText('קישור אישי');
  const [daily] = await sql<{ visits: number }>(`select visits from insight_daily where invitation_id = $1`, [
    host.id,
  ]);
  expect(daily!.visits).toBe(1);
});
