import type { Locale } from '@/features/invitations/contracts/types';

/**
 * The thank-you a host sends a guest with the album — from their own WhatsApp (wa.me) or copied — in
 * the guest's language: {name} the guest · {event} (phrases.ts: "בחתונה שלנו") · {hosts} · {url} (the
 * album, opening in that language). It says what the album's Meta template says (docs/whatsapp-setup.md
 * §10, whatsapp/template-text.ts ALBUM_TEMPLATE_TEXT), with the link in the text.
 */
export const ALBUM_MESSAGE: Record<Locale, string> = {
  he: 'היי {name} 💛\nתודה שחגגתם איתנו {event}!\nאספנו את הרגעים היפים שצילמתם לאלבום אחד — מוזמנים להיכנס, להיזכר ולשתף:\n{url}\nבאהבה, {hosts}',
  en: 'Hi {name} 💛\nThank you for celebrating with us {event}!\nWe gathered the beautiful moments you captured into one album — come relive them and share:\n{url}\nWith love, {hosts}',
  ru: 'Здравствуйте, {name}! 💛\nСпасибо, что праздновали вместе с нами {event}!\nМы собрали красивые моменты, которые вы сняли, в один альбом — заходите вспомнить и поделиться:\n{url}\nС любовью, {hosts}',
  ar: 'مرحبًا {name} 💛\nشكرًا لأنكم احتفلتم معنا {event}!\nجمعنا اللحظات الجميلة التي التقطتموها في ألبوم واحد — ادخلوا لتستعيدوا الذكريات وتشاركوها:\n{url}\nمع الحب، {hosts}',
  fr: 'Bonjour {name} 💛\nMerci d’avoir fêté avec nous {event} !\nNous avons réuni les beaux moments que vous avez capturés dans un seul album — venez les revivre et les partager :\n{url}\nAvec amour, {hosts}',
  es: '¡Hola, {name}! 💛\n¡Gracias por celebrar con nosotros {event}!\nReunimos en un solo álbum los momentos bonitos que capturaste: entra a revivirlos y compartirlos:\n{url}\nCon cariño, {hosts}',
  am: 'ሰላም {name} 💛\nከእኛ ጋር {event} ስላከበሩ እናመሰግናለን!\nያነሷቸውን ውብ ጊዜያት በአንድ አልበም ሰብስበናል — ገብተው ያስታውሱ፤ ያጋሩም፦\n{url}\nበፍቅር፣ {hosts}',
};

/** The same thank-you for everyone at once (a family group, a status): no guest's name. */
export const ALBUM_SHARE_MESSAGE: Record<Locale, string> = {
  he: 'תודה שחגגתם איתנו {event}! 💛\nאספנו את הרגעים היפים שצילמתם לאלבום אחד — מוזמנים להיכנס, להיזכר ולשתף:\n{url}\nבאהבה, {hosts}',
  en: 'Thank you for celebrating with us {event}! 💛\nWe gathered the beautiful moments you captured into one album — come relive them and share:\n{url}\nWith love, {hosts}',
  ru: 'Спасибо, что праздновали вместе с нами {event}! 💛\nМы собрали красивые моменты, которые вы сняли, в один альбом — заходите вспомнить и поделиться:\n{url}\nС любовью, {hosts}',
  ar: 'شكرًا لأنكم احتفلتم معنا {event}! 💛\nجمعنا اللحظات الجميلة التي التقطتموها في ألبوم واحد — ادخلوا لتستعيدوا الذكريات وتشاركوها:\n{url}\nمع الحب، {hosts}',
  fr: 'Merci d’avoir fêté avec nous {event} ! 💛\nNous avons réuni les beaux moments que vous avez capturés dans un seul album — venez les revivre et les partager :\n{url}\nAvec amour, {hosts}',
  es: '¡Gracias por celebrar con nosotros {event}! 💛\nReunimos en un solo álbum los momentos bonitos que capturaron: entren a revivirlos y compartirlos:\n{url}\nCon cariño, {hosts}',
  am: 'ከእኛ ጋር {event} ስላከበሩ እናመሰግናለን! 💛\nያነሷቸውን ውብ ጊዜያት በአንድ አልበም ሰብስበናል — ገብተው ያስታውሱ፤ ያጋሩም፦\n{url}\nበፍቅር፣ {hosts}',
};

/** The album's link opening in a language: `&lang=` when it isn't the invitation's default. */
export function albumLinkIn(link: string, language: Locale, defaultLocale: Locale): string {
  return language === defaultLocale ? link : `${link}&lang=${language}`;
}
