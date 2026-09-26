import type { Locale } from '@/features/invitations/contracts/types';

/**
 * The message a host sends from their own WhatsApp to tell a family its table (wa.me, "send from my
 * WhatsApp" — when the system's number can't, or for a family the host tells themselves), in the
 * guest's language: {name}, {hosts}, {table} (`table` with the number), {url} (their guide). It says
 * what the table number's Meta template says in that language (docs/whatsapp-setup.md §8).
 */
export const TABLE_MESSAGE: Record<Locale, { message: string; table: string }> = {
  he: {
    message: 'שלום {name}!\nהשולחן שלכם באירוע של {hosts}: {table}.\nהמפה לשולחן והדרך מהכניסה: {url}',
    table: 'שולחן {number}',
  },
  en: {
    message:
      'Hi {name}!\nYour table at {hosts}’s event: {table}.\nThe map to your table and the way from the entrance: {url}',
    table: 'table {number}',
  },
  ru: {
    message:
      'Здравствуйте, {name}!\nВас ждут на празднике: {hosts}.\nВаше место: {table}.\nКарта и путь от входа к вашему столу: {url}',
    table: 'стол {number}',
  },
  ar: {
    message: 'مرحبًا {name}!\nطاولتكم في حفل {hosts}: {table}.\nالخريطة والطريق من المدخل إلى طاولتكم: {url}',
    table: 'الطاولة {number}',
  },
  fr: {
    message:
      'Bonjour {name} !\nOn vous attend à la fête : {hosts}.\nVotre place : {table}.\nLe plan et le chemin depuis l’entrée : {url}',
    table: 'table {number}',
  },
  es: {
    message:
      '¡Hola, {name}!\nTu mesa en la celebración de {hosts}: {table}.\nEl plano y el camino desde la entrada: {url}',
    table: 'mesa {number}',
  },
  am: {
    message: 'ሰላም {name}!\nበ{hosts} በዓል ላይ ጠረጴዛዎ፦ {table}።\nካርታውና ከመግቢያው ወደ ጠረጴዛዎ ያለው መንገድ፦ {url}',
    table: 'ጠረጴዛ {number}',
  },
};

/**
 * A name inside a sentence of another script, kept whole (Unicode isolates, FSI…PDI): an Arabic name
 * in Hebrew text, a Hebrew one in English, never reordered with the numbers and signs around it.
 */
export const isolate = (text: string) => (text ? `⁨${text}⁩` : text);
