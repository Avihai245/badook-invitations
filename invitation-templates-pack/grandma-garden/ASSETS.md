# Grandma’s Garden · הגן של סבתא (`grandma-garden`)

גן כפרי אנגלי באור בוקר רך — ורדים מטפסים, לבנדר ומלוות שמתנדנדים ברוח, גדר עץ לבנה עם אדום־חזה, כוס תה מהבילה, מזלף ופרפרים. חם, רך ומלא אהבה — לימי הולדת של סבים וסבתות ולמפגשי משפחה.

An English cottage garden in soft morning light — climbing roses, lavender and hollyhocks swaying in the breeze, a white picket fence with a robin, a steaming teacup, a watering can and butterflies. Warm, gentle and full of love — for grandparents’ birthdays and family gatherings.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: birthday, other, baby_shower

Look: A soft morning garden: pale blue-and-peach sky, pink roses, purple lavender, sage green and a white fence. / גן בוקר רך: שמיים תכולים־אפרסקיים, ורדים ורודים, לבנדר סגול, ירוק מרווה וגדר לבנה.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/grandma-garden.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `grandma-garden/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `seal-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `rose-band.webp` | transparent WebP ≤120KB | template:rose-band |
| [ ] `garden-panorama.webp` | transparent WebP ≤120KB | template:garden-panorama |
| [ ] `teacup.webp` | transparent WebP ≤120KB | template:teacup |
| [ ] `watering-can.webp` | transparent WebP ≤120KB | template:watering-can |
| [ ] `rose.webp` | transparent WebP ≤120KB | template:rose |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
