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

**The house layout (landscape).** RTL reading: the TEXT COLUMN sits on the RIGHT (x ≈ 1290–1840, top-aligned at
y ≈ 120), the REAL SCREEN sits on the LEFT in a "window card" (x ≈ 80–1230): 18px radius, 1px ink@12% hairline,
soft card shadow, NO browser chrome, NO URL bar. A phone = the screenshot inside a dark device body (radius ≈
54px, 14px bezel). Vary it: some frames are centered heroes (01, 11, 14, 17), some are triptychs (10), some put a
phone beside a window (07, 12, 13). Everything important stays in the top 83% (y < 896): the bottom band is the
caption band.

**Placing anything ON a screenshot (the core trick of this film).** Every screenshot is the real app. Element
boxes are measured from the DOM and given per frame as `[x, y, w, h]` in CSS px of the page (desktop screens are
1440 CSS px wide, captured at 2× → image px = CSS px × 2). If the screenshot is shown at displayed width `W`
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

## Practical notes for every frame worker (from the orchestrator)

- Canvas 1920×1080. Captions ENABLED: keep every element above y = 896 (0.83 × 1080).
- All visible text is Hebrew: set `dir="rtl"` and `lang="he"` on text containers; right-align. Fonts: declare
  `@font-face` inside your template for "Heebo" and/or "Frank Ruhl Libre" pointing at the real files
  `assets/fonts/heebo-hebrew-{400,500,700}-normal.woff2`, `assets/fonts/heebo-latin-{400,500,700}-normal.woff2`,
  `assets/fonts/frank-ruhl-libre-hebrew-{400,500,700}-normal.woff2`, `assets/fonts/frank-ruhl-libre-latin-{400,500,700}-normal.woff2`
  (use unicode-range to split Hebrew/Latin, or just declare both files per weight). Heebo 600 does not ship: use 500 or 700.
- Screenshots are real app captures at 2× (desktop: 2880 px wide for the 1440-CSS-px page; phones: 1170×2532 for 390×844).
  Show a screenshot crop by putting the `<img>` inside an `overflow:hidden` window element and positioning/scaling the
  img (or an inner `.world` wrapper you animate for zooms). Compute every ring/pill/zoom target from the measured CSS
  boxes in your packet with the mapping in the Video direction — never eyeball positions.
- Text sizes on screen: headline ≈ 84–96px Frank Ruhl Libre 500, kicker ≈ 30px Heebo 700 brown, lead ≈ 34px Heebo 400,
  pills ≈ 26–28px Heebo 500. Keep copy SHORT (titles, labels, numbers) — never a narration sentence.
- Window card: background #fff, border 1px rgba(28,25,23,.12), radius 18px, box-shadow 0 1px 3px rgba(28,25,23,.08),
  0 18px 48px -18px rgba(60,35,15,.35). Phone: dark body #1C1917, radius 54px, 12–14px bezel, the screenshot inside
  with radius 42px. Ring: 3px #A0703F, radius 14px, outer glow 0 0 0 6px rgba(160,112,63,.18).
- GSAP: load GSAP from the LOCAL file `assets/vendor/gsap.min.js` (`<script src="assets/vendor/gsap.min.js"></script>`, the CDN is unreachable here) with a <script> INSIDE the template, then
  build the paused timeline synchronously. Every tween's position is the absolute cue time in seconds from the packet.
