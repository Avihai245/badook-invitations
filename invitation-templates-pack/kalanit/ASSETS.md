# Kalanit · כלנית (`kalanit`)

כלניות אדומות על גבעות ירוקות, בהשראת "דרום אדום" — פרחים עגולים עם לב שחור, עלווה נוצתית וגבעות מתגלגלות. שמחה של אביב ישראלי.

Red anemones on rolling green hills, inspired by the Darom Adom bloom — round petals with a black heart, feathery leaves and layered hills. Israeli spring joy.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: wedding, engagement, birthday

Look: A Negev anemone field at winter’s end: saturated red, fresh green, soft afternoon light. / שדה כלניות בנגב בסוף החורף: אדום רווי, ירוק רענן, אור אחר צהריים רך.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/kalanit.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `kalanit/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `anemone-band.webp` | transparent WebP ≤120KB | template:anemone-band |
| [ ] `hills-panorama.webp` | transparent WebP ≤120KB | template:hills-panorama |
| [ ] `anemone-bunch.webp` | transparent WebP ≤120KB | template:anemone-bunch |
| [ ] `bud-sprig.webp` | transparent WebP ≤120KB | template:bud-sprig |
| [ ] `anemone.webp` | transparent WebP ≤120KB | template:anemone |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
