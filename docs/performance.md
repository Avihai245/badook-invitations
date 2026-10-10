# Performance

What keeps the home page and every invitation fast, and what checks it. The budget, on Lighthouse's
mobile preset (Moto G Power, Slow 4G, 4× CPU), is in [`perf-budget.json`](../perf-budget.json):
Performance ≥ 98, LCP ≤ 1.8 s, Speed Index ≤ 2.5 s, TBT ≤ 100 ms, CLS ≤ 0.05, server response ≤ 600 ms, ≤ 8 script requests (≤ 2 font files on the home page), ≤ 170 KB of JavaScript and ≤ 1.5 MB in all
(compressed) with the first load, Accessibility and Best Practices 100 (SEO 100 on the home page — an
invitation is `noindex` by default).

## Checks

| What                                    | How                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Home + a sample invitation per template | `npm run build && npm run perf:lhci` (Lighthouse CI, [`lighthouserc.cjs`](../lighthouserc.cjs)); on PRs: `lighthouse.yml` |
| A live invitation                       | `npm run perf:lighthouse -- --url https://invitations.badooks.com/i/<slug>` (or `--slug <slug>`, `--runs 3`)              |
| Newly published invitations             | daily in `lighthouse.yml`: `--recent` reads `GET /api/cron/recent-invitations` (cron secret); misses → the alert webhook   |
| Scroll smoothness, CLS over a visit     | `npm run perf:templates` (`perf-templates.yml`)                                                                           |

Lighthouse CI measures through `scripts/lhci-server.mjs`: `next start` behind an HTTP/2 TLS front, the way a
CDN serves the site. It matters: the mobile preset simulates Slow 4G from a load recorded on the machine, and over
plain HTTP/1.1 (what `next start` speaks) the simulation gives every request a connection of its own — the same
home page scores ~0.9 s worse in LCP that way than over HTTP/2. The front also sends the invitations' dev render
route (`/dev/invitations/render/…`, which stands for `/i/<slug>/<lang>`) whole and Brotli-compressed as a CDN sends
the cached (ISR) page, instead of the ~100 KB the route streams. The sample invitations are the template's
*demo* document — every section on, the heaviest an invitation gets (up to ~2.6k elements).

The scheduled check needs the repository secrets `INVITES_CRON_URL` and `INVITES_CRON_SECRET` (the
same as the other jobs) and, for alerts, `INVITES_PERF_ALERT_WEBHOOK` (a Slack-compatible incoming
webhook). A page over the budget fails the run and is listed in its summary.

## Where it stands

Lighthouse, mobile preset (simulated Slow 4G, 4× CPU), a few runs each (the ranges); the numbers move a few
points from run to run, TBT most. "Before" is the code at the start of this work, measured over HTTP/1.1; the
last column is `npm run perf:lhci` on the final code (three runs per page).

| Page                          | Before (HTTP/1.1)                              | After, over HTTP/1.1                | After, over HTTP/2 (as served)          |
| ----------------------------- | ---------------------------------------------- | ----------------------------------- | --------------------------------------- |
| Home                          | **31** (PSI 37) · LCP 11.4 s · TBT 4,590 ms    | **91–94** · LCP 3.2 s · TBT 60–160  | **90–94** · LCP 2.4 s · TBT 210–330     |
|                               | 408 KB JS · 7.5 MB · 16,047 elements           | 159 KB JS · 0.29 MB · 895 elements  | 155 KB JS · 0.30 MB · 895 elements      |
| Invitation (ISR sample)       | —                                              | **88–91** · LCP 3.2 s · TBT 130–210 | **93–94** · LCP 2.7–2.9 s · TBT 130–180 |
| Template demo, sahar-bordeaux | **83** · LCP 3.8 s · TBT 200 ms                | **87–88** · LCP 3.3–3.5 s           | **93–97** · LCP 2.4–2.8 s · TBT 120–160 |
| Template demo, kalanit        | **69** · LCP 3.8 s · TBT 720 ms · 195 KB JS    | **85–86** · LCP 3.2–3.7 s           | **91–93** · LCP 2.4–2.8 s · TBT 210–250 |
| Template demo, grandma-garden | **88** · LCP 3.2 s · TBT 200 ms                | **85** · LCP 3.7 s · TBT 110 ms     | **86–93** · LCP 2.4–2.7 s · TBT 170–450 |

Desktop: 100 on the home page and on the three sample invitations (TBT ≈ 0). Accessibility 100, Best Practices
100, SEO 100 (home) on every page. The columns differ by the transport alone: a local `next start` speaks
HTTP/1.1, a CDN HTTP/2 (see Checks). The JavaScript of every page measured is under 170 KB, the whole load under
0.33 MB.

Ten more template demos, one run each (atara, bukhara, caesarea-shore, golden-years, jerusalem-stone, lumiere,
midnight-bloom, retro-80s, rocket-launch, unicorn-dream): Performance 91–96, LCP 2.0–2.8 s, TBT 130–290 ms, CLS
≤ 0.006, 161–163 KB of JavaScript, 0.28–0.38 MB in all, Accessibility and Best Practices 100. All of them meet the
score, the JavaScript, the weight and the layout-shift budgets; about half of the single runs are a little over on
LCP or TBT (below).

What is not within the budget yet:

- **LCP ≤ 2.5 s on an invitation**: 2.4–2.8 s from run to run — the median of three runs is inside the budget on
  the pages measured, a single run is not always. The simulation counts everything that finishes loading before
  the first paint: the framework (React + Next, 100 KB), the invitation's own client code (~60 KB), its fonts
  (~90 KB a Hebrew page) and CSS (24 KB). The next cut is the renderer's eager client code.
- **TBT ≤ 200 ms**: the home page (210–330 ms), the kalanit demo (210–250 ms) and the grandma demo (170–450 ms, 2.7k
  elements) sit at or above the line, the median of three runs a few percent over it. What is left after the
  first layout is the evaluation of React's and Next's own scripts (~45 ms of CPU, 4× in the simulation) and
  hydrating the tree.
- **A bilingual invitation opened from an English browser** (what PageSpeed Insights is): the guest's language is
  picked in the browser (`live/detect.ts`), which renders the whole invitation again in the other language
  (~110 KB of script, the `live.json`, the other language's fonts): Performance ~80, TBT ~500 ms.

## What every invitation gets (the shared renderer)

- **Static, cached long.** `/i/<slug>/<lang>` is ISR (10 minutes) on the server and the CDN; every
  change a guest would see refreshes it at once (`server/revalidate.ts`: publishing, edits, a feature
  turned on or off, an account closed). One features query per render (React `cache`), the gallery's
  link alongside it.
- **Pictures.** Every picture goes through the image optimizer (AVIF / WebP, a `srcset` of widths with
  `sizes`): the hero (preloaded, `fetchpriority=high` — `auto` behind a cover, whose poster comes first),
  the cover's poster and its blurred copy, the gallery's thumbnails and lightbox, a video's poster, a
  YouTube still the editor checked exists. Anything below the first screen is `loading=lazy`.
- **Video.** Behind a cover, the hero's video downloads nothing (`preload=none`, no autoplay) until the
  guest opens it; a YouTube / Vimeo hero is a still until then (or, without a cover, until the guest's
  first touch, scroll or key) — the player's megabyte of script never loads with the first paint.
- **JavaScript.** Parts an invitation may not have — the scroll scene's driver, the gallery, the live
  gallery's card, the flip cards, the date reveal — are separate chunks (`renderer/lazy.client.tsx`),
  still rendered on the server. What the guest sees first (the cover, its openings) stays in the page.
- **What the guest's browser doesn't load.** The beacon's zod schema lives in `insights/schema.ts` (server only —
  it was 27 KB in every guest's page through the model the beacon imports); the invitation's eager client
  components draw with `ui/core-icons.tsx` (15 icons) instead of the whole icon registry (`ui/Icon.tsx`, ~12 KB: the
  timeline's, the ornaments', the custom ones), which the server-rendered sections and the live switch's chunk use.
- **The other languages.** An invitation in several languages renders the others in the browser (the live
  language switch). What that takes — the document, the template, the render options — is not in the
  page: it is `GET /i/<slug>/live.json`, cached like the page and refreshed with it (`server/live-body.ts`),
  and the browser-side renderer is a chunk of its own. Both are fetched when the guest reaches for the
  language pill, at their first move after the opening, or 8 s after it — never while the page loads.
- **Fonts.** Self-hosted woff2 with `font-display: swap`, a `unicode-range` per subset (a browser
  downloads only the scripts it renders), the display font preloaded; cached for good. A Latin file is
  12–39 KB a weight and holds what a page in ASCII never shows (accents, ligatures…), yet every Hebrew
  page — for its spaces, digits and an English word — and every English one downloaded all of it: the
  build cuts each Latin face's ASCII part out as a file of its own, `latin-basic` (about two thirds of
  the size; `scripts/build-fonts.mjs`), declared after the Latin face so it wins for those characters
  and the whole face loads only for the rest.

## Uploads

- **Photos** (editor, `editor/fields/prepare-image.ts`): in the host's browser before they are sent —
  upright (EXIF), at most 2560 px on the long edge, WebP (JPEG where the browser can't write WebP;
  transparency kept). Their pixel size is saved in the document (`Media.width/height`, a gallery photo's
  `width/height`) and given to the `<img>`, so its box is kept before it loads. The optimizer then makes
  each screen's width.
- **Video posters**: a still from the file, made in the browser as it uploads (≤ 1280 px), served
  through the optimizer.
- **Videos** (editor, `editor/fields/prepare-video.ts`): re-encoded in the host's browser before they are
  sent — H.264 at most 1280×720 (either way up), at most 30 fps, ~1.5 Mb/s at 720p, faststart, with the
  sound kept (AAC, or Opus where the browser can't write AAC), through WebCodecs and `mp4-muxer`. A 15 MB
  phone clip becomes 2–3 MB, and a clip that was over the 15 MB limit now fits. It plays the clip muted,
  frame by frame, so it takes about as long as the video (the first half of the progress bar; the upload
  is the second); clips over 3 minutes aren't touched. Nothing here makes an upload worse: a video that is
  light already, one the browser can't decode or encode (Firefox, Safari before 16.4 — no WebCodecs
  H.264), a layout the editor doesn't know (several sound tracks), a result that isn't at least 12 %
  smaller, or one that doesn't play back as it should (size, length, a decoded frame, its sound — checked
  in a video element before it is sent) is uploaded as it was. The size is saved with it (`Media.width /
  height`). `editor/fields/mp4-tracks.ts` reads which tracks a file has from its movie box.
- **The team's own files** (hero videos, posters, gallery photos for a template): `npm run media:optimize`
  does the same on a folder and writes `media-info.json` ([template-media.md](template-media.md));
  `npm run media:sync` warns about anything in the bucket that is still heavy.

## The home page

- **The HTML.** 16k → ~900 elements, 109 → 54 KB compressed. The 62 designs' posters (and the "how it works"
  fan, the sign-in panel's two) are pre-rendered at build time (`npm run poster-art`,
  `scripts/build-poster-art.tsx` → `public/poster-art/<hash>/`): the page carries each poster's frame
  and fetches its contents and fonts as it nears the screen (`LazyTemplatePoster`, `PosterArtLoader`).
  Of the designs' grid only the first eight are in the page; the rest come as a pre-rendered fragment
  (`designs-more.html`, `DesignsMore`) once the visitor is near. Below the first screen, sections are
  `content-visibility: auto` (not laid out or animated until near); their entrances run from one
  `IntersectionObserver` (`RevealWatcher`) with no layout reads.
- **CSS.** Tailwind scans the whole repository, so one sheet carried the utilities of every screen of the
  app to a visitor of the home page. The public pages' sheet (`src/styles/public.css`) scans only the
  files the public pages can reach (`scripts/lib/public-css-sources.mjs` follows the imports; `npm run
  public-css` writes them, `npm run check:public-css` proves every class the pages render is in it);
  the app's screens' are in `app.css`. 31 → 17 KB compressed for the first paint.
- **JavaScript.** The first load's own scripts are ~157 KB (react-dom and Next's runtime 100 KB of it):
  the public pages import the app's primitives one by one (never through the `components/app` barrel —
  `tests/unit/public-css-sources.test.ts` keeps it so), the UI dictionary of the public pages holds only
  what their components read (`app-core.*` — the app's screens are `app-more.*`), the two video posters
  are plain `<img>` over the optimizer's addresses (`imageSet`) instead of `next/image` (its runtime is
  6 KB and hydrates per picture), Radix is imported per package (`@radix-ui/react-*`, not the umbrella
  that defeats tree-shaking). `node scripts/analyze-bundles.mjs --url …` shows what a page's scripts are
  made of (build with `ANALYZE_SOURCEMAPS=1`).
- **Fonts.** The text is Heebo (Hebrew UI) / Inter (English), each a variable font ("Heebo Variable" /
  "Inter Variable"): one file covers every weight, cut to the weights the app uses (400–800, as the static
  faces were: nothing renders lighter or heavier than before). A Hebrew page needs Hebrew *and* the ASCII
  letters and digits, which the font packages ship as two files: `scripts/build-fonts.mjs` cuts both from the
  full fonts (`scripts/font-sources`, Google Fonts' OFL files) into one — Heebo `hebrew-basic`, 31 KB — and
  the headlines' Frank Ruhl Libre the same way (one file per weight, 18 KB). The home page loads **two font
  files** (before: four), both preloaded; the combined face is declared after the whole Latin one, so it
  wins for the ASCII part (the shaping of the text is identical, checked with HarfBuzz on both).
- The demo video: the poster is a preloaded, optimized image (`fetchpriority=high`); the video (≤ 720p
  H.264, < 800 KB, one file per screen shape through `<source media>`) loads once it is in view and the
  visitor has done something. Its files and the narrated tour's (13 → 6 MB at 720p, captions in the
  picture kept sharp) come from `scripts/encode-site-video.mjs` (content-hashed names).
- The background YouTube video: the still (chosen on the server, `hero-still.ts`) through the optimizer,
  preloaded with its priority; the player after the visitor's first interaction (or the play button).
- The sample invitation in a phone loads when the visitor scrolls toward it.
- The logo: AVIF / WebP at 2× and 3× of its size; the footer's loads when it is near. The favicon is 96 px.

## The home page is static

`/` and `/en` are two static pages (ISR, one hour; `○` in the build output), so the CDN holds them and the
document comes from its edge — no server work, no database, no session check per visit. What used to make
the page dynamic and how it is kept:

- **The language** was read from the `ui_lang` cookie in the root layout (`cookies()` makes a page
  dynamic). The layout is now `features/site/SiteRoot.tsx`, given the language: the pages that follow the cookie
  (`(site)/layout.tsx`) resolve it per request as before, the home page's two route groups fix it
  (`(home-he)` → `/`, `(home-en)` → `/en`, with `canonical` and `hreflang` pointing at each other). The language
  switch on the home page goes to the other address; a visitor whose cookie says the other language is sent
  there from <head> before the first paint (`features/site/home/home-boot.ts`).
- **The middleware** ran on `/` for one thing: sending a signed-in host to their invitations (a Supabase
  `getUser()` on every visit, and a response that can't be cached). `/` is out of its matcher. The same
  redirect is made in <head> by `home-boot.ts` — the Supabase session cookie is enough to go to
  `/app/invitations`, which checks the session itself (a stale cookie ends at the sign-in page). The
  Supabase-answer redirects (`/?code=…`) still go through it.
- **CSS** is inlined into the page (`experimental.inlineCss`): measured under real Slow 4G + 4× CPU, first
  paint at ~650 ms instead of ~1000 ms with two stylesheets to wait for. Everything the first paint needs is
  in the document: the text fonts and the poster are preloaded in <head>, nothing is rendered after
  hydration; the sections below the first screen are `Suspense` boundaries, which React hydrates one at a
  time when idle instead of in the one long task (TBT 200–330 → ~100 ms).
- **Scripts**: Next splits the code shared by each pair of routes into a chunk of its own; those chunks are kept
  in the routes that use them (`next.config.ts`, the `default`/`defaultVendors` groups): 8 scripts in the
  HTML plus the dictionary's two small chunks (before: 18 + 2). Tried and dropped: importing the dictionary
  in the layout (a module that lives in two layouts' chunks makes a page load both) and a shared "shell"
  chunk — each loaded more, not less.
- **LCP picture**: the video poster at quality 60, sized to the page (`100vw − 40px` on a phone); the
  background still has no priority of its own, so the poster is fetched first. The logo files are 45 % smaller
  (`scripts/build-brand.mjs`).
- `/llms.txt` is a static file in `public/`.

## Caching

Versioned files are cached for good (`public, max-age=31536000, immutable`): `/_next/static`, `/fonts`,
`/video`, `/brand`, `/poster-art`, `/face-models` — in `customHttp.yml` (Amplify's CDN applies it to
the files it serves itself) and in `next.config.ts` (for `next start` and other hosts). A file there
must change its name when its content changes (a hash or a version in the path).

## Browsers

`package.json` `browserslist`: Chrome / Edge ≥ 93, Safari / iOS ≥ 15.4, Firefox ≥ 92, Samsung Internet
≥ 17 — all of them have what Next's polyfill module adds, so the build leaves it out
(`next.config.ts`). iPhones that can't update past iOS 15.3 or earlier (the iPhone 6 and older) are
outside this list.

## Not done yet

- **Video transcoding where the browser can't.** The editor re-encodes a host's video in their browser
  (see "Uploads"); browsers without WebCodecs H.264 encoding send it as recorded (mp4 ≤ 15 MB). A job
  outside the web server (a storage-upload trigger running ffmpeg, or AWS Elemental MediaConvert) would
  cover those too, writing the encoded file and its size back to the document.
- **LCP ≤ 1.8 s in the simulation.** Under real Slow 4G + 4× CPU the home page paints in ~0.65 s and the invitations in
  ~0.6–0.9 s; Lighthouse's simulation reads 2.2–2.6 s because it counts every request that finishes before
  the first paint (the document, two fonts, ~150 KB of script). What is left is bytes: the document (~70 KB
  gzipped, a third of it the page's CSS and its copy in the page's data), React and Next (~100 KB).
- **A bilingual invitation opened from an English browser** (PageSpeed's) still renders the sections again in the
  browser (script 165 → 296 KB, the other language's fonts, TBT 250 ms+). Sending that guest to the page in
  their language from <head> (`?lang=en`) removes the work but adds a navigation, and the simulation scores it
  no better; it also changes the address, so it was left as it is.
- **Hosting.** Time to first byte depends on where the HTML comes from: a static page is served by the CDN's
  edge, but the first visit after a deploy (or an hour) is rendered at the origin region. Check the region of the
  Amplify app and the response headers of `/` (`x-cache`, `age`) after the first deployment.
