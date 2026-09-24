# Caesarea Shore · חוף קיסריה (`caesarea-shore`)

מעטפת פשתן בגוון חול עם חותם שעווה טורקיז, קשתות אמת המים בשעת הזהב וגלים רכים. ים־תיכוני, אוורירי ואלגנטי.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: wedding, engagement, save_the_date

Upload them to the Supabase Storage bucket `template-media`, folder `caesarea-shore/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `shells.webp` | transparent WebP ≤120KB | template:shells |
| [ ] `arches-panorama.webp` | transparent WebP ≤120KB | template:arches-panorama |
| [ ] `sea-lavender.webp` | transparent WebP ≤120KB | template:sea-lavender |
| [ ] `lantern-sand.webp` | transparent WebP ≤120KB | template:lantern-sand |
| [ ] `footprints.webp` | transparent WebP ≤120KB | template:footprints |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
