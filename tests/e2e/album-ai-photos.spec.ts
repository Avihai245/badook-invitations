import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  LOCAL,
  PHONE,
  galleryOn,
  jpeg,
  newHost,
  open,
  publish,
  seedPhotos,
  sql,
  store,
} from '../support/phase5b';

// The album after the event and the AI photos with the people of honor, end to end on the local stack
// (tests/support/rest-shim.mjs; OpenAI's image model and WhatsApp are the stand-ins of
// tests/support/mock-whatsapp.mjs). The album: the guests' photos laid out in the invitation's design,
// opened early by the host, its link opened on a guest's phone, the thank-you sent from the system's
// number. The AI photos: the host uploads the couple's photos, gives the consent and turns it on; a
// guest's phone asks for a new scene of the couple as an animated film — made in OpenAI's background
// mode, shown, added to the gallery marked AI — and the host sees it. Screenshots go to
// tests/.artifacts/qa/album-ai-photos/.

test.skip(!LOCAL, 'reads and writes rows of the local stack');

const MOCKS = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;
const SHOTS = 'tests/.artifacts/qa/album-ai-photos';
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test('the album: the guests’ photos in the invitation’s design, opened early, its link on a phone, a thank-you to each guest', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the host on a computer; the guest on a phone');
  test.setTimeout(150_000);
  const host = await newHost(page, 'album', 'pro');
  await galleryOn(page, host.id);
  await publish(host.id);
  await seedPhotos(
    host.id,
    [
      [176, 70, 90],
      [60, 110, 170],
      [200, 150, 60],
      [90, 150, 110],
      [150, 90, 170],
      [70, 160, 160],
      [190, 110, 80],
      [110, 110, 190],
    ]
      // 16: enough for the highlights (ALBUM.highlights.from)
      .flatMap((c) => [c, c.map((v) => Math.min(255, v + 40))])
      .map((color, i) => ({
        color: color as [number, number, number],
        minute: i * 9,
        ...(i % 3 === 2 ? { width: 1600, height: 1200 } : {}),
      })),
  );

  // the gallery tab: the album's card — it opens the morning after; the host opens it now
  await open(page, `/app/invitations/${host.id}/gallery?view=extras`);
  const card = page.getByTestId('album-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('album-counts')).toContainText('16');
  await expect(card.getByTestId('album-state')).toContainText('ייפתח');
  await card.getByRole('button', { name: 'לפתוח עכשיו' }).click();
  await expect(card.getByTestId('album-state')).toHaveText('פתוח לאורחים');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${SHOTS}/he-desktop-1-album-card.png` });

  // its studio: the settings, the words, the link, the photos
  await card.getByTestId('album-edit').click();
  await expect(page.getByTestId('album-studio')).toBeVisible();
  await expect(page.getByTestId('album-photos').locator('img')).toHaveCount(16, { timeout: 20_000 });
  const url = await page.getByTestId('album-link-url').inputValue();
  expect(url).toMatch(new RegExp(`/e/${host.slug}/album\\?a=[A-Za-z0-9_-]+$`));
  await shot(page, 'he-desktop-2-album-studio');

  // the host's highlights film (as the film studio saves it): the album shows it at the top
  const filmId = randomUUID();
  const filmFolder = `${host.id}/${filmId}`;
  await store('gallery-originals', `${filmFolder}/original.mp4`, Buffer.from('not a real film'));
  await store('gallery-media', `${filmFolder}/display.jpg`, await jpeg([20, 20, 20], 640, 360));
  await store('gallery-media', `${filmFolder}/thumb.jpg`, await jpeg([20, 20, 20], 360, 200));
  await sql(
    `with n as (select $2::uuid as id)
     insert into gallery_items (id, invitation_id, kind, status, source, uploader_hash, original_path, original_type,
       original_size, original_done, display_path, display_size, thumb_path, thumb_size, width, height, published_at)
     select n.id, i.id, 'video', 'published', 'host', repeat('a', 64),
       i.id || '/' || n.id || '/original.mp4', 'video/mp4', 1000, true,
       i.id || '/' || n.id || '/display.jpg', 500, i.id || '/' || n.id || '/thumb.jpg', 100, 1280, 720, now()
     from invitations i, n where i.id = $1`,
    [host.id, filmId],
  );
  await sql(
    `select gallery_mark_film($1, (select owner_id from invitations where id = $1),
       (select id from gallery_items where invitation_id = $1 and kind = 'video' limit 1))`,
    [host.id],
  );

  // a guest's phone opens the link: the cover with the names, the letter, the highlights, the chapters
  const phone = await browser.newContext(PHONE);
  const guest = await phone.newPage();
  await guest.goto(url);
  await expect(guest.getByTestId('album')).toBeVisible();
  await expect(guest.getByTestId('album-cover')).toContainText('נועה');
  await expect(guest.getByTestId('album-cover')).toContainText('איתי');
  await expect(guest.getByTestId('album-message')).toBeVisible();
  // the film at the top: a player, and not one of the album's videos
  await expect(guest.getByTestId('album-film').locator('video')).toHaveCount(1);
  await expect(guest.getByTestId('album-film')).toContainText('הסרטון של האירוע');
  await expect(guest.getByTestId('album-highlights').locator('img').first()).toBeVisible();
  await guest.waitForLoadState('networkidle');
  await shot(guest, 'he-mobile-3-album');
  await phone.close();

  // the thank-you from the system's number: the guest with a phone gets the album's template
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const number = `+9725${suffix}02`;
  await sql(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, 'משפחת לוי', 2, $2, $3)`,
    [host.id, number, `al${randomUUID().replace(/-/g, '').slice(0, 20)}`],
  );
  await sql(
    `update accounts set message_credits = 3 where user_id = (select id from auth.users where email = $1)`,
    [host.email],
  );
  await open(page, `/app/invitations/${host.id}/gallery?view=extras`);
  await page.getByTestId('album-card').getByTestId('album-send').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('album-notices-rows').locator('li')).toHaveCount(1);
  await shot(page, 'he-desktop-4-album-thanks');
  await dialog.getByTestId('album-notices-send').click();
  await expect
    .poll(
      async () => {
        const sent = (await (await fetch(`${MOCKS}/__sent`)).json()) as {
          to: string;
          template: string;
          params: string[];
          button: string;
        }[];
        return sent.find((m) => m.to.endsWith(number.slice(1)) && m.template === 'badook_album') ?? null;
      },
      { timeout: 20_000 },
    )
    .toMatchObject({
      params: ['משפחת לוי', expect.any(String), 'נועה & איתי'],
      button: expect.stringMatching(new RegExp(`^${host.slug}/album\\?a=`)),
    });
});

test('AI photos: the host sets up the couple; a guest makes them an animated-film scene, into the gallery', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the host on a computer; the guest on a phone');
  test.setTimeout(180_000);
  const host = await newHost(page, 'aiphoto', 'business');
  const link = await galleryOn(page, host.id);
  await publish(host.id);

  // the setup: the couple suggested from the invitation — a photo each, groom and bride, saved
  await open(page, `/app/invitations/${host.id}/gallery/ai`);
  const people = page.getByTestId('ai-people');
  await expect(people.locator('[data-ai-person]')).toHaveCount(2);
  for (const [i, role, color] of [
    [0, 'groom', [120, 90, 70]],
    [1, 'bride', [200, 140, 150]],
  ] as const) {
    const editor = people.locator('[data-ai-person="new"]').first();
    await editor.locator('input[type=file]').setInputFiles({
      name: `person-${i}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await jpeg([...color], 900, 1200),
    });
    await expect(editor.locator('img')).toBeVisible();
    await editor.locator('select').selectOption(role);
    await editor.getByRole('button', { name: 'שמירה' }).click();
    await expect(people.locator('[data-ai-person="new"]')).toHaveCount(1 - i, { timeout: 20_000 });
  }
  // the consent, then on
  const settings = page.getByTestId('ai-settings');
  await settings.getByText('בעלי השמחה שבתמונות הסכימו', { exact: false }).click();
  await expect(settings.getByRole('checkbox')).toBeChecked();
  await settings.getByRole('switch', { name: 'פעיל לאורחים' }).click();
  await expect(settings.getByRole('switch', { name: 'פעיל לאורחים' })).toBeChecked();
  await shot(page, 'he-desktop-5-ai-setup');

  // a guest's phone: the card with the couple's names, the studio, a new scene as an animated film
  const phone = await browser.newContext(PHONE);
  const guest = await phone.newPage();
  await guest.goto(link);
  const card = guest.getByTestId('ai-photos');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText('נועה');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${SHOTS}/he-mobile-6-ai-card.png` });
  await guest.getByTestId('ai-photos-open').click();
  const studio = guest.getByTestId('ai-studio');
  await expect(studio).toBeVisible();
  await studio.getByRole('button', { name: 'סצנה חדשה' }).click();
  await studio.getByTestId('ai-styles').getByRole('button', { name: 'סרט מצויר' }).click();
  await studio.getByTestId('ai-prompt').fill('נועה ואיתי רוקדים על חוף בהוואי בשקיעה');
  // both are named: both chosen
  await expect(studio.getByRole('button', { pressed: true, name: /נועה/ })).toBeVisible();
  await expect(studio.getByRole('button', { pressed: true, name: /איתי/ })).toBeVisible();
  await guest.screenshot({ path: `${SHOTS}/he-mobile-7-ai-studio.png` });
  await studio.getByTestId('ai-create').click();
  await expect(studio.getByTestId('ai-working')).toBeVisible();
  await guest.screenshot({ path: `${SHOTS}/he-mobile-8-ai-working.png` });
  await expect(studio.getByTestId('ai-result')).toBeVisible({ timeout: 90_000 });
  await expect(studio.getByTestId('ai-result').locator('img')).toBeVisible();
  await guest.screenshot({ path: `${SHOTS}/he-mobile-9-ai-result.png` });

  // what OpenAI was asked: gpt-image-2 in background mode, both reference photos, the look
  const asked = (await (await fetch(`${MOCKS}/__ai/images`)).json()) as {
    background: boolean;
    tool: { model: string; size: string };
    text: string;
    images: number;
  }[];
  const last = asked.at(-1)!;
  expect(last.background).toBe(true);
  expect(last.tool).toMatchObject({ model: 'gpt-image-2', size: '1024x1536' });
  expect(last.images).toBe(2);
  expect(last.text).toContain('animated-film');
  expect(last.text).toContain('נועה ואיתי רוקדים על חוף בהוואי בשקיעה');

  // into the gallery, marked AI: the studio closes, back on the feed
  await studio.getByTestId('ai-to-gallery').click();
  await expect(studio).toBeHidden();
  await expect(guest.getByTestId('ai-notice')).toHaveText('התמונה נוספה לגלריה');
  const [item] = await sql<{ ai_generated: boolean; status: string }>(
    `select ai_generated, status from gallery_items where invitation_id = $1 and deleted_at is null`,
    [host.id],
  );
  expect(item).toEqual({ ai_generated: true, status: 'published' });
  const [made] = await sql<{ style: string; status: string }>(
    `select style, status from ai_photos where invitation_id = $1`,
    [host.id],
  );
  expect(made).toEqual({ style: 'cartoon', status: 'done' });
  await phone.close();

  // the host sees what the guests made
  await open(page, `/app/invitations/${host.id}/gallery/ai`);
  await expect(page.getByTestId('ai-photos-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('ai-photos-list').locator('img')).toBeVisible();
  await shot(page, 'he-desktop-10-ai-host');
});
