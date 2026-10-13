/**
 * Whether the legal documents' version 2 may be shown. It needs the owner's switch (INVITES_LEGAL_V2)
 * AND complete details: the operator's name, company number, address and the support email, and the
 * effective date — a document with a blank or invented identity is never published. Pure (no server
 * imports), so tests and scripts can use it.
 */
export interface LegalReadinessInput {
  INVITES_LEGAL_V2: boolean;
  INVITES_LEGAL_V2_EFFECTIVE: string;
  INVITES_LEGAL_NAME: string;
  INVITES_LEGAL_ID: string;
  INVITES_LEGAL_ADDRESS: string;
  INVITES_SUPPORT_EMAIL: string;
}

export interface LegalReadiness {
  /** the owner switched version 2 on */
  requested: boolean;
  /** details still missing (empty when complete) */
  missing: string[];
  /** version 2 is in force */
  active: boolean;
  effective: string | null;
}

export function legalReadiness(env: LegalReadinessInput): LegalReadiness {
  const missing: string[] = [];
  if (!env.INVITES_LEGAL_NAME.trim()) missing.push('INVITES_LEGAL_NAME');
  if (!env.INVITES_LEGAL_ID.trim()) missing.push('INVITES_LEGAL_ID');
  if (!env.INVITES_LEGAL_ADDRESS.trim()) missing.push('INVITES_LEGAL_ADDRESS');
  if (!env.INVITES_SUPPORT_EMAIL.trim()) missing.push('INVITES_SUPPORT_EMAIL');
  if (!env.INVITES_LEGAL_V2_EFFECTIVE.trim()) missing.push('INVITES_LEGAL_V2_EFFECTIVE');
  const requested = env.INVITES_LEGAL_V2;
  return {
    requested,
    missing,
    active: requested && missing.length === 0,
    effective: env.INVITES_LEGAL_V2_EFFECTIVE.trim() || null,
  };
}
