# Match Day · יום משחק (`match-day`)

ערב באצטדיון — פסי דשא מכוסח, עיגול אמצע בגיר, כדור, לוח תוצאות, מספר על החולצה וזרקורים. לחובבי הכדורגל שבינינו.

A night at the stadium — mowed stripes, a chalk centre circle, a ball, a split-digit scoreboard, a jersey number and floodlights. For the football fans among us.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: bar_mitzvah, birthday

Look: A football pitch at night: mowing stripes, white chalk, floodlights, glow and dust in the air. / מגרש כדורגל בלילה: פסי כיסוח, גיר לבן, זרקורים, הילת אור ואבק באוויר.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/match-day.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `match-day/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `stripes-band.webp` | transparent WebP ≤120KB | template:stripes-band |
| [ ] `stadium-panorama.webp` | transparent WebP ≤120KB | template:stadium-panorama |
| [ ] `ball.webp` | transparent WebP ≤120KB | template:ball |
| [ ] `scoreboard.webp` | transparent WebP ≤120KB | template:scoreboard |
| [ ] `trophy.webp` | transparent WebP ≤120KB | template:trophy |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
