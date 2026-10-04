/**
 * The home page's posters, pre-rendered (runs in `predev` / `prebuild`; see app/poster-art.ts): every
 * template's sample poster — what TemplatePoster draws inside its frame with posterSample — in each UI
 * language, to public/poster-art/<version>/<locale>/<template>.html, plus the posters' @font-face
 * rules per family (fonts.json). Gitignored; regenerated on every build; older versions are removed.
 * The version is a hash of the sources (poster-art-version.ts), the same one next.config.ts hands the
 * pages.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { posterSample } from '../src/features/invitations/app/poster';
import { posterArtVersion } from '../src/features/invitations/app/poster-art-version';
import { TemplatePosterContent } from '../src/features/invitations/app/TemplatePoster';
import { DesignCard } from '../src/features/site/home/DesignCard';
import { INITIAL_DESIGNS, listedDesigns } from '../src/features/site/home/designs';
import { fontFaceCss } from '../src/features/invitations/fonts';
import { TEMPLATES } from '../src/features/invitations/templates/registry';
import { UI_LOCALES } from '../src/lib/i18n/app';
import { en } from '../src/lib/i18n/app.en';
import { he } from '../src/lib/i18n/app.he';

const root = process.cwd();
const version = posterArtVersion(root);
const base = join(root, 'public', 'poster-art');
const out = join(base, version);

mkdirSync(base, { recursive: true });
for (const old of readdirSync(base)) if (old !== version) rmSync(join(base, old), { recursive: true });

// the cards render their posters' addresses (LazyTemplatePoster) with this build's version
process.env.INVITES_POSTER_ART_VERSION = version;

const manifests = [...TEMPLATES.values()].map(({ manifest }) => manifest);
let bytes = 0;
for (const locale of UI_LOCALES) {
  mkdirSync(join(out, locale), { recursive: true });
  for (const template of manifests) {
    const html = renderToStaticMarkup(
      <TemplatePosterContent template={template} locale={locale} text={posterSample(template.id, locale)} />,
      // a prefix per poster: the SVG ids (useIds) stay unique when many posters share a page
      { identifierPrefix: `pa-${locale}-${template.id}-` },
    );
    writeFileSync(join(out, locale, `${template.id}.html`), html);
    bytes += html.length;
  }
}

// the home page's designs after the first few: their cards (the page carries only the first ones)
const DICTIONARIES = { he, en };
let cards = 0;
for (const locale of UI_LOCALES) {
  const t = DICTIONARIES[locale];
  const labels = { sample: t.home.sample, liveDemo: t.gallery.preview.liveDemo, eventTypes: t.eventTypes };
  const rest = listedDesigns().slice(INITIAL_DESIGNS);
  const html = renderToStaticMarkup(
    <>
      {rest.map((manifest, i) => (
        <DesignCard
          key={manifest.id}
          manifest={manifest}
          locale={locale}
          index={INITIAL_DESIGNS + i}
          labels={labels}
        />
      ))}
    </>,
    { identifierPrefix: `pd-${locale}-` },
  );
  writeFileSync(join(out, locale, 'designs-more.html'), html);
  cards = rest.length;
  bytes += html.length;
}

// each family the posters write in (a pair's display and heading faces), regular weight
const families = new Set(
  manifests.flatMap((m) => {
    const pair = m.fontPairs[0];
    return pair ? [pair.display.hebrew, pair.display.latin, pair.heading.hebrew, pair.heading.latin] : [];
  }),
);
writeFileSync(
  join(out, 'fonts.json'),
  JSON.stringify(Object.fromEntries([...families].map((f) => [f, fontFaceCss([f], [400])]))),
);

console.log(
  `✓ poster art ${version}: ${manifests.length} posters + ${cards} more designs × ${UI_LOCALES.length} languages ` +
    `(${Math.round(bytes / 1024)} KB) → public/poster-art/`,
);
