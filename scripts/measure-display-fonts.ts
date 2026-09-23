/**
 * Measures the average advance width (in em, per character) of every invitation font for typical
 * Latin and Hebrew names, in a real browser with the self-hosted font files. The result drives the
 * CSS auto-fit of hero/footer names (`--name-em`). Re-run when fonts change:
 *
 *   npx tsx scripts/measure-display-fonts.ts [--base http://127.0.0.1:3000]
 *
 * (needs a running server that serves /fonts — `npm run dev`).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { fontFaceCss } from '../src/features/invitations/fonts';
import generated from '../src/features/invitations/fonts/font-faces.generated.json';

const i = process.argv.indexOf('--base');
const BASE = i > -1 ? process.argv[i + 1]! : 'http://127.0.0.1:3000';
const LATIN = ['Noa', 'Itay', 'Jonathan', 'Maya', 'Alexandra', 'Tamar', 'Dana', 'Benjamin', 'Shira', 'Ori'];
const HEBREW = ['נועה', 'איתי', 'יונתן', 'מאיה', 'אלכסנדרה', 'תמר', 'דנה', 'בנימין', 'שירה', 'אורי'];

async function main() {
  const families = Object.keys((generated as { families: Record<string, unknown> }).families);
  const css = fontFaceCss(families).replaceAll('url(/fonts/', `url(${BASE}/fonts/`);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.addStyleTag({ content: css });
  const metrics: Record<string, { latin: number; hebrew: number }> = {};
  for (const family of families) {
    // Plain loops only: tsx would otherwise inject a `__name` helper into the in-page function.
    const [latin, hebrew] = await page.evaluate(
      async ({ family, sets }) => {
        const el = document.createElement('span');
        el.style.cssText = `font-family:"${family}";font-size:100px;white-space:nowrap;position:absolute;visibility:hidden`;
        document.body.appendChild(el);
        const out: number[] = [];
        for (const words of sets) {
          let total = 0;
          let chars = 0;
          for (const w of words) {
            await document.fonts.load(`100px "${family}"`, w);
            el.textContent = w;
            total += el.getBoundingClientRect().width;
            chars += Array.from(w).length;
          }
          out.push(Math.round((total / chars / 100) * 1000) / 1000);
        }
        el.remove();
        return out;
      },
      { family, sets: [LATIN, HEBREW] },
    );
    metrics[family] = { latin: latin ?? 0.55, hebrew: hebrew ?? 0.55 };
  }
  await browser.close();
  const out = join(process.cwd(), 'src/features/invitations/fonts/font-metrics.generated.json');
  writeFileSync(
    out,
    `${JSON.stringify({ generatedBy: 'scripts/measure-display-fonts.ts', emPerChar: metrics }, null, 2)}\n`,
  );
  console.log(`✓ measured ${families.length} families → ${out}`);
  for (const [f, m] of Object.entries(metrics))
    console.log(`  ${f.padEnd(22)} latin ${m.latin}  hebrew ${m.hebrew}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
