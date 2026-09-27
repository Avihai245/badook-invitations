import 'server-only';
import { billingMode, type BillingMode } from '@/features/billing/server/billing';
import { payplusConfigured } from '@/features/billing/server/payplus';
import { seedVersion } from '@/features/invitations/templates/seed-data';
import { dailyDue } from '@/features/jobs/schedule';
import { cloudApiConfigured } from '@/features/whatsapp/cloud-api';
import { templateLanguages } from '@/features/whatsapp/languages';
import { serverEnv } from '@/lib/env';

/**
 * What the system page shows about this deployment besides the database: which services are set up —
 * yes or no only, never a value — the WhatsApp templates' languages, the code's templates version and
 * the build that is running.
 */
export interface Deployment {
  services: {
    supabase: boolean;
    whatsapp: boolean;
    whatsappWebhook: boolean;
    templates: { invitation: boolean; table: boolean; gallery: boolean };
    payplus: boolean;
    billing: BillingMode;
    email: boolean;
    supportEmail: boolean;
    ai: boolean;
    aiChat: boolean;
    tts: boolean;
    partnerApi: boolean;
    faceAlbums: boolean;
    cronSecret: boolean;
    jobsFallback: boolean;
  };
  /** INVITES_WHATSAPP_TEMPLATE_LANGS as the sender reads it (Meta's codes; not a secret) */
  templateLangs: string[];
  /** the templates' fingerprint in the code (the database's: admin_system seedVersion) */
  seedVersion: string;
  build: { commit: string; builtAt: string | null };
  /** when the daily run is due next (06:00 UTC) */
  dailyNext: string;
}

let codeSeed: string | null = null;

export function deployment(now = new Date()): Deployment {
  const env = serverEnv();
  codeSeed ??= seedVersion();
  const nextDaily = new Date(dailyDue(now).getTime() + 86_400_000);
  return {
    services: {
      supabase: !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY),
      whatsapp: cloudApiConfigured(),
      whatsappWebhook: !!(env.INVITES_WHATSAPP_APP_SECRET && env.INVITES_WHATSAPP_VERIFY_TOKEN),
      templates: {
        invitation: !!env.INVITES_WHATSAPP_TEMPLATE,
        table: !!env.INVITES_WHATSAPP_TABLE_TEMPLATE,
        gallery: !!env.INVITES_WHATSAPP_GALLERY_TEMPLATE,
      },
      payplus: payplusConfigured(),
      billing: billingMode(),
      email: !!(env.INVITES_EMAIL_API_KEY && env.INVITES_EMAIL_FROM),
      supportEmail: !!env.INVITES_SUPPORT_EMAIL,
      ai: !!(env.ANTHROPIC_API_KEY && env.INVITES_AI_MODEL),
      // the chat only: either provider (support/chat.ts) — true even when only OpenAI is set up
      aiChat: !!(
        (env.ANTHROPIC_API_KEY && env.INVITES_AI_MODEL) ||
        (env.OPENAI_API_KEY && env.INVITES_AI_MODEL_OPENAI)
      ),
      tts: !!(env.INVITES_TTS_AZURE_KEY && env.INVITES_TTS_AZURE_REGION),
      partnerApi: !!env.INVITES_PARTNER_API_KEY,
      faceAlbums: env.INVITES_FACE_ALBUMS,
      cronSecret: !!env.INVITES_CRON_SECRET,
      jobsFallback: env.INVITES_JOBS_FALLBACK,
    },
    templateLangs: templateLanguages(
      env.INVITES_WHATSAPP_TEMPLATE_LANGS,
      env.INVITES_WHATSAPP_TEMPLATE_LANG,
    ).map((l) => l.code),
    seedVersion: codeSeed,
    build: {
      // next.config.ts: Amplify's commit (AWS_COMMIT_ID), else git's, else "local"
      commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || 'local',
      builtAt: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    },
    dailyNext: nextDaily.toISOString(),
  };
}
