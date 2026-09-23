import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
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
  const sp = await searchParams;
  const initialError: AuthErrorKey | undefined = sp.error === 'link_invalid' ? 'link_invalid' : undefined;
  return <LoginForm next={safeNext(sp.next)} initialError={initialError} />;
}
