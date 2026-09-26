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

## Face albums (biometric data)

Grouping photos by face processes biometric data — "sensitive information" under the Privacy Protection
Law (amendment 13). The feature stays off everywhere until `INVITES_FACE_ALBUMS=on`, which should follow a
legal review; when on, it runs only with each guest's explicit opt-in, keeps no names, never links events,
and deletes the face data automatically after the retention period.
