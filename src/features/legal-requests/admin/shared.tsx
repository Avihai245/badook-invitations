'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useToast } from '@/components/app';
import type { AppDict } from '@/lib/i18n/app';
import type { Emailed } from '../server/admin-api';

export type AdminStrings = AppDict['legalRequests']['admin'];

export const legalHref = (q: { tab: string; show: string; id?: string | null }) =>
  `/app/admin/legal?tab=${q.tab}&show=${q.show}${q.id ? `&id=${q.id}` : ''}`;

/**
 * Calls one of the console's legal actions (JSON), then a toast — success (saying plainly whether the
 * outcome email went), or the reason in words — and the page refreshed. Signed out: to the sign-in page.
 */
export function useLegalAction(s: AdminStrings) {
  const { toast } = useToast();
  const router = useRouter();
  return useCallback(
    async (url: string, body: unknown): Promise<boolean> => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (res?.status === 401) {
        window.location.assign(
          `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
        return false;
      }
      const json = ((await res?.json().catch(() => null)) ?? {}) as { code?: string; emailed?: Emailed };
      if (res?.ok) {
        const mail = json.emailed;
        toast({
          title:
            mail === 'sent'
              ? s.actions.toasts.mailSent
              : mail === 'failed'
                ? s.actions.toasts.mailFailed
                : s.actions.toasts.done,
          variant: mail === 'failed' ? 'danger' : 'success',
          ...(mail === 'failed' ? { duration: Infinity } : {}),
        });
        router.refresh();
        return true;
      }
      const code = json.code ?? (res ? 'server_error' : 'network');
      const errors = s.errors as Record<string, string>;
      toast({ title: errors[code] ?? errors.conflict ?? '', variant: 'danger' });
      if (code === 'not_found') router.refresh();
      return false;
    },
    [router, s, toast],
  );
}
