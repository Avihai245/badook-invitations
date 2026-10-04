## Video direction

**Palette (from `frame.md`, by role).** Ground = `cream` #FBF7F1 everywhere (one continuous paper world), a very
soft warm `tile` #F3E8DB radial wash in the upper-right corner behind the text column. Type = `ink` #1C1917.
The ONE accent = `coral` (= Badook brown #A0703F): highlight rings, underlines, kicker numbers, pills, the
stopwatch, the end-card pill. `tile-strong` #7A5230 for pressed states and the end card's deep text. `bordeaux`
#731F2E only where the invitation itself appears. The app's own greens/ambers/reds live only inside the
screenshots (and the rebuilt budget gauge, which copies them).

**Type (by role).** Kicker (Heebo 600, brown, e.g. "02 · בית האירוע") → headline (Frank Ruhl Libre, `headline`
role ≈ 88px) → one supporting line (Heebo, `lead`). Hebrew, `dir="rtl"`, right-aligned. Numbers in Frank Ruhl
Libre with `tabular-nums`.

**The house layout (PORTRAIT 1080×1920 — this cut is watched on phones).** Top block (y ≈ 90–430): kicker
(right-aligned, RTL) + headline (Frank Ruhl Libre 500, 100–120px, max 2 lines) + at most one short lead/chip row.
Middle (y ≈ 450–1570): the REAL PHONE SCREEN of the app, big — either a "screen card" (the 390-CSS-wide phone capture
shown 900 px wide = 2.3077 px per CSS px, x 90–990, radius 28, hairline + card shadow, its inner `.world` scrolled /
zoomed to the part being talked about) or a phone device (dark body, radius 64) when the frame is about a guest's
phone. Pills / chips / count-ups sit ON the screen card's edges or in the top block. Nothing below y = 1594: the
bottom band is the caption band. The landscape cut's two-column idea becomes top/bottom stacking here.

The phone captures are 390 CSS px wide at 3× (PNG 1170 px wide; many are full-page and tall). Measured element boxes
are given per frame in CSS px of that 390-wide page — map them with the same formula (X = ox + (x − cx) × scale).
When a box is missing or marked "verify", VIEW the PNG (Python/PIL crop + Read) to locate the element before placing
anything on it.

**Placing anything ON a screenshot (the core trick of this film).** Every screenshot is the real app. Element
boxes are measured from the DOM and given per frame as `[x, y, w, h]` in CSS px of the page (phone captures are 390 CSS px wide at 3× → image px = CSS px × 3). If the screenshot is shown at displayed width `W`
starting at window origin `(ox, oy)` and cropped from CSS offset `(cx, cy)`, then a box maps to screen px as
`X = ox + (x − cx) × W / cropW_css`, same for y. Rings, spotlights, zooms and labels MUST sit exactly on the
named element — compute them from the box, never by eye.

**The recurring "feature language" (the beautiful elements).**
- *Highlight ring* — a 3px brown rounded-rect ring (radius 14) that SVG-draws around the measured box on the
  spoken word (`svg-path-draw`), with a soft brown glow; the rest of the window dims to ~55% (`depth-of-field-blur`
  light, a spotlight cut-out) only while the ring is the subject.
- *Callout pill* — cream pill, brown 1px border, Heebo 600 brown text + a small line-icon, joined to the ring by
  a 1.5px hairline leader; pops in with `spring-pop-entrance` (smooth settle, no bounce).
- *Feature chip* — a solid brown pill with white text and a sparkle/clock/bolt glyph for the system's innovative
  bits ("בזמן אמת", "AI", "אוטומטי"); at most one or two per frame.
- *Zoom-to-target* — the window's inner `.world` scales/translates to frame a measured box (`coordinate-target-zoom`),
  power3 in/out, ≤ 1.8×, never past the screenshot's 2× resolution.
- *Count-ups* — real numbers from the screens count up on their word (`counting-dynamic-scale`, no size growth here).

**Motion grammar.** power3 long-tail settles everywhere; no bounce, no elastic. Reveal model: at t=0 only what the
voice is saying enters; each further piece arrives on its spoken word (times given). Holds are still; the only
aliveness is a subtle low-amplitude jitter on a held hero (`sine-wave-loop`, finite). No lazy breathing, no
back-half drift pans. Internal seams (screen A → screen B in one frame) are velocity-matched cuts
(`cut-catalog.md`: cut-the-curve / inverse zoom-through). All motion inside the paused GSAP timeline; `fromTo`
entrances; no `repeat`, no randomness.

**Rhythm / held frames.** Busy demo frames (03, 08, 09, 11, 12) alternate with calmer ones. Deliberate held reads:
the end of 03 (the four stages), 11 after "חריגה" (the red needle holds a beat), 17 (the free-use card holds to the
last frame).

**Negative list.** No browser chrome, no cursor except where a drag/press is the point (02, 06, 08, 09, 12), no
invented UI except the few small rebuilt components named per frame (budget gauge, drag chip, chat bubbles, review
card), no purple/blue "AI" gradients, no bokeh fields, no emoji, no English UI, no "Avihai/Rotem" anything.
Both failure modes are forbidden: slideshow (everything up front then frozen) and screensaver (things floating).

**Captions.** ONE caption layer only (the assembled captions track, bottom band). Frames never draw their own
subtitle of the voice — the headline/kicker are titles, not captions.

## Practical notes for every frame worker (from the orchestrator) — PORTRAIT CUT

- Canvas 1080×1920. Captions ENABLED: keep every element above y = 1594 (0.83 × 1920).
- All visible text is Hebrew: `dir="rtl"`, `lang="he"`, right-aligned (or centered for hero lines). Fonts: declare
  `@font-face` inside your template for "Heebo" and/or "Frank Ruhl Libre" pointing at
  `assets/fonts/heebo-{hebrew,latin}-{400,500,700}-normal.woff2` and `assets/fonts/frank-ruhl-libre-{hebrew,latin}-{400,500,700}-normal.woff2`
  (Heebo 600 does not ship: use 500 or 700).
- Phone captures: 390 CSS px wide at 3× (1170 px PNG, often very tall). Show a crop by putting the `<img>` in an
  `overflow:hidden` screen card and positioning/scaling an inner `.world` wrapper (that is also what you animate for
  scrolls/zooms). Compute every ring/pill/zoom target from the CSS boxes in your packet; VIEW the PNG when a box is
  missing or marked VERIFY.
- Sizes (phones watch this): headline 100–120px Frank Ruhl Libre 500 (max 2 lines), kicker 36px Heebo 700 brown,
  lead 42px Heebo 500, pills/chips 34px Heebo 500 (padding 16px 30px), big numbers 160–220px. Short copy only.
- Screen card: background #fff, border 1px rgba(28,25,23,.12), radius 28px, box-shadow 0 1px 3px rgba(28,25,23,.08),
  0 24px 60px -24px rgba(60,35,15,.35). Phone device: body #1C1917, radius 64px, 16px bezel, screen radius 50px.
  Ring: 4px #A0703F, radius 16px, glow 0 0 0 8px rgba(160,112,63,.18).
- GSAP: `<script src="assets/vendor/gsap.min.js"></script>` INSIDE the template (the CDN is unreachable), then build
  the paused timeline synchronously; tween positions are the absolute cue times from the packet.
- REFERENCE: the landscape cut of the SAME frame is already built — read it at
  /home/user/badook-invitations/videos/badook-tour/.hyperframes/frame-src/<frame_id>.html to reuse its overlay pieces
  (rebuilt components, timings, copy, ids pattern), then re-lay everything out for portrait with the phone captures.
