# Atara · עטרה (`atara`)

שקית טלית מקטיפה רקומה בחוטי כסף שנפתחת אל ספר תורה באור חלון. לבר ולבת מצווה — מכובד, מרגש ונקי.

Cover: `pouch` · overlay `medallion` · exit `lift` · categories: bar_mitzvah, bat_mitzvah

Upload them to the Supabase Storage bucket `template-media`, folder `atara/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `tallit-stripes.webp` | transparent WebP ≤120KB | template:tallit-stripes |
| [ ] `torah-crown.webp` | transparent WebP ≤120KB | template:torah-crown |
| [ ] `pomegranates.webp` | transparent WebP ≤120KB | template:pomegranates |
| [ ] `stone-arch.webp` | transparent WebP ≤120KB | template:stone-arch |
| [ ] `tefillin-bag-outline.webp` | transparent WebP ≤120KB | template:tefillin-bag-outline |
| [ ] `flowers-spray.webp` | transparent WebP ≤120KB | template:flowers-spray |
| [ ] `hero-bloom.mp4` | 720×1280 H.264 loop ≤4MB | template:hero-bloom |
| [ ] `hero-bloom-poster.webp` | poster webp | template:hero-bloom-poster |
| [ ] `hero-bloom-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-bloom-desktop |
| [ ] `hero-bloom-desktop-poster.webp` | poster webp | template:hero-bloom-desktop-poster |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
