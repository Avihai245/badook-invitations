# Performance

What keeps the home page and every invitation fast, and what checks it. The budget, on Lighthouse's
mobile preset (Moto G Power, Slow 4G, 4× CPU), is in [`perf-budget.json`](../perf-budget.json):
Performance ≥ 90, LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.1, ≤ 170 KB of JavaScript and ≤ 1.5 MB in all
(compressed) with the first load, Accessibility and Best Practices 100 (SEO 100 on the home page — an
invitation is `noindex` by default).

## Checks

| What                                    | How                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Home + a sample invitation per template | `npm run build && npm run perf:lhci` (Lighthouse CI, [`lighthouserc.cjs`](../lighthouserc.cjs)); on PRs: `lighthouse.yml` |
| A live invitation                       | `npm run perf:lighthouse -- --url https://invitations.badooks.com/i/<slug>` (or `--slug <slug>`, `--runs 3`)              |
| Newly published invitations             | daily in `lighthouse.yml`: `--recent` reads `GET /api/cron/recent-invitations` (cron secret); misses → the alert webhook   |
| Scroll smoothness, CLS over a visit     | `npm run perf:templates` (`perf-templates.yml`)                                                                           |

The scheduled check needs the repository secrets `INVITES_CRON_URL` and `INVITES_CRON_SECRET` (the
same as the other jobs) and, for alerts, `INVITES_PERF_ALERT_WEBHOOK` (a Slack-compatible incoming
webhook). A page over the budget fails the run and is listed in its summary.

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
- **Fonts.** Self-hosted woff2 with `font-display: swap`, a `unicode-range` per subset (a browser
  downloads only the scripts it renders), the display font preloaded; cached for good.

## Uploads

- **Photos** (editor, `editor/fields/prepare-image.ts`): in the host's browser before they are sent —
  upright (EXIF), at most 2560 px on the long edge, WebP (JPEG where the browser can't write WebP;
  transparency kept). Their pixel size is saved in the document (`Media.width/height`, a gallery photo's
  `width/height`) and given to the `<img>`, so its box is kept before it loads. The optimizer then makes
  each screen's width.
- **Video posters**: a still from the file, made in the browser as it uploads (≤ 1280 px), served
  through the optimizer.
- **Videos**: limited to mp4 ≤ 15 MB; not transcoded (see "Not done yet").

## The home page

- The 62 designs' posters (and the "how it works" fan, the sign-in panel's two) are pre-rendered at
  build time (`npm run poster-art`, `scripts/build-poster-art.tsx` → `public/poster-art/<hash>/`): the
  page carries each poster's frame and fetches its contents and fonts as it nears the screen
  (`LazyTemplatePoster`, `PosterArtLoader`). DOM: 16k → ~1.4k elements.
- Below the first screen, sections are `content-visibility: auto` (not laid out or animated until near).
- The demo video: the poster is a preloaded, optimized image; the video (≤ 720p H.264, < 800 KB, one
  file per screen shape through `<source media>`) loads once it is in view and the visitor has done
  something. Its files and the narrated tour's (13 → 6 MB at 720p, captions in the picture kept sharp) come from `scripts/encode-site-video.mjs` (content-hashed names).
- The background YouTube video: the still (chosen on the server, `hero-still.ts`) through the optimizer,
  preloaded; the player after the visitor's first interaction (or the play button).
- The sample invitation in a phone loads when the visitor scrolls toward it.
- The public pages load only the site's part of the UI dictionary (`ui-site-he|en`); `/app` adds the
  rest.
- The logo: AVIF / WebP at 2× and 3× of its size.

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

- **Video transcoding on upload.** A host's video goes up as recorded (mp4 ≤ 15 MB). Transcoding to
  ≤ 720p H.264 / AV1 needs a job outside the web server (e.g. a storage-upload trigger running ffmpeg or
  AWS Elemental MediaConvert), writing the encoded file and its size back to the document.
- **One stylesheet for the whole app.** Tailwind scans the whole repository, so the public pages' CSS
  (~29 KB compressed, render-blocking) includes the app's screens' utilities.
