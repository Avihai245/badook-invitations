import { after } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import '@/styles/app.css';
import { tick } from '@/features/jobs/jobs';
import { assertInvitationsEnabled } from '@/lib/feature';
import { ActingAsBar } from '@/features/admin/ui/ActingAsBar.client';
import { UiProvider } from '@/lib/i18n/provider-lazy';
import { getUiLocale } from '@/lib/i18n/server';
import { getActingAs, requireUser } from '@/lib/supabase/session';
import { SupportChat } from '@/features/support/SupportChat.client';
import { NavEffects } from '@/components/app/NavEffects.client';
import { AppToasts } from '../AppProviders';

/**
 * Every /app page: feature flag, a verified session (the middleware already redirects signed-out
 * visitors — this is the server-side guarantee), toasts and the support assistant (signed-in hosts
 * only: the public pages don't have it). Once the page is sent, the app looks for its recurring jobs
 * that are due (features/jobs). The app's screens get the whole UI dictionary here (the root layout
 * gives the public pages only the site's part). Every move between screens starts at the top and shows
 * a bar while the next screen loads (NavEffects).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  assertInvitationsEnabled();
  const [, locale] = await Promise.all([requireUser('/app/invitations'), getUiLocale()]);
  const acting = await getActingAs();
  after(() => tick());
  return (
    <UiProvider locale={locale}>
      <AppToasts>
        {acting ? <ActingAsBar who={acting.target.email ?? acting.target.id} /> : null}
        {children}
        <SupportChat />
        <Suspense>
          <NavEffects />
        </Suspense>
      </AppToasts>
    </UiProvider>
  );
}
