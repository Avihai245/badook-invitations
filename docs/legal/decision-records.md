# Decision records

Matters that need an owner decision, a lawyer's reading of the Israeli law, a regulator filing or an
agreement with a provider. Each states what was found in the code (with file references), what this
programme did and did **not** do, and a concrete proposal. Nothing here is a legal opinion. Status:
**OPEN** unless stated.

Legend: ⛔ blocks switching on `INVITES_LEGAL_V2` · ⚠ should be decided before launch · ℹ can follow.

---

## DR-01 ⛔ Who operates Badook Invitations

- **Finding.** The repository names no operating entity for Invitations. "Badook Events" appears only as a
  separate partner system (`docs/partner-api.md`). The legal context reads the entity from
  `INVITES_LEGAL_NAME / _ID / _ADDRESS / _PHONE` and `INVITES_SUPPORT_EMAIL`, which are blank in the
  repository and in `amplify.yml`; production values cannot be verified from the code.
- **Done.** Version 2 will not switch on with any of name, company number, address, support email or the
  effective date missing (`src/features/legal/readiness.ts`, tested). The Badook Events operator
  (וולורם פתרונות טכנולוגיים בע״מ, 517067575, דרך מנחם בגין 150, תל אביב) was **not** assumed.
- **Decision needed.** Confirm the legal entity that actually runs Invitations (contracts with Meta, Tranzila,
  Supabase, OpenAI, Anthropic are in whose name?), then set the five values in the Amplify console.
- **Version 1** (live today) shows only the fields that happen to be set; if they are blank today the live
  policies already omit the operator's identity — check the production values.

## DR-02 ⛔ Effective date, notice to hosts, and what "approval" means

- The current Terms (v1 §11) promise that significant changes are emailed to hosts **at least 14 days before
  they apply**. Version 2 changes the terms materially (refund policy, gallery rules, acceptance records).
- **Proposal.** Pick `INVITES_LEGAL_V2_EFFECTIVE` ≥ 14 days after the email to hosts goes out; send the email
  (not automated by this programme); only then set `INVITES_LEGAL_V2=true`. Until then v1 stays in force.
- Existing accounts have no acceptance record (none is invented). From the effective date their continued
  use is under the notice above; new sign-ups and purchases record acceptance of version 2.
- Counsel: whether browsewrap + notice suffices for existing hosts, or a re-acceptance screen is wanted
  (not built — it would be a new enforcement).

## DR-03 ⛔ Face search ("the photos I'm in") — LEGAL APPROVAL REQUIRED

**Status of the feature today:** deployment flag `INVITES_FACE_ALBUMS` defaults to **false**; the feature is
also opt-in per event. The programme did **not** change, enable or disable any face processing.

**Facts (code audit).**
1. Two processing activities exist. (A) the searching guest's selfie → 128-number descriptor, computed on
   their phone, sent once per search, compared in SQL, not stored (`gallery_face_search`), kept in
   `sessionStorage` for the tab. Separate unticked consent checkbox (`FaceSearch.tsx`) — client-side only,
   **no consent record** (no version/time). (B) detection of **every** face in gallery photos:
   `UploadFaceIndexer` runs on every uploader's phone as soon as the host turns the feature on, and in the
   host's browser on "prepare"; descriptors (+ box) are stored in `gallery_faces` linked by `item_id` to a
   photo that carries `uploader_hash`, optional name, `guest_id`. Includes photos that are pending, hidden
   or rejected (`gallery_face_add` accepts any non-deleted image).
2. Nobody depicted, and no uploader, is asked or told in the upload flow today (a notice was added by this
   programme, see below). The host toggle records no acknowledgement (unlike AI photos).
3. No age handling: children's faces are processed like anyone's. A selfie accepts any image (search for
   someone else is possible); the server cannot tell.
4. Descriptors are service-role only (RLS, no policies, revoked grants; `tests/db/phase5b.test.ts`).
   Retention: 30 days after the event (`gallery_face_maintenance`), on toggle-off, photo delete, gallery
   delete. Models are served from our own origin; no external face processor.
5. The v1 privacy policy §7C said consent is needed "before anything else" and that "nothing links a face
   to a guest's identity" — both inaccurate for activity B (see above). **v2 text corrects this.**

**Legal issue.** A biometric identifier used for computerised identification may be specially sensitive
information under Amendment 13. The searching guest's consent cannot be the lawful basis for activity B (other
people's biometric data, including minors', generated before and regardless of any search). No lawful basis
for B is documented. → **LEGAL APPROVAL REQUIRED** before any deployment sets `INVITES_FACE_ALBUMS=true`.

**Done by this programme (no behaviour change).** v2 policy/rules describe A and B separately and truthfully;
the first-upload notice tells uploaders when face search is on in that gallery; the face consent screen adds
text that the guest's consent covers only their own selfie, with links to the exclusion request
(`/privacy-request?kind=biometric_exclusion`) and the gallery rules; the privacy request form has a
"biometric exclusion" kind; the privacy and rules texts recommend not enabling it where children attend.

**Proposal (risk reduction; needs approval, not implemented).**
- *Preferred design:* **no stored descriptors of non-searchers.** Do the matching on the searching guest's
  device at search time against the gallery's display copies (download → detect → compare locally), keep
  nothing server-side. Removes activity B as a stored biometric database; cost: heavier search on big
  galleries (can be capped / progressive).
- *If server-side descriptors stay:* (i) a recorded host acknowledgement (who/when/version) when turning it
  on, with the host warned that depicted people must be told; (ii) a recorded consent record for activity A
  (document version + time, `face_consents`); (iii) index only **published** photos; (iv) never index in
  galleries with approval mode pending items; (v) event-level "no children" confirmation or a hard
  recommendation; (vi) per-photo exclusion for people who ask (already: leave-out by selfie); (vii) shorten
  retention to the event window; (viii) a lawful-basis memo + notice duty (s.11) on the depicted people
  (impractical → supports the preferred design).
- Also assess: database definition/registration/notification (DR-08), DPO (DR-08), security level.

## DR-04 ⚠ Consumer Protection Law — refunds, cancellation fee, credits

- **v1 Terms §7** promised: cancellation effective "within three business days"; a 14-day cancellation right
  for every purchase with a 5%/₪100 fee and deduction for use; unused credits refundable in 14 days; refund
  within 14 days. **Code reality:** cancel is immediate (flag only on Tranzila; PayPlus API call + support
  alert on failure) and `effectivePlan` keeps the plan until `plan_renews_at`; **there is no refund code
  path at all** — refunds are manual via the provider/support; no UI implements the 14-day right.
- **v2 refund policy** states what the code does (immediate cancellation, plan runs to period end, manual
  refunds), states the statutory right as applying "where the law applies" (not universally), says the fee is
  charged only where the law permits and never for our fault, keeps the unused-credit 14-day commitment as
  a **voluntary commitment beyond the law**, and does not promise a refund timetable beyond "the period the
  law sets".
- **Counsel to confirm:** (1) whether s.14C(a) applies to a monthly SaaS plan and to credit packs, and which
  exceptions (service supplied during the 14 days, digital content) apply; (2) whether the s.13D continuing-
  transaction cancellation rules (incl. online cancellation, the effect date, any fee) are met by the billing
  page's "Cancel subscription" (it exists: `BillingScreen.client.tsx`); (3) the cancellation-fee wording;
  (4) whether the voluntary credit-refund commitment should stay; (5) VAT/invoice wording.
- **Owner:** decide whether to build an actual refund tool (admin console has none), and who answers within
  14 days. Prices, credits and payment processing were not changed.

## DR-05 ⚠ Billing defects found while verifying cancellation (not fixed — payment logic is out of scope)

From `tests/unit/billing-legal-cancel.test.ts` and `tests/db/billing-cancel.test.ts` (pinned as current behaviour):
1. **PayPlus renewal after cancel** (`billing.ts:447-484 applyRenewal`): if the PayPlus recurring stop failed
   (support is alerted by email) and a renewal callback arrives, the plan period is extended, monthly credits
   are granted and status stays "canceled"; a failed renewal flips it to `past_due`. *Decide:* ignore
   renewals for canceled accounts + refund, or accept.
2. **Tranzila token retained after cancel**: `billing_cards` row is not deleted at cancel (only on account
   deletion). Charges stop because `billing_renewals_due` filters to active/past_due (tested). *Decide:* delete
   the token at cancel (privacy-protective) — a payment-processing change, so not done.
3. `chargeRenewals` charges a plan cancelled between reading the due list and charging (narrow window).
4. Concurrent double-cancel can call the provider twice (idempotent at PayPlus).
5. Tranzila-card plans have no pre-renewal reminder (the v2 terms promise only price-change notices).

## DR-06 ⚠ Response deadlines

- **Privacy requests — 30 days.** v1 promised 30 days; v2 keeps "within 30 days of receiving your request" and
  the console tracks `due_at = +30 days` with an overdue flag. Counsel to confirm that 30 days is the period
  under the Privacy Protection Regulations (inspection of information) and whether the same applies to
  correction/deletion requests and to requests made through a host.
- **Accessibility — 7 business days.** An operational commitment (not statutory). v2 says "we aim to reply
  within 7 business days". Owner to confirm the team can meet it, or change the number.
- **Reports** (media): no response time is promised; urgent ones are prioritised and an item concerning a child
  or intimate image is hidden at once.

## DR-07 ⚠ Processors, international transfers, Regulation 15

See [`processors.md`](processors.md). Open: written agreements (DPA/processor terms) with each provider and
their security undertakings (Reg. 15 of the Data Security Regulations); the actual regions (OpenAI, Anthropic,
Resend, Meta, Azure Speech region); OpenAI `store: true` for background responses and the app never deletes
them; whether the Transfer Regulations' conditions are met per recipient (the policy states the principle only);
EEA-sourced data rules (2023 regulations) if guests in the EEA are invited; PayPlus vs Tranzila which is live.

## DR-08 ⚠ Database registration, notification, DPO, security level

See [`database-assessment.md`](database-assessment.md). Preliminary: no registration/notification/DPO
obligation is *asserted*; each depends on figures only the owner has (number of data subjects, authorised
staff) and on whether face search is ever enabled. The security level under the 2017 Regulations is
**undetermined**; a database-definition document skeleton is provided.

## DR-09 ⚠ Communications Law s.30A — WhatsApp / email

- Templates `invitation` and `reminder` are declared **Marketing** category at Meta (`docs/whatsapp-setup.md`);
  table, gallery, thank-you and album are Utility. The host confirms guests "know me and are happy to receive"
  (`consent: literal(true)`, enforced server-side); STOP/"הסר" replies and Meta error 131050 populate a global
  do-not-send list; the event-day and gallery-link send dialogs have **no** consent checkbox; the template
  footer carries no opt-out instruction; there is no email unsubscribe (emails go to hosts/staff/ticket
  customers only).
- No marketing from the platform exists in code; v2 terms and privacy say guest lists are not used for
  marketing and a reply is not marketing consent.
- **Counsel/owner:** whether an invitation / RSVP reminder to someone the host knows is "advertising" under
  s.30A (content, sender, purpose); whether Meta's Marketing category changes the analysis; whether to add the
  consent checkbox to the table/gallery send dialogs and an opt-out line to templates (template changes need
  Meta re-approval). Not changed.

## DR-10 ℹ Copyright and user-generated content

v2 terms/rules: copyright stays with the creator; limited licence "to operate the service"; host may use for the
event and its guests only; advertising/commercial reuse needs separate permission; music is the host's
responsibility; copyright complaints via "Report content" (copyright requires name + email). Counsel to
confirm: licence wording, the host's right to the originals, moral rights, whether to build a formal counter-
notice, whether the platform wants a statutory-style notice-and-takedown safe-harbour text.

## DR-11 ⚠ Children and minors

No age signal exists. Done: parent/guardian can report (child category = urgent, auto-hide, reversible);
`child_photo` privacy-request kind; rules and policy recommend not publishing others' children and not enabling
face search; AI photos: guests told not to send children's photos. Not done (needs decision): approval mode by
default for events typed bar/bat mitzvah/brit/birthday; hiding children's faces; blocking AI photos of
honorees who are minors without recorded guardian consent (today: one host checkbox, no per-person/guardian record).

## DR-12 ⚠ Accessibility statement

- v1 claimed a manual pass (keyboard, screen reader, 320 px/200%, reduced motion) and that the automated audit
  "runs with every change to the site". Findings: the axe suite runs only locally (no CI workflow), covers the
  guest side only; Lighthouse CI covers the home page and sample invitations; nothing in the repo evidences the
  manual pass. v2 reports only what is evidenced and mentions a manual review **only** when
  `INVITES_ACCESSIBILITY_REVIEW_DATE` is set.
- **Owner:** if the manual pass really happened, set the date; consider an external audit (IS 5568 / WCAG
  2.1 AA) before claiming conformance; confirm whether the exemption criteria of the regulations apply (not
  claimed); add axe scans of the host app, auth, policy pages and the new forms to CI.
- Not performed by this programme: assistive-technology testing (no screen reader available). Unit-level
  accessibility tests exist for the new dialogs/forms; axe scan of the new pages is listed in the matrix.

## DR-13 ⚠ Acceptance evidence gaps

Recorded: email sign-up (checkbox) and checkout (checkbox) under v2. **Not covered:** Google sign-in and
partner-provisioned accounts (no acceptance UI exists; none invented), existing accounts, acceptance recorded
when checkout opens rather than when payment completes, no support alert if the recording RPC fails twice,
acceptance rows are deleted with the account (cascade) — counsel to say whether evidence must outlive the account.

## DR-14 ⚠ Retention and backups

- Policy no longer says "backups within 90 days" (not verifiable from the repo). **Owner:** check the Supabase
  backup/PITR retention for the project and, if wanted, state it.
- Galleries never expire by themselves; likes persist until the gallery is deleted; rejected/hidden items stay;
  a file PUT after a soft-delete with a still-valid upload token (~2 h) could leave an orphan storage file
  (audit, unverified). *Proposal:* auto-expire galleries N months after the event (owner policy), delete
  likes with items, sweep orphans.

## DR-15 ⚠ Location metadata

Done (browser-side, same-length overwrite): GPS removed from JPEG/HEIC/HEIF/AVIF/PNG/WebP originals (incl.
XMP) and MP4/MOV/3GP location tags; derivatives are canvas re-encodes. **Not enforceable server-side**: the
server never reads bytes; a modified client uploads unchanged files; GIF/WebM, IPTC place names, dashcam GPS
tracks are untouched; other EXIF (camera, time) stays; guests and the album receive the **original** video
file (so a video with location can reach every viewer) and hosts download unmodified originals. Not spot-checked
on real Apple/Android files (no real media was used). *Proposal:* stop serving video originals to guests
(serve a transcoded copy), add a server-side stripping step after upload, spot-check with exiftool.

## DR-16 ⚠ AI photos (OpenAI)

Findings: honoree names/roles/description are in the prompt; background transport uses `store:true` and the app
never deletes the stored response; global endpoint, no region pinned; no prompt moderation, no age handling;
the host's consent is one checkbox for all honorees (time + user stored); the docs claimed a guest consent
screen that did not exist. Done: a guest notice before sending, policy/rules disclosure; no provider-deletion
promise. *Decide:* disable `store`/delete responses after retrieval, per-person consent, children exclusion.

## DR-17 ℹ Cookie notice default

The notice treats external media (YouTube/Vimeo/Google Maps) as **on until the visitor chooses "essential
only"**. Documented accurately in the cookie policy; behaviour not changed (out of scope: consent behaviour).
Counsel may prefer opt-in. No analytics/ad scripts exist in the repo.

## DR-18 ℹ Terms clauses for counsel

Hebrew text prevails over English; limitation of liability (12 months' fees; carve-out for intent/gross
negligence added); one-sided indemnity softened to "to the extent the law allows"; unilateral changes with a
14-day notice; jurisdiction; standard-contract (חוזה אחיד) review.

## DR-19 ⚠ Security findings left open

See [`security-findings.md`](security-findings.md): client IP for rate limits comes from a spoofable
`X-Forwarded-For` first hop; gallery access codes are a fast salted SHA-256 (rate-limited); album/projector
links do not check the access code; the upload token sits in the public invitation page and in a query string;
no CAPTCHA on public forms (Turnstile keys exist in env but unused).
