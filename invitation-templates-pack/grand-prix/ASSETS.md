# Grand Prix · מרוץ (`grand-prix`)

יום מרוץ בשמש — רמזורי זינוק שנדלקים, דגלי משבצות שמתנופפים, מסלול מתעקל עם שוליים באדום־לבן, מכונית מרוץ שהגלגלים שלה מסתובבים ופודיום עם גביע. יום הולדת במהירות מלאה.

Race day in the sun — start lights glowing, checkered flags waving, a curving track with red-and-white kerbs, a race car with spinning wheels and a podium with a trophy. A birthday at full speed.

Cover: `envelope_seal` · overlay `tag` · exit `lift` · categories: birthday, bar_mitzvah

Look: Race day in the sun: a curving asphalt track with red-and-white kerbs, a single-seater race car, start lights, checkered flags, a packed grandstand. / יום מרוץ בשמש: מסלול אספלט מתעקל עם שוליים באדום־לבן, מכונית מרוץ, רמזורי זינוק, דגלי משבצות ויציע מלא.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/grand-prix.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `grand-prix/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `pass-blank.png` | 1024×1024 transparent PNG | BLANK, no letters |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `kerb-band.webp` | transparent WebP ≤120KB | template:kerb-band |
| [ ] `track-panorama.webp` | transparent WebP ≤120KB | template:track-panorama |
| [ ] `race-car.webp` | transparent WebP ≤120KB | template:race-car |
| [ ] `checkered-flag.webp` | transparent WebP ≤120KB | template:checkered-flag |
| [ ] `trophy.webp` | transparent WebP ≤120KB | template:trophy |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
