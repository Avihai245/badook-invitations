# Retro 80s · שנות ה־80 (`retro-80s`) · premium

שקיעת סינת׳ווייב — שמש עם פסים ששוקעת מאחורי הרים עם קו ורוד, רשת זוהרת עד האופק, דקלים בצללית, קלטת שהסלילים שלה מסתובבים, נצנוצי כרום ושמיים מלאי כוכבים. כל הנוסטלגיה של שנות השמונים.

A synthwave sunset — a striped sun sinking behind pink-rimmed mountains, a glowing grid to the horizon, palm silhouettes, a cassette whose reels turn, chrome sparkles and a sky full of stars. All the nostalgia of the eighties.

Cover: `envelope_seal` · overlay `medallion` · exit `lift` · categories: birthday, corporate, other

Look: Outrun / synthwave: an indigo-to-magenta sky, a striped sun on the horizon, a grid scrolling toward it, palms swaying in silhouette, chrome and VHS glow — a sunset envelope with a chrome medallion on the cover. / אאוטראן / סינת׳ווייב: שמיים מאינדיגו למג׳נטה, שמש עם פסים על האופק, רשת שגוללת לעברה, דקלים מתנופפים בצללית, כרום וזוהר של VHS — ובשער מעטפה בצבעי שקיעה עם מדליון כרום.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/retro-80s.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `retro-80s/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `grid-band.webp` | transparent WebP ≤120KB | template:grid-band |
| [ ] `sunset-panorama.webp` | transparent WebP ≤120KB | template:sunset-panorama |
| [ ] `cassette.webp` | transparent WebP ≤120KB | template:cassette |
| [ ] `palms.webp` | transparent WebP ≤120KB | template:palms |
| [ ] `chrome-star.webp` | transparent WebP ≤120KB | template:chrome-star |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
