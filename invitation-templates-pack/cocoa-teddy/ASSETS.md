# Cocoa Teddy · דובון (`cocoa-teddy`)

דובון בצבע שוקולד על משבצות גינגהם בתכלת אבקתי — פפיונים, עננים תפוחים ותפר רקמה מסביב. רך, מתוק ומחבק.

A chocolate teddy on powder-blue gingham — bows, puffy clouds and a running-stitch border. Soft, sweet and cuddly.

Cover: `swaddle` · overlay `tag` · exit `lift` · categories: brit, baby_shower, birthday

Look: A brown plush teddy, a powder-blue gingham blanket, soft clouds — warm morning light. / דובון קטיפה חום, שמיכת גינגהם תכלת, עננים רכים — אור בוקר חמים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/cocoa-teddy.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `cocoa-teddy/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `tag-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (used as is) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `gingham-band.webp` | transparent WebP ≤120KB | template:gingham-band |
| [ ] `clouds-panorama.webp` | transparent WebP ≤120KB | template:clouds-panorama |
| [ ] `teddy.webp` | transparent WebP ≤120KB | template:teddy |
| [ ] `bow.webp` | transparent WebP ≤120KB | template:bow |
| [ ] `teddy-face.webp` | transparent WebP ≤120KB | template:teddy-face |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
