import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { googleSignInEnabled } from '@/lib/supabase/providers';
import { safeNext } from '@/lib/supabase/session';
import { LoginForm } from '../AuthForms';
import type { AuthErrorKey } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.loginTitle };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [sp, google] = await Promise.all([searchParams, googleSignInEnabled()]);
  const initialError: AuthErrorKey | undefined =
    sp.error === 'link_invalid' || sp.error === 'oauth_failed' ? sp.error : undefined;
  return <LoginForm next={safeNext(sp.next)} initialError={initialError} google={google} />;
}
