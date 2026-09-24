# Deco Gatsby · גטסבי (`deco-gatsby`) · premium

שנות העשרים השואגות בזהב על אוניקס — מניפות קרני שמש, מסגרת זיגורת מדורגת, שברונים, קווים משולשים עם יהלומים וגביע שמפניה.

The Roaring Twenties in gold on onyx — sunburst fans, a stepped ziggurat frame, chevrons, triple-line borders with diamonds and a champagne coupe.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: corporate, wedding, birthday, other

Look: 1920s art deco: brushed gold on onyx black, geometric lines, champagne glass. / ארט דקו של שנות העשרים: זהב מוברש על שחור אוניקס, קווים גאומטריים, זכוכית שמפניה.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/deco-gatsby.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `deco-gatsby/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `medallion-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `chevron-band.webp` | transparent WebP ≤120KB | template:chevron-band |
| [ ] `deco-panorama.webp` | transparent WebP ≤120KB | template:deco-panorama |
| [ ] `coupe.webp` | transparent WebP ≤120KB | template:coupe |
| [ ] `fan.webp` | transparent WebP ≤120KB | template:fan |
| [ ] `deco-medallion.webp` | transparent WebP ≤120KB | template:deco-medallion |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
