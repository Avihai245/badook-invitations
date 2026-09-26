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
 * `^(NEXT_PUBLIC_|SUPABASE_|INVITES_|ANTHROPIC_API_KEY=)`). Documented in .env.example.
 */
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
  INVITES_WHATSAPP_TEMPLATE_LANG: z.string().trim().min(2).default('he'),
  // the table number's template (features/event-day: a guest's table and the map to it), once Meta
  // approved it (docs/whatsapp-setup.md); empty: hosts send it from their own WhatsApp instead
  INVITES_WHATSAPP_TABLE_TEMPLATE: z.string().trim().default(''),
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
