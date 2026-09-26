# Campfire Night · מדורה (`campfire-night`)

לילה בקרחת יער — ירח חרמש וכוכבים מנצנצים, אורנים גבוהים וינשוף על ענף, אוהל מואר, מדורה עם להבות מרצדות וניצוצות שעולים, מרשמלו על מקלות וגחליליות. הרפתקה לכל המשפחה.

A night in a forest clearing — a crescent moon and twinkling stars, tall pines with an owl on a branch, a glowing tent, a campfire with dancing flames and rising sparks, marshmallows on sticks and fireflies. An adventure for the whole family.

Cover: `pouch` · overlay `medallion` · exit `lift` · categories: birthday, bar_mitzvah, other

Look: Deep night blue against warm firelight: pine silhouettes, a soft moon, sparks and fireflies. / לילה כחול עמוק מול אור כתום של מדורה: צלליות אורנים, ירח רך, ניצוצות וגחליליות.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/campfire-night.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `campfire-night/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `badge-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `pine-band.webp` | transparent WebP ≤120KB | template:pine-band |
| [ ] `forest-panorama.webp` | transparent WebP ≤120KB | template:forest-panorama |
| [ ] `marshmallows.webp` | transparent WebP ≤120KB | template:marshmallows |
| [ ] `lantern.webp` | transparent WebP ≤120KB | template:lantern |
| [ ] `campfire.webp` | transparent WebP ≤120KB | template:campfire |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
