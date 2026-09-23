# Badook Invitations

Digital event invitations (weddings, bar/bat mitzvahs, brit, birthdays, baby showers…) in Hebrew and
English: a host builds an invitation from a designed template, publishes it at `/i/<slug>`, and guests
open it on their phones and RSVP.

The full product spec is [`docs/invitations/MASTER_PROMPT.md`](docs/invitations/MASTER_PROMPT.md); the
design reference (look & feel source of truth) is in
[`docs/invitations/design-reference/`](docs/invitations/design-reference/). The 8 templates live in
[`invitation-templates-pack/`](invitation-templates-pack/) and are imported as-is.

**Status:** P4 — all phases of the build order (§11 of the spec) are in: design foundation, contracts
and rendering, the editor, the experience (video-first cover, music, live language switch, maps,
link preview, share screen) and the dashboard & extras (responses dashboard, CSV export, email
notifications, gallery, gifts, date reveal, the save-the-date flow, template preview videos).

## Stack

Next.js 15.5 (App Router, Node runtime only) · React 19 · TypeScript (strict) · Tailwind CSS v4 (host
app only) · Zod 4 · Supabase (Postgres, Auth, Storage) · Vitest · Playwright. Deployed on AWS Amplify
Hosting (SSR) — see §1.1 of the spec.

## Getting started

```bash
nvm use            # Node 22 (.nvmrc); Node ≥ 20 is required
npm ci
cp .env.example .env.local   # Supabase URL + keys, INVITES_IP_HASH_SALT (see the file)
npm run dev        # http://localhost:3000
```

Public routes:

| Route                                  | What                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/i/<slug>`                            | Published invitation (ISR, 60 s). `?lang=he\|en` (default: the invitation's), `?open=1` skips the cover |
| `/i/<slug>/event.ics?venue=<id>&lang=` | Calendar file for one venue; without `venue` the first one, or the event itself when there is none      |
| `/i/<slug>/opengraph-image?lang=&v=`   | 1200×630 link-preview PNG (next/og on Node; `v` = document hash, linked from the page's `og:image`)     |
| `POST /api/invitations/rsvp`           | Guest RSVP (`RsvpSubmission` → `RsvpResult`, §4)                                                        |

A save-the-date links to its full invitation (created from it in the list) as soon as that one is
published — and stops when it is archived. Publishing refreshes the cached pages right away (the
invitation's own and its save-the-date's); otherwise they refresh within a minute.

**Hero video**: an uploaded video autoplays muted and looping (the `muted` attribute is set for iOS;
a browser that holds it back, like iOS Low Power Mode, starts it on the first tap). The editor reads a
still from the file while it uploads — the poster, and the link preview's picture. A YouTube or Vimeo
link plays as the background instead (muted, looping, no controls, untouchable; its still shows until
it plays). With the music panel's "what plays → the background video's sound" the music button turns
the video's own sound on (from the cover's tap) and off instead of a song — for a YouTube / Vimeo link
as far as the browser allows.

**Search engines** (§4): an invitation is hidden by default (`share.noindex`, the switch in the
editor's "Link & sharing" panel). Its page then carries `robots` and `googlebot`
`noindex, nofollow, noarchive, noimageindex` in the server-rendered `<head>` (for every crawler), and
its link-preview image and calendar file send `X-Robots-Tag`. `/robots.txt` leaves `/i/` open on
purpose: a crawler has to fetch a page to see its `noindex`. A link that is unknown, not published
yet or archived shows a "not available" page (404) in both languages.

On a bilingual invitation the language pill switches in place (no reload, same place in the page,
`?lang=` updated, music keeps playing); the other language is rendered in the browser from a payload
the server prepares (`renderer/live/`).

Host app (sign-in required; Hebrew UI by default, English via the `עב | EN` toggle — cookie `ui_lang`):

| Route                             | What                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/signup` · `/login`              | Email + password (Supabase Auth); `/auth/forgot`, `/auth/update-password`, `/auth/callback`                         |
| `/`                               | Home: what Badook is, sign up / sign in, a sample invitation (signed-in hosts go to their invitations)              |
| `/app/invitations`                | The host's invitations (duplicate, archive; a save-the-date → its full invitation)                                  |
| `/app/invitations/new`            | Template gallery (muted preview videos) → live preview → 3-step wizard                                              |
| `/app/invitations/<id>/edit`      | The editor (autosave, undo/redo, publish, versions)                                                                 |
| `/app/invitations/<id>/share`     | Share screen: link, prefilled message → WhatsApp / copy, link preview, QR (PNG/SVG)                                 |
| `/app/invitations/<id>/responses` | Responses: KPIs, dietary/answer bars, search & filters, a reply's details (delete), CSV export, email notifications |
| `/app/preview-frame/<template>`   | The editor's preview iframe; `?invitation=<id>[&version=<n>]` = full-page preview                                   |
| `/api/invitations/…`              | JSON API (create, save, publish, versions, restore, slug, uploads, responses, notify, follow-up, CSV export, …)     |

**Email notifications** (P4): a host gets an email per reply or a daily summary (their choice on the
responses screen), sent through [Resend](https://resend.com) when `INVITES_EMAIL_API_KEY` and
`INVITES_EMAIL_FROM` (a sender on a verified domain) are set — otherwise the emails are only logged.
The daily summary is `POST /api/cron/rsvp-digest` with `Authorization: Bearer <INVITES_CRON_SECRET>`,
called every morning by [`.github/workflows/rsvp-digest.yml`](.github/workflows/rsvp-digest.yml) —
set the repository secrets `INVITES_CRON_URL` (the site) and `INVITES_CRON_SECRET` (the same value as
the app's). Without a secret the endpoint is off (404) and the workflow does nothing.

**Supabase Auth settings** (dashboard → Authentication → URL Configuration): Site URL = the deployed
URL (`INVITES_PUBLIC_BASE_URL`), and add `<site>/auth/callback` to the Redirect URLs — sign-up
confirmation and password-reset links land there. With "Confirm email" on, set up SMTP for real
volumes (the built-in sender is rate-limited).

### Database

Migrations are in [`supabase/migrations/`](supabase/migrations/) (tables, RLS, RPCs, storage buckets —
MASTER_PROMPT §4). Apply them with the Supabase CLI (`supabase db push`) or the SQL editor, then seed:

```bash
npm run db:seed > seed.sql          # 8 templates + the 3 examples + a demo per template/event type
psql "$DATABASE_URL" -f seed.sql     # idempotent — safe to re-run after template changes
```

Demo invitations: `/i/noa-and-itay`, `/i/mayas-baby-shower`, `/i/noa-and-itay-save-the-date`,
`/i/demo-<template>` (and `demo-atara-bat-mitzvah`).

**Without Supabase** (local Postgres 16): `tests/db/supabase-shim.sql` provides the Supabase roles and
`auth.uid()`, and `tests/support/rest-shim.mjs` answers `supabase-js` from a local database — RPC,
Auth (sign-up is auto-confirmed) and Storage (signed uploads, files under `tests/.artifacts/storage`).
This is how the database and end-to-end tests run:

```bash
npx tsx tests/support/reset-local-db.ts badook_local      # shim + migrations + seed
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/badook_local node tests/support/rest-shim.mjs
# .env.local: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#             NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-publishable  SUPABASE_SECRET_KEY=local-secret
```

Dev-only pages (always on under `next dev`; in builds only with `INVITES_DEV_ROUTES=true`):

| URL                                                 | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/invitations`                                  | Kitchen sink: every template × he/en with placeholder media; document, view, device theme, timeline variant and zoom controls                                                                                                                                                                                                                                                                                                                                                               |
| `/dev/invitations/render/<template>/<he\|en>/<doc>` | One invitation, full page. `doc` = `demo`, `demo-<eventType>`, `stress` or a fixture (`wedding-he-en`, `babyshower-en`, `savethedate-he`). Query: `open=1` skip the cover, `mode=preview`, `now=<ISO>` freeze time, `tl=<timeline variant>`, `cover=fixture\|stall` the video cover with test media (a video that never loads), `music=fixture`, `live=0` the language pill as a plain link, `gallery=carousel\|grid` a gallery of test photos, `reveal=scratch\|tap\|spin` the date reveal |
| `/dev/invitations/og/<template>/<he\|en>/<doc>`     | The link-preview image of a dev document                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/dev/app-ui`                                       | Host-app UI primitives and compositions (`?lang=en` for English)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/app/invitations/new?previews=fixture\|missing`    | The template gallery with test preview videos on every card (or a missing one: the poster stays)                                                                                                                                                                                                                                                                                                                                                                                            |

## Scripts

| Command                                 |                                                                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`       | Next.js (build first validates the templates and generates the fonts)                                                                                                                                      |
| `npm run lint` · `typecheck` · `format` | ESLint · `tsc --noEmit` · Prettier                                                                                                                                                                         |
| `npm test`                              | Unit tests (Vitest)                                                                                                                                                                                        |
| `npm run test:db`                       | Migration, RLS and RPC tests on a fresh local Postgres database (`TEST_DATABASE_URL`, default `postgres://postgres:postgres@127.0.0.1:5432/postgres`)                                                      |
| `npm run db:seed`                       | Seed SQL to stdout (see Database)                                                                                                                                                                          |
| `npm run qa:screens -- --base <url>`    | Design QA gate: pixel diff against the design reference, all templates × he/en, hero legibility, stress strings, P4 sections (`--only extras`). Writes to `tests/.artifacts/qa/`                           |
| `npm run qa:app-ui`                     | Host-app UI QA: RTL/LTR, focus and layout probes + screenshots of `/dev/app-ui` (`BASE=<url>`)                                                                                                             |
| `npm run qa:host`                       | Host screens QA (list, gallery, wizard, editor, publish, share, responses, save-the-date follow-up) in he/en at 1440, 1024 and 390 px, with layout probes (`BASE=<url>`, a local stack; `QA_DATABASE_URL`) |
| `npm run test:e2e`                      | Playwright tests; starts its own local stack (fresh database + REST shim + `next start`) — run `npm run build` first. `PW_BASE_URL=<url>` targets a deployment                                             |
| `npm run fonts`                         | Regenerate the self-hosted `@font-face` files and index                                                                                                                                                    |
| `npm run templates:validate`            | Validate the template pack and fixtures against the contracts                                                                                                                                              |
| `node scripts/make-test-media.mjs`      | Regenerate the synthetic cover/music test media in `tests/fixtures/media` (served by `/dev/media/<file>`)                                                                                                  |
| `node scripts/make-gallery-media.mjs`   | Regenerate the 5 gallery test photos in `tests/fixtures/media`                                                                                                                                             |

Visual and Playwright tests run locally or in CI — never in the Amplify build.

## Layout

```
src/
  app/(site)/            host app (Hebrew RTL root layout, Tailwind) + /dev pages
  app/(invitation)/      guest invitation routes: /i/[slug], .ics (own root layout, no Tailwind)
  app/(site)/app/        host app: (shell) list + gallery, (editor) the editor; (auth) sign-in pages
  app/(invitation)/app/preview-frame/  the editor's preview iframe (invitation root layout)
  app/api/invitations/   RSVP endpoint + the host JSON API; app/api/cron/ = the daily RSVP summary
  components/app/        host-app UI primitives (§9B.2)
  features/invitations/
    app/                 invitations list (+ save-the-date follow-up), template gallery, preview dialog,
                         create wizard, share screen, responses dashboard
    editor/              the editor: state + autosave, rail, forms, preview channel, publish, versions
    server/              published-invitation loader, RSVP rules, host API + data access, OG image,
                         share data, responses dashboard data, email notifications (server only)
    contracts/           §3 types, Zod schemas, document migrations
    templates/           registry of the 8 pack templates, document seeding, demos/fixtures
    renderer/            the one renderer (public page, preview, editor frame, kitchen sink); cover/ =
                         video-first cover + monogram; live/ = the in-place language switch
    sections/            one view per section type + the section registry
    ui/                  invitation CSS (ported from the design reference) and icons
    fonts/ i18n/ lib/    self-hosted fonts, dictionaries, dates/Hebrew calendar/contrast/… utilities
  lib/                   env parsing, feature flag, dev-route gate; supabase/ = server-side clients
supabase/migrations/     SQL (§4)
scripts/                 template validation, font generation, seed, design QA
tests/unit/              Vitest
tests/db/                database tests + the Supabase shim
tests/e2e/               Playwright
tests/support/           local stack: database reset, REST shim
```

## Deployment (AWS Amplify)

`amplify.yml` builds with Node 22 (`npm ci` → `npm run build`, artifacts `.next`). Amplify console
environment variables are copied into `.env.production` during the build (every variable the app
reads starts with `NEXT_PUBLIC_`, `SUPABASE_` or `INVITES_`); all of them are documented in
[`.env.example`](.env.example). Branches: `main` = production, `dev` = preview, each with its own
variables. Heavy template media (videos, music) is served from Supabase Storage, not from the build.
