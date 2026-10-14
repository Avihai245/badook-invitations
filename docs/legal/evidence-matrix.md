# Evidence matrix

Status: **PASS** = implemented and exercised by an executed test (not by a written policy alone) · **PARTIAL** = implemented
or tested in part; the remainder is named · **BLOCKED** = cannot be completed without an owner/counsel decision ·
**NOT TESTED** = implemented but no executed test. No row is "PASS" on a document alone. Nothing here is legal
certification; matters for qualified Israeli counsel are in `decision-records.md` (DR-nn).

Environment of every run: Linux container, Node 22.22, local PostgreSQL 16.15 with the Supabase shim
(`tests/db/harness.ts`), Next.js production build (`npm run build`) served by `next start` for the e2e specs,
Playwright Chromium (desktop 1440×900 and mobile 390×844). `INVITES_LEGAL_V2` is off except where the row says
`PW_LEGAL_V2=1`. Results are listed in "Run log" at the end.

| # | Requirement | Legal / policy basis | Implementation | Test evidence | Status | Remaining action (owner) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Six documents render, in Hebrew and English, with stable anchors | brief §3, Reg. 35 (accessibility statement reachable) | `src/features/legal/v2/*`, `LegalPage.tsx`, routes `/terms /privacy /cookies /accessibility /refunds /gallery-rules` | `tests/unit/legal-docs.test.tsx` (63); e2e `legal-v2.spec.ts` 12 pages × 2 projects incl. axe | PASS | counsel review of the texts (DR-04, 09, 10, 18) |
| 2 | Hebrew and English are consistent | brief §3 | one function per document, both languages | structure/ids/list-length parity test; reviewer read privacy, rules and refunds for meaning (one wording fix made) | PARTIAL | semantic review of all six by a Hebrew-reading lawyer |
| 3 | Dates and entity details correct; none invented | brief §3, H | `readiness.ts`, `context.ts` | blank/complete/date/salt tests (`legal-docs.test.tsx`); blank operator ⇒ no company name or number appears | PASS (mechanism) | DR-01: supply and verify the production identity — **blocks go-live** |
| 4 | Immutable history, stable routes, non-retroactive | brief §7 | `v1/` frozen, `registry.ts`, `/legal/<doc>/<version>`, `legal_acceptances` records the version | SHA-256 manifest test; e2e: `/legal/terms/1` reachable, marked earlier, noindex, still says "three business days"; `/legal/terms/9`, `/legal/refunds/1` → 404 | PARTIAL | DR-23: archived pages render live prices/entity; pin v2 at go-live |
| 5 | Refunds and Terms agree; no universal 14-day rule; no unsupported fee | brief 2.9, F | `v2/refunds.ts`, `v2/terms.ts` §7–8 | test: same prices, same immediate cancellation, same 14 days, no "three business days", statutory wording conditional | PASS (text) / PARTIAL (law) | DR-04 counsel; no refund tool exists (manual) |
| 6 | Cancellation really stops billing | Consumer Protection Law s.13D, brief 6.4 | existing `cancelPlan`; `billing_renewals_due` | `tests/db/billing-cancel.test.ts`, `tests/unit/billing-legal-cancel.test.ts` (Tranzila: DB flag, charges stop; PayPlus: provider call + alert) | PARTIAL | DR-05: PayPlus renewal after cancel, token retention, race — **not fixed** (payment logic out of scope) |
| 7 | Prominent pre-purchase disclosure + acceptance evidence | Consumer Protection Law distance selling; brief 2.9 | `BillingScreen.client.tsx` PurchaseReview, checkout route gate, `legal_accept` | `billing-legal*.test.ts*` (45), DB `legal-compliance.test.ts` | PASS (v2 on) | DR-13 gaps (Google/partner accounts, acceptance at checkout-open) |
| 8 | Terms acceptance evidence at sign-up; none fabricated | brief §7 | `AuthForms.tsx`, `signUp` action, `legal_acceptances` | e2e: unticked box, error + focus, two rows (`terms`,`privacy`, v2, `signup`) | PASS | DR-13 |
| 9 | Contextual privacy notices (s.11) | Privacy Protection Law s.11 | report/request forms (`CollectionNotice`), gallery notice, sign-up, checkout, guest dialogs, RSVP, planning, contact, support, AI notes (`collection-notes`) | `collection-notes.test.tsx` (23), `rsvp-form`, `legal-requests-ui`, `gallery-legal-*`; e2e forms | PASS (unit) / NOT TESTED (browser, for host-app notices) | quick-questionnaire AI left (provider varies); native-speaker review of ar/am/ru/fr/es |
| 10 | First-upload gallery notice, once, mobile-first, accessible, versioned evidence | brief 6.1, A | `UploadNotice.tsx`, `/api/gallery/acknowledge`, `gallery_acknowledgements` | `gallery-legal-notice.test.tsx` (shown once, Esc, no storage, lost ack retried, face line only when on), e2e: dialog axe clean, links, Esc ⇒ no record, ack row (v2, per-event hash), not shown again | PASS | DR-03/25: a persisted upload queue resumes without the notice |
| 11 | Report content / request removal, end to end | brief 6.2 | `/report`, `/api/legal/report`, console `/app/admin/legal`, `media_report_*` SQL | unit (≈70) + DB `legal-compliance.test.ts` (urgent hide, cap, role gating, trail, removal → trash) + e2e (stored, no email claim, urgent child report hides item and removes it from the feed) | PASS | host UI shows "0 items" when it tries to re-show a held item; DR-19 mass-hide exposure (spoofable IP) |
| 12 | Report never falsely claims delivery | brief 6.2 | `sendEmailStrict`, `mark_notified` | unit + e2e (`team_notified_at` null without a mailbox; page does not say "emailed") | PASS | DR-21: configure Resend/mailbox before go-live |
| 13 | Guest/privacy request lifecycle without an account | brief 6.3, Law ss.13–14 | `/privacy-request`, `privacy_request_*` SQL, console | unit + DB (lifecycle, 30-day due, overdue) + e2e (child-photo request stored, due 30 days) | PASS | DR-06 confirm 30 days |
| 14 | Host vs platform responsibilities explained | brief 6.3 | privacy §1/§18, rules §15–16, request page | document tests | PASS (text) | — |
| 15 | Photographed non-uploaders protected; uploader ack ≠ consent of others | brief 2.4, 2.8 | rules §6, notice "not the consent of the people in your photos" | `gallery-legal-notice.test.tsx`; reviewer: no code treats ack as others' consent | PASS | — |
| 16 | Children | brief 2.6, DR-11 | urgent/hide for child, guardian, intimate (cap 5/h/gallery), `child_photo` request, texts | DB (cap, guardian urgent) | PARTIAL | DR-11: no age handling, AI honoree consent is one host checkbox, face search has no minor exclusion |
| 17 | Copyright and licence terms; complaint mechanism | Copyright Law 2007 | terms §4, rules §10, report category "copyright" (name+email required) | DB constraint test; document tests | PASS (mechanism) | DR-10 counsel |
| 18 | Face search: separate unticked consent kept; notices; **no behaviour change** | Law Amendment 13, brief 2.8 | `FaceSearch.tsx` text only | reviewer diff: no change in indexer/flags/SQL; existing `faces` tests (292 unit, e2e not re-run for faces) | **BLOCKED** | **DR-03 LEGAL APPROVAL REQUIRED** — activity B (descriptors of non-searchers) has no documented lawful basis; keep `INVITES_FACE_ALBUMS` off |
| 19 | AI photo disclosures verified | brief D | guest notice in `AiPhotoStudio`, policy §10, rules §14 | `gallery-legal-surfaces.test.tsx`; audit of provider calls | PARTIAL | DR-16: `store:true`, no deletion at provider, no per-person/child consent |
| 20 | Location metadata minimised | brief B | `media-location.ts`, `process.ts` | `media-location*.test.ts` (50) incl. JPEG/HEIC/HEIF/AVIF/PNG/WebP/MP4/MOV/3GP fixtures, derivatives, big-file slicing; reviewer fuzz 28,000 mutated files, 0 throws | PARTIAL | DR-15: client-side only, no real-device files tested, video originals still reach guests |
| 21 | Tenant / event isolation (real SQL) | Data Security Regs 2017 | RLS, service-role RPCs | `tests/db/gallery-isolation.test.ts` (10), existing `gallery`, `invitations`, `guests`, `support-tickets` tests | PASS | storage-object RLS cannot be run in the harness (static check only) |
| 22 | Storage private; no storage policies | Regs 2017 | migrations | `tests/unit/storage-policy.test.ts` (3) | PASS (static) | live-project check by owner |
| 23 | Unauthorised media / pending / rejected not exposed | brief 6.5 | `gallery_feed`, `gallery_changes` | `gallery-isolation.test.ts` | PASS | — |
| 24 | Upload identity spoofing | brief 6.5 | per-event hashed uploader id | `gallery-isolation.test.ts` (wrong device/event cannot delete), `gallery-api.test.ts` | PASS (DB level) | S1/S3 |
| 25 | Browser roles cannot touch legal/billing-token tables | Regs 2017 | grants revoked in the migration | `gallery-isolation.test.ts` (14 tables × read/delete × 2 roles) | PASS | — |
| 26 | Accessibility statement accurate; no unverified claims | Reg. 35, IS 5568 | `v2/accessibility.ts` | document tests (no manual test claimed unless `INVITES_ACCESSIBILITY_REVIEW_DATE`) | PASS (text) | DR-12: manual/AT testing **not performed**; external audit |
| 27 | Accessibility of new pages | brief 8 | — | e2e axe (WCAG 2.0/2.1 A+AA) on 12 doc pages ×2 projects, /report, /privacy-request, upload dialog, 320 px reflow on 6 docs, RTL attribute | PASS (automated only) | keyboard/screen-reader/zoom 200% **manual testing not done**; admin console not scanned |
| 28 | Legal response commitments | brief E | privacy §18 (30 days), accessibility (aim 7 business days) | — | PARTIAL | DR-06 |
| 29 | Section numbering / duplicate ids fixed | brief G | v2 privacy numbered 1–22; ids unique | tests (no repeated numbers, unique ids) | PASS | — |
| 30 | Legal identity configuration verified before publish | brief H | readiness gate | tests | PARTIAL | DR-01 |
| 31 | Communications Law s.30A separation | brief 2.10 | terms §3, privacy §3 text | — | BLOCKED | DR-09 counsel; templates classed "Marketing" at Meta |
| 32 | Database registration / notification / DPO / security level assessed | brief 2.1–2.2 | `database-assessment.md` | — | BLOCKED | DR-08: needs data-subject counts; no filing made |
| 33 | Processors and transfers inventoried | brief 2.3 | `processors.md` | — | PARTIAL | DR-07: agreements, regions |
| 34 | Regression: existing features unaffected with v2 off | brief §10 | gating | full unit suite, full DB suite, e2e smoke subset (see run log) | PARTIAL | e2e for invitations/RSVP/WhatsApp/seating/billing run only as listed |
| 35 | Independent adversarial review, findings resolved | brief §9 | review report (this branch's history) | 21 findings: 2 blockers, 6 high, 8 medium, 5 low — all fixed in code or text, or moved to a DR | PASS (as a process) | residual risks are in DR-03, 05, 11, 15, 19–25 |
| 36 | No pricing/credit/payment/analytics/consent-loading change | brief §10 | — | diff review (reviewer): none; pack price display rounding changes only with v2 on | PASS | — |

## Run log

(Filled in with the final commands and results — see the end of the PR description.)
