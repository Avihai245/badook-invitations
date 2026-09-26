# Tropical Tiki · טרופי (`tropical-tiki`)

שקיעה טרופית מעל הים — שמש ענקית שוקעת במים, עלי דקל מתנדנדים, לפידי טיקי מהבהבים, היביסקוס, מונסטרה ואננס על החוף. מסיבה של קיץ נצחי.

A tropical sunset over the sea — a huge sun sinking into the water, swaying palm fronds, flickering tiki torches, hibiscus, monstera and a pineapple on the beach. An endless-summer party.

Cover: `pouch` · overlay `tag` · exit `lift` · categories: birthday, engagement, other

Look: Tropical dusk: an indigo-to-raspberry-to-gold sky, a violet-teal sea, palm silhouettes, warm torch flames. / שקיעה טרופית: שמיים מאינדיגו לפטל ולזהב, ים סגול־טורקיז, צלליות דקלים, להבות לפידים חמות.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/tropical-tiki.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `tropical-tiki/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `tag-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (used as is) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `palm-band.webp` | transparent WebP ≤120KB | template:palm-band |
| [ ] `lagoon-panorama.webp` | transparent WebP ≤120KB | template:lagoon-panorama |
| [ ] `hibiscus.webp` | transparent WebP ≤120KB | template:hibiscus |
| [ ] `tiki-torch.webp` | transparent WebP ≤120KB | template:tiki-torch |
| [ ] `pineapple.webp` | transparent WebP ≤120KB | template:pineapple |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
