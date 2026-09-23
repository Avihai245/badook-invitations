import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { SignupForm } from '../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.signupTitle };
}

export default function SignupPage() {
  return <SignupForm />;
}
