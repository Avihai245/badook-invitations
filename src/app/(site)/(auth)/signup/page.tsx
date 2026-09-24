import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { googleSignInEnabled } from '@/lib/supabase/providers';
import { SignupForm } from '../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.signupTitle };
}

export default async function SignupPage() {
  return <SignupForm google={await googleSignInEnabled()} />;
}
