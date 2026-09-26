import { stat } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  LOCAL,
  api,
  clickTrackWav,
  galleryOn,
  hydrated,
  newHost,
  open,
  seedPhotos,
  sql,
} from '../support/phase5b';

// The highlights film end to end (feature auto_reel): a host with a gallery of guests' photos opens
// the film studio from the gallery tab, gives it a song (a synthetic click track, read for its beat
// on the page), removes a shot and reorders two, previews it, makes it — with WebCodecs H.264 where
// this browser encodes it, else the MediaRecorder fallback, which is what the test browser (Chromium
// without H.264 encoding) takes — and the film downloads, plays, and joins the gallery as the host's
// own item, shown to guests.

test.skip(!LOCAL, 'fills the gallery through the local database and storage');

test('a host makes a highlights film of the gallery: previewed, made, downloaded, played, added', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the film is made on a computer');
  test.setTimeout(240_000);
  const host = await newHost(page, 'film', 'business');
  await galleryOn(page, host.id);
  await seedPhotos(host.id, [
    { color: [200, 60, 50] },
    { color: [40, 120, 200] },
    { color: [60, 170, 90] },
    { color: [210, 170, 40] },
    { color: [150, 60, 170] },
    { color: [30, 150, 160], width: 1600, height: 1200 },
  ]);

  // from the gallery tab's card
  await open(page, `/app/invitations/${host.id}/gallery`);
  await page.getByTestId('gallery-film-open').click();
  await page.waitForURL(/\/gallery\/film$/);
  await hydrated(page);
  await expect(page.getByTestId('film-studio')).toBeVisible();
  const shots = page.getByTestId('film-shot');
  await expect(shots).toHaveCount(6);

  // the song: a file of the host's own, its beat read here
  const settings = page.getByTestId('film-settings');
  await settings.getByRole('radio', { name: 'שיר אחר' }).click();
  await page.getByTestId('film-music-file').setInputFiles({
    name: 'song.wav',
    mimeType: 'audio/wav',
    buffer: clickTrackWav(16, 120),
  });
  const status = page.getByTestId('film-music-status');
  await expect(status).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await expect(status).toContainText('קצב של 120 פעמות לדקה');
  await settings.getByRole('radio', { name: '30 שנ׳' }).click();
  await settings.getByRole('radio', { name: '720p' }).click();

  // the host's choice: one shot out, two swapped (kept in this browser)
  const first = await shots.nth(0).getAttribute('data-id');
  const second = await shots.nth(1).getAttribute('data-id');
  const third = await shots.nth(2).getAttribute('data-id');
  await shots.nth(0).getByTestId('film-remove').click();
  await expect(shots).toHaveCount(5);
  await expect(page.locator(`[data-testid=film-shot][data-id="${first}"]`)).toHaveCount(0);
  await shots.nth(0).getByRole('button', { name: 'לאחר' }).click();
  await expect(shots.nth(0)).toHaveAttribute('data-id', third!);
  await expect(shots.nth(1)).toHaveAttribute('data-id', second!);
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`badook-film:${id}`) ?? 'null'),
    host.id,
  );
  expect(saved).toMatchObject({ excluded: [first], length: 30 });

  // the preview plays, and stops
  const play = page.getByTestId('film-preview-play');
  await play.click();
  await expect(play).toHaveText('עצירה', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await play.click();
  await expect(play).toHaveText('ניגון');

  // made: H.264 where this browser encodes it, else recorded in real time
  const h264 = await page.evaluate(async () => {
    if (typeof VideoEncoder === 'undefined') return false;
    const s = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42e01f',
      width: 720,
      height: 1280,
      bitrate: 3_500_000,
      framerate: 30,
    }).catch(() => ({ supported: false }));
    return !!s.supported;
  });
  await page.getByTestId('film-make-button').click();
  await expect(page.getByTestId('film-result')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId('film-result')).toHaveAttribute(
    'data-engine',
    h264 ? 'webcodecs' : 'recorder',
  );

  // it plays: a real video of the film's length
  const video = page.getByTestId('film-video');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  const duration = await video.evaluate((v: HTMLVideoElement) => v.duration);
  expect(duration).toBeGreaterThan(6);
  expect(duration).toBeLessThan(17);
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true;
    return v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 })
    .toBeGreaterThan(0.3);

  // it downloads
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('film-download').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${host.slug}-film\\.(mp4|webm)$`));
  expect((await stat((await download.path())!)).size).toBeGreaterThan(20_000);

  // it joins the gallery, shown to guests
  await page.getByTestId('film-add').click();
  await expect(page.getByTestId('film-added')).toBeVisible({ timeout: 60_000 });
  const [film] = await sql<{ status: string; kind: string; duration_ms: number; original_type: string }>(
    `select status, kind, duration_ms, original_type from gallery_items where invitation_id = $1 and source = 'host'`,
    [host.id],
  );
  expect(film).toMatchObject({ status: 'published', kind: 'video' });
  expect(film!.original_type).toMatch(/^video\/(mp4|webm)$/);
  expect(film!.duration_ms).toBeGreaterThan(6000);
  // guests see it in the feed; the host's tab marks it as theirs
  const guestsView = await api<{ view?: { gallery?: { uploadUrl: string } } }>(
    page,
    `/api/invitations/${host.id}/gallery`,
  );
  const t = new URL(guestsView.body.view!.gallery!.uploadUrl).searchParams.get('t');
  const feed = await page.evaluate(async (t) => {
    const res = await fetch('/api/gallery/feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ t }),
    });
    return (await res.json()) as { items: { kind: string }[] };
  }, t);
  expect(feed.items.filter((i) => i.kind === 'video')).toHaveLength(1);
  await open(page, `/app/invitations/${host.id}/gallery`);
  await expect(page.getByRole('button', { name: /הסרט שלכם/ })).toBeVisible();
});
