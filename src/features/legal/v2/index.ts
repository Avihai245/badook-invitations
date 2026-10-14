import type { LegalContext, LegalDoc, LegalDocKey } from '../types';
import { accessibilityDoc } from './accessibility';
import { cookiesDoc } from './cookies';
import { galleryRulesDoc } from './galleryRules';
import { privacyDoc } from './privacy';
import { refundsDoc } from './refunds';
import { termsDoc } from './terms';

/** Version 2 of the six legal documents (registry.ts lists them beside version 1). */
export const V2_DOCS: Record<LegalDocKey, (c: LegalContext) => LegalDoc> = {
  terms: termsDoc,
  privacy: privacyDoc,
  cookies: cookiesDoc,
  accessibility: accessibilityDoc,
  refunds: refundsDoc,
  'gallery-rules': galleryRulesDoc,
};
