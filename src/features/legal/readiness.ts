/**
 * Whether the legal documents' version 2 may be shown. It needs the owner's switch (INVITES_LEGAL_V2)
 * AND complete details: the operator's name, company number, address and the support email, a real
 * calendar date as the effective date that has arrived (the switch can be set ahead: nothing changes
 * until that day, so the 14 days' notice to hosts can run first), and the salt that makes the stored IP
 * hashes one-way — a document with a blank or invented identity is never published. Pure (no server
 * imports), so tests and scripts can use it.
 */
export interface LegalReadinessInput {
  INVITES_LEGAL_V2: boolean;
  INVITES_LEGAL_V2_EFFECTIVE: string;
  INVITES_LEGAL_NAME: string;
  INVITES_LEGAL_ID: string;
  INVITES_LEGAL_ADDRESS: string;
  INVITES_SUPPORT_EMAIL: string;
  INVITES_IP_HASH_SALT: string;
}

export interface LegalReadiness {
  /** the owner switched version 2 on */
  requested: boolean;
  /** details still missing (empty when complete) */
  missing: string[];
  /** version 2 is in force */
  active: boolean;
  effective: string | null;
  /** switched on and complete, but the effective date is still ahead */
  scheduled: boolean;
}

/** A calendar date as YYYY-MM-DD (not 2026-13-45). */
export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function legalReadiness(env: LegalReadinessInput, now: Date = new Date()): LegalReadiness {
  const missing: string[] = [];
  if (!env.INVITES_LEGAL_NAME.trim()) missing.push('INVITES_LEGAL_NAME');
  if (!env.INVITES_LEGAL_ID.trim()) missing.push('INVITES_LEGAL_ID');
  if (!env.INVITES_LEGAL_ADDRESS.trim()) missing.push('INVITES_LEGAL_ADDRESS');
  if (!env.INVITES_SUPPORT_EMAIL.trim()) missing.push('INVITES_SUPPORT_EMAIL');
  const effective = env.INVITES_LEGAL_V2_EFFECTIVE.trim();
  if (!isIsoDate(effective)) missing.push('INVITES_LEGAL_V2_EFFECTIVE');
  if (env.INVITES_IP_HASH_SALT.trim().length < 16) missing.push('INVITES_IP_HASH_SALT');
  const requested = env.INVITES_LEGAL_V2;
  const ready = requested && missing.length === 0;
  const arrived = isIsoDate(effective) && effective <= now.toISOString().slice(0, 10);
  return {
    requested,
    missing,
    active: ready && arrived,
    scheduled: ready && !arrived,
    effective: isIsoDate(effective) ? effective : null,
  };
}
