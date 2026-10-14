# Databases: registration, notification, DPO, security level

**Status: reasoned preliminary assessment — not a determination.** It applies the framework in the programme
brief (Privacy Protection Law as amended by Amendment 13, the 2017 Data Security Regulations). Official
references: gov.il/he/pages/tikun13_qa, gov.il/he/service/notice-obligation, gov.il/BlobFolder/generalpage/1files/he/IT2017.pdf.
Numbers the code cannot know are marked **[owner]**. Nothing here is filed; any filing or appointment is the
owner's decision (DR-08).

## 1. What databases exist (logical)

| Database | Contents | Data subjects | Sensitive? |
| --- | --- | --- | --- |
| Hosts & accounts | name, email, phone, plan, payments (tokens), acceptance records, support tickets | hosts [owner: count] | no |
| Guest lists & RSVPs | names, phones, emails, party size, dietary preference, free answers to host questions, check-in | guests of all events [owner: count] | not by design; dietary preference or a host's free question can reveal religion/health — host-controlled |
| Gallery media | photos/videos of people, display names, Instagram handle, per-event device hash, likes | guests and anyone photographed | images are personal information; not "specially sensitive" per se |
| Face codes (`gallery_faces`, opt-outs) | 128-number descriptors + box per face, linked to photos | anyone photographed in galleries where face search is on | **biometric — potentially specially sensitive**; exists only if `INVITES_FACE_ALBUMS` is on (default off) |
| Reports & privacy requests | reporter/requester name, email, phone, descriptions | reporters [owner: count] | content may include sensitive facts |
| Admin audit | staff actions | staff | no |

## 2. Registration (s.8 as amended)

Amendment 13 does **not** require every database to be registered. On the facts here (a service provider
processing hosts' event data; no sale or brokerage of data; not a public body) no registration obligation is
*asserted*. **Counsel to confirm** against the statutory categories.

## 3. Notification obligation

May apply to a database not otherwise requiring registration when it holds specially sensitive information on
more than 100,000 individuals. The only candidate is the face-code database, which (a) exists only if face
search is enabled and (b) is erased 30 days after each event. With the feature off: not applicable. If it is
enabled: count distinct individuals across events [owner: expected volume]; the threshold looks unlikely to be
reached in a 30-day-retention design but must be re-checked. Not filed.

## 4. Data Protection Officer

Depends on the actual activities and statutory criteria (large-scale sensitive processing or systematic
monitoring). Current facts (no biometric processing when off; no tracking of individuals; insights are
aggregate) do not on their face meet them; enabling face search would require re-assessment. The policy names a
privacy contact (mailbox), not a DPO. Not appointed.

## 5. Security level (2017 Regulations)

The level (basic / medium / high) depends on the sensitivity of information, the number of data subjects and the
number of persons with access, and determines the obligations (documentation, access control, logging, penetration
testing intervals, review). Inputs needed: [owner] number of data subjects per database; number of staff with
console access (role matrix in `admin_can`); whether any database counts as holding sensitive information.
**Level: not determined.** Controls already present are mapped below so that whichever level applies can be
evidenced.

| Regulation topic | Implemented | Evidence |
| --- | --- | --- |
| Database definition document | skeleton below | this file |
| Access permissions, least privilege | role matrix; service-role-only RPCs; masked contact details | `20260927010115_admin_console.sql`, `tests/db/support-tickets.test.ts`, `tests/db/legal-compliance.test.ts` |
| Authentication / privileged access | Supabase Auth; staff by verified email; remote support ("act as") is open to every role with `support.reply` (support, admin, owner), its start audited with a reason — in-session actions not verified as audited (DR-20) | `admin_role_of`, `act-as.ts` |
| Tenant isolation | RLS on, no policies, definer RPCs scoped by owner/token | `tests/db/*.test.ts`, `tests/db/gallery-isolation.test.ts` |
| Audit logging | `admin_audit` (2 y), report/request event trails | migrations |
| Security events & incident response | **no written procedure in the repo** | [owner] |
| Backup, recovery, deletion | provider backups; deletion jobs | DR-14 |
| Service providers / outsourcing (Reg. 15) | inventory only | `processors.md`, DR-07 |
| Periodic review & security testing | this programme's tests; no penetration test | [owner] |
| Access revocation | staff removal; sessions via Supabase | |
| Retention & disposal | schedules in policy §9; jobs in `src/features/jobs` | |

## 6. Database definition (skeleton to complete)

For each database: purposes (event administration, invitation delivery, RSVP management, gallery operation, AI,
biometric matching, support and security — **not** marketing), types of information, sources (hosts, guests,
payment providers, partner system), recipients/categories (section 5 of the policy), transfers abroad
(`processors.md`), the persons/roles with access, retention (policy §9), the security measures above, and the
owner of the database (the operator — DR-01).
