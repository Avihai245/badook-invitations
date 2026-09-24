import type { ReactNode } from 'react';
import { assertInvitationsEnabled } from '@/lib/feature';
import { requireUser } from '@/lib/supabase/session';
import { SupportChat } from '@/features/support/SupportChat.client';
import { AppToasts } from '../AppProviders';

/**
 * Every /app page: feature flag, a verified session (the middleware already redirects signed-out
 * visitors — this is the server-side guarantee), toasts and the support assistant (signed-in hosts
 * only: the public pages don't have it).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  assertInvitationsEnabled();
  await requireUser('/app/invitations');
  return (
    <AppToasts>
      {children}
      <SupportChat />
    </AppToasts>
  );
}
