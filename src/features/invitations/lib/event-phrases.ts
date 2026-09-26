import type { EventType, Locale } from '../contracts/types';

/**
 * How each language says who invites whom to what — the words of the invitation messages (WhatsApp
 * templates, the host's own WhatsApp) per culture. Each language's sentence is built so the hosts'
 * names never need declining or a verb to agree with them (one host or two, a couple or a family).
 */

/**
 * The event with its preposition — the WhatsApp template's {{3}}: "…מזמינים אותך לחתונה",
 * "…invite you to the wedding", "Вас приглашают на свадьбу", "…دعوتكم لحضور حفل الزفاف"…
 */
export const EVENT_PHRASE: Record<Locale, Record<EventType, string>> = {
  he: {
    wedding: 'לחתונה',
    engagement: 'למסיבת האירוסין',
    henna: 'לחינה',
    bar_mitzvah: 'לבר המצווה',
    bat_mitzvah: 'לבת המצווה',
    brit: 'לברית',
    baby_shower: 'לבייבי שאוור',
    birthday: 'ליום ההולדת',
    save_the_date: 'לשמור את התאריך',
    corporate: 'לאירוע',
    other: 'לאירוע',
  },
  en: {
    wedding: 'to the wedding',
    engagement: 'to the engagement party',
    henna: 'to the henna',
    bar_mitzvah: 'to the bar mitzvah',
    bat_mitzvah: 'to the bat mitzvah',
    brit: 'to the brit',
    baby_shower: 'to the baby shower',
    birthday: 'to the birthday party',
    save_the_date: 'to save the date',
    corporate: 'to the event',
    other: 'to the event',
  },
  ru: {
    wedding: 'на свадьбу',
    engagement: 'на помолвку',
    henna: 'на праздник хины',
    bar_mitzvah: 'на бар-мицву',
    bat_mitzvah: 'на бат-мицву',
    brit: 'на брит-милу',
    baby_shower: 'на бэби-шауэр',
    birthday: 'на день рождения',
    save_the_date: 'запомнить дату',
    corporate: 'на мероприятие',
    other: 'на праздник',
  },
  ar: {
    wedding: 'لحضور حفل الزفاف',
    engagement: 'لحضور حفل الخطوبة',
    henna: 'لحضور ليلة الحنّاء',
    bar_mitzvah: 'لحضور حفل البار متسفا',
    bat_mitzvah: 'لحضور حفل البات متسفا',
    brit: 'لحضور حفل البريت ميلا',
    baby_shower: 'لحضور حفل استقبال المولود',
    birthday: 'لحضور حفل عيد الميلاد',
    save_the_date: 'لحفظ الموعد',
    corporate: 'لحضور المناسبة',
    other: 'لحضور المناسبة',
  },
  fr: {
    wedding: 'au mariage',
    engagement: 'aux fiançailles',
    henna: 'à la soirée du henné',
    bar_mitzvah: 'à la bar-mitsva',
    bat_mitzvah: 'à la bat-mitsva',
    brit: 'à la brit-mila',
    baby_shower: 'à la baby shower',
    birthday: 'à l’anniversaire',
    save_the_date: 'à réserver la date',
    corporate: 'à l’événement',
    other: 'à la fête',
  },
  es: {
    wedding: 'a la boda',
    engagement: 'a la fiesta de compromiso',
    henna: 'a la noche de henna',
    bar_mitzvah: 'al bar mitzvá',
    bat_mitzvah: 'al bat mitzvá',
    brit: 'al brit milá',
    baby_shower: 'al baby shower',
    birthday: 'a la fiesta de cumpleaños',
    save_the_date: 'para reservar la fecha',
    corporate: 'al evento',
    other: 'a la celebración',
  },
  am: {
    wedding: 'ለሠርጉ',
    engagement: 'ለቀለበት ሥነ ሥርዓቱ',
    henna: 'ለሄና ምሽቱ',
    bar_mitzvah: 'ለባር ሚጽቫው',
    bat_mitzvah: 'ለባት ሚጽቫው',
    brit: 'ለብሪት ሚላው',
    baby_shower: 'ለሕፃኑ አቀባበል',
    birthday: 'ለልደት በዓሉ',
    save_the_date: 'ቀኑን እንዲያስታውሱ',
    corporate: 'ለዝግጅቱ',
    other: 'ለዝግጅቱ',
  },
};

/**
 * The host's own WhatsApp message to a guest (their phone's WhatsApp, not the system's template):
 * {name} the guest · {hosts} · {event} (EVENT_PHRASE) · {date} · {url} the personal link.
 */
export const GUEST_MESSAGE: Record<Locale, string> = {
  he: 'שלום {name}!\n{hosts} מזמינים אותך {event} ב{date}.\nלפרטים ולאישור הגעה: {url}',
  en: 'Hi {name}!\n{hosts} invite you {event} on {date}.\nDetails and RSVP: {url}',
  ru: 'Здравствуйте, {name}!\nВас приглашают {event}: {hosts}.\n📅 {date}\nПодробности и подтверждение участия: {url}',
  ar: 'مرحبًا {name}!\nيسرّ {hosts} دعوتكم {event} يوم {date}.\nللتفاصيل ولتأكيد الحضور: {url}',
  fr: 'Bonjour {name} !\nVous êtes invités {event} : {hosts}.\n📅 {date}\nTous les détails et la réponse : {url}',
  es: '¡Hola, {name}!\nTienes una invitación {event} de {hosts}.\n📅 {date}\nDetalles y confirmación: {url}',
  am: 'ሰላም {name}!\n{hosts} {event} ጋብዘውዎታል።\n📅 {date}\nዝርዝሮችና የመገኘት ማረጋገጫ፦ {url}',
};
