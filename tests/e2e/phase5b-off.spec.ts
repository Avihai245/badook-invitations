import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { LOCAL, PHONE, api, galleryOn, newHost, open, publish, seedPhotos, sql } from '../support/phase5b';

// Each of Phase 5B's features off — by the plan or by the host's switch — hides everything it adds
// and its APIs refuse (403 feature_off): the highlights film (auto_reel), face search (face_albums:
// never on until the host turns it on), the gallery section (live_gallery) and the insights
// (analytics).

test.skip(!LOCAL, 'sets plans and reads rows of the local database');

const descriptor = Array.from({ length: 128 }, (_, i) => Number((0.1 * Math.sin(i)).toFixed(4)));

test('without the package the film and face search are offered, not given; their APIs refuse', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  test.setTimeout(90_000);
  // Premium: the gallery, but neither the film nor face search
  const host = await newHost(page, 'off-pro', 'pro');
  const link = await galleryOn(page, host.id);
  await seedPhotos(host.id, [{ color: [200, 60, 60] }, { color: [60, 60, 200] }, { color: [60, 200, 60] }]);
  await open(page, `/app/invitations/${host.id}/gallery`);
  const film = page.getByTestId('gallery-film');
  await expect(film).toContainText('סרט הרגעים כלול בחבילת Business');
  await expect(film.getByTestId('gallery-film-open')).toHaveCount(0);
  await expect(page.getByTestId('face-search-card')).toContainText('החיפוש לפי פנים כלול בחבילת Business');
  await expect(page.getByTestId('face-search-prepare')).toHaveCount(0);
  // the studio offers the package
  await open(page, `/app/invitations/${host.id}/gallery/film`);
  await expect(page.getByTestId('film-upgrade')).toBeVisible();
  await expect(page.getByTestId('film-shots')).toHaveCount(0);
  const reserve = await api(page, `/api/invitations/${host.id}/gallery/film`, 'POST', {
    step: 'reserve',
    original: { type: 'video/mp4', size: 1_000_000 },
    display: { type: 'image/jpeg', size: 10_000 },
    thumb: { type: 'image/jpeg', size: 5_000 },
    width: 720,
    height: 1280,
    durationMs: 30_000,
  });
  expect(reserve).toMatchObject({ status: 403, body: { code: 'feature_off', reason: 'plan' } });
  const films = await api<{ view: { items: unknown[]; feature: { on: boolean } } }>(
    page,
    `/api/invitations/${host.id}/gallery/film`,
  );
  expect(films.body.view).toMatchObject({ items: [], feature: { on: false } });
  // guests: no face search on the gallery page, and its API refuses
  const phone = await browser.newContext(PHONE);
  const guest = await phone.newPage();
  await guest.goto(link);
  await expect(guest.getByRole('button', { name: 'בחירת תמונות וסרטונים' })).toBeEnabled();
  await expect(guest.getByTestId('face-search')).toHaveCount(0);
  const t = new URL(link).searchParams.get('t');
  for (const path of ['search', 'leave'])
    expect(await api(guest, `/api/gallery/faces/${path}`, 'POST', { t, descriptor })).toMatchObject({
      status: 403,
      body: { code: 'feature_off' },
    });
  const [photo] = await sql<{ id: string }>(`select id from gallery_items where invitation_id = $1 limit 1`, [
    host.id,
  ]);
  expect(
    (
      await api(guest, '/api/gallery/faces/index', 'POST', {
        t,
        uploader: 'phone-uploader-0001',
        id: photo!.id,
        faces: [],
      })
    ).status,
  ).toBe(403);
  const hostFaces = await api(page, `/api/invitations/${host.id}/gallery/faces`, 'POST', {
    results: [{ id: photo!.id, faces: [] }],
  });
  expect(hostFaces).toMatchObject({ status: 403, body: { code: 'feature_off', reason: 'plan' } });
  await phone.close();

  // VIP, but the host hasn't turned face search on: still nothing for guests (another host: their own browser)
  const vipContext = await browser.newContext();
  const vipPage = await vipContext.newPage();
  const vip = await newHost(vipPage, 'off-vip', 'business');
  const vipLink = await galleryOn(vipPage, vip.id);
  const phone2 = await browser.newContext(PHONE);
  const guest2 = await phone2.newPage();
  await guest2.goto(vipLink);
  await expect(guest2.getByRole('button', { name: 'בחירת תמונות וסרטונים' })).toBeEnabled();
  await expect(guest2.getByTestId('face-search')).toHaveCount(0);
  expect(
    await api(guest2, '/api/gallery/faces/search', 'POST', {
      t: new URL(vipLink).searchParams.get('t'),
      descriptor,
    }),
  ).toMatchObject({ status: 403, body: { code: 'feature_off' } });
  await phone2.close();
  // the host switches the film off: the studio offers it back, its API refuses
  expect(
    (await api(vipPage, `/api/invitations/${vip.id}/features`, 'PATCH', { feature: 'auto_reel', off: true }))
      .status,
  ).toBe(200);
  await open(vipPage, `/app/invitations/${vip.id}/gallery/film`);
  await expect(vipPage.getByTestId('film-turn-on')).toBeVisible();
  expect(
    await api(vipPage, `/api/invitations/${vip.id}/gallery/film`, 'POST', {
      step: 'done',
      id: randomUUID(),
      show: true,
    }),
  ).toMatchObject({ status: 403, body: { code: 'feature_off', reason: 'switched_off' } });
  await vipContext.close();
});

test('without the gallery the section isn’t in the catalog and a draft can’t bring one; without insights nothing is measured', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  test.setTimeout(90_000);
  const host = await newHost(page, 'off-free', 'free');
  await open(page, `/app/invitations/${host.id}/edit`);
  const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
  await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });
  await page.getByRole('button', { name: 'הוספת סקשן' }).click();
  const catalog = page.getByRole('dialog', { name: 'איזה סקשן להוסיף?' });
  await expect(catalog.getByRole('button', { name: /^טקסט ותמונה/ })).toBeVisible();
  await expect(catalog.getByRole('button', { name: /^גלריית האורחים/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // the server refuses a draft that brings one (the stored draft comes back with a stale save's 409)
  const probe = JSON.parse(readFileSync('docs/invitations/fixtures/example-wedding-he-en.json', 'utf8'));
  const refused = await page.evaluate(
    async ({ id, probe }) => {
      const stale = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: probe, updatedAt: '2000-01-01T00:00:00.000Z' }),
      });
      const current = (await stale.json()) as {
        draft: { sections: Record<string, unknown>[] };
        updatedAt: string;
      };
      const draft = structuredClone(current.draft);
      draft.sections.splice(draft.sections.length - 1, 0, {
        id: 'gallery-e2e',
        type: 'live_gallery',
        enabled: true,
        data: { title: null, body: null, afterTitle: null, afterBody: null, showQr: true },
      });
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft, updatedAt: current.updatedAt }),
      });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    },
    { id: host.id, probe },
  );
  expect(refused).toMatchObject({ status: 403, body: { code: 'feature_off' } });

  // insights switched off by the host: the tab offers them back, the page measures nothing, the API refuses
  expect(
    (await api(page, `/api/invitations/${host.id}/features`, 'PATCH', { feature: 'analytics', off: true }))
      .status,
  ).toBe(200);
  await publish(host.id);
  await open(page, `/app/invitations/${host.id}/insights`);
  await expect(page.getByTestId('insights-off')).toBeVisible();
  expect((await api(page, `/api/invitations/${host.id}/insights?range=30`)).status).toBe(403);
  const sent: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/insights') sent.push(r.url());
  });
  await page.goto(`/i/${host.slug}/he?open=1`);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(3500);
  expect(sent).toEqual([]);
  const direct = await page.evaluate(async (slug) => {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug,
        visit: crypto.randomUUID(),
        lang: 'he',
        device: 'desktop',
        source: 'other',
        opened: true,
        depth: 0,
        visibleMs: 1000,
        rsvpStarted: false,
        rsvpSent: false,
        calendar: false,
        map: false,
        gallery: false,
        langSwitch: false,
      }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }, host.slug);
  expect(direct).toMatchObject({ status: 403, body: { code: 'feature_off' } });
  const rows = await sql<{ n: number }>(
    `select count(*)::int as n from insight_visits where invitation_id = $1`,
    [host.id],
  );
  expect(rows[0]!.n).toBe(0);
});
