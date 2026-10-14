import 'server-only';
import { serverEnv } from '@/lib/env';
import { legalReadiness, type LegalReadiness } from './readiness';

/**
 * Whether version 2 of the legal documents is in force on this deployment (see readiness.ts). Kept apart
 * from context.ts, which pulls in billing and the feature flags: the public pages' footer asks only this.
 */
export function legalStatus(): LegalReadiness {
  return legalReadiness(serverEnv());
}
