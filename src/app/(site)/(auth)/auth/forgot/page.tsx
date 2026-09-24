import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { ForgotPasswordForm } from '../../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.forgotTitle };
}

/** ?error=other_browser: a reset link opened in another browser than the one that asked for it. */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ForgotPasswordForm initialError={error === 'other_browser' ? 'other_browser' : undefined} />;
}
