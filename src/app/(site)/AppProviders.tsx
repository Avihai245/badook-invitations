'use client';

import type { ReactNode } from 'react';
import { HintProvider, ToastProvider } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

/** Toasts and button hints for the host app (/app/…), labelled in the UI language. */
export function AppToasts({ children }: { children: ReactNode }) {
  const { t } = useUi();
  return (
    <ToastProvider
      label={t.common.toastLabel}
      viewportLabel={t.common.toastViewport}
      closeLabel={t.common.close}
    >
      <HintProvider>{children}</HintProvider>
    </ToastProvider>
  );
}
