# Skate Park · סקייטפארק (`skate-graffiti`) · premium

העיר בין ערביים — קיר בטון עם התאריך בגרפיטי של אותיות בועה, טפטופי ספריי ותגיות, רמפה עם סקייטבורד באוויר, זוג סניקרס שתלוי על חוט החשמל ושמיים סגולים־כתומים. לבני ולבנות העשרה.

The city at dusk — a concrete wall with the date in graffiti bubble letters, spray drips and tags, a ramp with a skateboard in mid-air, sneakers hanging from the power line and a violet-orange sky. Made for teens.

Cover: `envelope_seal` · overlay `wax_seal` · exit `lift` · categories: bar_mitzvah, bat_mitzvah, birthday

Look: A skatepark at dusk: a concrete wall with a colourful bubble-letter graffiti piece and drips, a quarter-pipe, a skateboard mid-air, a violet-orange city sky. / סקייטפארק בשקיעה: קיר בטון עם גרפיטי צבעוני באותיות בועה וטפטופים, רמפה, סקייטבורד באוויר ושמיים סגולים־כתומים מעל העיר.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/skate-graffiti.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `skate-graffiti/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `sticker-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `spray-band.webp` | transparent WebP ≤120KB | template:spray-band |
| [ ] `city-panorama.webp` | transparent WebP ≤120KB | template:city-panorama |
| [ ] `skateboard.webp` | transparent WebP ≤120KB | template:skateboard |
| [ ] `spray-can.webp` | transparent WebP ≤120KB | template:spray-can |
| [ ] `sneakers.webp` | transparent WebP ≤120KB | template:sneakers |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
