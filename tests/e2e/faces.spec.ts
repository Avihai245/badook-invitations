import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { LOCAL, PHONE, api, galleryOn, jpeg, newHost, open, seedPhotos, sql } from '../support/phase5b';

// Face search end to end ("the photos I'm in", feature face_albums — on in this stack's deployment,
// INVITES_FACE_ALBUMS): the host turns it on for the event (it never is by default) and prepares the
// gallery's photos in their browser; a guest agrees explicitly, picks a selfie, gets the album of the
// photos they are in and downloads it; asks to be left out of everyone's searches; another guest is
// forgotten. The face model is a stand-in injected through the test hook (window.__badookFaceEngine):
// it "recognizes" a person by a picture's main color — the real model runs in
// tests/unit/face-model.test.ts.

test.skip(!LOCAL, 'fills the gallery through the local database and storage');

/** The stand-in model: a reddish picture holds person A, a bluish one person B. */
const STAND_IN = () => {
  const person = (k: number) =>
    Array.from({ length: 128 }, (_, i) => Number((0.15 * Math.sin((i + 1) * k)).toFixed(5)));
  const A = person(1.3);
  const B = person(2.9);
  (window as unknown as { __badookFaceEngine: unknown }).__badookFaceEngine = {
    async detect(image: HTMLCanvasElement) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(image, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]!;
        b += d[i + 2]!;
      }
      return [{ box: [0.35, 0.2, 0.3, 0.25], score: 0.97, descriptor: r > b ? A : B }];
    },
  };
};

test('a guest finds the photos they are in, downloads them, and is left out; another is forgotten', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the host on a computer, the guests on their phones');
  test.setTimeout(150_000);
  const host = await newHost(page, 'faces', 'business');
  const link = await galleryOn(page, host.id);
  const [redA, redB, blue] = await seedPhotos(host.id, [
    { color: [205, 45, 45] },
    { color: [190, 60, 70] },
    { color: [40, 70, 205] },
  ]);

  // the host: off until they turn it on; then "prepare face search" in their browser
  await page.addInitScript(STAND_IN);
  await open(page, `/app/invitations/${host.id}/gallery`);
  // the card is in the gallery's settings tab
  await page.getByRole('tab', { name: 'הגדרות ומחיקה' }).click();
  const card = page.getByTestId('face-search-card');
  await expect(card.getByTestId('face-search-off')).toBeVisible();
  await card.getByRole('button', { name: 'הפעלת החיפוש לפי פנים' }).click();
  await expect(card.getByTestId('face-search-status')).toContainText('0 מתוך 3 תמונות מוכנות לחיפוש');
  await card.getByTestId('face-search-prepare').click();
  await expect(card.getByTestId('face-search-status')).toContainText(
    '3 מתוך 3 תמונות מוכנות לחיפוש · 3 פנים',
    {
      timeout: 30_000,
    },
  );
  const stored = await sql<{ n: number; boxes: number }>(
    `select count(*)::int as n, count(*) filter (where cardinality(box) = 4)::int as boxes
       from gallery_faces where invitation_id = $1`,
    [host.id],
  );
  expect(stored[0]).toEqual({ n: 3, boxes: 3 });

  // a guest (person A): consent first — unticked, and nothing goes on without it
  const phoneA = await browser.newContext(PHONE);
  await phoneA.addInitScript(STAND_IN);
  const guest = await phoneA.newPage();
  await guest.goto(link);
  await guest.getByTestId('face-start').click();
  const consent = guest.getByTestId('face-consent');
  await expect(consent).toContainText('הסלפי לא יוצא מהטלפון');
  await expect(consent.getByRole('link', { name: /מדיניות הפרטיות/ })).toHaveAttribute(
    'href',
    '/privacy#faces',
  );
  await expect(guest.getByTestId('face-agree')).not.toBeChecked();
  await expect(guest.getByTestId('face-continue')).toBeDisabled();
  await guest.getByTestId('face-agree').check();
  await guest.getByTestId('face-continue').click();
  // the selfie: a photo from the phone
  const searches: string[] = [];
  guest.on('request', (r) => {
    if (r.url().endsWith('/api/gallery/faces/search')) searches.push(r.postData() ?? '');
  });
  await guest.getByTestId('face-file').setInputFiles({
    name: 'selfie.jpg',
    mimeType: 'image/jpeg',
    buffer: await jpeg([215, 40, 40], 600, 800),
  });
  await expect(guest.getByTestId('face-count')).toHaveText('מצאנו אתכם ב־2 תמונות', { timeout: 20_000 });
  await expect(guest.getByTestId('face-album-grid').locator('[data-item]')).toHaveCount(2);
  const ids = await guest
    .getByTestId('face-album-grid')
    .locator('[data-item]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-item')));
  expect(new Set(ids)).toEqual(new Set([redA, redB]));
  // only the face code went, never the selfie
  expect(searches).toHaveLength(1);
  const sent = JSON.parse(searches[0]!) as Record<string, unknown>;
  expect(Object.keys(sent).sort()).toEqual(['descriptor', 't']);
  expect((sent.descriptor as number[]).length).toBe(128);

  // the album downloads
  const [download] = await Promise.all([
    guest.waitForEvent('download'),
    guest.getByTestId('face-download').click(),
  ]);
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).filter((n) => n.endsWith('.jpg'))).toHaveLength(2);

  // left out of everyone's searches: the same face finds nothing now
  await guest.getByTestId('face-leave').click();
  await guest.getByTestId('face-confirm-yes').click();
  await expect(guest.getByTestId('face-notice')).toContainText('לא תופיעו בחיפושים של אחרים');
  await guest.getByTestId('face-start').click();
  await guest.getByTestId('face-agree').check();
  await guest.getByTestId('face-continue').click();
  await guest.getByTestId('face-file').setInputFiles({
    name: 'selfie2.jpg',
    mimeType: 'image/jpeg',
    buffer: await jpeg([200, 50, 50], 600, 800),
  });
  await expect(guest.getByTestId('face-count')).toHaveText(/עוד לא מצאנו אתכם/, { timeout: 20_000 });
  const excluded = await sql<{ n: number }>(
    `select count(*)::int as n from gallery_faces where invitation_id = $1 and excluded_at is not null and descriptor is null`,
    [host.id],
  );
  expect(excluded[0]!.n).toBe(2);

  // another guest (person B) is forgotten: their face leaves the gallery's search at once
  const phoneB = await browser.newContext(PHONE);
  await phoneB.addInitScript(STAND_IN);
  const other = await phoneB.newPage();
  await other.goto(link);
  await other.getByTestId('face-start').click();
  await other.getByTestId('face-agree').check();
  await other.getByTestId('face-continue').click();
  await other
    .getByTestId('face-file')
    .setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await jpeg([40, 60, 210], 600, 800) });
  await expect(other.getByTestId('face-count')).toHaveText('מצאנו אתכם בתמונה אחת', { timeout: 20_000 });
  await expect(other.locator(`[data-testid=face-album-grid] [data-item="${blue}"]`)).toBeVisible();
  // the album stays for this visit (the code is kept in the tab only)
  await other.reload();
  await expect(other.getByTestId('face-count')).toHaveText('מצאנו אתכם בתמונה אחת', { timeout: 20_000 });
  await other.getByTestId('face-forget').click();
  await other.getByTestId('face-confirm-yes').click();
  await expect(other.getByTestId('face-notice')).toContainText('קוד הפנים שלך נמחק');
  expect(
    await other.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('badook-faces:'))),
  ).toEqual([]);
  const left = await sql<{ n: number }>(`select count(*)::int as n from gallery_faces where item_id = $1`, [
    blue,
  ]);
  expect(left[0]!.n).toBe(0);

  // the host sees only numbers
  await page.reload();
  await expect(card.getByText('2 פנים הוסרו מהחיפוש לבקשת אורחים')).toBeVisible();
  await expect(card.getByText('אורח אחד ביקש לא להופיע בחיפושים')).toBeVisible();

  // turned off: the face codes go at once, and guests no longer see face search
  await card.getByTestId('face-search-switch-off').click();
  await page.getByRole('dialog').getByRole('button', { name: 'כיבוי ומחיקה' }).click();
  await expect(card.getByTestId('face-search-off')).toBeVisible();
  const after = await sql<{ n: number }>(
    `select count(*)::int as n from gallery_faces where invitation_id = $1`,
    [host.id],
  );
  expect(after[0]!.n).toBe(0);
  const t = new URL(link).searchParams.get('t');
  const refused = await api(page, '/api/gallery/faces/search', 'POST', {
    t,
    descriptor: Array.from({ length: 128 }, () => 0.1),
  });
  expect(refused).toMatchObject({ status: 403, body: { code: 'feature_off' } });
  await guest.reload();
  await expect(guest.getByTestId('gallery-share')).toBeEnabled();
  await expect(guest.getByTestId('face-search')).toHaveCount(0);
  await phoneA.close();
  await phoneB.close();
});
