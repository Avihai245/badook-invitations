# Security and privacy testing — what was run, found, fixed and left

Synthetic data only (no real guest media was opened). Commands are from the repository root; the local stack is
Postgres 16 with the Supabase shim (`tests/db/harness.ts`). Results are in `evidence-matrix.md`.

## Tests added by this programme

| Area | Test | What it proves |
| --- | --- | --- |
| Event & tenant isolation (real SQL) | `tests/db/gallery-isolation.test.ts` | a gallery link opens only its own event and only as the kind it was made for; one event's feed/changes never hold another's items; pending/rejected items stay out of the feed and "added"; a device sees only its own pending items; deleting needs the right event **and** the right device (spoof attempts fail); a host cannot read, moderate or download another host's gallery; `anon` and `authenticated` cannot read or write any gallery, face, report, request, acceptance or billing-token table; every such table has RLS on; the new functions are service-role only |
| Reports, requests, acceptance (real SQL) | `tests/db/legal-compliance.test.ts` | a report can only point at a published item of its own invitation; urgent reports hide reversibly; staff role gating (support cannot remove; admin can; viewer cannot act); removal queues the files for deletion; audit rows; request lifecycle and 30-day due date; maintenance erases only old resolved rows |
| Storage | `tests/unit/storage-policy.test.ts` | no migration opens `storage.objects` with a policy; `gallery-originals`, `gallery-media`, `ai-photos`, `plan-files` are private; the only public buckets are the three that serve invitation pages |
| Upload-time location removal | `tests/unit/media-location*.test.ts` | GPS bytes zeroed for JPEG, HEIC/HEIF/AVIF, PNG, WebP, MP4/MOV/3GP; other bytes preserved; malformed input unchanged; a large video is handled by slices |
| Upload identity, tokens, codes | existing `tests/unit/gallery-api.test.ts` (46), `tests/db/gallery.test.ts` | per-event hashed uploader id; access code timing-safe compare + rate limit; reserve/complete limits |
| Acknowledgement | `tests/unit/gallery-legal-*.test.ts*` | the endpoint 404s when inactive, validates, rate-limits, and stores the **per-event hashed** uploader |
| Cancellation | `tests/db/billing-cancel.test.ts`, `tests/unit/billing-legal-cancel.test.ts` | a cancelled plan is not in `billing_renewals_due`; provider call/alert paths; pinned defects (DR-05) |

## Found and fixed

1. **Payment-token and rate tables carried browser grants** (`billing_cards`, `billing_claims`, `rsvp_rate_events`):
   RLS with no policy returned zero rows, but unlike every other server-only table the grants were not revoked.
   Revoked in `20261013000100_legal_compliance.sql` (server uses the service role; no behaviour change). Test:
   `gallery-isolation.test.ts`.
2. **Location metadata** left in HEIC/video/PNG/WebP originals (only JPEG was handled), including Exif beyond
   512 KB, a second Exif block, and XMP: now handled in the browser (see DR-15 for limits).
3. **A hidden item could not be distinguished** from a host's decision: new `status_reason = 'report'` and
   moderation rows with `decided_by = 'staff'`.

## Found and left (decision records)

| # | Finding | Why left | Where |
| --- | --- | --- | --- |
| S1 | The server never reads uploaded bytes: a modified client skips the location stripping; the AI check runs on a client-supplied thumbnail that is not tied to the display/original file | needs a server-side processing step | DR-15 |
| S2 | Guests (and the album page) receive a signed URL to the **original video file** | product behaviour; changing it alters the album's download | DR-15 |
| S3 | `lib/client-ip.ts` trusts the first `X-Forwarded-For` hop when CloudFront's header is absent: per-address rate limits (gallery, RSVP, contact, new report/request forms) can be evaded by spoofing it | cross-cutting; depends on the hosting header guarantees | DR-19 |
| S4 | Gallery access codes are stored as a salted fast SHA-256 (rate-limited, timing-safe compare); the album and projector links do not check the code; the upload token is in the public invitation page and in a query string | existing design | DR-19 |
| S5 | A file PUT with a still-valid upload token after its item was soft-deleted can leave an orphan storage object (audit, unverified) | needs a storage sweep | DR-14 |
| S6 | No CAPTCHA on public forms (Turnstile keys exist in env but are not used); the new forms use a honeypot, per-address limits and de-duplication | needs a provider | DR-19 |
| S7 | Face descriptors are linked to photos that carry the uploader's pseudonymous id and optional name; photos pending/hidden/rejected are indexed too | legal approval | DR-03 |
| S8 | PayPlus renewal after cancel extends the plan; Tranzila token kept after cancel | payment logic | DR-05 |
| S9 | Storage-object RLS cannot be exercised in the local harness (no `storage.objects`); the check is static + the signed-URL design | harness limit | this file |

## Not tested here (be honest)

- Supabase **storage** policies against a live project, signed-URL expiry behaviour at the CDN, Realtime channel
  secrecy (random channel names only), and the production Postgres roles/grants differ from the shim.
- Penetration testing, load, and backup/restore.
- Real Apple/Android media (no real media was used).
