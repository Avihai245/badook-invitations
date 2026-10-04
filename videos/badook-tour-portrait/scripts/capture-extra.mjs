import { chromium } from 'playwright';
const SP = process.env.SP ?? '/tmp', B = 'http://localhost:3200', ID = 'c68c616a-f8b5-4d88-910b-a6aae1a986e1', OUT = 'videos/badook-tour/capture/assets/screens';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const only = process.env.ONLY_SHOTS?.split(',');
const want = (n) => !only || only.includes(n);
// host (desktop): live page links, WhatsApp dialog
const h = await b.newContext({ storageState: SP + '/state.json', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await h.addInitScript(() => { try { localStorage.setItem('badook:tour-done', '1'); } catch {} });
const hp = await h.newPage();
await hp.goto(B + '/app/invitations/' + ID + '/live', { waitUntil: 'networkidle' });
const links = await hp.locator('main a').evaluateAll(xs => xs.map(a => a.getAttribute('href')).filter(Boolean));
const station = links.find(l => l.includes('/station'));
console.log('station', station);
await hp.goto(B + '/app/invitations/' + ID + '/gallery', { waitUntil: 'networkidle' });
const glinks = await hp.locator('main a').evaluateAll(xs => xs.map(a => a.getAttribute('href')).filter(Boolean));
const projector = glinks.find(l => l.includes('/projector'));
console.log('projector', projector);
if (want('whatsapp')) {
  await hp.goto(B + '/app/invitations/' + ID + '/guests', { waitUntil: 'networkidle' });
  await hp.getByRole('button', { name: /וואטסאפ/ }).first().click(); await hp.waitForTimeout(1500);
  await hp.screenshot({ path: OUT + '/desktop/whatsapp.png' }); console.log('ok whatsapp');
}
await h.close();
const local = (u) => u.replace(/^https?:\/\/[^/]+/, B);
// projector: the hall's screen
if (want('projector') && projector) {
  const c = await b.newContext({ locale: 'he-IL', viewport: { width: 1920, height: 1080 } });
  const p = await c.newPage(); await p.goto(local(projector), { waitUntil: 'networkidle' }); await p.waitForTimeout(6000);
  await p.screenshot({ path: OUT + '/desktop/projector.png' });
  await p.waitForTimeout(5000); await p.screenshot({ path: OUT + '/desktop/projector-2.png' }); console.log('ok projector'); await c.close();
}
// phones: personal invitation, station, guest's table, guest upload
const m = await b.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const mp = await m.newPage();
if (want('personal')) {
  await mp.goto(B + '/i/noa-ve-itay?g=2194ba9ee17a08e18fcea9413ebd57c7', { waitUntil: 'networkidle' }); await mp.waitForTimeout(1500);
  await mp.screenshot({ path: OUT + '/mobile/personal-cover.png' });
  await mp.mouse.click(195, 420); await mp.waitForTimeout(3500);
  await mp.screenshot({ path: OUT + '/mobile/personal-hero.png' });
  const rsvp = mp.locator('#rsvp, [data-section=rsvp], section:has(form)').first();
  if (await rsvp.count()) { await rsvp.scrollIntoViewIfNeeded(); await mp.waitForTimeout(2000); }
  await mp.getByText('כן, נגיע!').click(); await mp.waitForTimeout(1200);
  await mp.getByText('כן, נגיע!').evaluate(e => e.scrollIntoView({ block: 'start' })); await mp.mouse.wheel(0, -60); await mp.waitForTimeout(1200);
  await mp.screenshot({ path: OUT + '/mobile/personal-rsvp.png' }); console.log('ok personal');
}
if (want('station') && station) { await mp.goto(local(station), { waitUntil: 'networkidle' }); await mp.waitForTimeout(2500); await mp.screenshot({ path: OUT + '/mobile/station.png' }); console.log('ok station'); }
if (want('table')) { await mp.goto(B + '/e/noa-ve-itay/table?g=664dd1b30bc7e9cd8bf6b45b4c5378ef', { waitUntil: 'networkidle' }); await mp.waitForTimeout(2500); await mp.screenshot({ path: OUT + '/mobile/table.png' }); console.log('ok table'); }
if (want('upload')) { await mp.goto(B + '/e/noa-ve-itay/upload?t=bNClyxv8R62MhRuuowu6OATV', { waitUntil: 'networkidle' }); await mp.waitForTimeout(2500); await mp.screenshot({ path: OUT + '/mobile/upload.png', fullPage: true }); console.log('ok upload'); }
await b.close();
