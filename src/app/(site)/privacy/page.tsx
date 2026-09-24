import type { Metadata } from 'next';
import { legalContext } from '@/features/legal/context';
import { LegalPage, legalMetadata } from '@/features/legal/LegalPage';
import { privacyDoc } from '@/features/legal/privacy';
import { getUi } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getUi();
  return legalMetadata(privacyDoc(legalContext(locale)), t.brand);
}

/** /privacy — the privacy policy. */
export default async function PrivacyPage() {
  const { locale, t } = await getUi();
  const context = legalContext(locale);
  return <LegalPage t={t} doc={privacyDoc(context)} context={context} />;
}
