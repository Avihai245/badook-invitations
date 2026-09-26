import { after } from 'next/server';
import { reviewGuestDeps } from '@/features/review/server/deps';
import { addComment } from '@/features/review/server/guest-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/review/comment — a family member pins a comment on the draft (the review link). */
export async function POST(request: Request) {
  return publicJsonRoute(
    request,
    (body, ip) =>
      addComment(
        body,
        ip,
        reviewGuestDeps((job) => after(job)),
      ),
    {
      label: 'review api',
    },
  );
}
