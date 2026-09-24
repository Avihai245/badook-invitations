import type { Metadata } from 'next';
import { legalContext } from '@/features/legal/context';
import { LegalPage, legalMetadata } from '@/features/legal/LegalPage';
import { termsDoc } from '@/features/legal/terms';
import { getUi } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getUi();
  return legalMetadata(termsDoc(legalContext(locale)), t.brand);
}

/** /terms — the terms of use. */
export default async function TermsPage() {
  const { locale, t } = await getUi();
  const context = legalContext(locale);
  return <LegalPage t={t} doc={termsDoc(context)} context={context} />;
}
