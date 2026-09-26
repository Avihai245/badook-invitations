# Feature flags: what each event may use

Every new capability sits behind a flag (`src/features/flags`). A feature is on for an event when:

1. **this deployment offers it** — not listed in `INVITES_FEATURES_OFF`, and its setup exists: the AI
   features (`gallery_ai`, `translate_ai`) need `ANTHROPIC_API_KEY` + `INVITES_AI_MODEL`;
   `face_albums` needs `INVITES_FACE_ALBUMS=on` (biometric data — see below). `art_direction` works
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
| Basic | `cinematic`, `seating`, `languages`, `draft_review`, `analytics` |
| Premium | `seating_auto`, `seating_guide`, `live_gallery`, `gallery_ai`, `translate_ai`, `voice` |
| VIP | `checkin`, `projector`, `auto_reel`, `face_albums`, `art_direction` |

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

## Face albums (biometric data)

Grouping photos by face processes biometric data — "sensitive information" under the Privacy Protection
Law (amendment 13). The feature stays off everywhere until `INVITES_FACE_ALBUMS=on`, which should follow a
legal review; when on, it runs only with each guest's explicit opt-in, keeps no names, never links events,
and deletes the face data automatically after the retention period.

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
review page; phone and desktop, Hebrew and English; it fails on anything new). Every invitation with
motion has a "pause the animations" button (the corner opposite the music; in the review page's toolbar),
which stops its endless loops and background videos for the visit; with reduced motion nothing loops and
the button isn't there. While the cover is up only it takes the keyboard's focus.
