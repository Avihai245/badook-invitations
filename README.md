# Badook Invitations

Digital event invitations (weddings, bar/bat mitzvahs, brit, birthdays, baby showers…) in Hebrew and
English: a host builds an invitation from a designed template, publishes it at `/i/<slug>`, and guests
open it on their phones and RSVP.

The full product spec is [`docs/invitations/MASTER_PROMPT.md`](docs/invitations/MASTER_PROMPT.md); the
design reference (look & feel source of truth) is in
[`docs/invitations/design-reference/`](docs/invitations/design-reference/). The 8 templates live in
[`invitation-templates-pack/`](invitation-templates-pack/) and are imported as-is.

**Status:** P2 (the host app: sign-up, template gallery, wizard, editor, publish) — see the build order
in §11 of the spec.

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
| `/i/<slug>/event.ics?venue=<id>&lang=` | Calendar file for one venue                                                                             |
| `POST /api/invitations/rsvp`           | Guest RSVP (`RsvpSubmission` → `RsvpResult`, §4)                                                        |

Host app (sign-in required; Hebrew UI by default, English via the `עב | EN` toggle — cookie `ui_lang`):

| Route                           | What                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `/signup` · `/login`            | Email + password (Supabase Auth); `/auth/forgot`, `/auth/update-password`, `/auth/callback` |
| `/app/invitations`              | The host's invitations (duplicate, archive)                                                 |
| `/app/invitations/new`          | Template gallery → live preview → 3-step wizard                                             |
| `/app/invitations/<id>/edit`    | The editor (autosave, undo/redo, publish, versions)                                         |
| `/app/preview-frame/<template>` | The editor's preview iframe; `?invitation=<id>[&version=<n>]` = full-page preview           |
| `/api/invitations/…`            | JSON API of the editor (create, save, publish, versions, restore, slug, uploads, …)         |

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

| URL                                                 | What                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/invitations`                                  | Kitchen sink: every template × he/en with placeholder media; document, view, device theme, timeline variant and zoom controls                                                                                                               |
| `/dev/invitations/render/<template>/<he\|en>/<doc>` | One invitation, full page. `doc` = `demo`, `demo-<eventType>`, `stress` or a fixture (`wedding-he-en`, `babyshower-en`, `savethedate-he`). Query: `open=1` skip the cover, `mode=preview`, `now=<ISO>` freeze time, `tl=<timeline variant>` |
| `/dev/app-ui`                                       | Host-app UI primitives and compositions (`?lang=en` for English)                                                                                                                                                                            |

## Scripts

| Command                                 |                                                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`       | Next.js (build first validates the templates and generates the fonts)                                                                                          |
| `npm run lint` · `typecheck` · `format` | ESLint · `tsc --noEmit` · Prettier                                                                                                                             |
| `npm test`                              | Unit tests (Vitest)                                                                                                                                            |
| `npm run test:db`                       | Migration, RLS and RPC tests on a fresh local Postgres database (`TEST_DATABASE_URL`, default `postgres://postgres:postgres@127.0.0.1:5432/postgres`)          |
| `npm run db:seed`                       | Seed SQL to stdout (see Database)                                                                                                                              |
| `npm run qa:screens -- --base <url>`    | Design QA gate: pixel diff against the design reference, all templates × he/en, hero legibility, stress strings. Writes to `tests/.artifacts/qa/`              |
| `npm run qa:app-ui`                     | Host-app UI QA: RTL/LTR, focus and layout probes + screenshots of `/dev/app-ui` (`BASE=<url>`)                                                                 |
| `npm run qa:host`                       | Host screens QA (list, gallery, wizard, editor, publish) in he/en at 1440, 1024 and 390 px, with layout probes (`BASE=<url>`, a local stack)                   |
| `npm run test:e2e`                      | Playwright tests; starts its own local stack (fresh database + REST shim + `next start`) — run `npm run build` first. `PW_BASE_URL=<url>` targets a deployment |
| `npm run fonts`                         | Regenerate the self-hosted `@font-face` files and index                                                                                                        |
| `npm run templates:validate`            | Validate the template pack and fixtures against the contracts                                                                                                  |

Visual and Playwright tests run locally or in CI — never in the Amplify build.

## Layout

```
src/
  app/(site)/            host app (Hebrew RTL root layout, Tailwind) + /dev pages
  app/(invitation)/      guest invitation routes: /i/[slug], .ics (own root layout, no Tailwind)
  app/(site)/app/        host app: (shell) list + gallery, (editor) the editor; (auth) sign-in pages
  app/(invitation)/app/preview-frame/  the editor's preview iframe (invitation root layout)
  app/api/invitations/   RSVP endpoint + the editor's JSON API
  components/app/        host-app UI primitives (§9B.2)
  features/invitations/
    app/                 invitations list, template gallery, preview dialog, create wizard
    editor/              the editor: state + autosave, rail, forms, preview channel, publish, versions
    server/              published-invitation loader, RSVP rules, host API + data access (server only)
    contracts/           §3 types, Zod schemas, document migrations
    templates/           registry of the 8 pack templates, document seeding, demos/fixtures
    renderer/            the one renderer (public page, preview, editor frame, kitchen sink)
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
