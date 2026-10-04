'use client';

import { useUi } from '@/lib/i18n/client';
import { cn } from '@/components/app';
import { shekels } from '../model/budget';

/** An amount in ₪ with its thousands separator, always left-to-right (a number inside Hebrew text). */
export function Money({ value, className }: { value: number; className?: string }) {
  const { locale } = useUi();
  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {shekels(value, locale)}
    </bdi>
  );
}
