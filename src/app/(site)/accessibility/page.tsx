import type { Metadata } from 'next';
import { legalContext } from '@/features/legal/context';
import { LegalPage, legalMetadata } from '@/features/legal/LegalPage';
import { accessibilityDoc } from '@/features/legal/accessibility';
import { getUi } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getUi();
  return legalMetadata(accessibilityDoc(legalContext(locale)), t.brand);
}

/** /accessibility — the accessibility statement. */
export default async function AccessibilityPage() {
  const { locale, t } = await getUi();
  const context = legalContext(locale);
  return <LegalPage t={t} doc={accessibilityDoc(context)} context={context} />;
}
