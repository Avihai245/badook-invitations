# Vinyl Groove · תקליט (`vinyl-groove`)

פינת היי־פיי אחרי השקיעה — פטיפון מעץ אגוז עם תקליט מסתובב, זרוע ומחט, רמקול שהוופר שלו פועם, מנורת קשת באור חמים, מד עוצמה מרצד ותווים שמרחפים באוויר.

A hi-fi corner after dark — a walnut turntable with a record turning, a tonearm on the grooves, a speaker whose woofer thumps, an arc lamp’s warm glow, a level meter’s peaks breathing and music notes floating up.

Cover: `pouch` · overlay `medallion` · exit `lift` · categories: birthday, engagement, corporate, other

Look: A cosy record corner at night in warm lamplight: walnut, brushed aluminium, brass and amber, a record turning under the needle, a kraft record sleeve on the cover with the label as its seal. / פינת תקליטים חמימה בלילה באור מנורה: עץ אגוז, אלומיניום מוברש, פליז וענבר, תקליט שמסתובב מתחת למחט, ובשער עטיפת תקליט מקרטון חום עם התווית כחותם.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/vinyl-groove.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `vinyl-groove/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `label-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `groove-band.webp` | transparent WebP ≤120KB | template:groove-band |
| [ ] `records-panorama.webp` | transparent WebP ≤120KB | template:records-panorama |
| [ ] `turntable.webp` | transparent WebP ≤120KB | template:turntable |
| [ ] `speaker.webp` | transparent WebP ≤120KB | template:speaker |
| [ ] `vinyl-record.webp` | transparent WebP ≤120KB | template:vinyl-record |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
