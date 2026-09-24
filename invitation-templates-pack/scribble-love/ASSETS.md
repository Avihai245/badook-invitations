# Scribble Love · שרבוט (`scribble-love`)

קולאז׳ של פתקים, לא מושלם בכוונה — דף משבצות, לבבות משורבטים, עיגול טוש סביב התאריך, חצים עקומים, סלוטייפ צבעוני ומדבקות כוכבים.

A notes-app collage, imperfect on purpose — grid paper, loop-scribble hearts, a marker circle around the date, wobbly arrows, washi tape and star stickers.

Cover: `envelope_seal` · overlay `wax_seal` · exit `lift` · categories: engagement, birthday, other

Look: Marker and pen doodles on grid paper, washi tape, stickers — like a screenshot of a note. / שרבוטי טוש ועט על נייר משבצות, סלוטייפ וושי, מדבקות — נראה כמו צילום מסך של פתק.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/scribble-love.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `scribble-love/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `washi-band.webp` | transparent WebP ≤120KB | template:washi-band |
| [ ] `doodle-panorama.webp` | transparent WebP ≤120KB | template:doodle-panorama |
| [ ] `hearts.webp` | transparent WebP ≤120KB | template:hearts |
| [ ] `arrow.webp` | transparent WebP ≤120KB | template:arrow |
| [ ] `scribble-heart.webp` | transparent WebP ≤120KB | template:scribble-heart |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
