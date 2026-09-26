# Dig It! · חופרים! (`dig-it`)

אתר בנייה לפעוטות — מחפר שמרים דלי מלא, משאית עם פרצוף מחייך, מנוף ששלט ״אזור עבודה״ עם התאריך מתנדנד עליו, קונוסים, ערימות חול וסרט אזהרה. יום הולדת עם קסדות!

A building site for toddlers — an excavator lifting a full bucket, a smiling dump truck, a crane swinging a “work zone” sign with the date, cones, dirt piles and caution tape. A birthday in hard hats!

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: birthday

Look: Chunky toy-like machines with friendly faces (an excavator, a dump truck, a tower crane) on sandy dirt under a pale blue sky, orange cones and yellow-and-black stripes — bright, clean and cheerful, like a picture book for two-year-olds. / מכונות עבודה עגלגלות כמו צעצועים עם פרצופים חמודים (מחפר, משאית, מנוף) על חול בהיר תחת שמיים תכולים, קונוסים כתומים ופסים צהובים־שחורים — בהיר, נקי ושמח, כמו ספר תמונות לבני שנתיים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/dig-it.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `dig-it/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `caution-band.webp` | transparent WebP ≤120KB | template:caution-band |
| [ ] `site-panorama.webp` | transparent WebP ≤120KB | template:site-panorama |
| [ ] `excavator.webp` | transparent WebP ≤120KB | template:excavator |
| [ ] `cone.webp` | transparent WebP ≤120KB | template:cone |
| [ ] `hard-hat.webp` | transparent WebP ≤120KB | template:hard-hat |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
