'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/** Toasts for the host app (/app/…), labelled in the UI language. */
export function AppToasts({ children }: { children: ReactNode }) {
  const { t } = useUi();
  return (
    <ToastProvider
      label={t.common.toastLabel}
      viewportLabel={t.common.toastViewport}
      closeLabel={t.common.close}
    >
      {children}
    </ToastProvider>
  );
}
