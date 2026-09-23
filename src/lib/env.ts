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
 * Server-side configuration (every name matches amplify.yml's `^(NEXT_PUBLIC_|SUPABASE_|INVITES_)`).
 * Documented in .env.example. Supabase keys join in P1.
 */
const ServerEnvSchema = z.object({
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
