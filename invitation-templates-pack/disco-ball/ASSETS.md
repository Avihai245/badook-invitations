# Disco Ball · דיסקו (`disco-ball`) · premium

כדור מראות מתנדנד על השרשרת מעל רחבת ריקודים זוהרת — מאות אריחי מראה, קרני אור צבעוניות, נצנוצים, זרקורים שסורקים את החדר, אריחים שפועמים וקונפטי. ליל דיסקו אמיתי.

A mirror ball swinging on its chain over a glowing dance floor — hundreds of mirror tiles, colored rays, glints, spotlights sweeping the room, pulsing floor tiles and confetti. A real disco night.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: bat_mitzvah, birthday, corporate

Look: A real mirror ball turning slowly in a dark club, flecks of colored light on the walls, a light-up dance floor, haze and falling confetti — plum, pink, gold and silver, never plain black neon. / כדור מראות אמיתי שמסתובב לאט במועדון חשוך, כתמי אור צבעוניים על הקירות, רחבה מוארת מבפנים, עשן וקונפטי נופל — שזיף, ורוד, זהב וכסף, לא ניאון על שחור.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/disco-ball.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `disco-ball/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `sparkle-band.webp` | transparent WebP ≤120KB | template:sparkle-band |
| [ ] `floor-panorama.webp` | transparent WebP ≤120KB | template:floor-panorama |
| [ ] `mirror-ball.webp` | transparent WebP ≤120KB | template:mirror-ball |
| [ ] `confetti.webp` | transparent WebP ≤120KB | template:confetti |
| [ ] `disco-star.webp` | transparent WebP ≤120KB | template:disco-star |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
