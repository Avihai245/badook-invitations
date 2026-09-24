# Bukhara Silk · משי בוכרה (`bukhara`) · premium

איקט ורקמת סוזאני בצבעים עזים — פסי מעוינים בקצוות מטושטשים, רוזטות רקומות, ענפי צבעונים, תפר שרשרת וגדילים משתלשלים.

Bold ikat and suzani embroidery — feathered lozenge bands, stitched rosettes, tulip sprigs, chain-stitch borders and swinging tassels.

Cover: `pouch` · overlay `medallion` · exit `lift` · categories: henna, engagement, wedding

Look: Bukhara ikat silk and suzani embroidery: magenta, indigo and saffron, visible stitches. / משי איקט ורקמת סוזאני מבוכרה: מג׳נטה, אינדיגו וזעפרן, תפרים גלויים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/bukhara.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `bukhara/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `patch-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `ikat-band.webp` | transparent WebP ≤120KB | template:ikat-band |
| [ ] `tulip-panorama.webp` | transparent WebP ≤120KB | template:tulip-panorama |
| [ ] `rosette.webp` | transparent WebP ≤120KB | template:rosette |
| [ ] `tassels.webp` | transparent WebP ≤120KB | template:tassels |
| [ ] `suzani-medallion.webp` | transparent WebP ≤120KB | template:suzani-medallion |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
