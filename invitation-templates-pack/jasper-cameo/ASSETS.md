# Jasper Cameo · קמיאו (`jasper-cameo`) · premium

רוקוקו בהשראת חרסינת ג׳ספר כחולה עם תבליט לבן — קמיאו סגלגל, זר דפנה, סרטים משתלשלים, עלי אקנתוס ומסגרת של פנינים.

A rococo revival in blue jasperware and white relief — an oval cameo, a laurel wreath, ribbon swags, acanthus corners and a border of pearls.

Cover: `ribbon` · overlay `medallion` · exit `lift` · categories: wedding, engagement, bat_mitzvah

Look: Matte Wedgwood-blue jasperware, raised white relief, soft shadows. No gloss. / חרסינת ג׳ספר מט בכחול וודג׳ווד, תבליט לבן בולט, צללים רכים. בלי הברקה.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/jasper-cameo.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `jasper-cameo/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `cameo-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `pearl-band.webp` | transparent WebP ≤120KB | template:pearl-band |
| [ ] `swag-panorama.webp` | transparent WebP ≤120KB | template:swag-panorama |
| [ ] `laurel-wreath.webp` | transparent WebP ≤120KB | template:laurel-wreath |
| [ ] `ribbon-bow.webp` | transparent WebP ≤120KB | template:ribbon-bow |
| [ ] `cameo.webp` | transparent WebP ≤120KB | template:cameo |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
