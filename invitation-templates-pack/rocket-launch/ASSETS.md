# Rocket Launch · חללית (`rocket-launch`)

3… 2… 1… שיגור! חללית שממריאה על להבה מהבהבת, אסטרונאוט שמנופף, ירח עם כוכב לכת שמקיף אותו, כוכב שביט ושמיים מלאי כוכבים נוצצים. לחוקרי החלל הצעירים.

3… 2… 1… liftoff! A rocket rising on a flickering flame, a waving astronaut, a moon with a planet circling it, a comet and a sky full of twinkling stars. For young space explorers.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: birthday, bar_mitzvah

Look: A deep indigo night full of stars with soft violet and teal nebulae, a cream cratered moon, a coral ringed planet, a white-and-orange rocket lifting off a small purple world in billows of smoke, a friendly astronaut — glowing, playful, cartoon-bright. / לילה כחול־סגול עמוק מלא כוכבים עם ערפיליות סגולות וטורקיז רכות, ירח שמנת עם מכתשים, כוכב לכת אלמוגי עם טבעת, חללית לבנה־כתומה שממריאה מעולם סגול קטן בענני עשן, אסטרונאוט חביב — זוהר, שובב ובהיר כמו סרט מצויר.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/rocket-launch.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `rocket-launch/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `mission-patch-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `stars-band.webp` | transparent WebP ≤120KB | template:stars-band |
| [ ] `planets-panorama.webp` | transparent WebP ≤120KB | template:planets-panorama |
| [ ] `rocket.webp` | transparent WebP ≤120KB | template:rocket |
| [ ] `astronaut.webp` | transparent WebP ≤120KB | template:astronaut |
| [ ] `moon.webp` | transparent WebP ≤120KB | template:moon |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
