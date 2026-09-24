# Rooftop at Dusk · גג בשקיעה (`rooftop-dusk`)

כרטיס כניסה וינטג' שנתלש, גגות לבנים בשקיעה, שרשראות אורות ונוף לים. לימי הולדת, מסיבות אירוסין ואירועי חברה — לילי, צבעוני ומלא אנרגיה.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: birthday, engagement, corporate

Upload them to the Supabase Storage bucket `template-media`, folder `rooftop-dusk/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `string-lights.webp` | transparent WebP ≤120KB | template:string-lights |
| [ ] `cocktails.webp` | transparent WebP ≤120KB | template:cocktails |
| [ ] `vinyl.webp` | transparent WebP ≤120KB | template:vinyl |
| [ ] `disco-ball.webp` | transparent WebP ≤120KB | template:disco-ball |
| [ ] `palms.webp` | transparent WebP ≤120KB | template:palms |
| [ ] `confetti.webp` | transparent WebP ≤120KB | template:confetti |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
