import type { EventType, InvitationDocument, Locale } from '@/features/invitations/contracts/types';

/**
 * How each language says where the guests celebrated with the hosts — the album's thank-you: "תודה
 * שחגגתם איתנו בחתונה שלנו", "Thank you for celebrating with us at our wedding"… — the album template's
 * {{2}} (docs/whatsapp-setup.md §10), the host's own message and the album page's thank-you. A
 * couple's events say "our"; an event for one person names them where the language can without
 * declining the name ("בבר המצווה של יונתן", "at Jonathan’s bar mitzvah"); the rest say the event.
 */
export const ALBUM_EVENT_PHRASE: Record<Locale, Record<EventType, string>> = {
  he: {
    wedding: 'בחתונה שלנו',
    engagement: 'באירוסין שלנו',
    henna: 'בחינה שלנו',
    bar_mitzvah: 'בבר המצווה',
    bat_mitzvah: 'בבת המצווה',
    brit: 'בשמחת הברית',
    baby_shower: 'בבייבי שאוור',
    birthday: 'ביום ההולדת',
    save_the_date: 'באירוע',
    corporate: 'באירוע',
    other: 'באירוע',
  },
  en: {
    wedding: 'at our wedding',
    engagement: 'at our engagement party',
    henna: 'at our henna night',
    bar_mitzvah: 'at the bar mitzvah',
    bat_mitzvah: 'at the bat mitzvah',
    brit: 'at the brit',
    baby_shower: 'at the baby shower',
    birthday: 'at the birthday party',
    save_the_date: 'at the event',
    corporate: 'at the event',
    other: 'at the celebration',
  },
  ru: {
    wedding: 'на нашей свадьбе',
    engagement: 'на нашей помолвке',
    henna: 'на нашем вечере хины',
    bar_mitzvah: 'на бар-мицве',
    bat_mitzvah: 'на бат-мицве',
    brit: 'на брит-миле',
    baby_shower: 'на бэби-шауэре',
    birthday: 'на дне рождения',
    save_the_date: 'на празднике',
    corporate: 'на мероприятии',
    other: 'на празднике',
  },
  ar: {
    wedding: 'في حفل زفافنا',
    engagement: 'في حفل خطوبتنا',
    henna: 'في ليلة الحنّاء',
    bar_mitzvah: 'في حفل البار متسفا',
    bat_mitzvah: 'في حفل البات متسفا',
    brit: 'في حفل البريت ميلا',
    baby_shower: 'في حفل استقبال المولود',
    birthday: 'في حفل عيد الميلاد',
    save_the_date: 'في المناسبة',
    corporate: 'في المناسبة',
    other: 'في المناسبة',
  },
  fr: {
    wedding: 'à notre mariage',
    engagement: 'à nos fiançailles',
    henna: 'à notre soirée du henné',
    bar_mitzvah: 'à la bar-mitsva',
    bat_mitzvah: 'à la bat-mitsva',
    brit: 'à la brit-mila',
    baby_shower: 'à la baby shower',
    birthday: 'à l’anniversaire',
    save_the_date: 'à la fête',
    corporate: 'à l’événement',
    other: 'à la fête',
  },
  es: {
    wedding: 'en nuestra boda',
    engagement: 'en nuestra fiesta de compromiso',
    henna: 'en nuestra noche de henna',
    bar_mitzvah: 'en el bar mitzvá',
    bat_mitzvah: 'en el bat mitzvá',
    brit: 'en el brit milá',
    baby_shower: 'en el baby shower',
    birthday: 'en la fiesta de cumpleaños',
    save_the_date: 'en la celebración',
    corporate: 'en el evento',
    other: 'en la celebración',
  },
  am: {
    wedding: 'በሠርጋችን ላይ',
    engagement: 'በቀለበት ሥነ ሥርዓታችን ላይ',
    henna: 'በሄና ምሽታችን ላይ',
    bar_mitzvah: 'በባር ሚጽቫው ላይ',
    bat_mitzvah: 'በባት ሚጽቫው ላይ',
    brit: 'በብሪት ሚላው ላይ',
    baby_shower: 'በሕፃኑ አቀባበል ላይ',
    birthday: 'በልደት በዓሉ ላይ',
    save_the_date: 'በዝግጅቱ ላይ',
    corporate: 'በዝግጅቱ ላይ',
    other: 'በዝግጅቱ ላይ',
  },
};

/**
 * The same with the one person the event is for, where the language names them without declining
 * the name ({name}: the invitation's first host in that language).
 */
const NAMED: Partial<Record<Locale, Partial<Record<EventType, string>>>> = {
  he: {
    bar_mitzvah: 'בבר המצווה של {name}',
    bat_mitzvah: 'בבת המצווה של {name}',
    birthday: 'ביום ההולדת של {name}',
  },
  en: {
    bar_mitzvah: 'at {name}’s bar mitzvah',
    bat_mitzvah: 'at {name}’s bat mitzvah',
    birthday: 'at {name}’s birthday party',
  },
  es: {
    bar_mitzvah: 'en el bar mitzvá de {name}',
    bat_mitzvah: 'en el bat mitzvá de {name}',
    birthday: 'en el cumpleaños de {name}',
  },
};

/**
 * The phrase for an invitation in one language: named when the event is one person's and the
 * invitation names just one host (two hosts are a couple, or the parents: the event's word then).
 */
export function albumEventPhrase(
  doc: Pick<InvitationDocument, 'eventType' | 'hosts'>,
  locale: Locale,
): string {
  const named = NAMED[locale]?.[doc.eventType];
  const name = doc.hosts.primary[locale]?.trim();
  if (named && name && !doc.hosts.secondary?.[locale]?.trim()) return named.replace('{name}', name);
  return ALBUM_EVENT_PHRASE[locale][doc.eventType];
}
