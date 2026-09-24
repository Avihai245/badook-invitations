import type { Metadata } from 'next';
import { getUi } from '@/lib/i18n/server';
import { googleSignInEnabled } from '@/lib/supabase/providers';
import { safeNext } from '@/lib/supabase/session';
import { LoginForm, type AuthNoticeKey } from '../AuthForms';
import type { AuthErrorKey } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getUi()).t.auth.loginTitle };
}

/** Messages other pages send here (?error=…): the callback's, Google's, a sign-in link's. */
const ERRORS: readonly AuthErrorKey[] = ['link_invalid', 'link_expired', 'oauth_failed', 'generic'];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string; deleted?: string }>;
}) {
  const [sp, google] = await Promise.all([searchParams, googleSignInEnabled()]);
  const initialError = ERRORS.find((e) => e === sp.error);
  // ?deleted=…: the account screen, after deleting the account (charge: its monthly charge is left
  // for support to stop)
  const notice: AuthNoticeKey | undefined =
    sp.deleted === 'charge'
      ? 'deleted_charge'
      : sp.deleted
        ? 'deleted'
        : sp.notice === 'email_confirmed'
          ? 'email_confirmed'
          : undefined;
  return <LoginForm next={safeNext(sp.next)} initialError={initialError} notice={notice} google={google} />;
}
