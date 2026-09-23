# Badook Invitations

Digital event invitations (weddings, bar/bat mitzvahs, brit, birthdays, baby showers…) in Hebrew and
English: a host builds an invitation from a designed template, publishes it at `/i/<slug>`, and guests
open it on their phones and RSVP.

The full product spec is [`docs/invitations/MASTER_PROMPT.md`](docs/invitations/MASTER_PROMPT.md); the
design reference (look & feel source of truth) is in
[`docs/invitations/design-reference/`](docs/invitations/design-reference/). The 8 templates live in
[`invitation-templates-pack/`](invitation-templates-pack/) and are imported as-is.

**Status:** P0 (design foundation) — see the build order in §11 of the spec.

## Stack

Next.js 15.5 (App Router, Node runtime only) · React 19 · TypeScript (strict) · Tailwind CSS v4 (host
app only) · Zod 4 · Supabase (Postgres, Auth, Storage) · Vitest · Playwright. Deployed on AWS Amplify
Hosting (SSR) — see §1.1 of the spec.

## Getting started

```bash
nvm use            # Node 22 (.nvmrc); Node ≥ 20 is required
npm ci
cp .env.example .env.local   # fill in what you need; P0 runs without Supabase
npm run dev        # http://localhost:3000
```

Dev-only pages (always on under `next dev`; in builds only with `INVITES_DEV_ROUTES=true`):

| URL                                                 | What                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/invitations`                                  | Kitchen sink: every template × he/en with placeholder media; document, view, device theme, timeline variant and zoom controls                                                                                                               |
| `/dev/invitations/render/<template>/<he\|en>/<doc>` | One invitation, full page. `doc` = `demo`, `demo-<eventType>`, `stress` or a fixture (`wedding-he-en`, `babyshower-en`, `savethedate-he`). Query: `open=1` skip the cover, `mode=preview`, `now=<ISO>` freeze time, `tl=<timeline variant>` |
| `/dev/app-ui`                                       | Host-app UI primitives and compositions (`?lang=en` for English)                                                                                                                                                                            |

## Scripts

| Command                                 |                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`       | Next.js (build first validates the templates and generates the fonts)                                                                             |
| `npm run lint` · `typecheck` · `format` | ESLint · `tsc --noEmit` · Prettier                                                                                                                |
| `npm test`                              | Unit tests (Vitest)                                                                                                                               |
| `npm run qa:screens -- --base <url>`    | Design QA gate: pixel diff against the design reference, all templates × he/en, hero legibility, stress strings. Writes to `tests/.artifacts/qa/` |
| `npm run qa:app-ui`                     | Host-app UI QA: RTL/LTR, focus and layout probes + screenshots of `/dev/app-ui` (`BASE=<url>`)                                                    |
| `npm run test:e2e`                      | Playwright tests                                                                                                                                  |
| `npm run fonts`                         | Regenerate the self-hosted `@font-face` files and index                                                                                           |
| `npm run templates:validate`            | Validate the template pack and fixtures against the contracts                                                                                     |

Visual and Playwright tests run locally or in CI — never in the Amplify build.

## Layout

```
src/
  app/(site)/            host app (Hebrew RTL root layout, Tailwind) + /dev pages
  app/(invitation)/      guest invitation routes (own root layout, no Tailwind)
  components/app/        host-app UI primitives (§9B.2)
  features/invitations/
    contracts/           §3 types, Zod schemas, document migrations
    templates/           registry of the 8 pack templates, document seeding, demos/fixtures
    renderer/            the one renderer (public page, preview, editor frame, kitchen sink)
    sections/            one view per section type + the section registry
    ui/                  invitation CSS (ported from the design reference) and icons
    fonts/ i18n/ lib/    self-hosted fonts, dictionaries, dates/Hebrew calendar/contrast/… utilities
  lib/                   env parsing, dev-route gate
scripts/                 template validation, font generation, design QA
tests/unit/              Vitest
```

## Deployment (AWS Amplify)

`amplify.yml` builds with Node 22 (`npm ci` → `npm run build`, artifacts `.next`). Amplify console
environment variables are copied into `.env.production` during the build (every variable the app
reads starts with `NEXT_PUBLIC_`, `SUPABASE_` or `INVITES_`); all of them are documented in
[`.env.example`](.env.example). Branches: `main` = production, `dev` = preview, each with its own
variables. Heavy template media (videos, music) is served from Supabase Storage, not from the build.
