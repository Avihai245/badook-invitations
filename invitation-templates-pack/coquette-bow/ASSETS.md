# Coquette Bow · פפיון (`coquette-bow`) · premium

רכות קוקטית — פפיונים מסאטן, מחרוזות פנינים, תחרה מסולסלת, דובדבנים ולבבות, הכל בוורוד אבקתי.

Soft coquette charm — satin bows, strands of pearls, scalloped lace, cherries and hearts, all in powder pink.

Cover: `ribbon` · overlay `wax_seal` · exit `crack` · categories: bat_mitzvah, baby_shower, engagement

Look: Pink satin ribbons, pearls, white lace and cherries — a soft, bright shot. / סרטי סאטן ורודים, פנינים, תחרה לבנה ודובדבנים — צילום רך ובהיר.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/coquette-bow.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `coquette-bow/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `seal-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `lace-band.webp` | transparent WebP ≤120KB | template:lace-band |
| [ ] `pearl-swags.webp` | transparent WebP ≤120KB | template:pearl-swags |
| [ ] `cherries.webp` | transparent WebP ≤120KB | template:cherries |
| [ ] `satin-bow.webp` | transparent WebP ≤120KB | template:satin-bow |
| [ ] `bow.webp` | transparent WebP ≤120KB | template:bow |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
