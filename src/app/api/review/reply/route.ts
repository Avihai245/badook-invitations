import { after } from 'next/server';
import { reviewGuestDeps } from '@/features/review/server/deps';
import { addReply } from '@/features/review/server/guest-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/review/reply — a family member answers a comment (the review link). */
export async function POST(request: Request) {
  return publicJsonRoute(
    request,
    (body, ip) =>
      addReply(
        body,
        ip,
        reviewGuestDeps((job) => after(job)),
      ),
    {
      label: 'review api',
    },
  );
}
