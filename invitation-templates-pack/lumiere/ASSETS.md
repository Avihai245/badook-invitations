# Lumière — photographs

A photographic design: its pictures are the design. They are listed once, in `manifest.json` →
`assets` (the `photo-*` keys); the demo invitations, the gallery's poster and the cover's photo-led
opening all read them from there (`template:photo-*`).

| Key | File | Shape | Used for | What it should show |
| --- | --- | --- | --- | --- |
| `photo-hero` | `photo-hero.webp` | 9:16 portrait, ≥ 1080×1920 | the first screen, the gold-dust opening behind its veil, the gallery poster | the couple (or the celebrant) in soft evening light, faces in the upper third, calm space low for the names |
| `photo-quote` | `photo-quote.webp` | 3:4, ≥ 1200×1600 | the verse, full bleed | an atmosphere shot — hands, rings, a horizon at dusk; darkish, no busy detail in the middle |
| `photo-story` | `photo-story.webp` | 4:5, ≥ 1200×1500 | "our story", beside the text on a computer, above it on a phone (the second hero option too) | an intimate portrait in window light |
| `photo-venue` | `photo-venue.webp` | 3:4, ≥ 1200×1600 | the venue, full bleed with a slow parallax | the place at night — string lights, a garden, a hall |
| `photo-rsvp` | `photo-rsvp.webp` | 3:4, ≥ 1200×1600 | the RSVP (the climax), full bleed with a slow zoom | a warm, dark detail — candles, a table set, glasses |

Pictures sit under a dark scrim where text goes over them (the section's `overlay`), so any photo
reads; each section's focal point keeps the important part in frame on every screen
(`sectionDefaults.presentation` in the manifest). Hosts replace every one of them with their own.

## Until the real photos arrive

`node scripts/make-template-placeholders.mjs lumiere` draws placeholders at these sizes (soft
gradients, light and film grain in the design's palette) into `public/templates/lumiere/` and lists
them in `src/features/invitations/templates/placeholder-media.json`; the design is unlisted
(`"listed": false`) meanwhile — admins see it in the gallery, `/dev/invitations` shows it.

## Swapping in the real photos

1. Upload them to the Supabase bucket `template-media`, folder `lumiere/`, under the file names above
   (docs/template-media.md) — or under new names, and change the paths in `assets` (the one list).
2. `npm run media:sync` (the bucket's file wins over its placeholder), commit, deploy: the seed
   re-publishes the demos with them.
3. Set `"listed": true` in `manifest.json` when the design should appear in the public gallery.
