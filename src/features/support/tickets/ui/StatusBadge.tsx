'use client';

import { Badge, type BadgeVariant } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { TicketStatus } from '../config';

const VARIANT: Record<TicketStatus, BadgeVariant> = { open: 'info', waiting: 'live', closed: 'neutral' };

/** A ticket's status in the customer's words: waiting for the team · answered · closed. */
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useUi();
  return (
    <Badge variant={VARIANT[status]} data-status={status}>
      {t.tickets.status[status]}
    </Badge>
  );
}
