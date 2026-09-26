# Superhero POW · גיבורי־על (`superhero-pow`)

עמוד קומיקס בלילה — מסגרות שחורות עבות, נקודות רסטר, ירח מלא וגיבור בגלימה שעף מולו, זרקור מעל קו הרקיע של העיר, ובועות POW! ו־BOOM! שקופצות. מסיבה עם כוחות־על.

A comic-book page at night — bold panel borders, halftone dots, a full moon with a caped hero flying across it, a searchlight over the city skyline, and POW! and BOOM! bursts that pop. A party with superpowers.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: birthday, bar_mitzvah

Look: A comic-book night city: bold black outlines, halftone dots, a full moon with a caped hero flying across it, POW!/BOOM! bursts. / עיר של קומיקס בלילה: קווי מתאר שחורים ועבים, נקודות רסטר, ירח מלא עם גיבור בגלימה שעף מולו, בועות POW!/BOOM!.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/superhero-pow.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `superhero-pow/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `emblem-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `halftone-band.webp` | transparent WebP ≤120KB | template:halftone-band |
| [ ] `skyline-panorama.webp` | transparent WebP ≤120KB | template:skyline-panorama |
| [ ] `pow.webp` | transparent WebP ≤120KB | template:pow |
| [ ] `boom.webp` | transparent WebP ≤120KB | template:boom |
| [ ] `emblem.webp` | transparent WebP ≤120KB | template:emblem |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
