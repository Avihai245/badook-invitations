# Processors and data flows

Inventory from the code (`grep` of outbound calls, `src/lib/env.ts`, the audit in this programme). "Location"
is what the code or documentation shows; **where the code does not pin a region it says "not pinned"** and the
owner must confirm with the provider (DR-07). Retention: the provider's own policy applies to what it holds
unless stated. No agreement text was reviewed — the repository contains none.

| Recipient (role) | Data categories | Purpose | Location | Retention / deletion | Safeguards in code | Open |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase (database, auth, storage) | everything the app stores: accounts, guest lists, RSVPs, gallery media, face codes, reports, requests | hosting the service | EU, Frankfurt (policy v1/v2; project region not verifiable from code) | per our schedules (privacy policy §9); backups per Supabase plan | RLS on, no browser policies; service-role-only RPCs; private buckets; signed URLs ≤ 3 h | DPA; backup period (DR-14) |
| AWS Amplify (hosting) | request data, IP, server logs | web hosting | not pinned | AWS logs | HTTPS | region, DPA |
| Meta WhatsApp Business | guest phone, name, message link | sending invitations, reminders, table numbers, gallery/album links | global | Meta's policy | host confirmation + STOP list | Marketing-category templates (DR-09) |
| Tranzila | payer details entered on its form; token to us | card payments (current) | Israel | per tax law; token kept by us in `billing_cards` | card data never reaches us; handshake V2 | token deletion at cancel (DR-05) |
| PayPlus | payer details; subscription id | payments of subscriptions started there | Israel | per tax law | callback HMAC | which provider is live |
| Resend | recipient email, subject/body of service mail | email delivery | not pinned (US likely) | Resend's policy; `email_log` keeps kind+status 90 d | content minimised (no conversation in team notices) | DPA, region |
| Anthropic | support questions (text); **gallery thumbnails** (content check); host-chosen photos (design suggestions); planning/translation texts | AI features | global endpoint, not pinned | Anthropic's policy | thumbnails/texts only, no names | DPA, zero-retention option |
| OpenAI | **AI photos**: honoree photos, guest photo, honoree names/roles/description, request text; support text where used | AI photos, assistant | `api.openai.com`, not pinned | `store:true` in background mode; **app never deletes** responses | re-encoded images, no EXIF; no guest name sent | store flag, region, DPA (DR-16) |
| Microsoft Azure AI Speech | invitation texts (no guest data) | read-aloud audio | region configured by env (EU per policy) | audio stored by us | text only | confirm region |
| Google (Maps, OAuth), YouTube (nocookie), Vimeo | IP/browser as any embed; Google profile on sign-in | maps, videos, sign-in | global | their policies | consent notice for site pages | invitations load embeds without notice |

Internal flows that matter for biometric data: face descriptors never leave Supabase (no external face
processor; models are served from our origin). Gallery thumbnails (which may contain faces) go to Anthropic when
the plan's content check is on, whether or not face search is on.
