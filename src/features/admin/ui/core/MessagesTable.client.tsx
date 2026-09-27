'use client';

import type { MessageKind, StatusCounts } from '../../server/core-db';
import { useAdminUi } from '../AdminUi.client';
import { ScrollArea } from './ScrollArea.client';

const KINDS: readonly MessageKind[] = ['invitation', 'table', 'gallery'];
const STATUSES: readonly (keyof StatusCounts)[] = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
];

/** Whether there is anything to show (any WhatsApp message of any kind, in any state). */
export function anyMessages(counts: Record<MessageKind, StatusCounts>): boolean {
  return KINDS.some((kind) => STATUSES.some((s) => counts[kind][s] > 0));
}

/**
 * The WhatsApp messages of a user or an invitation: a row per kind (invitation, table, gallery), a
 * column per state, in its own scroll box on a phone.
 */
export function MessagesTable({
  counts,
  caption,
  className,
}: {
  counts: Record<MessageKind, StatusCounts>;
  caption: string;
  className?: string;
}) {
  const { t, number } = useAdminUi();
  const P = t.invitations.page;
  return (
    <ScrollArea label={caption} className={className}>
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-line bg-canvas px-3 py-2.5 text-start font-semibold text-muted"
            >
              {P.kind}
            </th>
            {STATUSES.map((s) => (
              <th
                key={s}
                scope="col"
                className="border-b border-line bg-canvas px-3 py-2.5 text-center font-semibold whitespace-nowrap text-muted"
              >
                {P.statuses[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KINDS.map((kind) => (
            <tr key={kind}>
              <th
                scope="row"
                className="border-b border-line px-3 py-2.5 text-start font-medium whitespace-nowrap"
              >
                {P.kinds[kind]}
              </th>
              {STATUSES.map((s) => (
                <td key={s} className="border-b border-line px-3 py-2.5 text-center tabular-nums">
                  {number(counts[kind][s])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
