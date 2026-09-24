# Jet-Set Passport · דרכון (`jet-set`) · premium

תעופה רטרו — מסגרת של דואר אוויר, חותמות ויזה, מסלול טיסה מקווקו עם מטוס, ברקוד ותג מזוודה. כרטיס עלייה למטוס אל האירוע שלכם.

Retro air travel — an airmail chevron border, visa stamps, a dashed flight path with a plane, a barcode stub and a luggage tag. A boarding pass to your celebration.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: wedding, save_the_date, corporate, bat_mitzvah

Look: 1960s travel ephemera: an airmail envelope, ink stamps, a paper ticket, a leather luggage tag. / חומרי נסיעות משנות ה־60: מעטפת דואר אוויר, חותמות דיו, כרטיס טיסה, תג מזוודה מעור.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/jet-set.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/jet-set/`. Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `airmail-band.webp` | transparent WebP ≤120KB | template:airmail-band |
| [ ] `flight-panorama.webp` | transparent WebP ≤120KB | template:flight-panorama |
| [ ] `stamps.webp` | transparent WebP ≤120KB | template:stamps |
| [ ] `luggage-tag.webp` | transparent WebP ≤120KB | template:luggage-tag |
| [ ] `plane.webp` | transparent WebP ≤120KB | template:plane |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
