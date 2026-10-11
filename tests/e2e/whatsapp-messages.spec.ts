import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';

// The guests' WhatsApp section (/app/invitations/[id]/guests/whatsapp): sending an RSVP reminder now
// to who hasn't answered, with the phone preview; then the Smart sequence — chosen, reviewed, turned
// on — and a stage whose time came, run by the cron, reaching only who said they're coming.

const WHATSAPP = `http://127.0.0.1:${Number(process.env.PW_WHATSAPP_PORT || 54340)}`;
const CRON_SECRET = 'e2e-cron-secret-0123456789abcdef';
const DB_URL = Object.assign(
  new URL(process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres'),
  { pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}` },
).toString();

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function api<T>(page: Page, url: string, method = 'GET', body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json().catch(() => null) } as never;
    },
    { url, method, body },
  );
}

const e164 = (local: string) => `+972${local.replace(/-/g, '').slice(1)}`;

test('send a reminder now, then turn on the Smart sequence and let a stage run', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // one of INVITES_ADMIN_EMAILS: sends without buying credits, and has every sequence
  const project = testInfo.project.name;
  await page.goto('/signup');
  await page.fill('input[name=email]', `wa-sched-${project}@example.com`);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });

  const created = await api<{ body: { id: string } }>(page, '/api/invitations', 'POST', {
    templateId: 'sahar-bordeaux',
    eventType: 'wedding',
    locales: ['he'],
    defaultLocale: 'he',
    hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
    date: '2027-06-17',
    startTime: '19:30',
    timezone: 'Asia/Jerusalem',
  });
  const id = created.body.id;
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    // published as it is (the publish flow has its own tests)
    await db.query(
      `update invitations set status = 'published', published_at = now(), published = draft where id = $1`,
      [id],
    );
    const s = project === 'desktop' ? '3' : '4';
    const phones = { waiting: `050-88800${s}1`, coming: `050-88800${s}2`, notYet: `050-88800${s}3` };
    expect(
      (
        await api<{ status: number }>(page, `/api/invitations/${id}/guests`, 'POST', {
          guests: [
            { name: 'דנה מחכה', phone: phones.waiting },
            { name: 'יוסי מגיע', phone: phones.coming },
            { name: 'רותי עוד לא', phone: phones.notYet },
          ],
        })
      ).status,
    ).toBe(200);
    const guests = (
      await api<{ body: { guests: { id: string; name: string }[] } }>(page, `/api/invitations/${id}/guests`)
    ).body.guests;
    const idOf = (name: string) => guests.find((g) => g.name === name)!.id;
    // two got the invitation; one of them said they're coming
    await api(page, `/api/invitations/${id}/guests/sent`, 'POST', {
      ids: [idOf('דנה מחכה'), idOf('יוסי מגיע')],
      sent: true,
    });
    await api(page, `/api/invitations/${id}/guests/${idOf('יוסי מגיע')}/answer`, 'PUT', {
      kind: 'answer',
      attending: true,
      count: 2,
    });

    // the guests page leads to the section
    await open(page, `/app/invitations/${id}/guests`);
    await page.getByTestId('guests-messages').click();
    await page.waitForURL(/\/guests\/whatsapp$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });

    // ── send now: the RSVP reminder to who hasn't answered ──
    await page.locator('[data-kind="reminder"]').click();
    const filters = page.getByTestId('manual-filters');
    await expect(filters.getByRole('radio', { name: /לא ענו/ })).toHaveAttribute('aria-checked', 'true');
    const list = page.getByTestId('manual-guests');
    await expect(list).toContainText('דנה מחכה');
    await expect(list).not.toContainText('יוסי מגיע');
    await list.getByRole('checkbox', { name: 'דנה מחכה' }).check();
    // the preview greets the chosen guest, in the approved template's words, with its button
    if (project === 'desktop') {
      const preview = page.locator('aside').getByTestId('whatsapp-preview');
      await expect(preview).toContainText('שלום דנה מחכה');
      await expect(preview).toContainText('רק מזכירים');
      await expect(preview.getByTestId('whatsapp-button')).toHaveText('לאישור הגעה');
    }
    await page.getByRole('button', { name: 'שליחה למוזמן אחד' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /אני מאשר\/ת/ }).click();
    await dialog.getByRole('button', { name: 'שליחה למוזמן אחד' }).click();
    await expect(dialog.getByTestId('send-done')).toBeVisible({ timeout: 60_000 });
    const sentTo = async (local: string) =>
      (await (await request.get(`${WHATSAPP}/__sent?to=${e164(local).slice(1)}`)).json()) as {
        template: string;
        params: string[];
        button: string | null;
      }[];
    const reminder = await sentTo(phones.waiting);
    expect(reminder).toHaveLength(1);
    expect(reminder[0]).toMatchObject({ template: 'badook_rsvp_reminder' });
    expect(reminder[0]!.params[0]).toBe('דנה מחכה');
    expect(reminder[0]!.button).toMatch(/\?g=[A-Za-z0-9_-]{16,}/);
    await dialog.getByRole('button', { name: 'סגירה' }).first().click();

    // ── smart scheduling: choose Smart, review, turn on ──
    await page.getByRole('tab', { name: /תזמון חכם/ }).click();
    // each stage says who gets it, behind its "?"
    const smartCard = page.locator('[data-preset="smart"]');
    await smartCard.getByRole('button', { name: /מה זה\? תזכורת 1/ }).click();
    await expect(smartCard).toContainText('נשלחת רק למי שקיבל את ההזמנה ועדיין לא אישר ולא סירב');
    await page.locator('[data-preset="smart"]').getByRole('button', { name: 'בחירה' }).click();
    await expect(page.getByTestId('schedule-stages').locator('[data-stage]')).toHaveCount(6);
    await page.getByRole('button', { name: 'לסקירה ולהפעלה' }).click();
    const review = page.getByRole('dialog', { name: 'סקירה לפני הפעלה' });
    await expect(review.getByTestId('review-table').locator('tbody tr')).toHaveCount(6);
    await expect(review.getByTestId('review-errors')).toHaveCount(0);
    const activate = review.getByRole('button', { name: 'הפעלת התזמון' });
    await expect(activate).toBeDisabled();
    await review.getByRole('checkbox', { name: /אני מאשר\/ת/ }).click();
    await activate.click();
    await expect(page.getByTestId('schedule-status')).toContainText('התזמון פעיל');

    // the reminder before the event comes due (moved to a minute ago), and the cron runs it
    await db.query(
      `update whatsapp_stages set send_at = now() - interval '1 minute' where invitation_id = $1 and key = 'event_reminder'`,
      [id],
    );
    const cron = await request.post('/api/cron/whatsapp', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(cron.status()).toBe(200);
    expect(await cron.json()).toMatchObject({ stages: { ran: 1, failed: 0 } });
    // only who is coming got it; nobody else got anything new
    const coming = await sentTo(phones.coming);
    expect(coming.map((m) => m.template)).toEqual(['badook_event_reminder']);
    expect(coming[0]!.params[0]).toBe('יוסי מגיע');
    expect(coming[0]!.params[3]).toContain('19:30');
    // its button: the way to the event, with the guest's personal link
    expect(coming[0]!.button).toMatch(new RegExp(`/way\\?g=[A-Za-z0-9_-]{16,}`));
    expect(await sentTo(phones.waiting)).toHaveLength(1);
    expect(await sentTo(phones.notYet)).toHaveLength(0);
    const stage = await db.query(
      `select status, outcome from whatsapp_stages where invitation_id = $1 and key = 'event_reminder'`,
      [id],
    );
    expect(stage.rows[0]).toMatchObject({ status: 'done', outcome: { ok: true, queued: 1 } });
    // a second run sends nothing again
    await request.post('/api/cron/whatsapp', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(await sentTo(phones.coming)).toHaveLength(1);

    // the way page the button opens: navigation in one tap, and the guest's own invitation
    // a page of its own, rendered on the server (no app around it)
    await page.goto(`/e/${coming[0]!.button}`);
    const way = page.getByTestId('way-page');
    await expect(way).toContainText('הדרך לאירוע');
    await expect(way).toContainText('נועה & איתי');
    await expect(way.getByRole('link', { name: 'הוספה ליומן' })).toBeVisible();
    await expect(way.getByRole('link', { name: 'להזמנה' })).toHaveAttribute('href', /\?g=/);
    await page.goto(`/app/invitations/${id}/guests/whatsapp`);

    // the page shows it: the stage sent, and the messages in the history
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByTestId('message-history')).toContainText('יוסי מגיע');
    expect(errors).toEqual([]);
  } finally {
    await db.end();
  }
});
