# Martini Olive · מרטיני (`martini-olive`)

מסיבת קוקטייל רטרו — כוס מרטיני עם זית על שיפוד, זיתים ירוקים, רצועת משבצות, נרות גבוהים ושוליים מסולסלים על ירוק זית.

A retro cocktail party — a martini with a speared olive, green olives, a checkerboard strip, taper candles and a scalloped edge on olive green.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: birthday, engagement, corporate

Look: A 1960s-inspired still: martini, olives, candles, black-and-white checks, saturated olive green. / צילום בהשראת שנות ה־60: מרטיני, זיתים, נרות, משבצות שחור־לבן, ירוק זית רווי.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/martini-olive.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `martini-olive/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `checker-band.webp` | transparent WebP ≤120KB | template:checker-band |
| [ ] `bar-panorama.webp` | transparent WebP ≤120KB | template:bar-panorama |
| [ ] `martini.webp` | transparent WebP ≤120KB | template:martini |
| [ ] `candles.webp` | transparent WebP ≤120KB | template:candles |
| [ ] `olive-pick.webp` | transparent WebP ≤120KB | template:olive-pick |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
