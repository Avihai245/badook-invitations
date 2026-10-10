import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { LOCAL, galleryOn, newHost, open, publish, seedPhotos, sql } from '../support/phase5b';

// A send on the date and at the time the host picked, in the time zone they picked (features/scheduler),
// end to end on the local stack: the album's thank-you scheduled from its dialog for 15:00 New York time
// on an event whose clock is Israel's — the dialog shows the moment on both clocks, the database keeps
// 15:00 / America/New_York and the moment it means (19:00 UTC in summer) — then, once that moment has
// come, the scheduler's call (POST /api/cron/tick, pg_cron's every minute in production) sends it, and
// the dialog says it went out. A wrong secret turns nothing.

test.skip(!LOCAL, 'reads and writes rows of the local stack');

const MOCKS = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;
const CRON = 'e2e-cron-secret-0123456789abcdef';
const SHOTS = 'tests/.artifacts/qa/scheduler';

test('the album’s thank-you scheduled for 15:00 New York time goes out then — not at Israel’s 15:00', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  test.setTimeout(120_000);
  const host = await newHost(page, 'clock', 'pro');
  await galleryOn(page, host.id);
  await publish(host.id);
  await seedPhotos(host.id, [{ color: [170, 80, 90] }, { color: [70, 120, 170] }]);
  const number = `+9725${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}03`;
  await sql(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, 'משפחת כץ', 2, $2, $3)`,
    [host.id, number, `sc${randomUUID().replace(/-/g, '').slice(0, 20)}`],
  );
  await sql(
    `update accounts set message_credits = 3 where user_id = (select id from auth.users where email = $1)`,
    [host.email],
  );

  // the album opened, its thank-you dialog: "schedule for later"
  await open(page, `/app/invitations/${host.id}/gallery`);
  const card = page.getByTestId('album-card');
  await card.getByRole('button', { name: 'לפתוח עכשיו' }).click();
  await expect(card.getByTestId('album-state')).toHaveText('פתוח לאורחים');
  await card.getByTestId('album-send').click();
  const dialog = page.getByRole('dialog');
  const schedule = dialog.getByTestId('schedule-album_thanks');
  await schedule.getByTestId('schedule-album_thanks-open').click();
  const form = schedule.getByTestId('schedule-album_thanks-form');
  // it starts on the event's clock
  await expect(form.getByTestId('schedule-album_thanks-zone')).toHaveValue('Asia/Jerusalem');
  const year = new Date().getUTCFullYear() + 1;
  await form.getByTestId('schedule-album_thanks-date').fill(`${year}-06-17`);
  await form.getByTestId('schedule-album_thanks-time').fill('15:00');
  await form.getByTestId('schedule-album_thanks-zone').selectOption('America/New_York');
  // the moment on both clocks before it is saved: 15:00 in New York is 22:00 in Israel
  const preview = form.getByTestId('schedule-album_thanks-preview');
  await expect(preview).toContainText('15:00');
  await expect(preview).toContainText('New York');
  await expect(preview).toContainText('22:00');
  await expect(preview).toContainText('Jerusalem');
  await preview.scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: `${SHOTS}/he-desktop-1-schedule-form.png` });
  await form.getByTestId('schedule-album_thanks-save').click();
  await expect(schedule.getByTestId('schedule-album_thanks-waiting')).toContainText('15:00');
  await expect(schedule.getByTestId('schedule-album_thanks-waiting')).toContainText('New York');
  await dialog.screenshot({ path: `${SHOTS}/he-desktop-2-scheduled.png` });

  // kept as picked, and the moment it means: 19:00 UTC (New York's summer time), not 12:00 (Israel's)
  const [kept] = await sql<{ local_date: string; local_time: string; time_zone: string; run_at: Date }>(
    `select to_char(local_date, 'YYYY-MM-DD') as local_date, to_char(local_time, 'HH24:MI') as local_time,
            time_zone, run_at from scheduled_sends where invitation_id = $1 and status = 'scheduled'`,
    [host.id],
  );
  expect(kept).toMatchObject({
    local_date: `${year}-06-17`,
    local_time: '15:00',
    time_zone: 'America/New_York',
  });
  expect(kept!.run_at.toISOString()).toBe(`${year}-06-17T19:00:00.000Z`);

  // not before its moment: the clock's turn sends nothing
  const turn = (secret: string) =>
    request.post('/api/cron/tick', { headers: { authorization: `Bearer ${secret}` } });
  expect((await turn('not-the-secret')).status()).toBe(401);
  const early = await turn(CRON);
  expect(early.status()).toBe(200);
  expect((await early.json()).scheduled).toEqual({ ran: 0, done: 0, failed: 0 });

  // its moment comes (moved to a second ago): the next turn sends the thank-you from the system's number
  await sql(`update scheduled_sends set run_at = now() - interval '1 second' where invitation_id = $1`, [
    host.id,
  ]);
  const due = await turn(CRON);
  expect((await due.json()).scheduled).toEqual({ ran: 1, done: 1, failed: 0 });
  await expect
    .poll(
      async () => {
        const sent = (await (await fetch(`${MOCKS}/__sent`)).json()) as { to: string; template: string }[];
        return sent.some((m) => m.to.endsWith(number.slice(1)) && m.template === 'badook_album');
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  const [done] = await sql<{ status: string; queued: number }>(
    `select status, (result->>'queued')::int as queued from scheduled_sends where invitation_id = $1`,
    [host.id],
  );
  expect(done).toEqual({ status: 'done', queued: 1 });

  // the dialog says so
  await page.reload();
  await page.getByTestId('album-card').getByTestId('album-send').first().click();
  await expect(page.getByRole('dialog').getByText(/השליחה המתוזמנת יצאה/)).toBeVisible();
});

test('a scheduled send that can’t go out (no credits by then): kept as failed with why, and its host gets an email', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  test.setTimeout(90_000);
  const host = await newHost(page, 'clockfail', 'pro');
  await galleryOn(page, host.id);
  await publish(host.id);
  const number = `+9725${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}04`;
  await sql(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, 'משפחת לוי', 2, $2, $3)`,
    [host.id, number, `sf${randomUUID().replace(/-/g, '').slice(0, 20)}`],
  );
  await sql(
    `update accounts set message_credits = 0 where user_id = (select id from auth.users where email = $1)`,
    [host.email],
  );
  // the gallery link scheduled from the app's API (as its dialog does), for 09:00 Los Angeles time
  const year = new Date().getUTCFullYear() + 1;
  const res = await page.evaluate(
    async ({ id, year }) => {
      const r = await fetch(`/api/invitations/${id}/schedule`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'gallery_link',
          date: `${year}-03-01`,
          time: '09:00',
          timeZone: 'America/Los_Angeles',
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    { id: host.id, year },
  );
  expect(res.status).toBe(200);
  expect(res.body.send.runAt).toBe(`${year}-03-01T17:00:00+00:00`);

  await sql(`update scheduled_sends set run_at = now() - interval '1 second' where invitation_id = $1`, [
    host.id,
  ]);
  const turn = await request.post('/api/cron/tick', { headers: { authorization: `Bearer ${CRON}` } });
  const body = await turn.json();
  expect(body.scheduled).toEqual({ ran: 1, done: 0, failed: 1 });
  expect(body.failureMails).toBe(1);
  const [failed] = await sql<{ status: string; error: string; needed: number; mailed: boolean }>(
    `select status, error, (result->>'needed')::int as needed, failure_mailed_at is not null as mailed
       from scheduled_sends where invitation_id = $1`,
    [host.id],
  );
  expect(failed).toEqual({ status: 'failed', error: 'credits', needed: 1, mailed: true });
  // the log of emails has it (the local stack sends no real email: "skipped")
  const [logged] = await sql<{ n: number }>(
    `select count(*)::int as n from email_log where kind = 'scheduled_send' and created_at > now() - interval '5 minutes'`,
  );
  expect(logged!.n).toBeGreaterThanOrEqual(1);
  // never twice
  const again = await request.post('/api/cron/tick', { headers: { authorization: `Bearer ${CRON}` } });
  expect((await again.json()).failureMails).toBe(0);

  // the dialog says why
  await open(page, `/app/invitations/${host.id}/gallery`);
  await page.getByTestId('gallery-send-links').click();
  await expect(page.getByRole('dialog').getByTestId('schedule-gallery_link-last')).toContainText(
    'לא היו מספיק קרדיטים',
  );
});
