---
format: 1920x1080
duration: 168s
message: "באדוק — כל האירוע במקום אחד, מהרעיון הראשון ועד הרגע האחרון. מתחילים בחינם."
arc: Welcome → Plan (start, home) → Design (gallery, AI, edit) → Invite (share, guests, RSVPs) → Organize (tasks, budget, seating) → Celebrate (event day, live gallery, film) → Help → Free to start
audience: hosts planning a wedding or a family event in Israel (Hebrew speakers)
mode: autonomous
music: none
language: he
direction: rtl
---

# STORYBOARD — Badook, the full tour (סיור מלא במערכת)

The user's own recording narrates the whole film, verbatim (`audio_meta.json`; one clip per frame, cut at the
pauses). Every frame's duration IS its voice clip — the cut lands exactly on the recording. Every cue time below
is a real word time from that recording (frame-relative seconds).

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

---

## Frame 1 — ברוכים הבאים

- scene: The real invitation of נועה & איתי opens on a phone while Badook's promise builds beside it
- voiceover: "ברוכים הבאים לבאדוק — מקום אחד שבו מתכננים את האירוע, מזמינים את האורחים ומנהלים הכול עד הרגע האחרון. בואו נראה איך זה עובד."
- duration: 10.306s
- transition_in: crossfade
- status: animated
- src: compositions/frames/01-intro.html
- type: hook
- persuasion: Show-don't-tell proof (the product's own output, the invitation, is the opening image)
- beat: curiosity + aspiration
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/invite-open.mp4 — the sample invitation recorded on a phone: envelope opens, names, countdown; assets/badook-logo.png — Badook wordmark
- focal: assets/invite-open.mp4
- roles: invite-open.mp4 = cutout (phone hero) · badook-logo.png = supporting
- sfx: none

narrativeRole: open on the thing people actually send — a living invitation — and name the promise.
keyMessage: one place for the whole event.

Adapt: keep the device-surface-showcase signature (a held device whose screen plays a real flow); the flow is
the invitation itself, and the text column builds the promise in three verbs instead of feature titles.

Layout: asymmetric 40/60 mirrored for RTL — the phone (screen 390×844 CSS → displayed ≈ 380×822 px, device ≈
408×850) sits LEFT-of-center at x ≈ 560 center, y 36–886; the text column RIGHT (x 1180–1840).
The phone plays `invite-open.mp4` from its t=0 at frame t=0 (muted; declared as an approved frame video, hoisted by
the assembler at FIXED host geometry: screen x 370, y 50, width 380, height 822, fit cover), so the envelope opens at
≈1.5s and the names land at ≈4s; it plays through 10.3s (the countdown scroll starts at ≈6.5s). Because the video is
hoisted, the device (bezel, shadow, notch) is drawn around those exact coordinates and NEVER moves or scales — the
phone's entrance is the bezel + shadow fading in (0–0.6s) around a video that is already playing.

Scene 1 (0.0–1.9s): cream ground; the phone's bezel + shadow bloom in around the playing video (power3). In the text
column: "ברוכים הבאים ל־" (Heebo `lead`) and at 1.0s the Badook logo PNG (≈ 360px wide) lands beside it with
`spring-pop-entrance` (smooth).
Scene 2 (1.9–8.9s): the promise builds as a stacked list under the logo — at 1.9s the line "מקום אחד" (Frank Ruhl,
`display` size, ink) via per-word reveal; then three verb rows each with a small brown numbered dot reveal on their
word: 3.0s "מתכננים את האירוע", 4.5s "מזמינים את האורחים", 6.0s "מנהלים הכול"; at
7.4s a brown hand-drawn underline draws under "עד הרגע האחרון" (a fourth, smaller line).
Meanwhile the phone shows the envelope opening into "נועה & איתי".
Scene 3 (8.9–10.306s): "בואו נראה איך זה עובד" — the promise lines step back (opacity 0.35) and a brown pill
"סיור במערכת ←" (arrow pointing left, RTL "onward") slides in under them at 8.9s; a soft brown glow blooms behind the
phone (`ambient-glow-bloom`, finite). Hold.

## Frame 2 — מתחילים באירוע חדש

- scene: The start wizard in three steps, each choice lighting up on its word, then a stopwatch shows "under a minute"
- voiceover: "מתחילים באירוע חדש: בוחרים את סוג האירוע, מוסיפים תאריך, מספר אורחים משוער ותקציב, ובוחרים מאיפה להתחיל. פחות מדקה, והאירוע מוכן."
- duration: 11.636s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/02-start.html
- type: product_intro
- persuasion: Friction reduction
- beat: ease + clarity
- blueprint: device-surface-showcase (Adapt — cursorless stepwise flow)
- asset_candidates: assets/screen-wizard-1.png — wizard step 1, event types; assets/screen-wizard-2.png — wizard step 2, names/date/guests/budget filled; assets/screen-wizard-3.png — wizard step 3, where to start
- focal: assets/screen-wizard-2.png
- roles: screen-wizard-1.png = supporting · screen-wizard-2.png = cutout · screen-wizard-3.png = supporting
- sfx: none

narrativeRole: the first minute — show how little it takes to start.
keyMessage: under a minute and the event exists.

Adapt: keep the stepwise-flow signature (one held window whose screen advances step → step); add rings on each
field and a stopwatch payoff.

Layout: window LEFT showing the wizard's central column — crop CSS x 280–1200, y 0–900 (920×900 CSS) displayed
at ≈ 900×880 px (x 120–1020, y 24–904 → keep the window bottom ≤ 880 by cropping y 0–880). Text column RIGHT:
kicker "01 · מתחילים", headline "אירוע חדש", lead "שלוש שאלות קצרות".
Boxes (CSS px, page 1440×900): wizard-1 `type-wedding` [1010,222,162,143]; wizard-2 `f-names` [752,250,392,66],
`f-date` [752,331,392,90], `f-guests` [344,331,392,90], `f-budget` [752,437,392,90], `next` [316,812,103,48];
wizard-3 `opt-plan` [895,222,277,182], `opt-design` [605,222,277,182], `opt-all` [316,222,277,182], `go` [316,812,142,48].

Scene 1 (0.0–2.2s): window slides up with wizard-1; kicker + headline reveal at 0.3s ("מתחילים").
Scene 2 (2.2–3.7s): 2.2s ring draws on `type-wedding`; at 3.1s a press (`press-release-spring`) on the tile.
Scene 3 (3.7–7.0s): cut-the-curve (leftward) to wizard-2; rings move field to field on their words: 4.4s `f-date`
("תאריך"), 5.3s `f-guests` ("אורחים"), 6.4s `f-budget` ("ותקציב") — one ring at a time, travelling.
Scene 4 (7.0–9.2s): cut-the-curve to wizard-3; the three option cards ring in turn at 7.0s, 7.6s, 8.1s, the last
(`opt-all`, "הכל · מומלץ") keeps a glowing ring.
Scene 5 (9.2–11.636s): a brown stopwatch chip (circle ring + "00:45") pops beside the window's top-right corner at
9.2s, its ring SVG-draws and the digits count 00:00→00:45 by 10.3s; at 10.3s a brown check badge pops on `go`
("יוצאים לדרך") and the text column's lead becomes "והאירוע מוכן". Hold.

## Frame 3 — בית האירוע

- scene: The event home — countdown, next step, budget, RSVPs, tasks ring in turn, then the four stages
- voiceover: "בית האירוע מראה הכול במבט אחד: ספירה לאחור, הצעד הבא שכדאי לעשות עכשיו, מד התקציב, אישורי ההגעה והמשימות. והכול מסודר בארבעה שלבים: מתכננים, מזמינים, מסדרים וחוגגים."
- duration: 16.932s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-home.html
- type: feature_showcase
- persuasion: Value stacking
- beat: clarity + control
- blueprint: device-surface-showcase (Adapt — floating-window tour with targeted zooms)
- asset_candidates: assets/screen-home.png — event home full page with countdown, next step, three widgets and the road map
- focal: assets/screen-home.png
- roles: screen-home.png = cutout
- sfx: none

narrativeRole: the hub — everything at a glance.
keyMessage: one screen tells you where you stand and what to do next.

Adapt: keep the held-window tour; the "camera work" is targeted zooms + rings on measured boxes, then one vertical
travel down the page to the road map.

Layout: window LEFT x 80–1230 (1150 px wide) showing the full 1440-wide page (scale 1150/1440 = 0.7986 px per CSS
px), first the top (CSS y 0–1000 → 799 px tall, window y 60–860). Text column RIGHT: kicker "02 · בית האירוע",
headline "הכול במבט אחד".
Boxes (CSS px, page 1440×1416): `countdown-days` [265,231,112,94]; `next-step` [72,441,1080,140]; `budget-widget`
[437,601,349,338]; `rsvp-widget` [803,601,349,338]; `tasks-widget` [72,601,349,338]; road map cards `road-plan`
[891,995,261,123], `road-invite` [618,995,261,123], `road-arrange` [345,995,261,123], `road-celebrate`
[72,995,261,123]; sidebar groups `side-plan` [1189,225,239,28], `side-invite` [1189,397,239,28], `side-arrange`
[1189,569,239,28], `side-celebrate` [1189,639,239,28].

Scene 1 (0.0–3.2s): window enters (rises + fades, power3); headline per-word reveal on "במבט אחד" (2.0s).
Scene 2 (3.2–4.5s): "ספירה לאחור" — zoom-to-target ≈1.5× on `countdown-days`, ring + pill "256 ימים" (count-up
0→256 inside the pill).
Scene 3 (4.5–6.9s): zoom glides to `next-step` (≈1.15×), ring around the green card, pill "הצעד הבא — תמיד דבר אחד".
Scene 4 (6.9–10.6s): zoom out to 1.0 over the three widgets; rings one at a time on their words — 6.9s
`budget-widget` (pill "44% · בטוחים"), 8.1s `rsvp-widget` (pill "24 מגיעים"), 9.2s `tasks-widget` (pill "72 משימות").
Scene 5 (10.6–16.932s): the page scrolls inside the window to CSS y≈560 (road map in view) with a smooth power3
travel (10.6–11.6s). Then the four stage cards light up in order on their words — 13.0s `road-plan`, 13.9s
`road-invite`, 15.0s `road-arrange`, 15.7s `road-celebrate` (ring + the card lifts 6px) — and in the text column a
vertical 1-2-3-4 stage list assembles in sync (brown numbered circles + the stage names, `grid-card-assemble`).
Held read from 15.9s.

## Frame 4 — בוחרים עיצוב

- scene: The design gallery — 60+ animated designs, all already showing נועה & איתי, glide past
- voiceover: "בוחרים הזמנה מתוך יותר משישים עיצובים מונפשים, עם מוזיקה ואנימציה, שמותאמים לסוג האירוע."
- duration: 7.506s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/04-design.html
- type: feature_showcase
- persuasion: Statistical proof (breadth)
- beat: excitement + belonging
- blueprint: grid-card-assemble (Adapt — 3D page-scroll reveal)
- asset_candidates: assets/screen-designs.png — design gallery full page, a grid of invitation cards personalised נועה & איתי
- focal: assets/screen-designs.png
- roles: screen-designs.png = cutout
- sfx: none

narrativeRole: open the design chapter with abundance.
keyMessage: 60+ animated designs, made for your kind of event.

Adapt: the grid already exists in the screenshot; the assemble becomes a tilted 3D page whose content scrolls
(`3d-page-scroll`) while a count-up carries "60+".

Layout: centered-left — the gallery page as a large window (crop CSS x 48–1176 = content area without the right
nav, displayed 1150 px wide) tilted ≈ 8° rotateX / −6° rotateY, x 70–1240; text column RIGHT: kicker "03 · עיצוב",
a giant count-up number "60+" (`number-hero`, brown) and the line "עיצובים מונפשים".
Boxes (CSS px, page 1440×3626): the category chips row y ≈ 215–300 (x 48–1176); the first card row starts y ≈ 420.

Scene 1 (0.0–2.1s): tilted window enters from below; kicker reveal.
Scene 2 (2.1–4.0s): on "משישים" (2.1s) the number counts 0→60 and the "+" pops at 2.6s; inside the window the page
scrolls (power3, finite) from y≈380 to y≈1700 CSS so rows of invitation cards pass (2.1–6.6s total travel).
Scene 3 (4.0–7.506s): two feature chips pop under the number on their words — 4.3s "מוזיקה" (note glyph), 4.8s
"אנימציה" (sparkle glyph); at 5.5s "מותאם לסוג האירוע" lead line reveals; the scroll settles at 6.6s; hold.

## Frame 5 — עצבו לי

- scene: Upload a few photos and "עצבו לי" builds a design inspired by them — colours, mood, style
- voiceover: "רוצים משהו אישי? מעלים כמה תמונות, ועצבו לי בונה עיצוב בהשראתן: צבעים, אווירה וסגנון."
- duration: 8.214s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-ai.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: intrigue → delight
- blueprint: agent-progress-theater (Adapt)
- asset_candidates: assets/screen-studio.png — the "עצבו לי" dialog over the gallery; assets/photo-couple.jpg — couple at sunset; assets/photo-chuppah.jpg — chuppah on the beach; assets/photo-venue.jpg — the lit hall; assets/screen-designs.png — design cards (for the resulting design)
- focal: assets/screen-studio.png
- roles: screen-studio.png = cutout · photo-couple.jpg = supporting · photo-chuppah.jpg = supporting · photo-venue.jpg = supporting · screen-designs.png = supporting (crop of one card)
- sfx: none

narrativeRole: the AI moment — personal, not generic.
keyMessage: your photos become your design.

Adapt: keep the trigger → working-state → receipt shape; the trigger is three photos dropping in, the working state
is a short "בונה עיצוב…" shimmer, the receipt is a design card + three swatch chips.

Layout: window LEFT showing screen-studio.png cropped to the dialog region (CSS [440,151,560,598] plus 40px
margin) displayed ≈ 700×750; text column RIGHT: kicker "04 · עצבו לי" + feature chip "AI", headline "משהו אישי".

Scene 1 (0.0–1.9s): window with the dialog enters; headline reveals at 0.3s ("רוצים משהו אישי?").
Scene 2 (1.9–3.2s): "מעלים כמה תמונות" — three photo cards (photo-couple, photo-chuppah, photo-venue; 4:5, 200px,
white 8px border, small tilt) fly in one after another (1.9s, 2.3s, 2.7s) and stack over the dialog's left side.
Scene 3 (3.2–5.8s): "ועצבו לי בונה עיצוב" — a brown sparkle chip "עצבו לי" pops at 3.2s; a soft shimmer sweep crosses
the stacked photos (finite, once), and at 4.3s a design card (crop of one bordeaux invitation card from
screen-designs.png, CSS ≈ [1000,420,170,300]) rises out of the stack and scales into the window's center (inverse
zoom-through).
Scene 4 (5.8–8.214s): three swatch chips land beside the card on their words — 5.8s "צבעים" (three dots: bordeaux
#731F2E, cream, gold), 6.4s "אווירה", 7.1s "סגנון". Hold.

## Frame 6 — עורכים ומשתפים את המשפחה

- scene: The editor — text fields ring and the live phone preview answers; a family draft gathers comments; then publish
- voiceover: "עורכים את הטקסטים, התאריך והמקום, ורואים כל שינוי מיד. אפשר לשלוח טיוטה למשפחה, לקבל הערות, ורק אז לפרסם."
- duration: 10.247s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-edit.html
- type: feature_showcase
- persuasion: Risk reversal (review before you publish)
- beat: control + peace of mind
- blueprint: panel-edit-live-sync (Adapt)
- asset_candidates: assets/screen-editor.png — the invitation editor with live phone preview and the section form
- focal: assets/screen-editor.png
- roles: screen-editor.png = cutout
- sfx: none

narrativeRole: you're in control of every word, and the family can weigh in first.
keyMessage: edit live, review with family, publish when ready.

Adapt: keep the panel ↔ live-surface couple (the field rings, the phone answers in the same beat); add a small
rebuilt review card for the family comments, then a publish press.

Layout: window LEFT-to-CENTER x 70–1250 showing the full editor (1440×900 CSS displayed 1180 px → 0.8194 px/CSS
px, 737 px tall, window y 70–807). Text column RIGHT: kicker "05 · עורכים", headline "רואים כל שינוי מיד".
Boxes (CSS px, page 1440×900): `phone` [217,102,326,706]; `field-open` [798,264,325,93]; `field-place`
[798,468,325,93]; `comments` [291,12,83,32] (הערות); `preview` [154,12,129,32]; `publish` [12,12,134,32]
(פרסום השינויים); sections list `sec-cover` [1267,117,131,44] … `sec-rsvp` [1267,577,125,44].

Scene 1 (0.0–1.2s): window enters; headline reveal at 0.3s.
Scene 2 (1.2–3.2s): rings on their words — 1.2s `field-open` ("הטקסטים"), 2.4s `field-place` ("והמקום"); with each
ring, a brown hairline arc draws from the field to the `phone` box (the live link).
Scene 3 (3.2–5.4s): "ורואים כל שינוי מיד" — zoom-to-target ≈1.25× on `phone`, a brown "מתעדכן בזמן אמת" feature
chip with a small live dot pops at its top edge (3.8s).
Scene 4 (5.4–8.6s): zoom back to 1.0; 5.8s ring on `comments`; a rebuilt review card (cream, 300px wide, title
"טיוטה למשפחה" + two comment bubbles "אמא: מהמם!" and "סבתא שושנה: להוסיף את שעת החופה" in Heebo) slides out beneath the button at 6.3s, bubbles appear 6.8s and 7.8s ("לקבל הערות").
Scene 5 (8.6–10.247s): review card tucks away; 9.3s press on `publish` (`press-release-spring`) and a brown check pill
"פורסם" pops next to it. Hold.

## Frame 7 — קישור, QR וקישור אישי

- scene: After publishing — the invitation's own link and QR, then a guest's personal link greets them by name and fills the RSVP for them
- voiceover: "אחרי הפרסום, להזמנה יש קישור משלה וקוד QR. וכל מוזמן מקבל קישור אישי, שפונה אליו בשם וממלא את הפרטים בשבילו."
- duration: 10.27s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/07-share.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: delight + trust
- blueprint: video-text-pivot (Adapt)
- asset_candidates: assets/screen-share.png — share page with link, QR and WhatsApp preview; assets/phone-personal-hero.png — personal link greeting "משפחת דהן, מחכים לכם!"; assets/phone-personal-rsvp.png — the RSVP form prefilled with the guest's name and phone
- focal: assets/phone-personal-hero.png
- roles: screen-share.png = supporting · phone-personal-hero.png = cutout · phone-personal-rsvp.png = cutout
- sfx: none

narrativeRole: the invite chapter opens — sharing is instant, and personal.
keyMessage: one link for everyone, plus a personal link per guest that knows their name.

Adapt: keep the pivot (the share window holds, then slides aside to hand the weight to the phone); the "hero stat" is
the personal greeting.

Layout: Scene 1–2 window LEFT (share page, crop CSS x 48–1176, y 60–940, displayed 1150 px). Scene 3–4 the window
slides left and shrinks to ≈ 70% and dims to 60%; a phone (screen 390×844 displayed 360×779, device ≈ 386×805) enters
at x ≈ 1000 center, y 50–855, overlapping the window's right edge; text column RIGHT.
Boxes (CSS px, page 1440×1018): `link-field` [704,333,427,40] (https://invitations.badooks.com/i/noa-ve-itay);
`qr` [374,718,159,159]; `wa-preview` [213,335,320,338]; `personal` [72,164,1080,98]. Phone screens: the greeting line
"משפחת דהן, מחכים לכם!" is at CSS ≈ [100,222,190,30] of phone-personal-hero.png (390-wide); the prefilled fields on
phone-personal-rsvp.png are at CSS ≈ [62,380,266,150].

Scene 1 (0.0–2.5s): window enters; kicker "06 · משתפים", headline "קישור משלה".
Scene 2 (2.5–4.9s): 2.5s ring on `link-field` + pill "קישור משלה"; 3.6s zoom-to-target on `qr` (≈1.6×) + ring.
Scene 3 (4.9–8.1s): the window slides aside; the phone enters showing phone-personal-hero.png; 6.1s feature chip
"קישור אישי לכל מוזמן"; 7.4s a brown marker highlight sweeps under the greeting "משפחת דהן, מחכים לכם!" ("בשם").
Scene 4 (8.1–10.27s): inside the phone, cut-the-curve (upward) to phone-personal-rsvp.png; at 8.5s the prefilled
name/phone fields ring ("וממלא את הפרטים בשבילו"). Hold.

## Frame 8 — מזמינים בוואטסאפ

- scene: The guest list from Excel, sent on WhatsApp — from Badook's number or your own, one after another
- voiceover: "מעלים את רשימת המוזמנים מקובץ אקסל, ושולחים לכולם בוואטסאפ: מהמספר של באדוק, או מהוואטסאפ שלכם, אחד אחרי השני."
- duration: 9.495s
- transition_in: crossfade
- status: animated
- src: compositions/frames/08-guests.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease + momentum
- blueprint: cursor-ui-demo (Adapt — static stage, element swaps)
- asset_candidates: assets/screen-guests.png — guest list with Excel upload, WhatsApp sending and stats; assets/screen-whatsapp.png — "send from my WhatsApp" dialog, one guest at a time
- focal: assets/screen-guests.png
- roles: screen-guests.png = cutout · screen-whatsapp.png = supporting
- sfx: none

narrativeRole: getting the invitation to everyone.
keyMessage: upload once, send on WhatsApp.

Adapt: locked stage; the "camera work" is rings + a file chip flying into the upload button, then a swap to the
dialog where the same send repeats.

Layout: window LEFT showing guests page (crop CSS x 48–1176, y 60–900, displayed 1150 px). Text column RIGHT: kicker
"07 · מזמינים", headline "וואטסאפ לכולם".
Boxes (CSS px, page 1440×3471): `excel` [917,233,210,48]; `send-mine` [367,233,220,48] (שליחה מהוואטסאפ שלי);
`send-auto` [200,233,160,48] (שליחה אוטומטית); `st-list` [982,374,170,157] (40), `st-sent` [800,374,170,157] (34);
screen-whatsapp.png (1440×900): `dialog` [440,297,560,307], `open-wa` [815,539,161,40].

Scene 1 (0.0–2.2s): window enters; headline reveal.
Scene 2 (2.2–3.0s): a rebuilt file chip "מוזמנים.xlsx" (green sheet glyph, cream card) flies from the text column into
`excel`, press on the button at 2.6s; the `st-list` number counts 0→40.
Scene 3 (3.0–5.0s): "ושולחים לכולם בוואטסאפ" — `st-sent` counts 0→34 and a WhatsApp-green feature chip "וואטסאפ"
pops (3.5s).
Scene 4 (5.0–7.9s): rings on their words — 5.0s `send-auto` (pill "מהמספר של באדוק"), 6.6s `send-mine` (pill
"מהוואטסאפ שלכם").
Scene 5 (7.9–9.495s): cut (inverse zoom-through) to screen-whatsapp.png: the dialog in focus; presses on `open-wa`
at 7.9s and 8.7s, a small counter pill beside the dialog steps "1 / 6" → "2 / 6" → "3 / 6" ("אחד אחרי השני"). Hold.

## Frame 9 — אישורי הגעה בזמן אמת

- scene: RSVPs update live — who's coming, how many, who isn't, who hasn't answered; a general-link reply assigned in one click
- voiceover: "אישורי ההגעה מתעדכנים בזמן אמת: מי מגיע, כמה אנשים, מי לא, ומי עוד לא ענה. תשובה שהגיעה מהקישור הכללי משייכים למוזמן בלחיצה אחת."
- duration: 12.076s
- transition_in: crossfade
- status: animated
- src: compositions/frames/09-rsvp.html
- type: feature_showcase
- persuasion: Statistical proof (live counts)
- beat: control + relief
- blueprint: dataviz-countup (Adapt)
- asset_candidates: assets/screen-responses.png — RSVP page with stat cards, general-link banner and responses table
- focal: assets/screen-responses.png
- roles: screen-responses.png = cutout
- sfx: none

narrativeRole: the payoff of inviting — answers arrive by themselves.
keyMessage: live numbers, no spreadsheets.

Adapt: the real stat cards are the instruments; each counts up on its word; one press resolves the general-link reply.

Layout: window LEFT (crop CSS x 48–1176, y 60–860, displayed 1150 px). Text column RIGHT: kicker "08 · אישורי הגעה",
headline "בזמן אמת" + a feature chip with a live dot.
Boxes (CSS px, page 1440×2076): `r-yes` [949,155,203,157] (24 · 54 אנשים), `r-total` [730,155,203,157] (27),
`r-no` [510,155,203,157] (3), `r-pending` [291,155,203,157] (14), `general` [72,328,1080,70], `assign`
[91,347,162,32] (לשיוך ברשימת המוזמנים).

Scene 1 (0.0–2.0s): window enters; headline per-word reveal.
Scene 2 (2.0–3.1s): "בזמן אמת" chip pops with a live dot whose single finite pulse runs 2.0–3.1s.
Scene 3 (3.1–7.5s): rings + count-ups on their words — 3.1s `r-yes` (number in the card is covered by an overlay that
counts 0→24, matched font/position), 4.0s pill "54 אנשים" on the same card, 5.0s `r-no` (0→3), 5.9s `r-pending` (0→14).
Scene 4 (7.5–12.076s): 7.5s ring on the `general` banner (pill "מהקישור הכללי"); 9.6s cursor glides to `assign` and
clicks (`cursor-click-ripple`), at 10.8s a brown check toast "שויך למוזמן" pops above the banner. Hold.

## Frame 10 — מתכננים: משימות, ספקים, רעיונות

- scene: Three planning tools in a triptych — the task timeline, vendors with quotes, the ideas board
- voiceover: "בתכנון מחכה לכם רשימת משימות לפי לוח זמנים, ספקים עם הצעות מחיר, ולוח רעיונות להשראה."
- duration: 7.882s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/10-tasks.html
- type: feature_showcase
- persuasion: Rule of three
- beat: calm + organized
- blueprint: grid-card-assemble (Adapt — triptych)
- asset_candidates: assets/screen-tasks.png — task timeline checklist; assets/screen-vendors.png — vendors board with quotes; assets/screen-ideas.png — ideas board with notes
- focal: assets/screen-vendors.png
- roles: screen-tasks.png = supporting · screen-vendors.png = cutout · screen-ideas.png = supporting
- sfx: none

narrativeRole: the planning chapter — the toolbox.
keyMessage: everything to plan, in one place.

Adapt: three window cards assemble in a staggered cascade, each on its word, then hold.

Layout: triptych across the top ~78%: three window cards each ≈ 560×560 at x 80/680/1280 (RTL order: the FIRST card is
the RIGHTMOST) with a title under each (Heebo 600). Above them: kicker "09 · מתכננים". Crops: tasks CSS
[60,300,1100,1100] (the timeline list); vendors CSS [60,520,1100,1100] (the status board with cards: אחוזת הגפן
₪25,500 ★5, קייטרינג שפע ₪24,500); ideas CSS [60,330,1100,1100] (notes).
Boxes: vendors `booked`-column card "אחוזת הגפן" ≈ CSS [1140,1565,…] is on the status board — ring the board's
first column of cards; ideas `pinned` [800,396,352,154], `songs` [800,593,352,255].

Scene 1 (0.0–1.7s): kicker reveal; empty stage.
Scene 2 (1.7–4.0s): 1.7s the right card (tasks) assembles (rises + fades) with title "משימות לפי לוח זמנים".
Scene 3 (4.0–5.9s): 4.0s the middle card (vendors) assembles, title "ספקים והצעות מחיר"; a pill "₪24,500 · הצעת מחיר"
pops on the quote card.
Scene 4 (5.9–7.882s): 5.9s the left card (ideas) assembles, title "לוח רעיונות"; ring on the pinned note. Hold.

## Frame 11 — מד התקציב

- scene: The budget gauge swings green → amber → red on the words, then expenses, payments and the guest-count what-if
- voiceover: "מד התקציב מראה מיד איפה אתם עומדים: ירוק, בטוחים. צהוב, מתקרבים לגבול. אדום, חריגה. מוסיפים הוצאות ותשלומים, ובודקים מה יקרה אם ישתנה מספר האורחים."
- duration: 14.516s
- transition_in: crossfade
- status: animated
- src: compositions/frames/11-budget.html
- type: feature_showcase
- persuasion: Future pacing (see the risk before it happens)
- beat: anxiety → control
- blueprint: dataviz-countup (Adapt — gauge as the hero instrument)
- asset_candidates: assets/screen-budget.png — budget page with the semicircle gauge, figure cards, guests basis and payments
- focal: assets/screen-budget.png
- roles: screen-budget.png = cutout
- sfx: none

narrativeRole: the budget's single most innovative piece — a gauge that tells you, not a spreadsheet.
keyMessage: green, amber, red — you always know where you stand.

Adapt: the gauge is REBUILT as one moving component exactly over the screenshot's gauge (the only rebuilt UI in the
frame), so its needle can swing on the words; everything else is the screenshot.

Layout: centered hero first — the gauge card (CSS [72,200,1080,408]) zoomed so it fills x 160–1760 (≈1.48 px/CSS px),
centered; later zoom out to the full page window LEFT with the text column RIGHT (kicker "10 · תקציב", headline
"איפה אתם עומדים").
Boxes (CSS px, page 1440×3503): `gauge` [753,229,360,199] (the SVG semicircle: pivot at CSS ≈ (933,408), radius ≈ 165,
0% at the RIGHT end, 100% at the LEFT end — the app's arc runs right→left); `pct` [893,425,80,65] ("44%");
`safe` [851,517,164,28] ("אתם בטוחים בתקציב"); `add` [180,108,138,40] (הוספת הוצאה); `edit` [431,295,62,26] (שינוי);
`basis` [72,628,1080,180] (אורחים ושיטת חישוב · 240 צפויים); `payments` [72,827,380,228].
Rebuilt gauge: cover the screenshot's gauge area with a cream plate, draw the same arc (green #15803D-ish from 0–60%,
amber #D97706 60–85%, red #DC2626 85–100%+, matching the screenshot's colors), the ink needle, the pivot dot, and the
big percent text below in the screenshot's font size; percent counts with the needle; a status pill under it changes
text+color with the zone.

Scene 1 (0.0–2.5s): the gauge card hero enters (zoomed); needle at 0%, percent "0%".
Scene 2 (2.5–3.5s): needle sweeps up to 44% (2.5–3.4s, power3), percent counts to 44%.
Scene 3 (3.5–5.4s): "ירוק, בטוחים" — the green zone glows; pill "בטוחים" (green text on pale green) pops at 4.1s.
Scene 4 (5.4–7.7s): "צהוב, מתקרבים לגבול" — needle swings to 78% (5.4–6.0s), amber glow, pill "מתקרבים לגבול" at 6.2s.
Scene 5 (7.7–9.7s): "אדום, חריגה" — needle swings to 104% (7.7–8.2s) past the red end, red glow, pill "חריגה" at 8.4s;
HOLD still 8.6–9.6s (the held beat), then the needle eases back to 44% (9.4–9.9s) and the pill returns to "בטוחים".
Scene 6 (9.7–14.516s): zoom out to the full page window (9.7–10.4s); rings on their words — 10.3s `add` (pill
"הוצאה חדשה"), 10.8s `payments` (pill "תשלומים"), 12.2s `basis` with a what-if chip "240 → 260 אורחים" whose number
ticks 240→260 at 13.2s. Hold.

## Frame 12 — סידור שולחנות

- scene: Drag a whole family onto a table on the hall plan, then every guest gets their table on their phone
- voiceover: "את סידור השולחנות עושים בגרירה: מושיבים משפחות שלמות, מסדרים על תוכנית האולם, ושולחים לכל אורח את מספר השולחן שלו."
- duration: 9.243s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/12-seating.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: satisfaction + control
- blueprint: cursor-ui-demo (Adapt)
- asset_candidates: assets/screen-seating.png — seating canvas with tables and the guests panel; assets/phone-table.png — a guest's own table page with the route on the hall map
- focal: assets/screen-seating.png
- roles: screen-seating.png = cutout · phone-table.png = supporting
- sfx: none

narrativeRole: the arranging chapter — the hardest chore made physical.
keyMessage: drag, drop, done — and guests find their seat.

Adapt: a cursor drags a rebuilt guest chip from the panel to a table on the canvas; the table's seat count updates;
then a phone slides in with the guest's table.

Layout: window LEFT (crop CSS x 48–1176, y 60–900 → displayed 1150 px, 0.8 px/CSS px... compute from W); text column
RIGHT: kicker "11 · מושיבים", headline "בגרירה".
Boxes (CSS px, page 1440×900): `canvas` [73,310,738,635]; the unseated row "משפחת אזולאי · 3" with its "הושבה" button
— row text `unseated` [1025,613,88,20] (the row spans CSS x ≈ 830–1150, y ≈ 600–640); table 4 (round, "7/10") center at
CSS ≈ (532,604), radius ≈ 22 (+ chairs ≈ 40); `auto` [1011,164,141,40] (סידור אוטומטי); `send` [781,164,222,40]
(לשלוח לאורחים את השולחן). phone-table.png: big "2 · השולחן שלכם" card at the top, the hall map with a route below.

Scene 1 (0.0–1.9s): window enters; headline reveal "בגרירה" at 1.9s.
Scene 2 (1.9–4.4s): a cursor picks up a rebuilt chip "משפחת אזולאי · 3" (cream chip, brown border, family glyph)
from the unseated row (1.9s), drags it on an arc across to table 4 (2.2–3.4s, power3 in-out), drops at 3.4s: table 4's
label overlay switches "7/10" → "10/10" and three chairs fill brown (rebuilt chair dots over the measured table);
pill "משפחה שלמה בגרירה" at 3.9s.
Scene 3 (4.4–6.1s): "מסדרים על תוכנית האולם" — zoom-to-target ≈1.3× on `canvas`, ring around the floor plan.
Scene 4 (6.1–9.243s): zoom back; ring on `send` at 6.1s; a phone (phone-table.png, ≈ 340×736 screen) slides in from
the right over the text column at 6.7s; at 7.6s ring on its "2 · השולחן שלכם" card ("את מספר השולחן שלו"). Hold.

## Frame 13 — ביום האירוע

- scene: The entrance station checks guests in by search or code scan, and the host sees arrivals live
- voiceover: "ביום האירוע, עמדת הכניסה מאשרת הגעה בחיפוש או בסריקת קוד, ואתם רואים מי הגיע בזמן אמת."
- duration: 7.969s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/13-eventday.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: calm on the big day
- blueprint: comparison-split (Adapt — station phone + host window)
- asset_candidates: assets/phone-station.png — entrance station on a phone: "29 מתוך 84 הגיעו", scan button, search, arrivals; assets/screen-live.png — the host's event-day page with live arrivals and the hall map
- focal: assets/phone-station.png
- roles: phone-station.png = cutout · screen-live.png = supporting
- sfx: none

narrativeRole: the celebration chapter opens — the door.
keyMessage: check-in in seconds, live for the hosts.

Adapt: two paired surfaces — the station phone (guest side) and the host window — enter from opposite wings with the
mirrored tilt, then settle flat.

Layout: phone RIGHT-of-center (x ≈ 1150 center, screen ≈ 360×779), host window LEFT (crop CSS x 48–1176, y 60–700,
displayed ≈ 900 px wide, x 90–990, y 120–630), kicker "12 · יום האירוע" top-right above the phone.
phone-station.png (390×844 CSS @3x): progress "29 מתוך 84 הגיעו" card at CSS ≈ [12,60,366,90]; dark "סריקת קוד"
button ≈ [12,174,366,52]; search field ≈ [12,262,366,44]; arrivals list from y ≈ 330.
screen-live.png box `stats` [891,219,261,153] (אנשים הגיעו · 29 מתוך 84).

Scene 1 (0.0–2.4s): the phone enters from the right wing with a mirrored tilt and settles (1.4s "עמדת הכניסה").
Scene 2 (2.4–5.5s): 3.3s ring on the search field (pill "חיפוש"); 4.2s ring on "סריקת קוד" and a scan frame (four brown
corner brackets) + one finite scan-line sweep over the phone's upper half (4.2–5.0s).
Scene 3 (5.5–7.969s): the host window enters from the left wing (5.5s); ring on `stats` with a count-up 0→29 (6.3–7.0s)
and a "בזמן אמת" chip with live dot. Hold.

## Frame 14 — גלריה חיה ומסך באולם

- scene: Guests upload photos from their phones; they appear on the hall's big screen; face search finds your photos
- voiceover: "האורחים מעלים תמונות לגלריה חיה שמוצגת על המסך באולם, וכל אחד יכול למצוא את התמונות שהוא מופיע בהן."
- duration: 7.915s
- transition_in: crossfade
- status: animated
- src: compositions/frames/14-gallery.html
- type: feature_showcase
- persuasion: Belonging (everyone's photos, together)
- beat: joy + awe
- blueprint: camera-journey (Adapt — action roundtrip, cursorless)
- asset_candidates: assets/phone-upload.png — the guests' upload page on a phone; assets/screen-projector.png — the hall screen showing the couple photo; assets/screen-projector-2.png — the hall screen's next photo; assets/photo-couple.jpg — the couple at sunset; assets/photo-chuppah.jpg — chuppah photo; assets/photo-venue.jpg — the lit hall; assets/photo-ballroom.jpg — the ballroom
- focal: assets/screen-projector.png
- roles: phone-upload.png = supporting · screen-projector.png = cutout · screen-projector-2.png = supporting · photo-couple.jpg = supporting · photo-chuppah.jpg = supporting · photo-venue.jpg = supporting · photo-ballroom.jpg = supporting
- sfx: none

narrativeRole: the room lights up with everyone's moments.
keyMessage: from every phone to the big screen, and back to you.

Adapt: keep the cause→effect roundtrip: the upload on the phone (cause) and the photo landing on the big screen (effect),
connected by the photo's flight; no cursor.

Layout: the hall screen is the hero — a large dark "screen" frame (16:9, ≈ 1180×664, x 80–1260, y 70–734, thin dark
bezel, a subtle stand shadow) showing screen-projector.png; the phone (phone-upload.png, screen ≈ 300×649) at the right
(x ≈ 1560 center, y 90–760); kicker "13 · גלריה חיה" above the phone.

Scene 1 (0.0–1.9s): the phone enters right; on "מעלים תמונות" (0.9–1.4s) three small photo tiles (photo-chuppah,
photo-venue, photo-ballroom) pop on the phone's "בחירת תמונות" area.
Scene 2 (1.9–4.2s): the hall screen fades up (1.9s, "לגלריה חיה"); a photo tile flies from the phone to the screen in
an arc (2.4–3.2s) and the screen crossfades from screen-projector-2.png to screen-projector.png as it lands
("על המסך באולם", 3.4s); pill "מסך באולם".
Scene 3 (4.2–7.915s): "וכל אחד יכול למצוא" — a round face-scan ring (brown dashed circle + 4 corner ticks, finite
rotation of 40°) settles on the couple in the projected photo at 5.2s; a feature chip "חיפוש לפי פנים · התמונות שלי"
pops at 6.4s under the screen. Hold.

## Frame 15 — סרט רגעים ותובנות

- scene: After the event, a moments film made from the photos, and insights about views and attendance
- voiceover: "ואחרי האירוע: סרט רגעים שנוצר מהתמונות, ותובנות על הצפיות וההגעה."
- duration: 6.444s
- transition_in: crossfade
- status: animated
- src: compositions/frames/15-film.html
- type: feature_showcase
- persuasion: Future pacing (the memory lasts)
- beat: nostalgia + pride
- blueprint: video-text-pivot (Adapt)
- asset_candidates: assets/screen-film.png — moments film page with the chosen photos grid; assets/screen-insights.png — insights with stat cards and charts; assets/photo-couple.jpg — couple photo; assets/photo-chuppah.jpg — chuppah photo; assets/photo-venue.jpg — the hall
- focal: assets/screen-film.png
- roles: screen-film.png = cutout · screen-insights.png = supporting · photo-couple.jpg = supporting · photo-chuppah.jpg = supporting · photo-venue.jpg = supporting
- sfx: none

narrativeRole: the afterglow.
keyMessage: the event keeps giving — a film and real numbers.

Adapt: a film strip of the photos plays in a 16:9 "player" then slides aside to hand weight to the insights window and
its count-ups.

Layout: player LEFT (16:9, ≈ 760×428, x 90–850, y 150–578) with a filmstrip (the three photos, 4:5 → cropped 16:9)
crossfading with a slow Ken Burns each (finite); insights window RIGHT-CENTER (crop CSS x 48–1176, y 60–700 of
screen-insights.png, displayed ≈ 820 px, x 900–1720, y 160–625). Kicker "14 · אחרי האירוע" top-right.
screen-insights.png boxes: `visits` [891,218,261,139] (209 ביקורים); the "פתחו" card ≈ [709,218,170,139] (188).

Scene 1 (0.0–1.9s): kicker; the player frame fades in (0.9s "האירוע").
Scene 2 (1.9–4.0s): "סרט רגעים" — the filmstrip plays: photo-couple → photo-chuppah → photo-venue (crossfades at 2.6s,
3.3s), a play glyph pill "סרט הרגעים" pops at 1.9s.
Scene 3 (4.0–6.444s): "ותובנות" — the insights window enters (4.0s); count-ups on `visits` 0→209 (4.9s "הצפיות") and
the "פתחו" card 0→188 (5.5s "וההגעה"). Hold.

## Frame 16 — עזרה בכל שלב

- scene: The help button opens a written guide, a smart assistant that answers any question, and a direct line to the team
- voiceover: "ובכל שלב, כפתור העזרה פותח מדריך כתוב, עוזר חכם שעונה על כל שאלה, ופנייה ישירה לצוות."
- duration: 8.599s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/16-help.html
- type: benefit_highlight
- persuasion: Risk reversal (never stuck)
- beat: reassurance
- blueprint: grid-card-assemble (Adapt — accumulating benefit list beside the real panel)
- asset_candidates: assets/screen-help.png — event home with the help panel open (guide, video, search)
- focal: assets/screen-help.png
- roles: screen-help.png = cutout
- sfx: none

narrativeRole: the safety net.
keyMessage: help is one tap away, three ways.

Adapt: the real help panel is the anchor; three benefit rows accumulate beside it on their words, each with a tiny
rebuilt illustration (a guide page, a chat exchange, a person).

Layout: window LEFT showing screen-help.png cropped to CSS x 0–760, y 100–900 (the open panel `panel` [24,156,440,720]
and part of the page) displayed ≈ 760×800 (x 90–850, y 60–860); text column RIGHT: kicker "15 · עזרה", headline
"תמיד יש עזרה", then three benefit rows (icon + title + one line), each ≈ 680 px wide.
Boxes (CSS px, page 1440×900): `panel` [24,156,440,720]; `video` [41,286,406,89] (סיור מלא במערכת); `search`
[41,391,406,44]; the guide article list from CSS y ≈ 450.

Scene 1 (0.0–1.5s): window enters with the panel; kicker + headline.
Scene 2 (1.5–2.9s): "כפתור העזרה פותח" — ring around `panel`.
Scene 3 (2.9–4.2s): row 1 "מדריך כתוב" (book glyph) reveals at 2.9s; ring on the article list.
Scene 4 (4.2–6.5s): row 2 "עוזר חכם" (sparkle glyph, brown chip "AI") reveals at 4.2s; a rebuilt mini chat (two
bubbles: guest "איך שולחים בוואטסאפ?" then assistant "מהמסך מוזמנים, בלחיצה על…" typing dots → text) builds 4.6–6.2s
inside row 2.
Scene 5 (6.5–8.599s): row 3 "פנייה ישירה לצוות" (person glyph) reveals at 6.5s. Hold.

## Frame 17 — שימוש חינם

- scene: Badook's lockup, the line "from the first idea to the last moment", and the call: free to use
- voiceover: "באדוק. מהרעיון הראשון ועד הרגע האחרון. יוצאים לדרך."
- duration: 8.895s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/17-end.html
- type: cta
- persuasion: Risk reversal (free to start)
- beat: motivation → urgency-to-act
- blueprint: logo-assemble-lockup (Adapt)
- asset_candidates: assets/badook-logo.png — Badook wordmark
- focal: assets/badook-logo.png
- roles: badook-logo.png = cutout
- sfx: none

narrativeRole: the close — brand, promise, and the free start.
keyMessage: שימוש חינם — start now.

Adapt: the lockup blooms on a cleared cream stage and extends into the CTA end card.

Layout: centered. Logo (≈ 640 px wide) at y ≈ 250; the line under it; the CTA block below (brown pill + URL); all
within y 120–860.

Scene 1 (0.0–1.4s): the logo blooms in at center ("באדוק", 0.4s) with a soft brown glow behind it (`ambient-glow-bloom`).
Scene 2 (1.4–4.7s): "מהרעיון הראשון ועד הרגע האחרון." per-word reveal (Frank Ruhl, `headline`), a brown underline draws
under "הרגע האחרון" at 3.5s.
Scene 3 (4.7–8.895s): on "יוצאים לדרך" the CTA lands: a big solid brown pill "שימוש חינם" (Frank Ruhl `display`,
white, ≈ 120px tall) springs in smoothly at 4.8s; under it "מתחילים בחינם · משדרגים רק כשצריך" (Heebo `lead`, 5.4s)
and "invitations.badooks.com" (Heebo 600, brown, 5.9s). Hold to the end; the whole card fades to cream over the last
0.6s (the film's only real exit).
