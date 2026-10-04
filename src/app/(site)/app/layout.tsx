import { after } from 'next/server';
import type { ReactNode } from 'react';
import { tick } from '@/features/jobs/jobs';
import { assertInvitationsEnabled } from '@/lib/feature';
import { UiProvider } from '@/lib/i18n/provider-lazy';
import { getUiLocale } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';
import { SupportChat } from '@/features/support/SupportChat.client';
import { AppToasts } from '../AppProviders';

/**
 * Every /app page: feature flag, a verified session (the middleware already redirects signed-out
 * visitors — this is the server-side guarantee), toasts and the support assistant (signed-in hosts
 * only: the public pages don't have it). Once the page is sent, the app looks for its recurring jobs
 * that are due (features/jobs). The app's screens get the whole UI dictionary here (the root layout
 * gives the public pages only the site's part).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  assertInvitationsEnabled();
  const [, locale] = await Promise.all([requireUser('/app/invitations'), getUiLocale()]);
  after(() => tick());
  return (
    <UiProvider locale={locale}>
      <AppToasts>
        {children}
        <SupportChat />
      </AppToasts>
    </UiProvider>
  );
}
