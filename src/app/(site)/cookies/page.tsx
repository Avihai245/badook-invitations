import type { Metadata } from 'next';
import { legalContext } from '@/features/legal/context';
import { LegalPage, legalMetadata } from '@/features/legal/LegalPage';
import { cookiesDoc } from '@/features/legal/cookies';
import { getUi } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getUi();
  return legalMetadata(cookiesDoc(legalContext(locale)), t.brand);
}

/** /cookies — the cookie policy. */
export default async function CookiesPage() {
  const { locale, t } = await getUi();
  const context = legalContext(locale);
  return <LegalPage t={t} doc={cookiesDoc(context)} context={context} />;
}
