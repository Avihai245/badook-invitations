# Jerusalem Stone · אבן ירושלמית (`jerusalem-stone`)

אבן גיר חמימה בגוון דבש — אבני גזית עם שוליים מסותתים, חלון מקושת אל השמיים, ענף זית וברושים. מכובד, מסורתי ומלא אור.

Warm honey-toned limestone — ashlar blocks with chiselled margins, an arched window onto the sky, an olive branch and cypresses. Dignified, traditional and full of light.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: bar_mitzvah, bat_mitzvah, wedding, brit

Look: Jerusalem stone in afternoon light, soft olive-leaf shadows, a clear sky. / אבן ירושלמית באור אחר צהריים, צללים רכים של עלי זית, שמיים בהירים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/jerusalem-stone.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/jerusalem-stone/`. Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `ashlar-band.webp` | transparent WebP ≤120KB | template:ashlar-band |
| [ ] `arches-panorama.webp` | transparent WebP ≤120KB | template:arches-panorama |
| [ ] `olive-branch.webp` | transparent WebP ≤120KB | template:olive-branch |
| [ ] `cypresses.webp` | transparent WebP ≤120KB | template:cypresses |
| [ ] `olive-sprig.webp` | transparent WebP ≤120KB | template:olive-sprig |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
