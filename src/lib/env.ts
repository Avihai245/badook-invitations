import 'server-only';
import { z } from 'zod';

const flag = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v === undefined || v.trim() === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
    );

/**
 * Server-side configuration (every name matches amplify.yml's
 * `^(NEXT_PUBLIC_|SUPABASE_|INVITES_|ANTHROPIC_API_KEY=|OPENAI_API_KEY=)`). Documented in .env.example.
 */
/** The OpenAI model used when OPENAI_API_KEY is set and INVITES_AI_MODEL_OPENAI isn't. */
export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(''),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().default(''),
  SUPABASE_SECRET_KEY: z.string().default(''),
  INVITES_IP_HASH_SALT: z.string().default(''),
  // replies to the site's sample invitations: checked, not kept; 'store' keeps them (end-to-end tests)
  INVITES_DEMO_RSVP: z.string().trim().toLowerCase().default(''),
  INVITES_PUBLIC_BASE_URL: z
    .url()
    .default('http://localhost:3000')
    .transform((u) => u.replace(/\/+$/, '')),
  INVITES_BRAND_NAME: z.string().trim().min(1).default('Badook'),
  INVITES_SUPPORT_EMAIL: z.union([z.email(), z.literal('')]).default(''),
  INVITES_FEATURE_ENABLED: flag(true),
  INVITES_DEV_ROUTES: flag(false),
  INVITES_TURNSTILE_SITE_KEY: z.string().default(''),
  NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL: z.string().default(''),
  // host notifications (P4): Resend API key + sender; without them emails are only logged
  INVITES_EMAIL_API_KEY: z.string().default(''),
  INVITES_EMAIL_FROM: z.string().default(''),
  // bearer token of POST /api/cron/* (a scheduler's calls); empty = those endpoints are off
  INVITES_CRON_SECRET: z.string().default(''),
  // the app runs its recurring jobs by itself on its own traffic (features/jobs); off: only a scheduler
  INVITES_JOBS_FALLBACK: flag(true),
  // feature flags (features/flags): features this deployment doesn't offer, comma-separated ids
  INVITES_FEATURES_OFF: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
    ),
  // the face albums process biometric data: off until approved (docs/features.md)
  INVITES_FACE_ALBUMS: flag(false),
  // the planning section (tasks, budget, vendors, ideas): off until its migrations are applied
  INVITES_PLANNING: flag(false),
  // comma-separated emails with the top plan and the admin tools (the platform's owners)
  INVITES_ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),

  // ── support assistant (AI chat): Anthropic API; without a key it answers from the built-in guide ──
  ANTHROPIC_API_KEY: z.string().default(''),
  // the model's id (Anthropic's models page); without it, too, the guide answers
  INVITES_AI_MODEL: z.string().trim().default(''),
  INVITES_AI_API_BASE: z
    .url()
    .default('https://api.anthropic.com')
    .transform((u) => u.replace(/\/+$/, '')),
  // questions a day for the whole site (a cost ceiling); past it the assistant answers from the guide
  INVITES_AI_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(2000),
  // OpenAI instead: with this key the support chat answers through it (chat.completions), and so does
  // the gallery's "quick create with AI" questionnaire when there is no Anthropic key — every other AI
  // feature above (gallery_ai, translate_ai, art_direction, planning_ai) stays on ANTHROPIC_API_KEY +
  // INVITES_AI_MODEL regardless. The model: INVITES_AI_MODEL_OPENAI, or DEFAULT_OPENAI_MODEL when empty.
  OPENAI_API_KEY: z.string().default(''),
  INVITES_AI_MODEL_OPENAI: z
    .string()
    .trim()
    .default('')
    .transform((m) => m || DEFAULT_OPENAI_MODEL),
  INVITES_AI_API_BASE_OPENAI: z
    .url()
    .default('https://api.openai.com')
    .transform((u) => u.replace(/\/+$/, '')),
  // design concepts made by the AI a day per account ("design it for me"); past it they are composed
  // from the photos without it. The site's ceiling for them is INVITES_AI_DAILY_LIMIT.
  INVITES_ART_DIRECTION_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(12),
  // plan drafts and idea summaries made by the AI a day per account (feature planning_ai); the site's
  // ceiling for them is INVITES_AI_DAILY_LIMIT
  INVITES_PLANNING_AI_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(10),

  // ── the invitation read aloud (feature `voice`): Azure AI Speech, text to speech (REST) ──
  // without the key and region the guest's "listen" uses the device's own voice (when it has one)
  INVITES_TTS_AZURE_KEY: z.string().default(''),
  INVITES_TTS_AZURE_REGION: z.string().trim().default(''),
  // another address for the service (a local stand-in in tests); empty: the region's
  INVITES_TTS_AZURE_ENDPOINT: z
    .union([z.url(), z.literal('')])
    .default('')
    .transform((u) => u.replace(/\/+$/, '')),

  // ── live gallery (features/live-gallery) ──
  // the key its links are derived from (random, ≥32 chars); empty: the Supabase secret key. Changing
  // it keeps the links already out working; the hosts' screens then offer new ones.
  INVITES_GALLERY_SECRET: z.string().default(''),
  // the model for the automatic check of guests' uploads (gallery_ai); empty: INVITES_AI_MODEL
  INVITES_GALLERY_AI_MODEL: z.string().trim().default(''),

  // ── WhatsApp Business Platform (Cloud API) — the system's official number ──
  INVITES_WHATSAPP_TOKEN: z.string().default(''),
  INVITES_WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  INVITES_WHATSAPP_APP_SECRET: z.string().default(''),
  INVITES_WHATSAPP_VERIFY_TOKEN: z.string().default(''),
  INVITES_WHATSAPP_TEMPLATE: z.string().trim().min(1).default('badook_invitation'),
  // the languages the template is approved in, as Meta's codes ("he,en,ru,ar"; default he,en): each
  // guest gets theirs, else the invitation's (features/whatsapp/languages.ts) — the invitation's
  // template, the table number's and the gallery link's alike
  INVITES_WHATSAPP_TEMPLATE_LANGS: z.string().trim().optional(),
  // the older single language (used only when INVITES_WHATSAPP_TEMPLATE_LANGS isn't set)
  INVITES_WHATSAPP_TEMPLATE_LANG: z.string().trim().optional(),
  // the table number's template (features/event-day: a guest's table and the map to it), once Meta
  // approved it (docs/whatsapp-setup.md); empty: hosts send it from their own WhatsApp instead
  INVITES_WHATSAPP_TABLE_TEMPLATE: z.string().trim().default(''),
  // the gallery link's template (features/live-gallery: each guest's link to upload photos and see the
  // album), once Meta approved it (docs/whatsapp-setup.md §9); empty: hosts send it from their own WhatsApp
  INVITES_WHATSAPP_GALLERY_TEMPLATE: z.string().trim().default(''),
  INVITES_WHATSAPP_API_VERSION: z.string().trim().min(2).default('v26.0'),
  INVITES_WHATSAPP_API_BASE: z
    .url()
    .default('https://graph.facebook.com')
    .transform((u) => u.replace(/\/+$/, '')),
  // Meta's marketing-message rate for Israel (per delivered template, USD) and the shekel rate
  INVITES_WHATSAPP_PRICE_USD: z.coerce.number().positive().default(0.0353),
  INVITES_USD_TO_ILS: z.coerce.number().positive().default(3.7),

  // ── payments: PayPlus (Israeli gateway: cards, Bit, Apple/Google Pay, invoices) ──
  INVITES_PAYPLUS_API_KEY: z.string().default(''),
  INVITES_PAYPLUS_SECRET_KEY: z.string().default(''),
  INVITES_PAYPLUS_PAGE_UID: z.string().default(''),
  INVITES_PAYPLUS_SANDBOX: flag(false),
  INVITES_PAYPLUS_API_BASE: z.string().default(''),
  // ── payments: Tranzila (docs/billing-setup.md): the card is typed in Tranzila's iframe on the
  // iframe terminal, which hands back a token; the token terminal charges it (the first payment and
  // every month) through the API. With the API keys set, new purchases go through Tranzila.
  INVITES_TRANZILA_TERMINAL: z.string().trim().default('badookinvit'),
  INVITES_TRANZILA_TOKEN_TERMINAL: z.string().trim().default('badookinvittok'),
  INVITES_TRANZILA_APP_KEY: z.string().trim().default(''),
  INVITES_TRANZILA_SECRET: z.string().trim().default(''),
  // what the iframe does with the card: VK holds the sum (J5, which our server then takes) and makes a
  // token; NK checks it (J2, nothing held) and makes a token; K only makes a token
  INVITES_TRANZILA_TRANMODE: z.enum(['VK', 'NK', 'K']).default('VK'),
  // the iframe terminal's TranzilaPW: the handshake that locks the form's sum (optional)
  INVITES_TRANZILA_PW: z.string().trim().default(''),
  INVITES_TRANZILA_API_BASE: z
    .url()
    .default('https://api.tranzila.com')
    .transform((u) => u.replace(/\/+$/, '')),
  INVITES_TRANZILA_IFRAME_BASE: z
    .url()
    .default('https://directng.tranzila.com')
    .transform((u) => u.replace(/\/+$/, '')),
  INVITES_TRANZILA_CGI_BASE: z
    .url()
    .default('https://secure5.tranzila.com')
    .transform((u) => u.replace(/\/+$/, '')),
  // local / end-to-end tests only: a fake checkout page instead of PayPlus
  INVITES_BILLING_TEST_MODE: flag(false),
  // monthly plan prices in shekels, VAT included
  INVITES_PRICE_PRO: z.coerce.number().nonnegative().default(49),
  INVITES_PRICE_BUSINESS: z.coerce.number().nonnegative().default(149),

  // ── partners: Badook Events opens users here (server to server) ──
  INVITES_PARTNER_API_KEY: z.string().default(''),

  // ── legal pages: the operator's details (shown only when set) ──
  INVITES_LEGAL_NAME: z.string().default(''),
  INVITES_LEGAL_ID: z.string().default(''),
  INVITES_LEGAL_ADDRESS: z.string().default(''),
  INVITES_LEGAL_PHONE: z.string().default(''),
  INVITES_ACCESSIBILITY_COORDINATOR: z.string().default(''),
  INVITES_ACCESSIBILITY_PHONE: z.string().default(''),
  INVITES_ACCESSIBILITY_EMAIL: z.union([z.email(), z.literal('')]).default(''),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const blankToUndefined = Object.fromEntries(
      Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
    );
    cached = ServerEnvSchema.parse(blankToUndefined);
  }
  return cached;
}
