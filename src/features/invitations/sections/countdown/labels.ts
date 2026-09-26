import type { Locale } from '../../contracts/types';
import { dictEntries } from '../../i18n/dictionary';
import { INTL_LOCALE } from '../../lib/dates';
import type { CountdownLabels } from './Countdown.client';

/** What <Countdown> needs to name its units in `locale`: the plural forms and the Intl locale. */
export function countdownProps(locale: Locale): { intl: string; labels: CountdownLabels } {
  const e = dictEntries(locale, ['countdown.days', 'countdown.hours', 'countdown.minutes', 'countdown.seconds']);
  return {
    intl: INTL_LOCALE[locale],
    labels: {
      days: e['countdown.days'],
      hours: e['countdown.hours'],
      minutes: e['countdown.minutes'],
      seconds: e['countdown.seconds'],
    },
  };
}
