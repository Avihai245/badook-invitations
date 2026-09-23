# Honey Meadow · אחו הדבש (`honey-meadow`)

מעטפת קראפט עם חותם שעוות דבורים משושה, אחו חמניות בצבעי מים עם בלון פורח ודבורה חמודה. לבייבי שאוור ולימי הולדת לילדים — מתוק ושמח.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: baby_shower, birthday, brit

Put files in `public/templates/honey-meadow/`. Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `seal-hex-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `daisy-bunch.webp` | transparent WebP ≤120KB | template:daisy-bunch |
| [ ] `bee-sunflower.webp` | transparent WebP ≤120KB | template:bee-sunflower |
| [ ] `sunflowers.webp` | transparent WebP ≤120KB | template:sunflowers |
| [ ] `balloon.webp` | transparent WebP ≤120KB | template:balloon |
| [ ] `honeycomb-band.webp` | transparent WebP ≤120KB | template:honeycomb-band |
| [ ] `clouds.webp` | transparent WebP ≤120KB | template:clouds |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
