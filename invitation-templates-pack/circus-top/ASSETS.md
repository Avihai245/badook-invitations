# Circus Top · קרקס (`circus-top`)

האוהל הגדול ביום שמש — קרני שמש בסגנון וינטג׳, שרשרת דגלונים שמתנופפת, בלונים שעולים, כוכבים מנצנצים, אוהל פסים עם שוליים מסולסלים וכלב ים בכובע של מנהל הקרקס שמלהטט בכדור. יום הולדת לקטנטנים.

The big top on a sunny day — vintage sunburst rays, fluttering bunting, balloons floating up, twinkling stars, a striped tent with a scalloped valance and a seal in a ringmaster’s hat juggling a ball. A birthday for little ones.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: birthday

Look: A cheerful big top on a sunny day: red-and-white stripes, bunting, balloons, sunburst rays — soft, bright, toddler-friendly. / אוהל קרקס עליז ביום שמש: פסים אדומים ולבנים, דגלונים, בלונים, קרני שמש — רך, בהיר ומתאים לקטנטנים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/circus-top.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `circus-top/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `bunting-band.webp` | transparent WebP ≤120KB | template:bunting-band |
| [ ] `bigtop-panorama.webp` | transparent WebP ≤120KB | template:bigtop-panorama |
| [ ] `balloons.webp` | transparent WebP ≤120KB | template:balloons |
| [ ] `seal.webp` | transparent WebP ≤120KB | template:seal |
| [ ] `big-top.webp` | transparent WebP ≤120KB | template:big-top |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
