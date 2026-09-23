import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { ForgotPasswordForm } from '../../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.forgotTitle };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
