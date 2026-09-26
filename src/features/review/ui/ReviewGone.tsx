import { reviewGuestEn } from '@/lib/i18n/review-guest.en';
import { reviewGuestHe } from '@/lib/i18n/review-guest.he';

export type ReviewGoneState = 'expired' | 'revoked' | 'unavailable' | 'rate';

/** A review link with nothing to show: expired, revoked, replaced or unknown, or too many requests. */
export function ReviewGone({ state, locale }: { state: ReviewGoneState; locale: 'he' | 'en' }) {
  const g = (locale === 'en' ? reviewGuestEn : reviewGuestHe).gone[state];
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
