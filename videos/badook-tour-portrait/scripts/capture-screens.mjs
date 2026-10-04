// Tour screens: capture (widgets hidden) + measured element boxes → capture/extracted/screen-boxes.json
import { chromium } from 'playwright';
import fs from 'node:fs';
const SP = process.env.SP ?? '/tmp', B = 'http://localhost:3200', ID = 'c68c616a-f8b5-4d88-910b-a6aae1a986e1';
const OUT = 'videos/badook-tour/capture/assets', BOXES = 'videos/badook-tour/capture/extracted/screen-boxes.json';
const A = `/app/invitations/${ID}`;
const only = process.env.ONLY_SHOTS?.split(',');
const HIDE = '[data-testid=a11y-button],[data-testid=support-launcher]{display:none!important}';
const wiz = async (p, steps) => {
  await p.getByRole('radio', { name: 'חתונה' }).click(); if (steps < 2) return;
  await p.getByRole('button', { name: 'המשך' }).click(); await p.waitForTimeout(700);
  const ins = p.locator('main input'); const vals = ['נועה', 'איתי', '2027-06-17', '240', '120000'];
  for (let i = 0; i < await ins.count(); i++) await ins.nth(i).fill(vals[i] ?? '');
  await p.locator('main').click({ position: { x: 5, y: 5 } }).catch(() => {});
  if (steps < 3) return; await p.getByRole('button', { name: 'המשך' }).click(); await p.waitForTimeout(900);
};
// [name, url, action, {full, wait, keepWidgets}, targets]; target = [label, mode, arg, region]
const C = 'content', S = 'side';
const SHOTS = [
  ['home', A, null, { full: true }, [['countdown-days', 'card', '256', C, 1], ['countdown-hours', 'card', 'שעות', C], ['next-step', 'card', 'הצעד הבא', C], ['budget-widget', 'card', 'לתקציב המלא', C], ['rsvp-widget', 'card', 'לכל התשובות', C], ['tasks-widget', 'card', 'לכל המשימות', C], ['road-plan', 'card', 'משימות, תקציב וספקים', C], ['road-invite', 'card', 'עיצוב, מוזמנים, שליחה ואישורים', C], ['road-arrange', 'card', 'סידור שולחנות', C], ['road-celebrate', 'card', 'יום האירוע, גלריה וסרט', C], ['side-plan', 'text', 'מתכננים', S], ['side-invite', 'text', 'מזמינים', S], ['side-arrange', 'text', 'מסדרים', S], ['side-celebrate', 'text', 'חוגגים', S], ['hero-phone', 'img', '', C]]],
  ['wizard-1', '/app/invitations/new', null, {}, [['types', 'card', 'חתונה', C], ['type-wedding', 'text', 'חתונה', C]]],
  ['wizard-2', '/app/invitations/new', (p) => wiz(p, 2), {}, [['form', 'card', 'תאריך האירוע', C], ['f-names', 'field', 'שם 1', C], ['f-date', 'field', 'תאריך האירוע', C], ['f-guests', 'field', 'כמה אורחים בערך?', C], ['f-budget', 'field', 'תקציב משוער', C], ['next', 'text', 'המשך', C]]],
  ['wizard-3', '/app/invitations/new', (p) => wiz(p, 3), {}, [['opt-plan', 'card', 'משימות לפי לוח זמנים', C], ['opt-design', 'card', 'בוחרים מתוך העיצובים', C], ['opt-all', 'card', 'עיצוב הזמנה ותכנון', C], ['go', 'text', 'יוצאים לדרך', C]]],
  ['designs', '/app/invitations/new?type=wedding', null, { full: true, wait: 4000 }, [['ai-banner', 'card', 'בואו נתחיל', C], ['chips', 'card', 'מונפשים', C], ['card-1', 'card', 'סהר בורדו', C]]],
  ['studio', '/app/invitations/new?type=wedding', async (p) => { await p.getByRole('button', { name: 'בואו נתחיל' }).click(); await p.waitForTimeout(2000); }, { wait: 3000 }, [['dialog', 'sel', '[role=dialog]', C]]],
  ['editor', `${A}/edit`, null, { wait: 4000 }, [['phone', 'sel', 'iframe', C], ['sec-cover', 'text', 'מעטפה ופתיחה', S], ['sec-rsvp', 'text', 'אישור הגעה', S], ['add-section', 'text', 'הוספת סקשן', S], ['field-open', 'field', 'שורת פתיחה', C], ['field-place', 'field', 'שורת מיקום', C], ['publish', 'text', 'פרסום השינויים', C], ['comments', 'text', 'הערות', C], ['preview', 'text', 'תצוגה מקדימה', C]]],
  ['share', `${A}/share`, null, { full: true }, [['link', 'card', 'קישור להזמנה', C], ['link-field', 'sel', 'input[readonly], input[value*="badooks"]', C], ['qr', 'card', 'קוד QR', C], ['personal', 'card', 'קישור אישי לכל מוזמן', C], ['wa-preview', 'card', 'כך זה ייראה בוואטסאפ', C], ['send-wa', 'text', 'שליחה בוואטסאפ', C]]],
  ['guests', `${A}/guests`, null, { full: true }, [['excel', 'text', 'העלאת רשימה מאקסל', C], ['send-mine', 'text', 'שליחה מהוואטסאפ שלי', C], ['send-auto', 'text', 'שליחה אוטומטית', C], ['steps', 'card', 'שלב 1', C], ['st-list', 'card', 'מוזמנים ברשימה', C], ['st-sent', 'card', 'קיבלו הזמנה', C], ['st-opened', 'card', 'פתחו את ההזמנה', C], ['st-yes', 'card', 'אישרו הגעה', C], ['table', 'sel', 'table', C]]],
  ['whatsapp', `${A}/guests`, async (p) => { await p.getByRole('button', { name: /שליחה מהוואטסאפ שלי/ }).click(); await p.waitForTimeout(1500); }, {}, [['dialog', 'sel', '[role=dialog]', C], ['open-wa', 'text', 'פתיחה בוואטסאפ', C]]],
  ['responses', `${A}/responses`, null, { full: true }, [['r-yes', 'card', 'מגיעים', C], ['r-total', 'card', 'תשובות', C], ['r-no', 'card', 'לא מגיעים', C], ['r-pending', 'card', 'עוד לא ענו', C], ['r-deadline', 'card', 'עד הדדליין', C], ['general', 'card', 'לשיוך ברשימת המוזמנים', C], ['assign', 'text', 'לשיוך ברשימת המוזמנים', C], ['table', 'sel', 'table', C]]],
  ['tasks', `${A}/plan/tasks`, null, { full: true }, [['list', 'sel', 'main ul, main [role=list]', C], ['add', 'text', 'הוספת משימה', C]]],
  ['vendors', `${A}/plan/vendors`, null, { full: true }, [['booked', 'card', 'אחוזת הגפן', C], ['quote', 'card', 'קייטרינג שפע', C]]],
  ['ideas', `${A}/plan/ideas`, null, { full: true }, [['pinned', 'card', 'חופה בשקיעה', C], ['songs', 'card', 'שירים לכניסה', C], ['colors', 'card', 'בורדו, שמנת וזהב', C]]],
  ['budget', `${A}/plan/budget`, null, { full: true }, [['gauge-card', 'card', 'איפה אתם עומדים', C], ['gauge', 'svgmax', '', C], ['pct', 'text', '44%', C], ['safe', 'text', 'אתם בטוחים בתקציב', C], ['edit', 'text', 'שינוי', C, 1], ['add', 'text', 'הוספת הוצאה', C], ['basis', 'card', 'אורחים ושיטת חישוב', C], ['payments', 'card', 'התשלומים הבאים', C]]],
  ['seating', `${A}/seating`, null, { wait: 4000 }, [['canvas', 'svgmax', '', C], ['rules', 'text', 'כללים', C], ['auto', 'text', 'סידור אוטומטי', C, 1], ['send', 'text', 'לשלוח לאורחים את השולחן', C], ['unseated', 'text', 'משפחת אזולאי', C]]],
  ['live', `${A}/live`, null, { full: true }, [['stats', 'card', 'הגיעו', C]]],
  ['gallery', `${A}/gallery`, null, { full: true, wait: 3000 }, [['stat-photos', 'card', 'MB 4', C], ['upload-link', 'card', 'הקישור לאורחים', C], ['qr', 'text', 'קוד QR להעלאה', C], ['projector', 'card', 'פתיחת המסך', C], ['grid', 'sel', 'main img[src*="gallery"], main img[src*="storage"]', C]]],
  ['film', `${A}/gallery/film`, null, { full: true, wait: 3000 }, []],
  ['insights', `${A}/insights`, null, { full: true }, [['visits', 'card', 'ביקורים', C]]],
  ['help', A, async (p) => { await p.getByRole('button', { name: /עזרה/ }).first().click(); await p.waitForTimeout(1500); }, { keepWidgets: true }, [['panel', 'sel', '[role=dialog]', C], ['video', 'text', 'סיור מלא במערכת', C], ['search', 'sel', '[role=dialog] input', C]]],
];
const measure = (p, targets) => p.evaluate((targets) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const inRegion = (e, region) => { const r = e.getBoundingClientRect(); return region === 'side' ? r.left > 1170 : r.right < 1172 || r.width > 1300; };
  const isCard = (e) => { const s = getComputedStyle(e); const rad = parseFloat(s.borderTopLeftRadius) || 0; const bg = s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor); const bd = parseFloat(s.borderTopWidth) > 0; return rad >= 10 && (bg || bd || s.boxShadow !== 'none') && e.getBoundingClientRect().height >= 36; };
  const byText = (t, region) => { const all = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const n = w.currentNode; if (n.textContent.includes(t) && n.parentElement && vis(n.parentElement) && inRegion(n.parentElement, region)) all.push(n.parentElement); } return all; };
  const out = {};
  for (const [label, mode, arg, region, nth = 0] of targets) {
    let el = null;
    if (mode === 'sel') el = [...document.querySelectorAll(arg)].filter(vis).filter((e) => inRegion(e, region))[nth];
    else if (mode === 'svgmax') el = [...document.querySelectorAll('svg')].filter(vis).filter((e) => inRegion(e, region)).sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
    else if (mode === 'img') el = [...document.querySelectorAll('img')].filter(vis).filter((e) => inRegion(e, region)).sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    else {
      const t = byText(arg, region)[nth];
      if (t && mode === 'text') el = t.closest('button,a,label,[role=button]') ?? t;
      if (t && mode === 'field') { el = t.closest('label') ?? t; let up = el; for (let i = 0; i < 4 && up.parentElement; i++) { up = up.parentElement; if (up.querySelector('input,textarea,select,[role=combobox]')) { el = up; break; } } }
      if (t && mode === 'card') { el = t; while (el && el !== document.body && !isCard(el)) el = el.parentElement; if (el === document.body) el = t; }
    }
    if (!el) { out[label] = null; continue; }
    const r = el.getBoundingClientRect();
    out[label] = [r.left + scrollX, r.top + scrollY, r.width, r.height].map((v) => Math.round(v));
  }
  return out;
}, targets);
const boxes = fs.existsSync(BOXES) ? JSON.parse(fs.readFileSync(BOXES, 'utf8')) : {};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [vp, w, h, dsf, prefix] of [['desktop', 1440, 900, 2, 'screen'], ['mobile', 390, 844, 3, 'phone']]) {
  if (process.env.ONLY && process.env.ONLY !== vp) continue;
  const ctx = await b.newContext({ storageState: `${SP}/state.json`, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  await ctx.addInitScript(() => { try { localStorage.setItem('badook:tour-done', '1'); } catch {} });
  const p = await ctx.newPage();
  for (const [name, url, act, opt = {}, targets = []] of SHOTS) {
    if (only && !only.includes(name)) continue;
    try {
      await p.goto(B + url, { timeout: 120000, waitUntil: 'networkidle' });
      if (!opt.keepWidgets) await p.addStyleTag({ content: HIDE });
      await p.waitForTimeout(opt.wait ?? 1500);
      if (act) await act(p);
      await p.mouse.move(1, 1);
      const file = `${prefix}-${name}.png`;
      await p.screenshot({ path: `${OUT}/${file}`, fullPage: !!opt.full });
      const bx = await measure(p, vp === 'desktop' ? targets : targets.map(([l, m, a, r, n]) => [l, m, a, r === S ? C : r, n]));
      const size = await p.evaluate((f) => f ? [document.documentElement.scrollWidth, document.documentElement.scrollHeight] : [innerWidth, innerHeight], !!opt.full);
      boxes[file] = { css_size: size, dsf, image_px_per_css_px: dsf, boxes_css: bx };
      const missing = Object.entries(bx).filter(([, v]) => !v).map(([k]) => k);
      console.log('ok', file, missing.length ? 'MISSING ' + missing.join(',') : '');
    } catch (e) { console.log('FAIL', vp, name, e.message.split('\n')[0].slice(0, 160)); }
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(BOXES, JSON.stringify(boxes, null, 1));
