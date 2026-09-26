# Pixel Quest · גיימינג (`pixel-quest`)

שלב שמונה־ביט בצהרי היום — שמיים כחולים בפיקסלים, עננים עם קו מתאר, לבבות ושלט LEVEL UP, קוביית סימן שאלה שמקפיצה מטבע, מטבעות באמצע סיבוב וגבעות ירוקות. מסיבה שמתחילה בלחיצה על Start.

An 8-bit level at noon — a pixel-blue sky, outlined clouds, a HUD of hearts and a LEVEL UP banner, a question block popping a coin, coins mid-spin and rolling green hills. A party that starts when you press Start.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: birthday, bar_mitzvah, bat_mitzvah

Look: Crisp 8-bit pixel art on one pixel grid (no smoothing), a side-scrolling level at noon: clouds drifting, a coin popping out of the block, a gold arcade prize ticket on the cover. / פיקסל־ארט חד של שמונה ביט על גריד אחד (בלי החלקה), שלב גלילה בצהרי היום: עננים זזים, מטבע שקופץ מהקובייה, כרטיס פרס זהוב של ארקייד בשער.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/pixel-quest.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `pixel-quest/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `pixel-band.webp` | transparent WebP ≤120KB | template:pixel-band |
| [ ] `hills-panorama.webp` | transparent WebP ≤120KB | template:hills-panorama |
| [ ] `question-block.webp` | transparent WebP ≤120KB | template:question-block |
| [ ] `hearts.webp` | transparent WebP ≤120KB | template:hearts |
| [ ] `controller.webp` | transparent WebP ≤120KB | template:controller |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
