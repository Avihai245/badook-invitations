import { accessibilityDoc as accessibilityV1 } from './v1/accessibility';
import { cookiesDoc as cookiesV1 } from './v1/cookies';
import { privacyDoc as privacyV1 } from './v1/privacy';
import { termsDoc as termsV1 } from './v1/terms';
import { V2_DOCS } from './v2';
import type { LegalContext, LegalDoc, LegalDocKey } from './types';

/**
 * Every version of every legal document. A version is immutable once it was in force: its text lives in
 * its own file (v1/, v2/), never edited afterwards — a change is a new version, and
 * tests/unit/legal-docs.test.tsx fails if a frozen file changes. Version 1 is the text that was live
 * before the compliance update; version 2 is switched on by INVITES_LEGAL_V2 (legal/context.ts) after
 * the owner approved it. `effective` is the ISO date it took effect; null for version 2 means "the
 * date the deployment sets" (INVITES_LEGAL_V2_EFFECTIVE) — never invented in code.
 */
export interface LegalVersion {
  version: string;
  effective: string | null;
  build: (c: LegalContext) => LegalDoc;
}

type Registry = Record<LegalDocKey, readonly LegalVersion[]>;

const V1_EFFECTIVE = '2026-10-10';

const v2 = V2_DOCS;

export const LEGAL_VERSIONS: Registry = {
  terms: [
    { version: '1', effective: V1_EFFECTIVE, build: termsV1 },
    { version: '2', effective: null, build: v2.terms },
  ],
  privacy: [
    { version: '1', effective: V1_EFFECTIVE, build: privacyV1 },
    { version: '2', effective: null, build: v2.privacy },
  ],
  cookies: [
    { version: '1', effective: V1_EFFECTIVE, build: cookiesV1 },
    { version: '2', effective: null, build: v2.cookies },
  ],
  accessibility: [
    { version: '1', effective: V1_EFFECTIVE, build: accessibilityV1 },
    { version: '2', effective: null, build: v2.accessibility },
  ],
  // the refund policy and the gallery rules are new in version 2: before it, the terms (section 7)
  // carried the refund provisions, and the gallery's disclosure was in the privacy policy (7A)
  refunds: [{ version: '2', effective: null, build: v2.refunds }],
  'gallery-rules': [{ version: '2', effective: null, build: v2['gallery-rules'] }],
};

/** The version in force: the newest when version 2 is active, otherwise the newest version 1 (if any). */
export function versionInForce(key: LegalDocKey, v2Active: boolean): LegalVersion | null {
  const all = LEGAL_VERSIONS[key];
  const usable = v2Active ? all : all.filter((v) => v.version === '1');
  return usable.length ? usable[usable.length - 1]! : null;
}

/** The versions a visitor may open: version 1 always; version 2 only once it is active. */
export function visibleVersions(key: LegalDocKey, v2Active: boolean): readonly LegalVersion[] {
  return LEGAL_VERSIONS[key].filter((v) => v.version === '1' || v2Active);
}
