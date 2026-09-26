# Hoop Stars · כדורסל (`hoop-stars`)

ערב משחק באולם — פרקט מבריק עם קווי מגרש, סל שהרשת שלו מתנדנדת, כדור קופץ, שעון משחק שמראה את התאריך, גופייה עם מספר וזרקורים שסורקים את היציע. לחובבי הכדורסל שבינינו.

Game night at the arena — a polished court with painted lines, a hoop with a swinging net, a bouncing ball, a game clock showing the date, a numbered jersey and spotlights sweeping the stands. For the basketball lovers among us.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: birthday, bar_mitzvah, bat_mitzvah

Look: A basketball arena at night: a glossy maple court with painted lines, a hoop under the rafters, spotlights and a crowd in soft bokeh. / אולם כדורסל בלילה: פרקט מבריק עם קווי מגרש, סל תלוי מהתקרה, זרקורים וקהל מטושטש באורות.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/hoop-stars.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `hoop-stars/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `court-band.webp` | transparent WebP ≤120KB | template:court-band |
| [ ] `arena-panorama.webp` | transparent WebP ≤120KB | template:arena-panorama |
| [ ] `ball.webp` | transparent WebP ≤120KB | template:ball |
| [ ] `jersey.webp` | transparent WebP ≤120KB | template:jersey |
| [ ] `hoop.webp` | transparent WebP ≤120KB | template:hoop |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
