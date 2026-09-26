# MASTER PROMPT v3 — Digital Invitations + RSVP, end to end (product · design · code) · HE/RTL + EN

> Paste this whole file into Claude Code at the root of the product repo. It is self-contained: product definition, contracts, behaviour, full examples, build order and acceptance criteria.
> **Before starting:** unzip `invitations-build-kit.zip` at the repo root. It creates:
> ```
> docs/invitations/MASTER_PROMPT.md          ← this file
> docs/invitations/fixtures/*.json            ← the 3 example invitations (§10)
> docs/invitations/i18n/invitations.{he,en}.json
> docs/invitations/design-reference/invitation.html · app.html · screenshots/*.png   ← LOOK & FEEL SOURCE OF TRUTH
> docs/invitations/icons/{chuppah,rings,toast}.svg
> invitation-templates-pack/<id>/{manifest.json,defaults.json,ASSETS.md}           ← 8 ready templates
> ```
> Media files (videos, posters, illustrations, music) are produced separately (production kit) and dropped into `public/templates/<id>/` later — the app must look finished with placeholders until they exist.

---

## 0. Role, goal, operating rules

You are a senior full-stack engineer and product-minded designer. Add a **self-serve digital invitations feature** to this existing product: a host picks a template, edits every detail themselves, previews it live on a phone frame, publishes a share link, and collects RSVPs in a dashboard. Invitations must work in **Hebrew (RTL)** and **English (LTR)**, including **bilingual invitations with a live language switch**.

Operating rules:
1. **Scope discipline.** Only create/modify what this feature needs. Do not refactor unrelated code, rename existing things, or change global styles/configs beyond what is required (and list every such change).
2. **Contract first.** Implement the types, schemas and DB contracts in §3–§4 before any UI. If you must deviate, update the contract first and explain why.
3. **Inspect before building.** Step 0 is mandatory (see §1).
4. **Originality.** This feature is inspired by a studied reference product (KindlyRSVP). Never copy its assets, illustrations, copy, template names or code. Use only the original templates in `invitation-templates-pack/`.
5. **Report after every phase** (§11) with: what was built, files touched, how to run/test, open questions. Stop and wait for approval between phases.
6. **Design fidelity.** The guest invitation must match `design-reference/invitation.html` and the host screens must match `design-reference/app.html` (layout, hierarchy, spacing, type scale, states). Open both in a browser and study the screenshots before building UI. Do not invent new visual styles; when something is unspecified, extrapolate from the references and §9A/§9B.
7. **Read the kit files, don't retype them.** Import JSON from `docs/invitations/` and `invitation-templates-pack/` (copy into `src/` if the build requires) instead of transcribing them.

---

## 1. Step 0 — inspect the repo and map the stack

Before writing code, read the repo and report:
- Framework/router, language, styling system, component library, animation lib, state/data fetching, i18n setup (if any), auth + tenancy model (users / orgs / workspaces), storage, email provider, deployment target, test setup.
- Whether the app already supports RTL anywhere.

**Default stack if not already present / if compatible:** Next.js (App Router) + TypeScript + Tailwind CSS (logical utilities) + Framer Motion (`motion`) + Zod + Supabase (Postgres, RLS, Storage, Edge Functions or route handlers) + `@hebcal/core` (Hebrew dates) + `libphonenumber-js` + `qrcode` + `@dnd-kit/*` (editor reordering).
If the repo uses a different stack, **map each piece to the existing equivalent** and keep the contracts identical. Scope all data by the existing tenancy model (e.g. `org_id`) if there is one.

Config (env, with safe defaults): `INVITES_BRAND_NAME` (footer credit + OG), `INVITES_PUBLIC_BASE_URL` (share links, OG, ICS UID domain), `INVITES_SUPPORT_EMAIL`, `INVITES_TURNSTILE_SITE_KEY` (optional). Feature flag `invitations` so the feature can ship dark.

Also report in Step 0: does the product have its own design system/component library (→ §9B rule), which font loading mechanism exists, and where static assets live (→ `public/templates/<id>/`).

### 1.1 Deployment — AWS Amplify

Deployment target: **AWS Amplify Hosting (Next.js SSR)**. Follow these rules in every phase:
1. Use a Next.js version officially supported by Amplify Hosting SSR (check the current Amplify docs before choosing) and Node 20+.
2. Add `amplify.yml` at the repo root: `npm ci` → `npm run build`, artifacts `baseDirectory: .next`, cache `node_modules` and `.next/cache`.
3. Amplify console env vars are NOT available to SSR at runtime by default — in the build phase write the needed ones into `.env.production` (e.g. `env | grep -E '^(NEXT_PUBLIC_|SUPABASE_|INVITES_)' >> .env.production`). Document every required var in `.env.example`.
4. No Edge runtime anywhere (no `runtime = 'edge'`): route handlers, OG image generation and middleware must run on Node. Verify the OG image (with Hebrew) works on Amplify.
5. Publishing must refresh `/i/[slug]` on Amplify: use `revalidatePath` and verify it works there; if not, render the public page dynamically with short cache headers.
6. Heavy template media (videos, music) must not ship in the build: serve it from Supabase Storage (public bucket, long cache headers). `public/templates/` keeps only placeholders.
7. Branches: `main` = production, `dev` = preview, each with its own env vars. Playwright/visual tests run locally or in CI, never in the Amplify build.
8. At the end of P1, deploy to Amplify and confirm the public page, RSVP submission and ICS download work in production.

---

## 2. Product definition (what we are building)

### 2.1 Mental model
| Layer | Owned by | Contains |
|---|---|---|
| **Template** (`TemplateManifest`) | Our design team (code/JSON + asset folder) | palette tokens + presets, font pairs per script (Latin + Hebrew), cover (opening video + editable monogram overlay), hero media options, illustrations, music, motion preset, section variants, per-event-type default content in HE+EN |
| **Invitation document** (`InvitationDocument`) | The host, via the editor | names, date/time/timezone, venues, timeline, all texts per locale, enabled sections + order, RSVP settings, constrained theme overrides |
| **Renderer** | Code | `render(template, document, locale, mode)` — the SAME renderer powers editor preview, preview link and the public page |
| **Responses** | Guests | RSVP answers, attendees, dietary, messages |

### 2.2 Guest experience (observed reference behaviour, improved)
A single mobile-first vertical page (content max-width 560px, centered on desktop):

1. **Cover (video-first)** — full-viewport `fixed` overlay, scroll locked. Layers, bottom → top:
   (a) `cover.poster` image (closed envelope / papercut gate / velvet pouch / swaddle / ticket — **no text baked in**), `object-fit: cover`, centered;
   (b) hidden `<video muted playsInline preload="auto">` of `cover.openVideo` (its first frame == the poster);
   (c) the **editable overlay** centered on the viewport: a blank seal/medallion/tag PNG (tinted with the chosen `sealColor` when `overlay.recolor`) with the host's **monogram** (e.g. `N&I` / `נ&א`, or ticket text like `DANA 30`) drawn on top as SVG text with the template's effect (`emboss | deboss | foil | print`);
   (d) hint text ("Tap to open") fading in after 1.2s, overlay pulsing (scale 1→1.04, 2.4s loop).
   On tap / Enter / Space: start music **inside the gesture handler** (iOS requirement; 1.5s volume fade-in) and `video.play()` in the same handler → during the video's static `holdMs` (≈500ms) the overlay exits (`crack`: splits into two halves rotating ±12° and falling with fade, 450ms · `lift`: rises 24px + scale 1.08 + fade, 400ms · `fade`: 250ms) → video plays → **600ms before the video ends** crossfade the whole cover layer out to reveal the Hero → unlock scroll. Total ≈ 3–3.5s.
   Fallbacks: no `openVideo` or `renderer: 'css3d'` → CSS 3D animation (flap `rotateX(0→180deg)` 700ms, card rises 600ms, fade 700ms); video fails/stalls >1.5s → skip to the crossfade; `prefers-reduced-motion` → plain 300ms fade; `?open=1` skips the cover (editor, screenshots, OG). Show a small "Skip" after 1s. On desktop use `posterDesktop`/`openVideoDesktop`; if null, show the 9:16 media centered over a blurred, scaled copy of itself.
2. **Hero** — `100svh`, background video (muted, playsInline, loop; poster shown until `canplay`) or image with focal point — on desktop the matching `mediaDesktop` of the chosen hero option, else the 9:16 media over a blurred copy — overlay color+opacity, centered text: eyebrow → title (hosts stacked: name / joiner / name, in the display font) → thin divider → date line (Gregorian `·` Hebrew date when enabled) → location line. Staggered entrance: 0 / +150 / +300 (divider `scaleX 0→1`) / +450ms, each 900ms from `opacity 0, blur(10px), y 16px`.
3. **Countdown** — title, subtitle, 4 cells Days/Hours/Minutes/Seconds (`tabular-nums`, tick every 1s). Target = event start or a custom date (e.g. baby due date). From target until +24h show `afterEvent` text; after that hide the section.
4. **Text sections** (`kind`: story, transport, accommodation, dress_code, menu, activities, custom) — script heading, optional subtitle, multi-line body (preserve line breaks), optional template illustration, optional CTA button.
5. **Venues** (1–4) — label ("The Ceremony"), pin icon in a tinted circle, venue name, address, `weekday | date`, clock icon + time, optional embedded map (rounded, bordered, **lazy**: static placeholder until in view), buttons: **Open in Maps**, **Waze**, **Add to Calendar** (dropdown: Google / Apple .ics / Outlook).
6. **Template decorations** between sections (panoramic sketches, small illustrations) — defined by the template, not the host.
7. **Timeline** — date heading + items (time pill, icon in circle, label, connecting line). Variants: `horizontal-icons` (≤6 items fit; else horizontal scroll with snap), `vertical`, `flip-cards` (tap to reveal).
8. **FAQ** (accordion), **Gallery** (carousel/grid), **Gifts** (card with links: registry, Bit, PayBox, PayPal, bank details, custom link).
9. **Reveal** (Save-the-Date style): `scratch` (canvas scratch-off revealing the date, auto-complete at 55% cleared), `tap` (tap to burst/reveal), `spin` (slot-machine digits settle on the date).
10. **RSVP** form (§6).
11. **Footer** — decoration, hosts, date, parents' names (common in Israeli invitations), closing line, "Made with love by {brand}" credit (removable per plan).

Global: every section reveals once when 20% in view (`y 40→0`, `opacity 0→1`, 800ms, ease `[0.22,1,0.36,1]`, children stagger 80ms). Floating **music toggle** (`inset-inline-end`, bottom) after the cover opens; pause on `visibilitychange` hidden. **Locale switcher** pill (top, `inset-inline-end`) when `locales.length > 1`: swaps texts and `dir` instantly without reload, keeps scroll position, syncs `?lang=`.

### 2.3 Look & feel in one paragraph
Stationery-grade, calm and romantic: paper textures, generous white space, one centered column, script display type for names and titles, serif body, thin 1px lines, soft tinted badges, no heavy shadows, no gradients on UI chrome, motion that is cinematic yet gentle (800–1300ms eases, soft springs with a few percent of overshoot where things land, themed particles — §9A.6). The host app is the opposite: neutral, fast, dense-but-airy SaaS UI (stone neutrals, black primary buttons, 8–12px radii), so the invitation is always the colorful thing on screen. Exact specs: §9A (invitation) and §9B (app).

### 2.4 Why this matters vs the reference
The reference product is done-for-you (designers hand-build each invitation in a site builder, ~AUD 395–995). Our differentiator is **self-serve editing with guaranteed design quality**, plus Israeli-market features: Hebrew date (gematria), kosher/mehadrin dietary, shuttles, Waze, Bit/PayBox gifts, parents' names, WhatsApp-first sharing.

---

## 3. Contracts — TypeScript (implement exactly, plus matching Zod schemas)

```ts
// ---------- i18n ----------
export type Locale = 'he' | 'en';                 // extensible later: 'ar' | 'ru' | 'fr' ...
export const RTL_LOCALES: readonly Locale[] = ['he'];
export const dirOf = (l: Locale) => (RTL_LOCALES.includes(l) ? 'rtl' : 'ltr');
/** User-authored text. Must contain every locale listed in document.locales (validated on publish). */
export type L10n = Partial<Record<Locale, string>>;

export type EventType =
  | 'wedding' | 'engagement' | 'henna' | 'bar_mitzvah' | 'bat_mitzvah' | 'brit'
  | 'baby_shower' | 'birthday' | 'save_the_date' | 'corporate' | 'other';

export type HHmm = string;      // /^([01]\d|2[0-3]):[0-5]\d$/
export type ISODate = string;   // 'YYYY-MM-DD' in document.timezone
export type AssetRef = string;  // 'template:<key>' | 'upload:<storage path>' | absolute https URL

// ---------- document ----------
export interface InvitationDocument {
  schemaVersion: 2;               // v1 (the §10 examples, older drafts) is migrated on read and on save — below
  templateId: string;
  eventType: EventType;
  locales: Locale[];              // order = switcher order
  defaultLocale: Locale;          // must be in locales
  timezone: string;               // IANA, e.g. 'Asia/Jerusalem'
  hosts: {
    primary: L10n;
    secondary: L10n | null;
    joiner: L10n | null;          // '&'
    parents: L10n | null;         // shown in footer when footer.showParents
  };
  event: {
    date: ISODate;
    startTime: HHmm;
    endTime: HHmm | null;         // if < startTime → next day
    hebrewDate: 'off' | 'day' | 'eve';  // 'eve' → "אור ל…" (Hebrew date after sunset)
    timeFormat: '24h' | '12h' | null;   // null → locale default (he 24h, en 12h)
    rsvpDeadline: ISODate | null;
  };
  theme: { fontPairId: string; palette: Partial<Palette> | null };  // only template.editablePaletteKeys
  cover: {                        // the cover design itself comes from the template
    enabled: boolean;
    monogram: L10n | null;        // overlay text; ≤ template.cover.overlay.text.maxGlyphs visible glyphs (e.g. 'N&I', 'נ&א', 'DANA 30')
    sealColor: string | null;     // must be in template.cover.sealColors when overlay.recolor
    hint: L10n | null;
    opening?: OpeningPreset | null;  // v2: the host's cinematic opening; absent / null → the template's cover.opening
  };
  music: { enabled: boolean; trackId: string | null; customUrl: AssetRef | null; volume: number; startAtSec: number };
  share: { slug: string; ogTitle: L10n | null; ogDescription: L10n | null; ogImage: AssetRef | null; noindex: boolean };
  sections: Section[];            // render order; hero first, footer last, ≤1 rsvp
}

export interface Media { kind: 'image' | 'video'; src: AssetRef; poster: AssetRef | null; focalPoint: { x: number; y: number } }

// ---------- v2: cinematic presentation (feature `cinematic`; all optional — without them v1 rendering) ----------
/** stack = the classic column (the media framed above the text) · full_bleed = media behind the text, edge to
 *  edge, under a scrim · split_start / split_end = beside the text on wide screens (start = the reading side:
 *  right in Hebrew), above / below it on a phone · parallax = full-bleed, the media drifting slower than the page
 *  · video_bg = full-bleed looping muted video over its poster. A layout that needs media renders as stack without it. */
export type SectionLayout = 'stack' | 'full_bleed' | 'split_start' | 'split_end' | 'parallax' | 'video_bg';
export interface SectionMedia extends Media {  // an upload (or template asset) — never a YouTube / Vimeo link
  alt?: L10n | null;              // what a content picture shows (stack / split); backgrounds are decorative
  overlay?: number | null;        // scrim under text, 0..0.85; null → template.tokens.overlay
}
export type EnterPreset = 'auto' | 'none' | 'fade' | 'rise' | 'sink' | 'zoom' | 'zoom_out' | 'slide_start' | 'slide_end' | 'tilt';
export interface SectionAnimation {   // missing fields take DEFAULT_SECTION_ANIMATION's (the schema fills them)
  enter: { preset: EnterPreset;     // 'auto' = the template's own reveal (§9A.6)
           duration: number;        // ms 150..4000 (900) — as scroll distance where scroll-driven: 0.3px per ms
           delay: number;           // ms 0..3000 (0)
           distance: number;        // px 0..240 (40), × intensity
           easing: 'smooth' | 'spring' | 'gentle' | 'linear' };
  scroll: 'none' | 'parallax' | 'ken_burns';        // what the media does while the section scrolls by
  text: 'none' | 'letters' | 'words' | 'lines';     // titles / texts / quotes revealed piece by piece (real text stays in the DOM)
  stagger: number;                // ms between blocks / letters / words, 0..600 (80)
  intensity: number;              // 0..2 (1), × template.motion.intensity
}
export interface ThemeOverrides {    // a section's own tokens — only what it changes
  palette?: Partial<Palette>;     // any key (a band of its own colors); contrast is checked (warning)
  radius?: { card?: number; button?: number; media?: number };
  typography?: Partial<Record<'display' | 'heading' | 'body' | 'caption', Partial<{ size: number; lineHeight: number; letterSpacing: number }>>>;
  spacing?: Partial<{ section: number; gutter: number; block: number }>;
}
export type OpeningPreset = 'envelope' | 'gate' | 'curtain' | 'fireworks' | 'gold_dust';   // envelope = the template's own cover
export interface OpeningConfig {
  preset: OpeningPreset;
  trigger?: 'tap' | 'scroll';     // scroll: scrolling / swiping opens it too, with a "scroll to enter" cue (gate, curtain default)
  motion?: 'swing' | 'slide' | 'part' | 'rise';   // gate: swing | slide · curtain: part | rise
  color?: string | null;          // doors / curtain / sky; null → from the palette
}

interface Base<T extends string, D> {
  id: string; type: T; enabled: boolean; variant?: string; data: D;
  // v2 (the hero: media stays data.media — its own `media` is null and `layout` 'full_bleed'; it takes animation and themeOverrides)
  media?: SectionMedia | null; layout?: SectionLayout; animation?: SectionAnimation | null; themeOverrides?: ThemeOverrides | null;
}

export type Section =
  | Base<'hero', {
      eyebrow: L10n | null;
      title: { mode: 'hosts' } | { mode: 'custom'; text: L10n };
      showDate: boolean;
      locationLine: L10n | null;
      media: Media;
      overlayOpacity: number;                    // 0..0.7
    }>
  | Base<'countdown', {
      title: L10n; subtitle: L10n | null;
      target: 'event' | { date: ISODate; time: HHmm };
      afterEvent: L10n;
    }>
  | Base<'text', {
      kind: 'story' | 'transport' | 'accommodation' | 'dress_code' | 'menu' | 'activities' | 'custom';
      title: L10n | null; subtitle: L10n | null; body: L10n;   // '\n' = line break
      illustration: AssetRef | null;
      cta: { label: L10n; url: string } | null;
    }>
  | Base<'venues', { items: Venue[] }>
  | Base<'timeline', {
      title: L10n; showDate: boolean; revealMode: 'none' | 'flip';
      items: { id: string; time: HHmm; label: L10n; icon: TimelineIcon }[];
    }>
  | Base<'faq', { title: L10n; items: { id: string; q: L10n; a: L10n }[] }>
  | Base<'gallery', { title: L10n | null; layout: 'carousel' | 'grid'; images: { id: string; src: AssetRef; alt: L10n }[] }>
  | Base<'gifts', {
      title: L10n; body: L10n;
      links: { id: string; kind: 'registry' | 'bit' | 'paybox' | 'paypal' | 'bank_transfer' | 'link'; label: L10n; url: string | null; details: L10n | null }[];
    }>
  | Base<'reveal', { title: L10n; mechanic: 'scratch' | 'tap' | 'spin'; prompt: L10n; showCalendarButton: boolean }>
  | Base<'rsvp', RsvpConfig>
  | Base<'footer', { showHosts: boolean; showDate: boolean; showParents: boolean; closingLine: L10n | null; showCredit: boolean }>
  // v2 section types (they render without the feature too — plainly, without their media)
  | Base<'parents', { title: L10n | null; items: { id: string; label: L10n; names: L10n }[]; note: L10n | null }>   // no items → hosts.parents
  | Base<'when', { title: L10n | null; showWeekday: boolean; showHebrewDate: boolean; showTime: boolean; countdown: boolean; showCalendar: boolean; note: L10n | null }>
  | Base<'where', { venue: Venue; note: L10n | null }>    // one place told big; counts as a venue (calendar, .ics)
  | Base<'quote', { text: L10n; attribution: L10n | null }>
  | Base<'custom', { title: L10n | null; subtitle: L10n | null; body: L10n; cta: { label: L10n; url: string } | null }>;  // text over / beside media; no text = a picture band

export interface Venue {
  id: string;
  label: L10n; name: L10n; address: L10n;
  geo: { lat: number; lng: number } | null;
  mapsQuery: string | null;       // used when geo is null
  date: ISODate | null;           // null → event.date
  startTime: HHmm; endTime: HHmm | null;
  showMap: boolean;
  buttons: { maps: boolean; waze: boolean; calendar: boolean };
}

export type TimelineIcon =
  | 'glass' | 'chuppah' | 'rings' | 'heart' | 'walk' | 'dinner' | 'music' | 'party'
  | 'cake' | 'camera' | 'bus' | 'toast' | 'star' | 'gift' | 'baby' | 'torah';

export type DietaryKey =
  | 'none' | 'kosher' | 'kosher_mehadrin' | 'vegetarian' | 'vegan' | 'gluten_free'
  | 'dairy_free' | 'pescatarian' | 'nut_allergy' | 'other_allergy' | 'kids_meal';

export interface RsvpConfig {
  title: L10n; subtitle: L10n | null;
  askChildren: boolean; maxAdults: number; maxChildren: number;   // 1..10 / 0..10
  requirePhone: boolean; requireEmail: boolean;
  perAttendeeDetails: boolean;    // false → only counts + primary contact
  dietary: { enabled: boolean; options: DietaryKey[]; note: L10n | null };
  customQuestions: {
    id: string; type: 'text' | 'select' | 'boolean'; required: boolean; label: L10n;
    options?: { value: string; label: L10n }[];
  }[];
  messageLabel: L10n | null;
  successMessage: L10n; declineMessage: L10n; closedMessage: L10n;
}

// ---------- template ----------
export interface Palette { bg: string; surface: string; ink: string; inkMuted: string; accent: string; accentInk: string; line: string; heroText: string }
export interface FontPair {
  id: string;
  display: { latin: string; hebrew: string };   // script/decorative (names, headings)
  heading: { latin: string; hebrew: string };
  body:    { latin: string; hebrew: string };
  ui:      { latin: string; hebrew: string };   // forms/buttons
}
export type CoverStyle = 'envelope_seal' | 'ribbon' | 'gatefold' | 'pouch' | 'swaddle' | 'ticket' | 'none';

export interface TemplateManifest {
  id: string; version: number;
  name: L10n; description: L10n;
  categories: EventType[];
  supportsLocales: Locale[];
  previewImage: string; previewVideo: string | null;
  tokens: {
    palette: Palette; editablePaletteKeys: (keyof Palette)[];
    radius: { card: number; button: number; media?: number };   // media (v2): a section's framed picture; absent → card
    divider: 'gradient_line' | 'none';
    // v2 — each defaults to the design's own values (a manifest without them keeps its look)
    typography: Record<'display' | 'heading' | 'body' | 'caption', { size: number; lineHeight: number; letterSpacing: number }>;  // × the base scale (1, 1, 0)
    spacing: { section: number; gutter: number; block: number };   // × 56/80px section padding, 24px gutter, in-section gaps (1)
    overlay: { color: string | null; opacity: number | null };   // the scrim under text on media; null → hero.overlayColor / 0.42
  };
  palettePresets: { id: string; name: L10n; palette: Partial<Palette> }[];   // keys ⊆ editablePaletteKeys; shown as swatches
  fontPairs: FontPair[];                         // [0] is default
  cover: {
    style: CoverStyle;
    renderer: 'video' | 'css3d';                 // 'video' is the default for all pack templates
    poster: string; posterDesktop: string | null;          // closed state, NO text baked in
    openVideo: string | null; openVideoDesktop: string | null;   // first frame == poster; first holdMs are static
    holdMs: number;                              // overlay exit plays inside this window
    overlay: {
      kind: 'wax_seal' | 'medallion' | 'tag' | 'ticket_text' | 'none';
      image: string | null;                      // blank transparent PNG (no letters); null for ticket_text
      recolor: boolean;                          // tint with document.cover.sealColor (mask + multiply)
      size: number;                              // fraction of the viewport's shorter side
      offset: { x: number; y: number };          // from viewport center, fraction of the shorter side
      exit: 'crack' | 'lift' | 'fade' | 'none';
      text: { color: string; effect: 'emboss' | 'deboss' | 'foil' | 'print'; maxGlyphs: number };
    };
    sealColors: string[];
    monogramFont: { latin: string; hebrew: string };
    opening: OpeningConfig | null;               // v2: a cinematic opening instead of the style's own (feature `cinematic`)
  };
  hero: {
    options: { id: string; name: L10n; media: Media; mediaDesktop: Media | null }[];   // [0] default; offered in the editor
    textColor: string; overlayColor: string; defaultOverlay: number;
  };
  music: { defaultTrackId: string | null; tracks: { id: string; title: string; url: string; license: string }[] };
  motion: {
    preset: 'soft' | 'none'; revealDistance: number; revealBlur: boolean; stagger: number;
    // optional: the hero's ambient particles — the cover's opening burst and the RSVP celebration follow
    // it. Without it the renderer picks one by template id (renderer/fx/theme.ts FX_BY_TEMPLATE), else by
    // the first event type. preset 'none' turns all of them off.
    ambient?: 'none' | 'petals' | 'leaves' | 'confetti' | 'sparkles' | 'stars' | 'bubbles' | 'balloons' | 'hearts' | 'fireflies' | 'embers' | 'notes' | 'pixels';
    intensity: number;                           // v2: × every travel of the motion engine (reveal distance, parallax, zoom), 0..2 (1)
  };
  assets: Record<string, string>;               // referenced as 'template:<key>'
  decorations: Partial<Record<'afterHero' | 'betweenVenues' | 'afterTimeline' | 'beforeRsvp' | 'footer', AssetRef | null>>;
  sectionDefaults: { order: Section['type'][]; variants: Partial<Record<Section['type'], string>> };
}

// ---------- template seed copy (invitation-templates-pack/<id>/defaults.json) ----------
export interface EventDefaults {
  coverHint: L10n;
  eyebrow: L10n;
  heroTitle: { mode: 'hosts' } | { mode: 'custom'; text: L10n };
  countdown: { title: L10n; subtitle: L10n | null; afterEvent: L10n };
  story: { title: L10n; body: L10n } | null;
  venueLabels: L10n[];                           // one venue item is seeded per label
  timeline: { time: HHmm; label: L10n; icon: TimelineIcon }[];
  extraSections: { kind: 'transport' | 'accommodation' | 'dress_code' | 'menu' | 'activities' | 'custom'; title: L10n; subtitle: L10n | null; body: L10n; illustration: AssetRef | null }[];
  rsvp: { title: L10n; subtitle: L10n | null; messageLabel: L10n; successMessage: L10n; declineMessage: L10n; closedMessage: L10n; dietaryOptions: DietaryKey[]; dietaryNote: L10n | null };
  closingLine: L10n;
}
export interface TemplateDefaults { templateId: string; defaults: Partial<Record<EventType, EventDefaults>> }
// seedDocument(template, defaults, wizardInput) → InvitationDocument. If the chosen eventType has no defaults
// in this template, fall back to the closest one (wedding↔engagement, bar↔bat mitzvah, brit↔baby_shower) and flag
// "review texts" in the editor. Seed only the locales the host selected.

// ---------- live text tokens ----------
// Any user L10n string may contain {primary} {secondary} {date} {hebrewDate} {deadline}.
// They are interpolated at render time in the active locale (so changing the date updates every text).
// Unknown tokens render verbatim. Length caps are measured after interpolation with a 12-char budget per token.

// ---------- RSVP payload (guest → server) ----------
export type RsvpSubmission = {
  invitationSlug: string;
  locale: Locale;
  hp: string;                     // honeypot, must be ''
  renderedAt: number;             // ms epoch when form mounted; reject if submit < 3s later
  answers: Record<string, string | boolean>;
  message: string | null;         // ≤ 500 chars
  editToken?: string;             // present when updating an existing response
} & (
  | { attending: true;
      adults: { firstName: string; lastName: string; phone: string | null; email: string | null; dietary: DietaryKey[]; dietaryNotes: string | null }[]; // [0] = primary contact
      children: { fullName: string; age: number; dietary: DietaryKey[]; dietaryNotes: string | null }[] }
  | { attending: false; contact: { fullName: string; phone: string | null; email: string | null } }
);
export type RsvpResult = { ok: true; responseId: string; editToken: string } | { ok: false; code: 'closed' | 'invalid' | 'rate_limited' | 'not_found'; fieldErrors?: Record<string, string> };
```

**Validation rules (Zod, shared client + server):**
- Every non-null `L10n` must contain every `document.locales` key with a non-empty trimmed string → **blocking on publish**, warning while editing ("missing translation").
- Length caps: host name 20, eyebrow 40, section title 32, subtitle 60, body 600, timeline label 22, guest message 500, monogram ≤ `overlay.text.maxGlyphs` visible glyphs (count grapheme clusters, ignore spaces).
- `sections`: unique ids; `hero` first; `footer` last; ≤1 `rsvp`; if an enabled `rsvp` exists → `event.rsvpDeadline` required.
- `theme.palette` keys ⊆ `template.tokens.editablePaletteKeys`; when `overlay.recolor`, `cover.sealColor` ∈ `template.cover.sealColors` (else must be null); hero `media.src` is the `src` (video) or `poster` (still image) `template:` key of one of `hero.options`, or an `upload:`; `theme.fontPairId` ∈ `template.fontPairs`; `template:<key>` refs exist in `template.assets`; `eventType` ∈ `template.categories`; `locales` ⊆ `template.supportsLocales`.
- `slug`: `/^[a-z0-9-]{3,60}$/`, unique; suggest from transliterated host names.
- v2: a section's `media.src` / `poster` refs are checked like any asset; a layout that needs media without it (or `video_bg` with a picture) → warning `layout_media` (renders as `stack`); a section video that is a YouTube / Vimeo link → `media_link` (blocking on publish); a video without a poster → warning `media_poster`; a section palette override below 4.5:1 for its text pairs → warning `contrast_low`; `custom.body` and `cta` follow the text rules once they have text (a title alone, or a picture band, is a whole section) and its `cta.url` must be https (`invalid_url`); `parents` with neither items nor `hosts.parents` → warning `empty_section`; new types' L10n fields follow the locale rules (`media.alt` optional).
- RSVP (attending): 1 ≤ adults ≤ maxAdults; 0 ≤ children ≤ maxChildren (0 if !askChildren); adult[0] firstName+lastName required, phone required if `requirePhone`, email if `requireEmail`; other adults first+last required; children fullName + age 0–17; `none` is mutually exclusive with other dietary keys; `nut_allergy|other_allergy` → `dietaryNotes` required. Decline: fullName + (phone or email). Phones normalized to E.164 (`libphonenumber-js`, default country IL when locale `he`).

Add `schemaVersion` migrations: `migrateDocument(doc) → latest` (`contracts/migrate.ts`), applied on every read (drafts, published versions, the guest's page, notifications) and on save — the host API accepts any known version and stores the latest; `safeMigrateDocument` returns issues instead of throwing. v1 → v2 only sets `schemaVersion: 2`: every v2 field is optional, so the migration is pure, lossless and idempotent, and a v1 document renders byte-for-byte as before (tested on every template's defaults, every seeded demo and the §10 fixtures). A v2 document can't be read by a release older than v2.

---

## 4. Contracts — database (Supabase / Postgres) & API

```sql
-- Adjust owner/tenant columns to the existing auth model (e.g. add org_id) — keep everything else.
create table public.invitation_templates (
  id text primary key,                 -- 'sahar-bordeaux'
  manifest jsonb not null,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.invitation_templates(id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  event_type text not null,
  draft jsonb not null,
  published jsonb,
  version int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitation_versions (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  version int not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  unique (invitation_id, version)
);

create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  attending boolean not null,
  locale text not null,
  primary_name text not null,
  phone text, email text,
  adults_count int not null default 0,
  children_count int not null default 0,
  message text,
  answers jsonb not null default '{}',
  edit_token_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rsvp_attendees (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.rsvp_responses(id) on delete cascade,
  kind text not null check (kind in ('adult','child')),
  position int not null,
  first_name text, last_name text, full_name text,
  age int check (age between 0 and 17),
  phone text, email text,
  dietary text[] not null default '{}',
  dietary_notes text
);

create index on public.rsvp_responses (invitation_id, created_at desc);
create index on public.rsvp_attendees (response_id);
```

RLS:
- `invitation_templates`: `select` for everyone where `is_active`.
- `invitations`: owner full CRUD (`owner_id = auth.uid()`, or the tenant equivalent). **No public select.**
- Public read through `security definer` RPC `get_published_invitation(p_slug text)` → `{ id, slug, document: published, template: manifest }` only when `status = 'published'`. Never return `draft`, `owner_id` or anything else.
- `rsvp_responses` / `rsvp_attendees`: owner `select`/`delete` via join to `invitations`; **no public insert** — writes only through the server endpoint using the service role.
- Storage bucket `invitation-media`: path `{owner_id}/{invitation_id}/…`; owners write via signed upload URLs; public read. MIME whitelist: image/jpeg, image/png, image/webp, image/avif, video/mp4, audio/mpeg. Limits: image 8MB, video 15MB (≤20s), audio 10MB.

Routes (adapt names to the repo's conventions):
| Route | Purpose |
|---|---|
| `GET /i/[slug]` | Public invitation (SSR/ISR, revalidate on publish). `?lang=he|en`, `?open=1`. `noindex` unless `share.noindex=false`. |
| `GET /i/[slug]/opengraph-image` | 1200×630 OG image (template palette + hosts + date). Verify Hebrew shapes/joins correctly; if the OG lib mis-renders RTL, generate on publish by screenshotting an internal `/og/[slug]` page server-side and store it. |
| `GET /i/[slug]/event.ics?venue=<id>` | ICS file (`text/calendar`, TZID or UTC, UID stable per venue). |
| `POST /api/invitations/rsvp` | Validates `RsvpSubmission` with the shared Zod schema; honeypot empty; `now - renderedAt ≥ 3000`; rate limit 10/min per `ip_hash`+invitation; payload ≤ 20KB; deadline not passed; strips HTML; inserts response + attendees in one transaction; returns `RsvpResult`. With `editToken`: verifies hash and replaces the response. Sends host notification (existing email provider; daily digest option). |
| `POST /api/invitations/[id]/publish` | Validates draft (blocking errors) → copies to `published`, `version+1`, inserts `invitation_versions`, sets `published_at`, revalidates `/i/[slug]`, (re)generates OG image. |
| `POST /api/invitations/[id]/restore/[version]` | Copies a version back into `draft`. |
| App pages | `/app/invitations` (list), `/app/invitations/new` (template gallery + wizard), `/app/invitations/[id]/edit`, `/app/invitations/[id]/responses`, `/app/invitations/[id]/share`. |

---

## 5. Rendering engine

```
<InvitationRenderer template doc locale mode="live|preview|editor" onSelectPath?>
  <ThemeProvider>        // CSS variables from palette (+ overrides), fonts per script, dir, lang
    <CoverOverlay/>      // live only; preview shows "Replay opening" button
    <MusicController/>   // single <audio>, started from cover gesture
    <LocaleSwitcher/>    // when doc.locales.length > 1
    {doc.sections.filter(s => s.enabled).map(s => <SectionView key={s.id} section={s} />)}
    <Decoration slot=…/> // from template.decorations
  </ThemeProvider>
</InvitationRenderer>
```

- **Template registry**: at build time import every `invitation-templates-pack/<id>/manifest.json` + `defaults.json`, validate them with the Zod schemas (fail the build on error), and upsert manifests into `invitation_templates` via a seed script. Media paths point to `public/templates/<id>/…`.
- **Missing media must never break an invitation** (the pack ships without media): `resolveAsset` checks a generated `public/templates/<id>/.available.json` (built by a script that lists existing files) — missing poster → CSS gradient from the palette with a subtle paper-noise texture + a CSS-drawn envelope/gate/pouch silhouette; missing `openVideo` → CSS 3D fallback; missing hero video → poster; missing poster → gradient; missing illustration/decoration → skipped; missing overlay image → a CSS circle (radial gradient in `sealColor`) under the monogram. Show a "placeholder media" badge in the editor only.
- **Cover overlay rendering**: recolor = a `<div>` filled with `sealColor` masked by the PNG (`mask-image`) + the same PNG on top with `mix-blend-mode: multiply` (the blanks are light warm-gray, so shading survives). Monogram = inline `<svg>` `<text>` in `monogramFont` for the locale script, auto-fit to 58% of the overlay width, with SVG filters: `emboss`/`deboss` (feGaussianBlur + feSpecularLighting / inverted offset shadows, text color = sealColor darkened 18% / lightened 22%), `foil` (linearGradient gold/silver sheen animated once on hover/tap), `print` (flat ink `text.color`, slight 0.9 opacity, feTurbulence roughness). `crack` = two clip-path halves of the same overlay animated apart.
- **Hero options**: the editor lists `template.hero.options`; the document stores the chosen option's `media` (`template:` refs); the renderer finds the option whose `media.src` matches to pick `mediaDesktop`.
- **Section registry**: `sections/<type>/index.ts` exports `{ type, schema, defaults(eventType, locales), EditorForm, views: Record<variant, Component> }`. Adding a section type must not touch the renderer.
- **Theming**: palette → CSS variables (`--inv-bg`, `--inv-ink`, `--inv-accent`, …). Components use only these variables — no hard-coded colors. Derive `--inv-heading` = `accent` if contrast(accent, bg) ≥ 3:1 (large display text), otherwise `ink`; `accent` is always safe for fills (buttons, icon circles, dividers).
- **Fonts**: load via `next/font` (or equivalent) with `unicode-range` so HE pages don't download Latin script fonts and vice versa; preload only the display font of the active locale; `font-display: swap`. Resolve font per element: `fontFor(role, locale)` → `pair[role].hebrew` for `he`, `.latin` otherwise. Latin names inside Hebrew text fall back via the font stack.
- **Editor hooks**: in `mode="editor"` every editable node gets `data-edit-path="sections.3.data.items.1.label"`; clicking calls `onSelectPath(path)`. No hover outlines in `live`.
- **Asset resolution**: `resolveAsset(ref, template, invitation)` handles `template:` / `upload:` / https.
- **Cinematic presentation (v2, feature `cinematic`)** — `renderer/cinematic`: a section with media, a layout, motion or tokens of its own is wrapped in `<div class="cine" data-layout data-on-media data-enter data-scroll data-tr data-palette>` (`CineSection`); full-bleed layouts put the media behind the text under a scrim (`tokens.overlay`, or the section's `media.overlay` for its opacity) — the text on media is light on a dark scrim in the design's own hues (its hero overlay when dark, else its ink; the text its paper or white), even on designs whose hero has dark text over pale art, unless the section sets its own `heroText` (the scrim follows it) or the template a light `tokens.overlay.color` (the text goes dark) — split layouts beside it (CSS grid; start follows `dir`), stack above it. Focal points → `object-position`. Section `themeOverrides` become the wrapper's CSS variables (`sectionThemeVars`), so they apply to that section only. Without the feature (`RenderOptions.cinematic: false`) nothing of this renders: sections come out exactly as v1, the new types render plainly without media, the cover is the template's own. The guest's page asks the event's flags only when the document or template uses v2 (`server/cinematic.ts`); a feature change reaches a cached page within the ISR minute (or at once on the next publish).
- **Scroll Timeline Engine** — `renderer/motion/engine.ts` (animation JSON → attributes + variables, pure) and `ScrollEngine.client.tsx` (one component per page): CSS scroll-driven animations (`animation-timeline: view()`, a `view-timeline` per section) scrub the enter presets, the parallax and the Ken Burns zoom where supported; elsewhere one IntersectionObserver adds `.in` and the presets play in time, and the parallax is written once per frame from geometry measured outside the scroll handler. Transform and opacity only. Text reveals split a title into aria-hidden pieces over the real text (read once) and remove them after playing. Background videos get their `src` only near the screen (never with Save-Data, `prefers-reduced-data` or reduced motion), play muted/looped/inline and pause off screen. Blocks too near the page's end to finish a scroll-driven entrance come in on time instead. Reduced motion or `<html data-motion="none">`: everything static.
- **Openings (v2)** — `renderer/cover/Openings.client.tsx`: gate (doors swing / slide), curtain (parts / rises), fireworks, gold dust, besides the template's envelope; the host's `cover.opening` wins over the template's `cover.opening` (whose trigger / motion / color apply when the presets match). The monogram is real text; gate and curtain also open by scrolling or swiping ("גללו להיכנס / Scroll to enter"); the light is a small canvas (`fx/sparks.ts`); reduced motion → a 300ms fade.
- **Responsive images** — `renderer/images.ts`: pictures go through Next's image optimizer (AVIF/WebP, srcset + sizes per layout) when `next.config.ts` allows their host (the Supabase Storage buckets from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL`, and local paths); anything else, or `INVITES_IMAGE_OPTIMIZATION=off`, is a plain `<img>`, and an optimized image that fails falls back to its original (an inline capture listener). The renderer writes the optimizer's addresses itself (next/image's default-loader format, widths and qualities shared with `next.config.ts` via `renderer/image-config.ts`), so next/image stays out of the guest's bundle. The hero's picture is the only eager one besides the cover's (`fetchpriority=high`; React hoists its preload with the srcset); every section picture is lazy; videos have posters.
- **Public bundle** must not import editor code (separate route group / dynamic imports).
- **Utilities (unit-tested)**:
  - `formatEventDate(doc, locale)` → HE: `יום חמישי, 17 ביוני 2027` · EN: `Thursday, 17 June 2027` (`Intl.DateTimeFormat` with `he-IL` / `en-GB` by default — keep the Intl locale in one config map so `en-US` ordering can be offered later; timeZone = doc.timezone).
  - `formatHebrewDate(date, mode, locale)` via `@hebcal/core`: HE → `י״ב בסיון תשפ״ז` (insert `ב` before the month); `eve` → `אור לי״ג בסיון תשפ״ז`; EN → `12 Sivan 5787`.
  - `formatTime(hhmm, locale, timeFormat)` → `19:30` / `7:30 PM`.
  - `eventRange(doc, venue?)` → `{ start: Date, end: Date }` in UTC (endTime < startTime ⇒ next day; missing endTime ⇒ +4h).
  - `googleCalendarUrl`, `outlookCalendarUrl`, `buildIcs` (escape commas/semicolons/newlines, CRLF line endings), `googleMapsUrl(venue)`, `wazeUrl(venue)` (`https://waze.com/ul?ll=<lat>,<lng>&navigate=yes` or `?q=<query>`), `googleMapsEmbedUrl(venue)`.
  - `countdownParts(target, now)` and `plural(locale, unit, n)` using `Intl.PluralRules` with fallback to `other`.

---

## 6. RSVP UX (guest side) — exact behaviour

1. "Will you attend?" — two large radio cards (required).
2. **Yes** → steppers: adults `[−] n [+]` (1..maxAdults), children (0..maxChildren, hidden if `!askChildren`). Attendee cards render from counts; keep typed data in state arrays so decreasing then increasing does not lose input.
   - Card 1 "Primary contact": first name, last name, phone (`dir="ltr"`, `inputmode="tel"`, locale placeholder), email (`dir="ltr"`, `inputmode="email"`), dietary checkboxes + notes.
   - Other adults: first + last name, dietary. Children: full name, age select 0–17, dietary.
   - `dietary.note` (e.g. kosher explanation) shown above the checkbox grid (2 columns on mobile).
3. **No** → full name, phone, email (one of them required), message.
4. Custom questions, then message textarea (`messageLabel`), Send button (full width, accent). Honeypot input visually hidden (not `display:none`), `tabindex=-1`, `autocomplete=off`.
5. Errors: inline, localized, `aria-describedby`, focus + scroll to first error; network error keeps all input.
6. Success: form is replaced by `successMessage` / `declineMessage` + "Add to calendar" (attending only) + "Edit my response". Store `{responseId, editToken}` in `localStorage` key `rsvp:<slug>` (wrapped in try/catch); when present, show "You already replied — edit".
7. After `rsvpDeadline` (end of that day in doc.timezone): show `closedMessage` instead of the form.
8. LTR fields inside RTL pages align to the page start edge (right) for visual consistency.

Host dashboard (`/responses`): KPI cards (responses, attending adults, attending children, total heads, declined), dietary breakdown, custom-question breakdown (e.g. shuttle TLV/JLM counts), searchable/filterable table, detail drawer, delete response, **CSV export with UTF-8 BOM** (Hebrew opens correctly in Excel; columns flattened one row per attendee + one per response variant), optional realtime updates.

---

## 7. Editor UX (host side)

1. **Template gallery**: filter by event type; cards show a phone-framed looping preview; "Live demo" opens `/i/demo-<template>?open=1`.
2. **Wizard (3 steps)**: event type → hosts + date + time + timezone (default from browser, `Asia/Jerusalem` for HE) → languages (HE / EN / both + default). Creates a draft seeded from `templates/<id>/defaults/<eventType>` in the chosen locales — **the host starts from a complete, beautiful invitation**, never an empty page.
3. **Editor layout**: desktop 3 columns — (a) section list: toggle, drag-reorder (`@dnd-kit`, hero/footer locked), add from catalog, duplicate, delete custom; (b) form for the selected section/global settings (Event, Cover, Design, Music, Languages, Share); (c) live preview in a 390×844 phone frame (scaled), with "Replay opening" and locale toggle. Mobile: tabs Edit / Preview.
4. **Localized fields**: when 2 locales are active, each `L10n` field shows `עב | EN` tabs with a dot for missing translations; the input's `dir` follows the tab. Optional "Copy from other language" helper.
5. **Design panel**: palette preset swatches (`palettePresets`) + fine-tune of editable keys with contrast check (warn below 4.5:1 for text on bg), font pair select, cover: monogram/ticket-text input (live counter vs `maxGlyphs`, per locale) + seal color swatches (when `recolor`) + "Replay opening" button, hero: pick one of `hero.options` or upload (focal-point picker, overlay slider), music track picker + custom upload (with rights checkbox).
6. **Autosave** draft (debounce 800ms, optimistic, conflict-safe via `updated_at`), "Unpublished changes" badge, undo/redo (in-memory, 50 steps).
7. **Publish**: run full validation → list blocking errors (click to jump to field) and warnings → publish → share screen: copy link, WhatsApp share (`https://wa.me/?text=<encoded message + link>`), QR (PNG/SVG download), preview of the OG card.
8. **Versions**: list published versions, preview, restore to draft.
9. Editor strings (UI chrome) follow the app's existing i18n; the invitation language is independent of the editor language.

---

## 8. i18n & RTL rules (non-negotiable)

- `<html lang dir>` (or the invitation root) from the active locale; bilingual invitations switch live.
- Logical CSS only (`ms-/me-/ps-/pe-/start-/end-`, `inset-inline-*`, `text-start`). No physical left/right except for truly physical things (e.g. scratch canvas math).
- Mirror directional icons (arrows, chevrons, "send" icon) in RTL; never mirror pins, clocks, hearts, logos.
- Horizontal sequences (timeline, countdown cells, stepper) naturally flow right-to-left in RTL — correct by design; the stepper keeps `−` on the start side and `+` on the end side.
- Wrap mixed-direction user text in `<bdi>`; phones/emails/times/URLs in `dir="ltr"` spans.
- System strings only from dictionaries (§10.4). Zero hard-coded UI strings in components.
- Every template must declare Hebrew-capable fonts; a template without them cannot be used with `he`.
- Dates: Gregorian via `Intl`; Hebrew date via `@hebcal/core`; western digits; he → 24h, en → 12h by default.

---

## 9. Performance, accessibility, security

- LCP < 2.5s on mid-range mobile/4G: preload cover poster (≤200KB AVIF/WebP) and active display font; hero video ≤4MB 720×1280 H.264 with poster; below-the-fold images lazy; map iframe only after in view (static placeholder first); no editor code in the public bundle.
- **Performance budget gate** — `npm run perf:templates` (`scripts/perf-templates.ts`, Playwright + the DevTools protocol, no Lighthouse; `.github/workflows/perf-templates.yml`): every template's demo and the v2 showcase on a 390×844 phone with Lighthouse's mobile 4G throttling (150 ms RTT, 1.6 Mbps down, 750 Kbps up — per request 562.5 ms, ×0.9) and a 4× slower CPU must keep LCP < 2.5 s (before the first tap), CLS < 0.1 (the whole visit) and a median ≥ 55 fps while scrolling the whole invitation; JSON + Markdown report in `test-results/perf/`.
- Cover works in iOS Safari, Android Chrome, and WhatsApp/Instagram in-app browsers (test `playsInline`, audio start inside the gesture, `100svh`).
- A11y: cover is a `<button aria-label>`; keyboard operable everywhere; visible focus; AA contrast; `aria-live="polite"` for form status; all animations disabled under `prefers-reduced-motion`; music never autoplays without a gesture and is always mutable.
- Security: RLS as in §4; server-side validation only; rate limiting; honeypot + time check (optional Cloudflare Turnstile flag); sanitize text (render as text, never HTML); signed uploads with MIME/size checks; edit tokens stored hashed (SHA-256); responses deleted with the invitation.

---

## 9A. Visual design — guest invitation (look & feel)

**Source of truth:** `docs/invitations/design-reference/invitation.html` + `docs/invitations/design-reference/screenshots/inv-*.png`. Open it in a browser (`?lang=en`, `?open=1`) before building any section. **Port its CSS into the section components 1:1** (tokens → CSS variables), then generalize. It is rendered from `fixtures/example-wedding-he-en.json` with the `sahar-bordeaux` tokens; every other template changes only tokens, fonts, media and decorations — never layout.

### 9A.1 Layout & rhythm
- Single column, `max-width: 560px`, side gutter 24px (20px below 360px). Hero and panoramic decorations are full-bleed; panoramas get a top/bottom fade mask (`mask-image: linear-gradient(transparent, #000 22%, #000 78%, transparent)`).
- Section padding: 88px top/bottom on mobile, 120px from 768px. A text section that directly follows another text section gets `padding-top: 24px`.
- Gradient divider (1px high, 72% wide: `transparent → line 20% → accent 50% → line 80% → transparent`) after countdown, timeline and RSVP; template decorations after venues and at the other `decorations` slots.
- Content is centered; the RSVP form and FAQ are start-aligned inside centered containers.
- Light templates get a paper grain layer: fixed SVG `feTurbulence` (baseFrequency .9), opacity .05, `mix-blend-mode: multiply`. Dark templates: none.

### 9A.2 Typography (font roles come from the chosen `fontPair`, per script)
| Element | Role | Size | Line-height | EN tracking | Notes |
|---|---|---|---|---|---|
| Hero names | display | `clamp(64px, 19vw, 112px) × displayScale` (he .9 · en 1) | 1.02 | 0 | stacked; the joiner `&` uses the heading font (italic in EN) at .42em |
| Hero eyebrow | heading | 19–20px | 1.5 | .04em | EN italic; HE weight 300, no italic |
| Hero date | heading 500 | 18px | 1.5 | .14em | Hebrew date on its own line at .86em |
| Section title | display | EN `clamp(42px, 11vw, 56px)` · HE `clamp(34px, 9vw, 46px)` | 1.1 | 0 | `text-wrap: balance`, color `--inv-heading` |
| Section subtitle | heading | 17–18px | 1.5 | .12em | `inkMuted` |
| Body | body | HE 17px · EN 19px (Cormorant runs small) | HE 1.75 · EN 1.6 | 0 | `max-width: 36ch`, `white-space: pre-line`; EN story text italic |
| Venue name | heading 500 | 26px | 1.3 | .04em | |
| UI (buttons, form, pills) | ui | 15–16px · labels 13px · helper 12–13px | 1.5 | .04em | |
- Numbers everywhere (countdown, stepper, dates, times): `font-variant-numeric: lining-nums tabular-nums`.
- **Hebrew rules:** no uppercase transforms, no letter-spacing, no italics (use weight/size instead). Equalize optical size between scripts with `size-adjust` in `@font-face` — starting values: Amatic SC 118%, Karantina 115%, Suez One 92%, Secular One 92%, Varela Round 95%, Playpen Sans Hebrew 95%, all others 100% (tune visually on the kitchen-sink page).

### 9A.3 Color roles
| Token | Used for |
|---|---|
| `bg` | page, attendee cards, inputs on dark templates |
| `surface` | countdown cells, cards, RSVP container, floating buttons (82% + `backdrop-filter: blur(8px)`) |
| `ink` / `inkMuted` | text / secondary text, icons in illustrations |
| `accent` | fills: primary button, time pills, selected chips & options, icon badges, icons in outline buttons |
| `--inv-heading` | titles (= accent if contrast ≥ 3:1 on bg, else ink) |
| `line` | borders, dividers, timeline spine |
| `heroText` | all text over the hero |
| derived | `accent-08` hover, `accent-12` badge/tag bg + focus ring, `accent-35` map border + focus outline (via `color-mix`) |
| danger | `#B3261E` on light templates, `#FF8A80` on dark ones |

### 9A.4 Components (exact specs — match the reference)
- **Primary button:** 52px high, full width inside forms, radius `tokens.radius.button`, `accent` / `accentInk`, ui 16px/600, 18px icon at inline-start, `:active` scale .98, disabled opacity .6.
- **Outline button:** 44px, 1px `accent` border, `accent` text, hover `accent-08`, padding-inline 18px, gap 8px, 18px icon.
- **Floating controls:** music = 44×44 circle at bottom / `inset-inline-end: 16px` (+ safe-area); language pill = 36px high, 13px/600, top / `inset-inline-end: 16px`. Both appear after the cover opens (fade + 8px rise, 500ms). Language pill hidden in the editor preview.
- **Icon badge:** 48px circle, `accent-12` background, 22px `accent` icon.
- **Countdown:** 4-column grid, gap 10px, max-width 360px; cell = 1px `line`, radius 12, `surface`, padding 14px/10px; number heading 34px/500 `ink`; label ui 12px `inkMuted` (EN: uppercase 10.5px, .12em).
- **Venue block:** label (section title) → pin badge → name → address (ui 15px muted) → `weekday | date` (1×16px `line` separator) → clock icon + time → map (4:3 mobile / 16:9 from 640px, radius card, 1px `accent-35` border, static placeholder until in view) → action buttons (wrap, centered, gap 10).
- **Calendar dropdown:** white popover, radius 12, 1px `line`, shadow `0 12px 32px rgba(40,10,15,.14)`, 44px items with icon (Google / Apple / Outlook).
- **Timeline — vertical** (default below 640px, and whenever items > 6): spine 1px `line` at `inset-inline-start: 22px`; 44px dot (page bg + 1px `line` + 20px `accent` icon); time pill (ui 12px/600, `accent` bg, `accentInk`, padding 2px 10px, radius 999); label heading 19px. **Horizontal** (from 640px when variant is `horizontal-icons` and ≤ 6 items): one column per item, spine through the dots, pill above the dot. **Flip-cards:** 2-column grid, card in `surface`, front = pill + icon, back = label, `rotateY(180deg)` 600ms on tap, hint "(לחצו לגילוי)" / "(tap to reveal)".
- **Card (gifts etc.):** `surface`, 1px `line`, radius card, padding 40/24/28, icon badge overlapping the top edge (−24px), links as stacked outline buttons (max-width 300px).
- **FAQ:** top border `line`; each item separated by 1px `line`; question heading 19px/500 + `accent` chevron rotating 180° (250ms); answer ui 16px `inkMuted`.
- **RSVP form:** container `surface`, 1px `line`, radius card, padding 20px (28px from 640px), max-width 520px.
  - Attend options: 56px rows, 1px `line`, radius 12, page bg; selected = 2px `accent` border + `accent-08` bg + filled radio with a check.
  - Steppers: one row per stepper — label with icon at the start, stepper at the end; 44px buttons, 48px value (heading 20px), 1px internal separators, disabled at min/max.
  - Person card: page bg, 1px `line`, radius 12, padding 16; header 14px/700 + "Primary contact" tag (`accent-12` bg, `accent` text).
  - Fields: label 13px `inkMuted` (+ danger `*` when required); input 48px, radius 10, white on light templates / `bg` on dark, 1px `line`; focus = `accent` border + 3px `accent-12` ring; error = danger border + 12px message; first/last name side by side (stacked below 360px).
  - Dietary chips: pill, min-height 34px, 1px `line`, 14px; checked = `accent` bg + `accentInk` + check icon; dietary note = `surface` bg, 3px `accent` border at inline-start, 13px muted. Selecting an allergy reveals a required notes field.
  - Submit: primary button with send icon; "Sending…" state; success view = 64px circle-check drawn with stroke-dash animation (ring then check), message in the display font, then "Add to calendar" and "Edit my response" (§9A.6: a reply just sent is brought into view and celebrated).
- **Footer:** 72px thin rings illustration (or the template's `footer` decoration), names in display 48px × scale (HE 40px), date, parents (ui 14px muted), closing line (heading 19px, EN italic), credit (ui 12px muted).
- **Cover:** hint ui 15px (EN uppercase 12px, .14em) in `#7C6A60` on light covers / `rgba(255,255,255,.8)` on dark; overlay size from `overlay.size` (reference: `clamp(92px, 26vw, 120px)`).

### 9A.5 Iconography
- `lucide` icons: stroke 1.5 on invitations, 1.75 in the app; 20px default. `TimelineIcon` → lucide: `glass→wine`, `heart→heart`, `walk→footprints`, `dinner→utensils-crossed`, `music→music`, `party→party-popper`, `cake→cake`, `camera→camera`, `bus→bus`, `star→star`, `gift→gift`, `baby→baby`, `torah→scroll-text`.
- Custom icons (24px grid, `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`), also in `docs/invitations/icons/`:
```svg
<!-- chuppah --> <path d="M3 8c2.5-3.6 15.5-3.6 18 0"/><path d="M3 8q1.5 2 3 0t3 0 3 0 3 0 3 0 3 0"/><path d="M4.5 9.3V21M19.5 9.3V21"/><path d="M2.5 21h19"/>
<!-- rings -->   <circle cx="9" cy="15" r="5.5"/><circle cx="15" cy="15" r="5.5"/><path d="M12 6.5 13.5 4h3L18 6.5l-3 3z"/>
<!-- toast -->   <path d="M4 3.5l5 1-1.2 5.2a2.5 2.5 0 0 1-3 1.8 2.5 2.5 0 0 1-1.7-2.9z"/><path d="M6.2 11.4 5.2 17.5M3.2 17.1l4 .8"/><path d="M20 3.5l-5 1 1.2 5.2a2.5 2.5 0 0 0 3 1.8 2.5 2.5 0 0 0 1.7-2.9z"/><path d="M17.8 11.4l1 6.1M20.8 17.1l-4 .8"/><path d="M12 .8v1.8M10.3 1.6l.8.8M13.7 1.6l-.8.8"/>
```
- Mirror directional icons in RTL (`navigation`, `send`, arrows, `external-link`, `undo-2`, `redo-2`) with `transform: scaleX(-1)`.

### 9A.6 Motion summary
| What | Spec |
|---|---|
| Cover idle | hint fades in after 0.3s (on a cover with no picture and no monogram it is the first screen's largest text — its LCP) · overlay pulse scale 1→1.04, 2.4s loop · the envelope / ticket floats ±4px, 6s |
| Cover open | overlay exit in `holdMs` (crack 450ms / lift 400ms / fade 250ms) with a flash of light and a spray of sparks → video → crossfade 600ms with the template's burst (CSS fallback: flap 700ms with a glow from inside, card rises 750ms and the template's burst comes out of it at 1.25s, then the card lifts toward the guest and dissolves while the envelope falls away, fade 800ms; ticket: the stub tears off at the perforation with the burst, the ticket lifts away) |
| Particles (`renderer/fx`) | burst: a canvas that exists ≈ 3s, ≤ 24 particles on a phone (40 elsewhere), petals / confetti / sparkles / stars / bubbles / balloons / hearts / fireflies / embers / notes / pixels in the palette's colors · hero ambient: CSS (transform/opacity), ≤ 24 on a phone, after the cover opens, paused off screen and in a hidden tab, none with Save-Data |
| Hero text | lead 0 → names one by one (140/420/560ms, 1.35s, from `opacity 0, blur(12px), y .3em, scale .96`) with a gold-foil glint sweeping each name once (in the reading direction) → rule draws (780ms) and a spark runs along it → date 900ms → place 1.02s · the scene / photo / video settles from scale 1.12 over 2.8s · where scroll-driven animations exist, the media drifts slower than the page and the text lifts away |
| Section reveal | once at 20% visible, `y 40px`, `blur(6px)`, children +80ms each; opacity 800ms ease `cubic-bezier(.22,1,.36,1)`, transform 1.05s on a gentle spring (`linear()`, ~4.5% overshoot) · cards and the map lift in tilted back, the map's pin drops · a block's children cascade (countdown cells flip down, buttons, FAQ, gallery) · dividers draw from the centre with a spark · the timeline's line draws and its dots pop |
| Countdown | a digit that changes rolls (out 550ms, in 700ms) |
| Clouds / hero loop | video only (CSS placeholder drifts 34–52s) |
| Accordion / chevron | 250ms |
| Flip card | 600ms `rotateY` |
| RSVP success | the badge pops, its ring and check draw, two ripples, then the message rises; a "yes" bursts in the template's particles |
| Buttons | press in (scale .95, 80ms) and spring back; the fabs pop in after the cover opens |
| Floating controls | fade + rise 8px, 500ms |
| Sections (v2) | a section's `animation`: enter presets (fade, rise, sink, zoom, zoom out, slide from the start / end, tilt) scrubbed by the scroll (0.3px per ms of duration) or played once in view; parallax (media ±9% of its box) and Ken Burns (to ×1.14) tied to the section's passage; text reveals by letters (≤ 90, else words), words (≤ 140, else lines) or lines; × intensity |
| Openings (v2) | gate 820ms · curtain 760ms · fireworks ≈ 1.25s · gold dust 700ms, then the invitation fades in; scroll / swipe to enter follows the finger a little first |
| Reduced motion | everything above becomes instant — no particles, no glint, no parallax, no text reveals, no background video (its poster); the cover uses a 300ms fade |

### 9A.7 Desktop (≥ 1024px)
Same single column (560px), full-bleed hero using `mediaDesktop` (or the 9:16 media over a blurred copy), horizontal timeline, 16:9 map, same floating controls. No sidebars, no multi-column layouts: the invitation must feel like the phone experience, just wider.

---

## 9B. Visual design — host app (editor, gallery, dashboard, share)

**Source of truth:** `docs/invitations/design-reference/app.html` (screens: editor · gallery · responses · share) + `screenshots/app-*.png`.
**Rule:** if the product already has a design system / component library, use **its** components, colors and fonts and apply only the layouts, behaviors and copy below. Otherwise use these tokens.

### 9B.1 Tokens (fallback)
`bg #FAFAF9 · surface #FFFFFF · subtle #F5F5F4 · border #E7E5E4 · border-strong #D6D3D1 · text #1C1917 · muted #78716C · faint #A8A29E · primary #1C1917 (ink #FFF) · focus #2563EB · success #15803D/#F0FDF4 · warning #B45309/#FFFBEB · danger #B91C1C/#FEF2F2 · info-bg #EFF6FF`.
Radius: 8 buttons · 10 inputs · 12 cards · 16 dialogs · 24 template posters · 999 pills. Shadows: sm `0 1px 2px rgba(28,25,23,.06)`, md `0 8px 24px rgba(28,25,23,.08)`, lg `0 24px 48px rgba(28,25,23,.14)`. Font: Heebo (HE) / Inter (EN); base 14px, labels 13px/600, help 12px, page title 26px/700, panel title 18px/700.

### 9B.2 Components
Button (sm 32 · md 40 · lg 48; primary / secondary (white + border + sm shadow) / ghost / danger / WhatsApp `#25D366`), IconButton 36, Input/Select 40, Textarea, **Segmented** (28px items in a `subtle` track), **Switch** 36×20 (knob moves toward inline-end when on — mirrors in RTL), **L10nTabs** (22px mini tabs `עב | EN` beside the label; amber dot = missing translation), Badge 22px (`טיוטה` draft / `פורסם` live / warning / `לא מגיעים`), Card, KPI card, horizontal Bars (fill grows from inline-start), DataTable (header row on `bg`, 12px cell padding, hover tint, numeric columns centered), Drawer (480px from inline-end), Dialog (560px), Toast (bottom-center on mobile, bottom inline-end on desktop), Skeleton, EmptyState (120px illustration + title + one line + CTA), ColorSwatch, **PhoneFrame** (390×844, 52px outer radius, 11px `#111` bezel, lg shadow).

### 9B.3 Screens & wireframes (drawn as they appear in Hebrew/RTL: start = right)

**A. Invitations list — `/app/invitations`**
```
                                                    ההזמנות שלי                 [+ הזמנה חדשה]
┌───────────────┐ ┌───────────────┐ ┌───────────────┐      grid: 4 cols ≥1280 · 3 ≥1024 · 2 ≥640 · 1
│ poster 9:16   │ │               │ │               │      card: poster (cover poster of the template)
│ (seal+monogram)│ │               │ │               │      + name + date + badge (טיוטה/פורסם)
├───────────────┤ └───────────────┘ └───────────────┘      + "97 תשובות · 184 מגיעים" + ⋯ menu
│ נועה & איתי  [פורסם]│                                        (עריכה · שיתוף · תשובות · שכפול · ארכיון)
│ 17.06.2027 · 97 תשובות │
└───────────────┘
Empty: illustration + "עוד אין הזמנות" + "בחרו עיצוב ותוך דקות תהיה לכם הזמנה מרגשת" + [בחירת עיצוב]
```

**B. Template gallery — `/app/invitations/new`**
```
בחרו עיצוב                                                          [עברית | English] ← preview language
כל עיצוב מגיע עם פתיחה מונפשת, מוזיקה וטקסטים מוכנים — הכל ניתן לעריכה.
(הכל) (חתונה) (בר/בת מצווה) (ברית) (יום הולדת) (בייבי שאוור) (Save the Date)      ← filter chips 34px
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     poster 9:16, radius 24, md shadow, hover: lift 4px + lg shadow
│ poster │ │        │ │        │ │        │     previewVideo autoplays muted on hover (desktop) / when
│  ▶     │ │        │ │        │ │        │     ≥60% in view (mobile, one at a time)
└────────┘ └────────┘ └────────┘ └────────┘
סהר בורדו  ●●●       ← name 15px/700 + 3 palette dots (bg, accent, ink)
חתונה · אירוסין      ← categories 12px muted
Click → Preview dialog: live phone (iframe /i/demo-<id>) + palette presets as swatches (live switch)
        + font pairs + [שימוש בעיצוב הזה] primary.
```

**C. Wizard (dialog 560px, 3 steps, progress dots)**
```
Step 1  "איזה אירוע חוגגים?"   tiles 2×4 with lucide icons (heart=חתונה, gem=אירוסין, scroll-text=בר/בת מצווה,
        baby=ברית, cake=יום הולדת, gift=בייבי שאוור, calendar-heart=Save the Date, sparkles=אחר)
Step 2  fields adapt to the type: wedding → שם 1, שם 2 · bar/bat mitzvah → שם החוגג/ת + שמות ההורים ·
        brit → שמות ההורים · birthday → שם + גיל (optional); then תאריך, שעה, אזור זמן (default Asia/Jerusalem)
Step 3  "באיזו שפה?"  cards: [עברית] [English] [שתיהן] + default language
[יצירת ההזמנה] → skeleton "מכינים את ההזמנה שלכם…" (<1s) → editor
```

**D. Editor — `/app/invitations/[id]/edit`** (desktop ≥1280: 280 | 400 | canvas)
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [פרסום] [תצוגה מקדימה] ↷ ↶        [עב | EN]  [נייד | מחשב]        נועה & איתי · חתונה [טיוטה]   →   │ 56px
│                                                                    ✓ כל השינויים נשמרו            │
├──────────────────────────────────┬───────────────────────────┬─────────────────────────────────────┤
│ CANVAS (1fr, #EFEDEA + dot grid) │ FORM PANEL (400px, bg)    │ RAIL (280px, surface)               │
│  (תצוגה חיה · 390×844)           │ פתיחה (Hero)               │ [סקשנים] [עיצוב] [הגדרות]            │
│        ┌──────────┐              │ helper line                │ 🔒 מעטפה ופתיחה                      │
│        │  phone   │              │ ┌ טקסטים ───────────────┐  │▌🔒 פתיחה (Hero)        ← selected    │
│        │  frame   │              │ │ שורת פתיחה   [עב|EN]  │  │ ⋮⋮ ספירה לאחור           (●)        │
│        │ (iframe) │              │ │ [input]        14/40  │  │ ⋮⋮ הסיפור שלנו            (●)        │
│        └──────────┘              │ │ כותרת [שמות|טקסט חופשי]│  │ ⋮⋮ מקום האירוע           (●)        │
│ [▶ הפעלת הפתיחה מחדש] [לשונית]  │ └───────────────────────┘  │ ⋮⋮ גלריה                  (○) faint │
│                                  │ ┌ רקע ──────────────────┐  │ 🔒 סיום                              │
│                                  │ │ [thumb][thumb][upload] │  │ [+ הוספת סקשן]  (dashed, 40px)      │
│                                  │ │ הכהיית רקע ───●── 35% │  │                                     │
└──────────────────────────────────┴───────────────────────────┴─────────────────────────────────────┘
Tablet 1024–1279: rail collapses to 64px icons.   Mobile <1024: full-width form + bottom tab bar
[עריכה | תצוגה | עיצוב | פרסום]; the section list is a bottom sheet.
```
- Section row: 44px, grip (faint) · icon (muted) · name · switch; selected = `subtle` bg + 3px bar at inline-start; disabled = faint text; hero/cover/footer show a lock and no grip. "+ הוספת סקשן" opens a popover grid of section types (icon + name + one-line description).
- Form panel: title + helper, then grouped **cards** (13px/700 muted card titles). List items (venues, timeline, FAQ, gift links) are collapsible cards with a grip, summary line and ⋯ menu (duplicate/delete); "+ הוספה" at the bottom.
- Canvas: "תצוגה חיה" chip at top/inline-start; phone scaled to fit (`min(1, (canvasHeight − 120) / 844)`); under it "Replay opening" and "Open in new tab". Desktop mode shows a 1280×800 browser frame scaled.
- **Preview wiring:** the phone is an **iframe** to `/app/invitations/[id]/preview-frame` (so `svh`, media queries, `dir`/`lang` behave like a real phone). The parent posts `{type:'doc', doc, locale}` on every change (150ms debounce); the frame posts `{type:'select', path}` when an element with `data-edit-path` is clicked; the parent posts `{type:'highlight', path}` when a field is focused (the frame outlines the node: 2px `#2563EB` + small label chip).

**E. Design tab (rail → עיצוב)**
Palette presets as cards (3 dots + name, selected ring) → "התאמה אישית" expands color inputs for `editablePaletteKeys` with a live contrast badge (`AA ✓` / `נמוך ⚠`) · font pairs as cards rendering "נועה & איתי / Noa & Itay" in that pair · cover: monogram input (per locale, counter vs `maxGlyphs`) + live mini overlay preview + seal color swatches · hero options as 9:16 thumbnails + upload tile (focal-point picker in a dialog) + overlay slider · music list (play 10s preview, select, toggle, upload with rights checkbox).

**F. Publish dialog → Share screen**
```
Publish dialog (560px): slug field  [yourapp.co.il/i/][noa-and-itay] ✓ פנוי
                         issues list: ⛔ errors (block) / ⚠ warnings — each row clicks to the field
                         WhatsApp card preview · [פרסום] primary
Share screen (2 cols ≥900):  [link + copy] · message textarea (prefilled in default locale) ·
                             [שליחה בוואטסאפ] (#25D366, 48px) [העתקת ההודעה] │ WhatsApp bubble preview · QR + PNG/SVG
```

**G. Responses — `/app/invitations/[id]/responses`**
```
אישורי הגעה                                                     [שיתוף] [ייצוא ל-Excel]
נועה & איתי · יום חמישי, 17 ביוני 2027 · [פורסם]
┌ מגיעים 184 ┐ ┌ תשובות 97 ┐ ┌ לא מגיעים 14 ┐ ┌ עד הדדליין 9 ימים ┐     KPI: 30px/700 tabular
│152 מבוגרים · 32 ילדים│ │+12 השבוע│ │14% מהתשובות│ │1 ביוני 2027│
┌ העדפות תזונה (bars) ┐ ┌ custom question breakdown (bars) ┐
┌ [🔍 חיפוש…] [הכל|מגיעים|לא מגיעים] [סינון] ───────────────────────────────┐
│ שם │ סטטוס │ מבוגרים │ ילדים │ תזונה (tags) │ הסעה │ הודעה (ellipsis) │ התקבל │
└──────────────────────────────────────────────────────────────────────────────┘
Row click → Drawer: full response, attendees list with dietary, answers, message, delete.
Empty: "עוד אין תשובות — שתפו את ההזמנה" + [שיתוף].
```

**H. States & microcopy**
- Loading: skeletons shaped like the final UI (posters, KPI cards, table rows). Never spinners on full pages.
- Autosave: "שומר…" → "✓ כל השינויים נשמרו"; failure → persistent toast "השינויים לא נשמרו" + [ניסיון חוזר]; offline banner in the editor.
- Validation copy is specific and actionable: "חסר תרגום לאנגלית ב'שורת מיקום'", not "שגיאה".
- Hebrew tone: warm, short, plural/gender-inclusive imperatives ("לחצו", "שתפו", "בחרו"); numbers and dates always via `Intl`.

---

## 10. Full examples (use as fixtures, seeds and tests)
Also available as files in `docs/invitations/fixtures/` and `docs/invitations/i18n/` — import those.

### 10.1 Hebrew-first bilingual wedding (he + en) — `sahar-bordeaux`
Rendered result (HE): cover = ivory envelope with bordeaux seal "נ&א" → hero: "אנחנו מתחתנים" / **נועה & איתי** / `יום חמישי, 17 ביוני 2027 · י״ב בסיון תשפ״ז` / זכרון יעקב → countdown → story → venue "אחוזת הגפן" with map + Google Maps / Waze / calendar → timeline 19:30 קבלת פנים · 20:30 חופה וקידושין · 21:15 ארוחה · 22:00 ריקודים · 00:00 אפטר → shuttles → dress code → gifts (Bit/PayBox) → FAQ → RSVP (kosher-mehadrin option, shuttle question, deadline 1 June 2027) → footer with parents' names. Switching to EN flips to LTR with the English texts and `Thursday, 17 June 2027 · 12 Sivan 5787`.

```json
{
  "schemaVersion": 1,
  "templateId": "sahar-bordeaux",
  "eventType": "wedding",
  "locales": [
    "he",
    "en"
  ],
  "defaultLocale": "he",
  "timezone": "Asia/Jerusalem",
  "hosts": {
    "primary": {
      "he": "נועה",
      "en": "Noa"
    },
    "secondary": {
      "he": "איתי",
      "en": "Itay"
    },
    "joiner": {
      "he": "&",
      "en": "&"
    },
    "parents": {
      "he": "מרים ודני לוי · רונית ואבי כהן",
      "en": "Miriam & Dani Levi · Ronit & Avi Cohen"
    }
  },
  "event": {
    "date": "2027-06-17",
    "startTime": "19:30",
    "endTime": "01:00",
    "hebrewDate": "day",
    "timeFormat": null,
    "rsvpDeadline": "2027-06-01"
  },
  "theme": {
    "fontPairId": "classic-script",
    "palette": {
      "accent": "#731F2E"
    }
  },
  "cover": {
    "enabled": true,
    "monogram": {
      "he": "נ&א",
      "en": "N&I"
    },
    "sealColor": "#731F2E",
    "hint": {
      "he": "לחצו לפתיחת ההזמנה",
      "en": "Tap to open"
    }
  },
  "music": {
    "enabled": true,
    "trackId": "sahar-bordeaux-theme",
    "customUrl": null,
    "volume": 0.6,
    "startAtSec": 0
  },
  "share": {
    "slug": "noa-and-itay",
    "ogTitle": {
      "he": "נועה ואיתי מתחתנים",
      "en": "Noa & Itay are getting married"
    },
    "ogDescription": {
      "he": "יום חמישי, 17 ביוני 2027 · זכרון יעקב",
      "en": "Thursday, 17 June 2027 · Zikhron Ya'akov"
    },
    "ogImage": null,
    "noindex": true
  },
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "enabled": true,
      "data": {
        "eyebrow": {
          "he": "אנחנו מתחתנים",
          "en": "We're getting married"
        },
        "title": {
          "mode": "hosts"
        },
        "showDate": true,
        "locationLine": {
          "he": "זכרון יעקב",
          "en": "Zikhron Ya'akov"
        },
        "media": {
          "kind": "video",
          "src": "template:hero",
          "poster": "template:hero-poster",
          "focalPoint": {
            "x": 0.5,
            "y": 0.4
          }
        },
        "overlayOpacity": 0.35
      }
    },
    {
      "id": "countdown",
      "type": "countdown",
      "enabled": true,
      "data": {
        "title": {
          "he": "ספירה לאחור",
          "en": "Countdown"
        },
        "subtitle": {
          "he": "עד היום הגדול שלנו",
          "en": "Until our big day"
        },
        "target": "event",
        "afterEvent": {
          "he": "תודה שחגגתם איתנו ♥",
          "en": "Thank you for celebrating with us ♥"
        }
      }
    },
    {
      "id": "story",
      "type": "text",
      "enabled": true,
      "data": {
        "kind": "story",
        "title": {
          "he": "יחד, מתחת לגפנים",
          "en": "Together, beneath the vines"
        },
        "subtitle": null,
        "body": {
          "he": "אחרי שבע שנים, שני כלבים ואינספור שקיעות בכרמל —\nהגיע הזמן להגיד \"כן\".\nנשמח שתהיו חלק מהרגע הזה.",
          "en": "Seven years, two dogs and countless Carmel sunsets later —\nit's time to say \"yes\".\nWe would love for you to be part of this moment."
        },
        "illustration": "template:rings-vine",
        "cta": null
      }
    },
    {
      "id": "venues",
      "type": "venues",
      "enabled": true,
      "data": {
        "items": [
          {
            "id": "venue-main",
            "label": {
              "he": "האירוע",
              "en": "The Celebration"
            },
            "name": {
              "he": "אחוזת הגפן",
              "en": "Ahuzat HaGefen"
            },
            "address": {
              "he": "דרך הכרמים 12, זכרון יעקב",
              "en": "12 Derech HaKramim, Zikhron Ya'akov"
            },
            "geo": {
              "lat": 32.5707,
              "lng": 34.9536
            },
            "mapsQuery": "Ahuzat HaGefen Zikhron Yaakov",
            "date": null,
            "startTime": "19:30",
            "endTime": "01:00",
            "showMap": true,
            "buttons": {
              "maps": true,
              "waze": true,
              "calendar": true
            }
          }
        ]
      }
    },
    {
      "id": "timeline",
      "type": "timeline",
      "enabled": true,
      "data": {
        "title": {
          "he": "סדר הערב",
          "en": "Timeline of the evening"
        },
        "showDate": true,
        "revealMode": "none",
        "items": [
          {
            "id": "t1",
            "time": "19:30",
            "label": {
              "he": "קבלת פנים",
              "en": "Welcome"
            },
            "icon": "glass"
          },
          {
            "id": "t2",
            "time": "20:30",
            "label": {
              "he": "חופה וקידושין",
              "en": "Chuppah"
            },
            "icon": "chuppah"
          },
          {
            "id": "t3",
            "time": "21:15",
            "label": {
              "he": "ארוחת ערב",
              "en": "Dinner"
            },
            "icon": "dinner"
          },
          {
            "id": "t4",
            "time": "22:00",
            "label": {
              "he": "ריקודים",
              "en": "Dancing"
            },
            "icon": "music"
          },
          {
            "id": "t5",
            "time": "00:00",
            "label": {
              "he": "מסיבת אפטר",
              "en": "After Party"
            },
            "icon": "party"
          }
        ]
      }
    },
    {
      "id": "transport",
      "type": "text",
      "enabled": true,
      "data": {
        "kind": "transport",
        "title": {
          "he": "הסעות",
          "en": "Transportation"
        },
        "subtitle": {
          "he": "יוצאות בשעה 18:15",
          "en": "Departing at 18:15"
        },
        "body": {
          "he": "יציאה מתל אביב — חניון רידינג.\nיציאה מירושלים — חניון בנייני האומה.\nחזרה בשעה 00:30. נא לסמן בטופס האישור אם תצטרפו.",
          "en": "From Tel Aviv — Reading parking lot.\nFrom Jerusalem — Binyanei HaUma parking.\nReturn shuttles at 00:30. Please indicate in the RSVP form if you'll join."
        },
        "illustration": null,
        "cta": null
      }
    },
    {
      "id": "dress-code",
      "type": "text",
      "enabled": true,
      "data": {
        "kind": "dress_code",
        "title": {
          "he": "קוד לבוש",
          "en": "Dress Code"
        },
        "subtitle": {
          "he": "חגיגי־קיצי",
          "en": "Summer festive"
        },
        "body": {
          "he": "האירוע בחוץ, על הדשא — מומלץ להימנע מעקבי סטילטו.",
          "en": "The celebration is outdoors on the lawn — we suggest skipping stiletto heels."
        },
        "illustration": null,
        "cta": null
      }
    },
    {
      "id": "gifts",
      "type": "gifts",
      "enabled": true,
      "data": {
        "title": {
          "he": "מתנות",
          "en": "Gifts"
        },
        "body": {
          "he": "הנוכחות שלכם היא המתנה הגדולה ביותר. למי שרוצה — אפשר גם כאן:",
          "en": "Your presence is the greatest gift. If you wish, you can also give here:"
        },
        "links": [
          {
            "id": "g1",
            "kind": "bit",
            "label": {
              "he": "העברה בביט",
              "en": "Send via Bit"
            },
            "url": "https://www.bitpay.co.il/app/me/EXAMPLE",
            "details": null
          },
          {
            "id": "g2",
            "kind": "paybox",
            "label": {
              "he": "העברה בפייבוקס",
              "en": "Send via PayBox"
            },
            "url": "https://payboxapp.page.link/EXAMPLE",
            "details": null
          }
        ]
      }
    },
    {
      "id": "faq",
      "type": "faq",
      "enabled": true,
      "data": {
        "title": {
          "he": "שאלות נפוצות",
          "en": "FAQ"
        },
        "items": [
          {
            "id": "q1",
            "q": {
              "he": "יש חניה במקום?",
              "en": "Is there parking at the venue?"
            },
            "a": {
              "he": "כן, חניה חינם בשטח האחוזה.",
              "en": "Yes, free parking on the estate grounds."
            }
          },
          {
            "id": "q2",
            "q": {
              "he": "האוכל כשר?",
              "en": "Is the food kosher?"
            },
            "a": {
              "he": "כן, כשר בהשגחת הרבנות. אפשר לבקש כשר למהדרין בטופס.",
              "en": "Yes, rabbinate-certified kosher. Mehadrin meals can be requested in the form."
            }
          }
        ]
      }
    },
    {
      "id": "rsvp",
      "type": "rsvp",
      "enabled": true,
      "data": {
        "title": {
          "he": "אישור הגעה",
          "en": "RSVP"
        },
        "subtitle": {
          "he": "נשמח לדעת אם תגיעו",
          "en": "Please let us know if you can make it"
        },
        "askChildren": true,
        "maxAdults": 4,
        "maxChildren": 4,
        "requirePhone": true,
        "requireEmail": false,
        "perAttendeeDetails": true,
        "dietary": {
          "enabled": true,
          "options": [
            "none",
            "kosher_mehadrin",
            "vegetarian",
            "vegan",
            "gluten_free",
            "nut_allergy",
            "other_allergy",
            "kids_meal"
          ],
          "note": {
            "he": "כל האוכל באירוע כשר. אם אתם צריכים כשר למהדרין — סמנו זאת.",
            "en": "All food served is kosher. If you need a Mehadrin-certified meal, please tick it."
          }
        },
        "customQuestions": [
          {
            "id": "shuttle",
            "type": "select",
            "required": false,
            "label": {
              "he": "מצטרפים להסעה?",
              "en": "Joining a shuttle?"
            },
            "options": [
              {
                "value": "none",
                "label": {
                  "he": "לא צריך",
                  "en": "No thanks"
                }
              },
              {
                "value": "tlv",
                "label": {
                  "he": "מתל אביב",
                  "en": "From Tel Aviv"
                }
              },
              {
                "value": "jlm",
                "label": {
                  "he": "מירושלים",
                  "en": "From Jerusalem"
                }
              }
            ]
          }
        ],
        "messageLabel": {
          "he": "ברכה לזוג",
          "en": "Message for the couple"
        },
        "successMessage": {
          "he": "תודה! קיבלנו את האישור שלכם ♥",
          "en": "Thank you! Your RSVP has been received ♥"
        },
        "declineMessage": {
          "he": "תודה שעדכנתם, נתגעגע!",
          "en": "Thanks for letting us know — we'll miss you!"
        },
        "closedMessage": {
          "he": "מועד אישורי ההגעה הסתיים. לשאלות אפשר לפנות אלינו ישירות.",
          "en": "RSVPs are now closed. Please contact us directly with any questions."
        }
      }
    },
    {
      "id": "footer",
      "type": "footer",
      "enabled": true,
      "data": {
        "showHosts": true,
        "showDate": true,
        "showParents": true,
        "closingLine": {
          "he": "מחכים לראותכם",
          "en": "Can't wait to see you"
        },
        "showCredit": true
      }
    }
  ]
}
```

### 10.2 English baby shower (en only, LTR) — `honey-meadow`
Rendered result: kraft envelope with a honey-coloured hexagonal wax seal embossed "M" → hero video with custom title **Maya's Baby Shower**, `Sunday, 14 March 2027` → "Due Date Countdown" targeting 20 April 2027 → venue (no embedded map, Maps + calendar buttons, 11:00 AM – 2:00 PM) → "Books for Baby" note → gift registry → RSVP (email + phone required, standard dietary list) → footer.

```json
{
  "schemaVersion": 1,
  "templateId": "honey-meadow",
  "eventType": "baby_shower",
  "locales": [
    "en"
  ],
  "defaultLocale": "en",
  "timezone": "Europe/London",
  "hosts": {
    "primary": {
      "en": "Maya"
    },
    "secondary": null,
    "joiner": null,
    "parents": null
  },
  "event": {
    "date": "2027-03-14",
    "startTime": "11:00",
    "endTime": "14:00",
    "hebrewDate": "off",
    "timeFormat": "12h",
    "rsvpDeadline": "2027-03-01"
  },
  "theme": {
    "fontPairId": "playful-serif",
    "palette": null
  },
  "cover": {
    "enabled": true,
    "monogram": {
      "en": "M"
    },
    "sealColor": "#E0A526",
    "hint": {
      "en": "Tap to open"
    }
  },
  "music": {
    "enabled": true,
    "trackId": "honey-meadow-theme",
    "customUrl": null,
    "volume": 0.5,
    "startAtSec": 0
  },
  "share": {
    "slug": "mayas-baby-shower",
    "ogTitle": {
      "en": "Maya's Baby Shower"
    },
    "ogDescription": {
      "en": "Sunday, 14 March 2027 · The Orchard Room"
    },
    "ogImage": null,
    "noindex": true
  },
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "enabled": true,
      "data": {
        "eyebrow": {
          "en": "Boy or girl — we can't wait to meet you!"
        },
        "title": {
          "mode": "custom",
          "text": {
            "en": "Maya's Baby Shower"
          }
        },
        "showDate": true,
        "locationLine": null,
        "media": {
          "kind": "video",
          "src": "upload:hero-watercolor.mp4",
          "poster": "upload:hero-watercolor.jpg",
          "focalPoint": {
            "x": 0.5,
            "y": 0.35
          }
        },
        "overlayOpacity": 0.2
      }
    },
    {
      "id": "countdown",
      "type": "countdown",
      "enabled": true,
      "data": {
        "title": {
          "en": "Due Date Countdown"
        },
        "subtitle": null,
        "target": {
          "date": "2027-04-20",
          "time": "00:00"
        },
        "afterEvent": {
          "en": "Baby is here! 💛"
        }
      }
    },
    {
      "id": "venues",
      "type": "venues",
      "enabled": true,
      "data": {
        "items": [
          {
            "id": "venue-main",
            "label": {
              "en": "The Venue"
            },
            "name": {
              "en": "The Orchard Room"
            },
            "address": {
              "en": "42 Willow Lane, Brighton BN1 1AA"
            },
            "geo": null,
            "mapsQuery": "42 Willow Lane Brighton",
            "date": null,
            "startTime": "11:00",
            "endTime": "14:00",
            "showMap": false,
            "buttons": {
              "maps": true,
              "waze": false,
              "calendar": true
            }
          }
        ]
      }
    },
    {
      "id": "book-note",
      "type": "text",
      "enabled": true,
      "data": {
        "kind": "custom",
        "title": {
          "en": "Books for Baby"
        },
        "subtitle": null,
        "body": {
          "en": "Instead of a card, please bring your favourite children's book with a little note inside."
        },
        "illustration": "template:daisy-bunch",
        "cta": null
      }
    },
    {
      "id": "gifts",
      "type": "gifts",
      "enabled": true,
      "data": {
        "title": {
          "en": "Gifts"
        },
        "body": {
          "en": "Your presence is the greatest gift we could ask for. If you'd like to spoil Baby, we've put together a small wish list."
        },
        "links": [
          {
            "id": "g1",
            "kind": "registry",
            "label": {
              "en": "Gift Registry"
            },
            "url": "https://example.com/registry/maya",
            "details": null
          }
        ]
      }
    },
    {
      "id": "rsvp",
      "type": "rsvp",
      "enabled": true,
      "data": {
        "title": {
          "en": "RSVP"
        },
        "subtitle": {
          "en": "Please let us know if you can make it."
        },
        "askChildren": true,
        "maxAdults": 3,
        "maxChildren": 3,
        "requirePhone": true,
        "requireEmail": true,
        "perAttendeeDetails": true,
        "dietary": {
          "enabled": true,
          "options": [
            "none",
            "gluten_free",
            "dairy_free",
            "vegan",
            "vegetarian",
            "pescatarian",
            "nut_allergy",
            "other_allergy"
          ],
          "note": null
        },
        "customQuestions": [],
        "messageLabel": {
          "en": "Message for Maya"
        },
        "successMessage": {
          "en": "Thank you! We can't wait to celebrate with you."
        },
        "declineMessage": {
          "en": "Thanks for letting us know — you'll be missed!"
        },
        "closedMessage": {
          "en": "RSVPs are now closed. Please contact Maya directly."
        }
      }
    },
    {
      "id": "footer",
      "type": "footer",
      "enabled": true,
      "data": {
        "showHosts": false,
        "showDate": true,
        "showParents": false,
        "closingLine": {
          "en": "With love, Maya & Tom"
        },
        "showCredit": true
      }
    }
  ]
}
```

### 10.3 Hebrew save-the-date (he only) — `sahar-bordeaux`
Rendered result: envelope → hero "אנחנו מתחתנים!" with names only → **scratch-to-reveal** card showing the date + "הוספה ליומן" → short note → footer.

```json
{
  "schemaVersion": 1,
  "templateId": "sahar-bordeaux",
  "eventType": "save_the_date",
  "locales": [
    "he"
  ],
  "defaultLocale": "he",
  "timezone": "Asia/Jerusalem",
  "hosts": {
    "primary": {
      "he": "נועה"
    },
    "secondary": {
      "he": "איתי"
    },
    "joiner": {
      "he": "&"
    },
    "parents": null
  },
  "event": {
    "date": "2027-06-17",
    "startTime": "19:30",
    "endTime": "01:00",
    "hebrewDate": "day",
    "timeFormat": null,
    "rsvpDeadline": null
  },
  "theme": {
    "fontPairId": "classic-script",
    "palette": null
  },
  "cover": {
    "enabled": true,
    "monogram": {
      "he": "נ&א"
    },
    "sealColor": "#731F2E",
    "hint": {
      "he": "לחצו לפתיחה"
    }
  },
  "music": {
    "enabled": true,
    "trackId": "sahar-bordeaux-theme",
    "customUrl": null,
    "volume": 0.6,
    "startAtSec": 0
  },
  "share": {
    "slug": "noa-and-itay-save-the-date",
    "ogTitle": {
      "he": "שמרו את התאריך — נועה ואיתי"
    },
    "ogDescription": {
      "he": "הזמנה רשמית תישלח בהמשך"
    },
    "ogImage": null,
    "noindex": true
  },
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "enabled": true,
      "data": {
        "eyebrow": {
          "he": "אנחנו מתחתנים!"
        },
        "title": {
          "mode": "hosts"
        },
        "showDate": false,
        "locationLine": null,
        "media": {
          "kind": "image",
          "src": "template:hero-poster",
          "poster": null,
          "focalPoint": {
            "x": 0.5,
            "y": 0.5
          }
        },
        "overlayOpacity": 0.3
      }
    },
    {
      "id": "reveal",
      "type": "reveal",
      "enabled": true,
      "data": {
        "title": {
          "he": "שמרו את התאריך"
        },
        "mechanic": "scratch",
        "prompt": {
          "he": "(גרדו כדי לגלות)"
        },
        "showCalendarButton": true
      }
    },
    {
      "id": "note",
      "type": "text",
      "enabled": true,
      "data": {
        "kind": "custom",
        "title": null,
        "subtitle": null,
        "body": {
          "he": "פרק חדש עומד להתחיל, ואנחנו כל כך מתרגשים לחגוג אותו עם האנשים הכי חשובים לנו.\nהזמנה רשמית תישלח בהמשך."
        },
        "illustration": null,
        "cta": null
      }
    },
    {
      "id": "footer",
      "type": "footer",
      "enabled": true,
      "data": {
        "showHosts": true,
        "showDate": true,
        "showParents": false,
        "closingLine": {
          "he": "באהבה,"
        },
        "showCredit": true
      }
    }
  ]
}
```

### 10.4 System strings dictionary (he + en) — `i18n/invitations.<locale>.json`
Plural entries use `{ one, other }` (resolve with `Intl.PluralRules`, fall back to `other`). `{n}`, `{date}`, `{brand}` are interpolation tokens. `rsvp.deadline` is shown only when the RSVP `subtitle` is null (pack defaults put `{deadline}` inside the subtitle).

```json
{
  "he": {
    "cover.hint": "לחצו לפתיחה",
    "cover.skip": "דלגו",
    "music.play": "הפעלת מוזיקה",
    "music.pause": "השתקת מוזיקה",
    "locale.switch": "English",
    "countdown.days": { "one": "יום", "other": "ימים" },
    "countdown.hours": { "one": "שעה", "other": "שעות" },
    "countdown.minutes": { "one": "דקה", "other": "דקות" },
    "countdown.seconds": { "one": "שנייה", "other": "שניות" },
    "venue.openInMaps": "פתיחה במפות",
    "venue.openInWaze": "ניווט ב-Waze",
    "venue.addToCalendar": "הוספה ליומן",
    "calendar.google": "Google",
    "calendar.apple": "Apple",
    "calendar.outlook": "Outlook",
    "rsvp.willAttend": "תגיעו?",
    "rsvp.yes": "כן, נגיע!",
    "rsvp.no": "לצערנו לא נוכל להגיע",
    "rsvp.adults": "כמה מבוגרים?",
    "rsvp.children": "כמה ילדים?",
    "rsvp.decrease": "הפחתה",
    "rsvp.increase": "הוספה",
    "rsvp.adultDetails": "פרטי המבוגרים",
    "rsvp.childDetails": "פרטי הילדים",
    "rsvp.primaryContact": "איש קשר ראשי",
    "rsvp.person": "אורח/ת {n}",
    "rsvp.child": "ילד/ה {n}",
    "rsvp.firstName": "שם פרטי",
    "rsvp.lastName": "שם משפחה",
    "rsvp.fullName": "שם מלא",
    "rsvp.age": "גיל",
    "rsvp.phone": "טלפון",
    "rsvp.phonePlaceholder": "050-000-0000",
    "rsvp.email": "אימייל",
    "rsvp.dietary": "העדפות תזונה",
    "rsvp.dietaryNotes": "פרטו אלרגיות או בקשות מיוחדות",
    "rsvp.message": "הודעה",
    "rsvp.submit": "שליחה",
    "rsvp.sending": "שולחים…",
    "rsvp.deadline": "נשמח לתשובה עד {date}",
    "rsvp.editResponse": "עדכון התשובה שלי",
    "rsvp.error.required": "שדה חובה",
    "rsvp.error.phone": "מספר טלפון לא תקין",
    "rsvp.error.email": "כתובת אימייל לא תקינה",
    "rsvp.error.contact": "נא למלא טלפון או אימייל",
    "rsvp.error.network": "משהו השתבש. נסו שוב בעוד רגע.",
    "diet.none": "ללא העדפות",
    "diet.kosher": "כשר",
    "diet.kosher_mehadrin": "כשר למהדרין",
    "diet.vegetarian": "צמחוני",
    "diet.vegan": "טבעוני",
    "diet.gluten_free": "ללא גלוטן",
    "diet.dairy_free": "ללא חלב",
    "diet.pescatarian": "פסקטריאני",
    "diet.nut_allergy": "אלרגיה לאגוזים (פרטו בהערות)",
    "diet.other_allergy": "אלרגיה אחרת (פרטו בהערות)",
    "diet.kids_meal": "מנת ילדים",
    "footer.madeWith": "נוצר באהבה ב-{brand}"
  },
  "en": {
    "cover.hint": "Tap to open",
    "cover.skip": "Skip",
    "music.play": "Play music",
    "music.pause": "Mute music",
    "locale.switch": "עברית",
    "countdown.days": { "one": "Day", "other": "Days" },
    "countdown.hours": { "one": "Hour", "other": "Hours" },
    "countdown.minutes": { "one": "Minute", "other": "Minutes" },
    "countdown.seconds": { "one": "Second", "other": "Seconds" },
    "venue.openInMaps": "Open in Maps",
    "venue.openInWaze": "Open in Waze",
    "venue.addToCalendar": "Add to Calendar",
    "calendar.google": "Google",
    "calendar.apple": "Apple",
    "calendar.outlook": "Outlook",
    "rsvp.willAttend": "Will you attend?",
    "rsvp.yes": "Yes, I'll be there",
    "rsvp.no": "Unfortunately, I can't make it",
    "rsvp.adults": "How many adults?",
    "rsvp.children": "How many children?",
    "rsvp.decrease": "Decrease",
    "rsvp.increase": "Increase",
    "rsvp.adultDetails": "Adult details",
    "rsvp.childDetails": "Child details",
    "rsvp.primaryContact": "Primary contact",
    "rsvp.person": "Guest {n}",
    "rsvp.child": "Child {n}",
    "rsvp.firstName": "First name",
    "rsvp.lastName": "Last name",
    "rsvp.fullName": "Full name",
    "rsvp.age": "Age",
    "rsvp.phone": "Phone",
    "rsvp.phonePlaceholder": "+44 7700 900000",
    "rsvp.email": "Email",
    "rsvp.dietary": "Dietary requirements",
    "rsvp.dietaryNotes": "Please specify allergies or special requests",
    "rsvp.message": "Message",
    "rsvp.submit": "Send",
    "rsvp.sending": "Sending…",
    "rsvp.deadline": "Kindly reply by {date}",
    "rsvp.editResponse": "Edit my response",
    "rsvp.error.required": "Required",
    "rsvp.error.phone": "Invalid phone number",
    "rsvp.error.email": "Invalid email address",
    "rsvp.error.contact": "Please enter a phone number or email",
    "rsvp.error.network": "Something went wrong. Please try again in a moment.",
    "diet.none": "No dietary requirements",
    "diet.kosher": "Kosher",
    "diet.kosher_mehadrin": "Kosher (Mehadrin)",
    "diet.vegetarian": "Vegetarian",
    "diet.vegan": "Vegan",
    "diet.gluten_free": "Gluten free",
    "diet.dairy_free": "Dairy free",
    "diet.pescatarian": "Pescatarian",
    "diet.nut_allergy": "Nut allergy (please specify in the notes)",
    "diet.other_allergy": "Other allergy (please specify in the notes)",
    "diet.kids_meal": "Kids' meal",
    "footer.madeWith": "Made with love by {brand}"
  }
}
```

### 10.5 Template pack (8 ready templates) — `invitation-templates-pack/`
| id | categories | cover | hero |
|---|---|---|---|
| `sahar-bordeaux` | wedding, engagement, save_the_date | ivory envelope + wax seal (`crack`) | vineyard sunset |
| `papercut-gold` | wedding, engagement | papercut gatefold + gold medallion (`lift`) | stone courtyard & olive tree in a papercut frame |
| `caesarea-shore` | wedding, engagement, save_the_date | sand-linen envelope + teal seal (`crack`) | aqueduct arches at golden hour |
| `ramon-dusk` | wedding, engagement, henna | kraft envelope, jute bow + paper tag (`lift`, `print`) | desert crater at dusk |
| `atara` | bar_mitzvah, bat_mitzvah | velvet tallit pouch + embroidered patch (`lift`) | Torah in window light · alt: stone arch & bougainvillea |
| `nitzan` | brit, baby_shower | muslin swaddle, satin ribbon + wood tag (`lift`, `deboss`) | young olive tree & dandelion seeds |
| `rooftop-dusk` | birthday, engagement, corporate | vintage ticket tears (`ticket_text`, `fade`) — **dark theme** | city rooftops at dusk |
| `honey-meadow` | baby_shower, birthday, brit | kraft envelope + hexagon beeswax seal (`crack`) | sunflower meadow & hot-air balloon |

Every template ships `manifest.json` (contract above), `defaults.json` (HE+EN seed copy for its main event types) and `ASSETS.md`. `honey-meadow` is the test case for the `--inv-heading` rule (honey accent on cream ≈ 1.8:1 → headings use `ink`); `rooftop-dusk` is the test case for dark palettes. Full manifest for reference:

```json
{
  "id": "sahar-bordeaux",
  "version": 2,
  "name": {
    "he": "סהר בורדו",
    "en": "Sahar Bordeaux"
  },
  "description": {
    "he": "מעטפת שנהב עם חותם שעווה בורדו, שקיעה בצבעי מים מעל כרמים ואיורי דיו בגוון ספיה. קלאסי, חם ורומנטי.",
    "en": "Ivory envelope with a bordeaux wax seal, a watercolour sunset over vineyards and sepia ink-and-wash drawings. Classic, warm and romantic."
  },
  "categories": [
    "wedding",
    "engagement",
    "save_the_date"
  ],
  "supportsLocales": [
    "he",
    "en"
  ],
  "previewImage": "/templates/sahar-bordeaux/preview.webp",
  "previewVideo": "/templates/sahar-bordeaux/preview.mp4",
  "tokens": {
    "palette": {
      "bg": "#FBF8F4",
      "surface": "#FAF2EF",
      "ink": "#59141F",
      "inkMuted": "#8A5A62",
      "accent": "#731F2E",
      "accentInk": "#FFFFFF",
      "line": "#D9C3C6",
      "heroText": "#FFFFFF"
    },
    "editablePaletteKeys": [
      "accent",
      "ink",
      "bg"
    ],
    "radius": {
      "card": 16,
      "button": 6
    },
    "divider": "gradient_line"
  },
  "palettePresets": [
    {
      "id": "bordeaux",
      "name": {
        "he": "בורדו",
        "en": "Bordeaux"
      },
      "palette": {
        "accent": "#731F2E",
        "ink": "#59141F"
      }
    },
    {
      "id": "midnight",
      "name": {
        "he": "כחול לילה",
        "en": "Midnight"
      },
      "palette": {
        "accent": "#1F3A5F",
        "ink": "#16263D"
      }
    },
    {
      "id": "olive",
      "name": {
        "he": "זית",
        "en": "Olive"
      },
      "palette": {
        "accent": "#4E5A2E",
        "ink": "#2F361C"
      }
    }
  ],
  "fontPairs": [
    {
      "id": "classic-script",
      "display": {
        "latin": "Pinyon Script",
        "hebrew": "Bellefair"
      },
      "heading": {
        "latin": "Cormorant Garamond",
        "hebrew": "Frank Ruhl Libre"
      },
      "body": {
        "latin": "Cormorant Garamond",
        "hebrew": "Frank Ruhl Libre"
      },
      "ui": {
        "latin": "Lora",
        "hebrew": "Assistant"
      }
    },
    {
      "id": "modern-serif",
      "display": {
        "latin": "Bodoni Moda",
        "hebrew": "Noto Serif Hebrew"
      },
      "heading": {
        "latin": "Bodoni Moda",
        "hebrew": "Noto Serif Hebrew"
      },
      "body": {
        "latin": "Lora",
        "hebrew": "Heebo"
      },
      "ui": {
        "latin": "Inter",
        "hebrew": "Heebo"
      }
    }
  ],
  "cover": {
    "style": "envelope_seal",
    "renderer": "video",
    "poster": "/templates/sahar-bordeaux/cover-poster.webp",
    "posterDesktop": "/templates/sahar-bordeaux/cover-poster-desktop.webp",
    "openVideo": "/templates/sahar-bordeaux/cover-open.mp4",
    "openVideoDesktop": "/templates/sahar-bordeaux/cover-open-desktop.mp4",
    "holdMs": 500,
    "overlay": {
      "kind": "wax_seal",
      "image": "/templates/sahar-bordeaux/seal-blank.png",
      "recolor": true,
      "size": 0.34,
      "offset": {
        "x": 0,
        "y": 0.0
      },
      "exit": "crack",
      "text": {
        "color": "#FFFFFF",
        "effect": "emboss",
        "maxGlyphs": 3
      }
    },
    "sealColors": [
      "#731F2E",
      "#1F3A5F",
      "#B08D57",
      "#2F4F3A"
    ],
    "monogramFont": {
      "latin": "Pinyon Script",
      "hebrew": "Bellefair"
    }
  },
  "hero": {
    "options": [
      {
        "id": "default",
        "name": {
          "he": "שקיעה בכרם",
          "en": "Vineyard sunset"
        },
        "media": {
          "kind": "video",
          "src": "template:hero",
          "poster": "template:hero-poster",
          "focalPoint": {
            "x": 0.5,
            "y": 0.45
          }
        },
        "mediaDesktop": {
          "kind": "video",
          "src": "template:hero-desktop",
          "poster": "template:hero-desktop-poster",
          "focalPoint": {
            "x": 0.5,
            "y": 0.5
          }
        }
      }
    ],
    "textColor": "#FFFFFF",
    "overlayColor": "#1A0A0D",
    "defaultOverlay": 0.35
  },
  "music": {
    "defaultTrackId": "sahar-bordeaux-theme",
    "tracks": [
      {
        "id": "sahar-bordeaux-theme",
        "title": "Strings at Dusk",
        "url": "/templates/sahar-bordeaux/music.mp3",
        "license": "TBD — must be royalty-free for commercial use"
      }
    ]
  },
  "motion": {
    "preset": "soft",
    "revealDistance": 40,
    "revealBlur": true,
    "stagger": 0.08
  },
  "assets": {
    "hero": "/templates/sahar-bordeaux/hero.mp4",
    "hero-poster": "/templates/sahar-bordeaux/hero-poster.webp",
    "hero-desktop": "/templates/sahar-bordeaux/hero-desktop.mp4",
    "hero-desktop-poster": "/templates/sahar-bordeaux/hero-desktop-poster.webp",
    "rings-vine": "/templates/sahar-bordeaux/rings-vine.webp",
    "bicycle": "/templates/sahar-bordeaux/bicycle.webp",
    "harvest-table": "/templates/sahar-bordeaux/harvest-table.webp",
    "vineyard-panorama": "/templates/sahar-bordeaux/vineyard-panorama.webp",
    "grapes": "/templates/sahar-bordeaux/grapes.webp"
  },
  "decorations": {
    "afterHero": null,
    "betweenVenues": "template:vineyard-panorama",
    "afterTimeline": "template:harvest-table",
    "beforeRsvp": "template:grapes",
    "footer": "template:rings-vine"
  },
  "sectionDefaults": {
    "order": [
      "hero",
      "countdown",
      "text",
      "venues",
      "timeline",
      "gallery",
      "faq",
      "gifts",
      "rsvp",
      "footer"
    ],
    "variants": {
      "timeline": "horizontal-icons",
      "venues": "stacked-with-map",
      "countdown": "boxes"
    }
  }
}
```

`defaults.json` for the same template:

```json
{
  "templateId": "sahar-bordeaux",
  "defaults": {
    "wedding": {
      "coverHint": {
        "he": "לחצו לפתיחת ההזמנה",
        "en": "Tap to open"
      },
      "eyebrow": {
        "he": "אנחנו מתחתנים",
        "en": "We're getting married"
      },
      "heroTitle": {
        "mode": "hosts"
      },
      "countdown": {
        "title": {
          "he": "ספירה לאחור",
          "en": "Countdown"
        },
        "subtitle": {
          "he": "עד היום הגדול שלנו",
          "en": "Until our big day"
        },
        "afterEvent": {
          "he": "תודה שחגגתם איתנו ♥",
          "en": "Thank you for celebrating with us ♥"
        }
      },
      "story": {
        "title": {
          "he": "יחד, מתחת לגפנים",
          "en": "Together, beneath the vines"
        },
        "body": {
          "he": "ב־{date} אנחנו מתחתנים,\nויהיה לנו כבוד גדול לחגוג את היום הזה איתכם.",
          "en": "On {date} we will be married,\nand it would mean the world to us to celebrate with you."
        }
      },
      "venueLabels": [
        {
          "he": "האירוע",
          "en": "The Celebration"
        }
      ],
      "timeline": [
        {
          "time": "19:30",
          "label": {
            "he": "קבלת פנים",
            "en": "Welcome"
          },
          "icon": "glass"
        },
        {
          "time": "20:30",
          "label": {
            "he": "חופה וקידושין",
            "en": "Chuppah"
          },
          "icon": "chuppah"
        },
        {
          "time": "21:15",
          "label": {
            "he": "ארוחת ערב",
            "en": "Dinner"
          },
          "icon": "dinner"
        },
        {
          "time": "22:00",
          "label": {
            "he": "ריקודים",
            "en": "Dancing"
          },
          "icon": "music"
        },
        {
          "time": "00:00",
          "label": {
            "he": "מסיבת אפטר",
            "en": "After Party"
          },
          "icon": "party"
        }
      ],
      "extraSections": [
        {
          "kind": "dress_code",
          "title": {
            "he": "קוד לבוש",
            "en": "Dress Code"
          },
          "subtitle": {
            "he": "חגיגי",
            "en": "Festive"
          },
          "body": {
            "he": "נשמח לראותכם בלבוש חגיגי — ונוח מספיק כדי לרקוד כל הלילה.",
            "en": "Dress to celebrate — and comfortable enough to dance all night."
          },
          "illustration": null
        }
      ],
      "rsvp": {
        "title": {
          "he": "אישור הגעה",
          "en": "RSVP"
        },
        "subtitle": {
          "he": "נשמח לדעת אם תגיעו עד {deadline}",
          "en": "Kindly reply by {deadline}"
        },
        "messageLabel": {
          "he": "ברכה לזוג",
          "en": "Message for the couple"
        },
        "successMessage": {
          "he": "תודה! קיבלנו את האישור שלכם ♥",
          "en": "Thank you! Your RSVP has been received ♥"
        },
        "declineMessage": {
          "he": "תודה שעדכנתם, נתגעגע!",
          "en": "Thanks for letting us know — we'll miss you!"
        },
        "closedMessage": {
          "he": "מועד אישורי ההגעה הסתיים. לשאלות אפשר לפנות אלינו ישירות.",
          "en": "RSVPs are now closed. Please contact us directly with any questions."
        },
        "dietaryOptions": [
          "none",
          "kosher_mehadrin",
          "vegetarian",
          "vegan",
          "gluten_free",
          "nut_allergy",
          "other_allergy",
          "kids_meal"
        ],
        "dietaryNote": {
          "he": "כל האוכל באירוע כשר. מי שצריך כשר למהדרין — סמנו זאת.",
          "en": "All food served is kosher. If you need a Mehadrin-certified meal, please tick it."
        }
      },
      "closingLine": {
        "he": "מחכים לראותכם",
        "en": "Can't wait to see you"
      }
    }
  }
}
```

## 11. Build order (stop for review after each phase)

| Phase | Deliverables | Done when |
|---|---|---|
| **P0 — Design foundation** | Tokens → CSS variables, font loading per script (with `size-adjust`), icon set (lucide + 3 custom), invitation primitives (buttons, badge, pill, card, field, chip, stepper, divider, reveal) and app primitives (§9B.2) — or mapping to the existing design system; a dev-only **kitchen-sink page** `/dev/invitations` rendering every section variant for every pack template × he/en × light/dark, with placeholder media | Kitchen-sink screenshots at 390×844 match `design-reference/screenshots/inv-*.png` for `sahar-bordeaux`; all 8 templates render cleanly |
| **P1 — Contracts & core render** | Types + Zod + migrations fn; SQL migration + RLS + RPC; template registry loading all 8 pack templates (with media placeholders) + seed script; renderer with hero, countdown, text, venues, timeline, rsvp, footer; dictionaries; `/i/[slug]` public page; `POST /api/invitations/rsvp`; the 3 examples + one demo invitation per template/event type seeded from `defaults.json` | All fixtures and demos render correctly in he/en with placeholders, RSVP rows land in the DB, unit tests for all utilities pass |
| **P2 — Editor** | Gallery + wizard + 3-column editor, localized fields, section list with dnd, design panel, uploads, autosave, publish/versions, validation UX | A new user creates, edits and publishes an invitation without touching code |
| **P3 — Experience** | Video-first cover (overlay recolor + monogram effects + exits, css3d fallback), music controller, locale switcher, calendar/maps/Waze, OG image, share screen (WhatsApp, QR) | Opening works on iOS Safari + Android Chrome + WhatsApp in-app browser |
| **P4 — Dashboard & extras** | Responses dashboard, CSV (BOM) export, email notifications, FAQ, gallery, gifts, reveal (scratch/tap/spin), save-the-date flow, template gallery with preview videos | Host sees live stats; all section types editable |

---

**Design QA gate (every phase with UI):** take Playwright screenshots of what you built (390×844 and 1440×900, HE and EN) and compare them side by side with `docs/invitations/design-reference/screenshots/`. List every visible deviation (spacing, size, color, alignment, RTL mirroring) and fix it before reporting the phase as done. Include the screenshots in the report.

## 12. Acceptance tests (automate what you can — Vitest + Playwright)

1. `formatHebrewDate('2027-06-17','day','he') === 'י״ב בסיון תשפ״ז'`; `'eve'` → `'אור לי״ג בסיון תשפ״ז'`; en → `'12 Sivan 5787'`.
2. `eventRange` for 19:30–01:00 on 2027-06-17 Asia/Jerusalem → start `2027-06-17T16:30:00Z`, end `2027-06-17T22:00:00Z`.
3. Google/Outlook URLs and `.ics` open with the correct local time; `.ics` passes a validator.
4. Bilingual fixture: toggling locale flips `dir`, all texts switch, no English system string appears in HE (snapshot both).
5. Publishing is blocked when any L10n misses a locale; error list deep-links to the field.
6. RSVP: yes with 2 adults + 1 child creates 1 response + 3 attendees; decreasing then increasing adults preserves typed data; `none` + `vegan` cannot both be checked; nut allergy requires notes; honeypot filled → rejected silently (200 with fake success, nothing stored); <3s submit → rejected; after deadline → closed message; edit token updates instead of duplicating.
7. CSV export opens in Excel with correct Hebrew.
8. Visual regression (Playwright, 390×844) for each fixture in each locale, with `?open=1` and reduced motion; plus one snapshot per template × palette preset × locale using its seeded demo.
8b. Cover: monogram `נ&א` and `N&I` render inside the overlay in the right font; `DANA 30` fits the ticket; with media missing the cover falls back to CSS and still opens; with media present the poster→video transition shows no visible jump (compare first video frame to poster, pixel diff < 2%).
9. Lighthouse mobile on `/i/noa-and-itay`: Performance ≥ 85, Accessibility ≥ 95.
10. RLS tests: anonymous cannot read drafts/responses; owner A cannot read owner B's data.
11. Design: the public page for `noa-and-itay` at 390×844 (`?open=1`) is visually equivalent to `design-reference/invitation.html` (same section order, type scale ±2px, spacing ±4px, colors exact); editor, gallery, responses and share screens at 1440×900 follow `app.html` layouts; RTL mirroring correct everywhere (steppers, switches, bars, directional icons, drawers from inline-end).
12. Kitchen-sink: no text overflow or overlap with the longest allowed strings (20-char names, 40-char eyebrow, 22-char timeline labels) in every template and locale.
13. v2: `migrateDocument` is pure, lossless and idempotent on every template's defaults, every demo and the fixtures, and they render the same; the showcase (`/dev/invitations/render/<id>/<lang>/cinematic`, `?opening=`, `?cinematic=0`, `?motion=`) renders every layout and opening on a phone and a desktop, statically with reduced motion, through a language switch, and plainly without the feature (`tests/e2e/cinematic.spec.ts`); `npm run perf:templates` passes.

---

## 13. What to send back after each phase
- Summary of what exists now (routes, tables, components).
- List of files created/modified (and any change outside the feature folder, with justification).
- Commands to run migrations, seeds, tests and the dev server.
- Screenshots (or Playwright artifacts) of the fixtures in HE and EN.
- Decisions/assumptions made and open questions for me.
