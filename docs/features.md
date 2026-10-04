# Feature flags: what each event may use

Every new capability sits behind a flag (`src/features/flags`). A feature is on for an event when:

1. **this deployment offers it** — not listed in `INVITES_FEATURES_OFF`, and its setup exists: the AI
   features (`gallery_ai`, `translate_ai`) need `ANTHROPIC_API_KEY` + `INVITES_AI_MODEL`;
   `face_albums` needs `INVITES_FACE_ALBUMS=on` (biometric data — see below); the `planning` features
   need `INVITES_PLANNING=on` (see "Event planning" below). `art_direction` works
   without the AI (its composer) and `voice` without the speech service (the guest's device reads) —
   both are better with them;
2. **the host hasn't switched it off** for the event (`PATCH /api/invitations/:id/features { feature, off }`);
3. **the owner's plan includes it** — or the platform granted it to the event (`grantFeature()`, server
   only: admins, partners). The platform's admins (`INVITES_ADMIN_EMAILS`) have everything offered.

The server enforces it (`featuresFor(invitationId)` for guests' pages and APIs, `featureInput()` for
reasons); the screens hide what is off and offer the package that has it (`packageFor()`), so a feature
that is off never shows a broken button.

## Packages

The plans are the packages: Free = **Basic**, Pro = **Premium**, Business = **VIP**. Each includes the one
before it.

| Package | Adds |
|---|---|
| Basic | `cinematic`, `seating`, `languages`, `draft_review`, `analytics`, `planning` |
| Premium | `seating_auto`, `seating_guide`, `live_gallery`, `gallery_ai`, `translate_ai`, `voice`, `planning_ai`, `planning_export` |
| VIP | `checkin`, `projector`, `auto_reel`, `face_albums`, `art_direction`, `planning_templates` |

Changing a package is one line in `PACKAGE_FEATURES` (`src/features/flags/features.ts`).

## Languages (`languages`, `translate_ai`)

An invitation can be in any of seven languages — Hebrew, English, Russian, Arabic, French, Spanish and
Amharic. Hebrew and English are free for every event; the other five need `languages` (in Basic, so on
unless this deployment or the host switched it off). The server refuses a draft save or a publish that
adds one of them without the feature (`402 languages`), and the editor doesn't offer them.

`translate_ai` fills a language's missing texts with a machine translation (one call to the AI model
per language, names and places never sent, the invitation's glossary kept as it is). The texts go into
the draft and wait for the host: the side-by-side review approves them one by one or all at once, and
publishing waits (`422 translations_unreviewed`) while a language has machine text the host hasn't
approved — or whose original changed since. What the host writes counts as approved. Without the
feature (or without an AI model) the same review screen is where hosts translate by hand. A host has
30 machine runs a day (`TRANSLATE_LIMITS`).

## Event planning (`planning`, `planning_ai`, `planning_export`, `planning_templates`)

An invitation's "Event planning" tab (`/app/invitations/:id/plan`): tasks, budget, vendors, and notes &
ideas. It lives only inside the invitations system — nothing is read from or shared with Badook Events.

**Rolling it out.** The tab stays hidden until `INVITES_PLANNING=on`. Apply the planning migrations
(`supabase/migrations/*_planning_*.sql`) to the database *before* turning it on (and before the code that
uses them is deployed with the switch on). `amplify.yml` turns it on for the production branch (`main`) when
the console has no value of its own — a console value, e.g. `false`, wins — and the other branches stay off
until their database has the migrations. `INVITES_FEATURES_OFF=planning` switches it off again for the
whole deployment; the host can switch it off for one event (nothing is deleted), and an admin can grant a
paid tool to one event.

**What each package gets.** Basic (Free): the section — tasks, budget, vendors, ideas, the weekly email
and the calendar export. Premium (Pro): `planning_ai` (a plan drafted from a description of the event, and
an idea card's "summarize and suggest steps" — needs `ANTHROPIC_API_KEY` + `INVITES_AI_MODEL`, capped per
account by `INVITES_PLANNING_AI_DAILY_LIMIT` and site-wide by `INVITES_AI_DAILY_LIMIT`) and
`planning_export` (the budget as an Excel file, and files attached to vendors and costs). VIP (Business):
`planning_templates` (the host's own plans saved as templates, up to 20). A tool outside the package is
shown as a soft upgrade card, never a broken button.

**How it fits the invitation.** Plans start from a template written for the kind of event (code,
`src/features/planning/templates`, Hebrew and English): wedding, bar and bat mitzvah, brit in full;
engagement, henna, baby shower, birthday and company event light; "other" starts from the system tasks, a
draft from the AI, or a saved template. A save-the-date has no plan (it lives on the full invitation).
The five steps of "the road to a perfect invitation" are *system tasks* judged by the same function
(`systemTaskDone`), so the overview and the task list never disagree; the RSVP deadline and the final
head-count follow the invitation's own deadline. The budget follows the invitation system only as far as
the host chose — standalone, recommended (vendors, tasks, the overview card; the default) or full (the
guest list and replies, the seating, today's payments on the event day) — and turning a link off deletes
nothing.

**Data.** `plan_settings`, `plan_tasks`, `budget_categories`, `budget_items`, `budget_payments`,
`plan_vendors`, `plan_ideas`, `plan_templates`: row level security on with no policies, every read and
write through owner-checked functions (service role only), money computed in the database
(`planning_totals`), files in the private `plan-files` bucket (`<owner>/<invitation>/…`). The weekly email
is part of the daily run (`sendPlanReminders`), once in six days per plan, owner only.

## Per event

`invitations.features` keeps an event's own choices: `{ "off": [...], "grant": [...] }`. Switched off wins
over a grant (it's the host's event). Unknown ids are ignored, so removing a feature needs no migration.

## Cinematic (`cinematic`)

Each section's picture or video, its layout, motion and colors, the cinematic openings and the
design-wide "Style & motion" (invitation schema v2). In the editor these controls show only when the
event has the feature; without it "add section" and "duplicate" add content only, and the server refuses
a draft that brings a v2 value the stored draft doesn't have (`PATCH /api/invitations/:id` → 403
`feature_off`, the paths in `issues`) — what the draft already has stays, so a host whose feature went
away keeps saving. Guests then get the design's plain rendering. Colors from a photo and the suggested
fonts aren't part of it: they set ordinary colors and fonts.

## Face search — "the photos I'm in" (`face_albums`, biometric data)

Faces are biometric data — "sensitive information" under the Privacy Protection Law (amendment 13). The
feature stays off everywhere until `INVITES_FACE_ALBUMS=on`, which should follow a legal review. Even then
it is never on by default: it is the one **opt-in** feature (`OPT_IN` in `src/features/flags/features.ts`)
— the host turns it on for their event in the gallery tab (`invitation_feature_on`, the event's `on`
list), and turning it off erases the event's face data at once. When on:

- **Guests** (the gallery page, `/e/<slug>/upload`): "Find the photos I'm in" → an explicit consent screen
  (what is processed, that it happens on the phone, how long anything is kept, a link to the privacy
  policy's section 7C, a separate unticked checkbox) → a selfie (camera or file) → a downloadable album
  of the published photos they appear in. The selfie never leaves the phone: the phone runs the model and
  sends only the 128-number descriptor, once per search, compared in SQL (`gallery_face_search`, Euclidean
  distance ≤ 0.52, no pgvector) and neither stored nor logged. "Forget me" erases the matching faces (≤ 0.6)
  and the guest's opt-out at once; "don't show me in others' searches" excludes the matching faces and keeps
  only that descriptor, so photos added later leave the guest out too. APIs: `/api/gallery/faces/{search,
  leave,forget,index}`.
- **Indexing** happens on devices: the phone that uploaded a photo (only when the event has the feature,
  not on data saver / 2G / very low memory), and the host's browser — "Prepare face search" in the gallery
  tab, with progress, stop, and resuming where it stopped (`/api/invitations/:id/gallery/faces`).
- **Stored**: per-face rows only (`gallery_faces`: photo, box, score, descriptor) plus which photos were
  looked at and the opt-outs. No crops, no names, nothing linking events.
- **Erased**: 30 days after the event (the daily run), at once when the host turns the feature off (a
  trigger) or deletes the gallery or a photo, with the account, and for events that no longer have the
  feature (the daily run checks).
- **The model**: `@vladmandic/face-api` 1.7.15 (MIT) — SSD MobileNet v1 detector (5.6 MB), 68-point
  landmarks (0.36 MB) and the recognition net (6.4 MB), plus the library's browser build (1.3 MB) —
  copied from `node_modules` into `public/face-models/<version>/` by `scripts/copy-face-models.mjs`
  (prebuild/predev), served from the app's own origin with a one-year cache, and loaded only when someone
  uses face search. Nothing is downloaded from the internet at runtime.
- **Off** (deployment, plan or host): the gallery page shows no face search, the APIs refuse (403
  `feature_off`), phones don't index, and the host's card offers to turn it on (or the package).

## Highlights film (`auto_reel`)

A short film of the gallery, made entirely in the host's browser (`/app/invitations/:id/gallery/film`; no
server rendering): the best photos and short clips (sharpness, exposure, resolution, faces when face search
found them, no near-duplicates, spread over the event), which the host can pin, remove and reorder; 30, 60
or 90 seconds; vertical or horizontal; 1080p (720p on weak devices). The music — the invitation's song or
an uploaded file that never leaves the computer — is read on the device (OfflineAudioContext, onset
energy, tempo by autocorrelation, beats by dynamic programming): cuts land on beats, the film ends on a
phrase and the music fades out. Photos move slowly toward the faces without cropping one out; transitions
(cut, dissolve, whip) follow the tempo; title and end cards use the invitation's palette and fonts —
in any of the invitation's languages (its default first): the names, the date as the invitation writes it
and the end card's line in all seven, right to left in Hebrew and Arabic, in the invitation's face for
each script (its Arabic, Ethiopic and Cyrillic faces too), loaded before anything is painted.
Rendering: WebCodecs H.264 (+ AAC, or Opus) muxed into an MP4 by `mp4-muxer`; where H.264 encoding is
missing, the MediaRecorder fallback records in real time (MP4 or WebM, its duration written in). The
result downloads, or joins the gallery as the host's own item (`gallery_items.source = 'host'`) through
the gallery's signed uploads (`POST /api/invitations/:id/gallery/film`), in the feed and on the projector
only if the host ticks it. Off: the studio offers the package or the switch, the API refuses (403
`feature_off`), and the gallery tab's card offers the package.

## The gallery on the invitation (`live_gallery`)

- The editor's "add section" catalog offers a **gallery section** (`live_gallery`, one per invitation)
  only when the event has the feature; the server refuses a draft that adds one without it (403
  `feature_off`). Before and during the event (from 3 hours before it starts until 6 hours after it ends,
  in the event's time zone) it shows a button — and a QR code on wide screens — to `/e/<slug>/upload`,
  carrying the guest's personal link and the language they read in; after the event, "see the album".
  The ISR page renders the same HTML for everyone; the phase is decided in the browser. Without a gallery
  (or the feature) the section renders nothing.
- **The guests' page as stories** (`/e/<slug>/upload`): a circle for each person who shared (the "+" to add
  your own first), newest first, opening a full-screen viewer that plays one person's photos and videos in
  the order they were shared and then the next person's (tap the start side to go back, the rest to go on,
  hold to pause, swipe down to close; with "reduce motion" nothing moves by itself). A ring turns grey once
  the last item was watched — kept on that phone only. Named guests are one story by name; unnamed ones are
  told apart by the feed's opaque `by` key (the start of the uploader's hash — never the device's own id,
  which alone can delete an upload; `gallery_item_json`, migration `20261004000100`); without the migration
  unnamed uploads share one story. The hosts' own items (the highlights film) are one story. The page ends
  with the Badook logo.
- **Sending guests the gallery link** (gallery tab → share card): from the system's WhatsApp number once
  the third Meta template is approved and `INVITES_WHATSAPP_GALLERY_TEMPLATE` names it
  (docs/whatsapp-setup.md §9); otherwise per-guest wa.me links and copied messages. In each guest's
  language, like the invitation and the table number: the template in their language when it is approved
  in it (`INVITES_WHATSAPP_TEMPLATE_LANGS`; Meta's 132001 moves it to the next language at once), else in
  the invitation's; the button, the wa.me text and the copied message open the gallery in their language.
  The dialog counts the messages per language and previews each. Credits and statuses work like the other
  templates.

## Insights (`analytics`)

How guests use an invitation, in the invitation's "Insights" tab: the funnel opened → read to the end →
started the RSVP → replied, the median time on the page, languages, sources (personal link, shared
link, QR, other), devices, a daily chart, personal-link opens and gallery uploads. The beacon loads after
the page is interactive (never in the ISR HTML's critical path), sets no cookies and keeps nothing on the
device (a random per-page-load id in memory), sends nothing under Global Privacy Control / Do Not Track,
and reports with `sendBeacon` to `POST /api/insights`. The server validates, rate-limits per IP hash and
per invitation, drops bots, never stores IPs or user agents, and writes daily aggregates; raw page loads
are erased after 7 days by the daily run. Off: the tab is gone (not offered) or offers the switch, the
beacon isn't mounted, and both APIs refuse (403 `feature_off`).

## The event day (`seating_guide`, `checkin`)

- `seating_guide` (Premium): each guest's table guide (`/e/<slug>/table?g=…`), telling guests their table
  (the second WhatsApp template, the host's own WhatsApp, marked by hand) and the table cards to print.
  The guide opens in the guest's language (`?lang=`, else their language on the guest list, else the
  invitation's) and switches among the invitation's languages; the table number goes out in the guest's
  language when the template is approved in it (the invitation's otherwise), and so does the host's own
  WhatsApp message. The entrance station and the printed cards stay in Hebrew or English.
  Off: the guide answers "not available", the notices API refuses (403 `feature_off`), the buttons are
  gone (the seating screen offers the package instead).
- `checkin` (VIP): the entrance stations (`/e/<slug>/station?t=…`), the entrance QR on the guide and the
  cards, the "Event day" tab (live hall, re-seating live). Off: the stations' link opens nothing, the
  check-in and live APIs refuse, the tab is gone (or offers the package).
- The seating's history of changes (and undo) belongs to `seating`, which every package has.

## Design it for me (`art_direction`, VIP)

Three complete design concepts from the host's 3–5 photos and a mood — in the editor's design tab and in
the gallery's wizard for a new invitation (`features/art-direction`). The photos are downscaled on the
device; one batched call to the AI (`ANTHROPIC_API_KEY`, `INVITES_AI_MODEL`) answers JSON that is checked
against what the product has (templates the host may use, font pairs, openings, layouts per section,
palettes repaired to WCAG AA). Without the AI — no key, an error, a nonsense answer, or past
`INVITES_ART_DIRECTION_DAILY_LIMIT` a day per account (default 12; the site's ceiling is
`INVITES_AI_DAILY_LIMIT`) — the composer makes the three from the photos' colors, the font suggestions
and template scoring, and the screen says so. Nothing is stored; the photos are never logged. Applying a
concept is one undo step, and the draft is kept in the history first. Off: the panel and the gallery's
card are gone (the plan without it: the card offers the package), `POST /api/art-direction` refuses (403
`feature_off`).

## Family review (`draft_review`, Basic)

A private link to the current draft for the family (`/review/<token>`; only the token's hash is stored,
derived like the gallery's links). The host sets an optional expiry (7 or 30 days), replaces the link (the
old one stops at once) or revokes it; the comments stay. The page renders the draft through the same
renderer — noindex, a "draft" mark, the RSVP sends nothing, no guest link, nobody counted — and updates
live. Family members type a name once (kept in their browser) and pin comments to a spot of a section;
the host sees them as numbered pins on the preview, per section in the rail and in the "Comments"
drawer, answers, marks them handled or open again, and deletes them. Emails to the host: per comment
(at most one every 10 minutes), a daily summary, or none. Limits in the database: writes per address and
per link, 500 comments per invitation, 50 replies per comment. Comments are erased 90 days after the
event. Off: the button and the pins are gone, the host's review API refuses (403), the link opens
nothing (404).

## Read aloud (`voice`, Premium) and captions

At publish each language's words are queued by their hash and read once in the background by Azure AI
Speech (REST, SSML; `INVITES_TTS_AZURE_KEY` + `INVITES_TTS_AZURE_REGION`, voices per language in
`src/features/voice/config.ts`, Amharic included); the audio is stored in the host's folder of
`invitation-media` and made again only when the words change. Nothing blocks the publish: the work runs
after the answer and on the app's own clock (`POST /api/cron/voice` too), and a failure is tried again
later (three times). The guest's "listen" pauses the music; without audio for these words it uses the
device's own voice for the language, and without one it isn't shown. The host sees each language's
state under Settings → Sharing and can switch it off there. Off: no "listen" on the page.

Captions are for everyone (no flag): a video's WebVTT per language — an uploaded .vtt, a converted .srt,
or typed cue by cue — shown as the page language's `<track kind="captions">`. A video the host marked as
having speech and without captions in a language is a publish warning.

## Versions and saves (every package)

`invitation_versions` keeps every publish and the draft's saves: an autosave at most once per 10 minutes
of editing, and the draft before a restore or a design concept. Saves are kept 90 days, 60 per invitation
at most (the daily run); publishes always. The versions drawer filters them, previews any in a new tab,
says what restoring would change per section, and restores into the draft (one undo step).

## Accessibility of the guest's path (everyone)

WCAG 2.1 AA, audited by `tests/e2e/a11y.spec.ts` (axe-core over the cover and sections of several designs,
the RSVP form, a save-the-date, the table guide, the entrance station, the gallery's upload page and the
review page; phone and desktop, Hebrew and English — and Arabic (right to left) and Russian for two
designs' cover and sections, the RSVP form, the table guide, the gallery's upload page and the review page;
it fails on anything new). Every invitation with
motion has a "pause the animations" button (the corner opposite the music; in the review page's toolbar),
which stops its endless loops and background videos for the visit; with reduced motion nothing loops and
the button isn't there. While the cover is up only it takes the keyboard's focus.
