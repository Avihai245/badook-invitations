# Buzzer Beater (זריקה על הבאזר) — the film's pictures

A scroll scene (renderer/scene): the invitation is one film over a pinned backdrop, and these five
pictures are that backdrop. Each one belongs to the section that brings it
(`sectionDefaults.presentation` in `manifest.json`: its `media`, the picture's slow zoom `kenBurns`
and its `drift`); a section without a picture of its own keeps the one before it. The next picture
cross-fades in as its section's top crosses the middle of the screen.

| Key | File | Section | What it shows |
| --- | --- | --- | --- |
| `scene-tunnel` | `scene-tunnel.webp` | the first screen (the names) — also around the phone frame on a computer, blurred | The tunnel to the court |
| `scene-court` | `scene-court.webp` | the opening words (and the parents after them) | The court |
| `scene-arena` | `scene-arena.webp` | the date (the countdown pins itself over it) | The stands |
| `scene-lines` | `scene-lines.webp` | the venue (and the evening's order after it) | The key |
| `scene-rim` | `scene-rim.webp` | the RSVP (and the gifts and the end after it) | Up to the rim |

**Shape:** 9:16 portrait, at least 1080×1920 (the renderer serves each at the screen's width as AVIF
or WebP). **Tone:** one palette across all five, and a calm middle: the texts are white, over a
gradient in the design's shade (`scene.shade`, #0B1220) that is darker at the top and the
bottom, so no picture should be busy in the middle band. Consecutive pictures cross-fade into each
other: the same light, the same horizon height, and they read as one film. No writing, logos or
people.

**The prop.** The app draws the basketball itself: one long arc from the lower left across all five pictures, and the hoop (white backboard, orange rim, white net) in the upper right, which it drops through at the end. So no picture shows a ball or a hoop, and the last keeps its upper right quarter clean and fairly dark.

## Until the real pictures arrive

`node scripts/scene-art/buzzer-beater.mjs` paints the five as illustrations (seeded: every run gives the same
files) into `public/templates/buzzer-beater/` and lists them in
`src/features/invitations/templates/placeholder-media.json`.

## Swapping in the real pictures

1. Upload them to the Supabase bucket `template-media`, folder `buzzer-beater/`, under the file names above
   (docs/template-media.md).
2. `npm run media:sync` (a file in the bucket wins over its placeholder), commit, deploy: the seed
   re-publishes the demos with them.
