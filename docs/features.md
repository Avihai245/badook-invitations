# Feature flags: what each event may use

Every new capability sits behind a flag (`src/features/flags`). A feature is on for an event when:

1. **this deployment offers it** — not listed in `INVITES_FEATURES_OFF`, and its setup exists: the AI
   features (`gallery_ai`, `translate_ai`, `art_direction`) need `ANTHROPIC_API_KEY` + `INVITES_AI_MODEL`;
   `face_albums` needs `INVITES_FACE_ALBUMS=on` (biometric data — see below);
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
feature stays off everywhere until `INVITES_FACE_ALBUMS=on`, which should follow a legal review. When on:

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
(cut, dissolve, whip) follow the tempo; title and end cards use the invitation's palette and fonts.
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
  carrying the guest's personal link; after the event, "see the album". The ISR page renders the same
  HTML for everyone; the phase is decided in the browser. Without a gallery (or the feature) the section
  renders nothing.
- **Sending guests the gallery link** (gallery tab → share card): from the system's WhatsApp number once
  the third Meta template is approved and `INVITES_WHATSAPP_GALLERY_TEMPLATE` names it
  (docs/whatsapp-setup.md §9); otherwise per-guest wa.me links and copied links. Credits and statuses work
  like the other templates.

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
  Off: the guide answers "not available", the notices API refuses (403 `feature_off`), the buttons are
  gone (the seating screen offers the package instead).
- `checkin` (VIP): the entrance stations (`/e/<slug>/station?t=…`), the entrance QR on the guide and the
  cards, the "Event day" tab (live hall, re-seating live). Off: the stations' link opens nothing, the
  check-in and live APIs refuse, the tab is gone (or offers the package).
- The seating's history of changes (and undo) belongs to `seating`, which every package has.
