import type { Locale } from '@/features/invitations/contracts/types';
import { reviewText } from '../text';

export type ReviewGoneState = 'expired' | 'revoked' | 'unavailable' | 'rate';

/** A review link with nothing to show: expired, revoked, replaced or unknown, or too many requests. */
export function ReviewGone({ state, locale }: { state: ReviewGoneState; locale: Locale }) {
  const g = reviewText(locale).gone[state];
  return (
    <div className="rv-ui">
      <main className="rv-gone" data-testid="review-gone" data-state={state}>
        <div>
          <h1>{g.title}</h1>
          <p>{g.body}</p>
        </div>
      </main>
    </div>
  );
}
