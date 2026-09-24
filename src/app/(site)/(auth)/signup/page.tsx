import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { signupNext } from '@/lib/supabase/auth-paths';
import { googleSignInEnabled } from '@/lib/supabase/providers';
import { SignupForm } from '../AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.signupTitle };
}

/**
 * /signup — ?next= comes back after signing up (also with Google, and through the confirmation
 * email); ?plan=pro|business (the home page's pricing) goes on to paying for that plan.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string }>;
}) {
  const [sp, google] = await Promise.all([searchParams, googleSignInEnabled()]);
  return <SignupForm next={signupNext(sp)} google={google} />;
}
