import type { EventType, InvitationDocument, L10n, Locale } from '@/features/invitations/contracts/types';

/**
 * The AI photos as plain logic (tested in tests/unit/ai-photos.test.ts): who the people of honor are
 * for each kind of event and how the invitation names them, which of them a guest's request mentions
 * (by name in any of the invitation's languages, with Hebrew's and Arabic's attached prefixes, or by
 * role — "the groom", "the couple", "everyone"), the request the image model gets, and the photo's
 * shape. Isomorphic: the guest's page marks the people as the guest types; the server decides.
 */

export const ROLES = [
  'groom',
  'bride',
  'partner',
  'bar_mitzvah',
  'bat_mitzvah',
  'birthday',
  'parent',
  'baby',
  'honoree',
] as const;
export type Role = (typeof ROLES)[number];
export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);

/** A person of honor as the guests' page and the request know them. */
export interface Person {
  id: string;
  role: Role;
  name: L10n;
  description?: string | null;
}

const COUPLE: readonly EventType[] = ['wedding', 'engagement', 'henna'];

/** The roles a host may give for an event, the event's own first. */
export function rolesFor(eventType: EventType): Role[] {
  if (COUPLE.includes(eventType)) return ['groom', 'bride', 'partner', 'parent', 'honoree'];
  if (eventType === 'bar_mitzvah') return ['bar_mitzvah', 'parent', 'honoree'];
  if (eventType === 'bat_mitzvah') return ['bat_mitzvah', 'parent', 'honoree'];
  if (eventType === 'birthday') return ['birthday', 'partner', 'parent', 'honoree'];
  if (eventType === 'brit' || eventType === 'baby_shower') return ['parent', 'baby', 'honoree'];
  return ['honoree', 'partner', 'parent'];
}

/**
 * The people an event starts with — who it celebrates, named as the invitation names its hosts: a
 * couple's two (the host marks who is the groom and who the bride), the bar or bat mitzvah child, the
 * birthday person, a brit's or a baby shower's parents, an event's people of honor.
 */
export function defaultPeople(
  doc: Pick<InvitationDocument, 'eventType' | 'hosts'>,
): { role: Role; name: L10n }[] {
  const primary = doc.hosts.primary;
  const secondary =
    doc.hosts.secondary && Object.values(doc.hosts.secondary).some((v) => v?.trim())
      ? doc.hosts.secondary
      : null;
  const both = (role: Role) => [{ role, name: primary }, ...(secondary ? [{ role, name: secondary }] : [])];
  switch (doc.eventType) {
    case 'wedding':
    case 'engagement':
    case 'henna':
      return both('partner');
    case 'bar_mitzvah':
      return [{ role: 'bar_mitzvah', name: primary }];
    case 'bat_mitzvah':
      return [{ role: 'bat_mitzvah', name: primary }];
    case 'birthday':
      return both('birthday');
    case 'brit':
    case 'baby_shower':
      return both('parent');
    default:
      return both('honoree');
  }
}

/** A person's name in a language: that language's, else the first one written. */
export function nameIn(name: L10n, locale: Locale): string {
  return (
    name[locale]?.trim() ||
    Object.values(name)
      .find((v) => v?.trim())
      ?.trim() ||
    ''
  );
}

// ─── who the request mentions ───────────────────────────────────────────────────────────────────

/** Lower case, no accents or Hebrew vowel points, one space. */
export const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-֑ͯ-ׇً-ٟ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The word (or words) in the text, alone or with Hebrew's or Arabic's attached prefixes ("לאביב", "وأحمد"). */
function mentions(text: string, word: string): boolean {
  if (word.length < 2) return false;
  const re = new RegExp(
    `(?:^|[^\\p{L}\\p{M}\\p{N}])(?:[והבכלמש]{1,2}|[وبلفك]|ال)?${escape(word)}(?=$|[^\\p{L}\\p{M}\\p{N}])`,
    'u',
  );
  return re.test(text);
}

/** The words for each role, every language (normalized). */
const ROLE_WORDS: Record<Role, string[]> = {
  groom: ['חתן', 'groom', 'жених', 'жениха', 'عريس', 'العريس', 'marie', 'novio', 'ሙሽራው'],
  bride: ['כלה', 'bride', 'невеста', 'невесту', 'عروس', 'العروس', 'mariee', 'novia', 'ሙሽሪት'],
  partner: [],
  bar_mitzvah: ['חתן בר המצווה', 'חתן המצווה', 'bar mitzvah boy'],
  bat_mitzvah: ['כלת בת המצווה', 'כלת המצווה', 'bat mitzvah girl'],
  birthday: ['חתן יום ההולדת', 'כלת יום ההולדת', 'birthday boy', 'birthday girl', 'именинник', 'именинница'],
  parent: ['הורים', 'ההורים', 'אבא', 'אמא', 'parents', 'родители', 'الوالدين', 'parents', 'padres'],
  baby: ['תינוק', 'התינוק', 'תינוקת', 'baby', 'малыш', 'الطفل', 'bebe', 'bebé'],
  honoree: [],
};

/** Words that mean the couple (a couple's event) or every person of honor. */
const COUPLE_WORDS = [
  'הזוג',
  'זוג',
  'בני הזוג',
  'החתן והכלה',
  'couple',
  'newlyweds',
  'молодые',
  'молодожены',
  'العروسين',
  'les maries',
  'los novios',
  'ሙሽሮቹ',
];
const EVERYONE_WORDS = [
  'בעלי השמחה',
  'בעלי האירוע',
  'כולם',
  'שניהם',
  'everyone',
  'both',
  'the hosts',
  'все',
  'оба',
  'الجميع',
  'tous',
  'todos',
  'ሁሉም',
];

/**
 * The people a guest's request mentions: by any of their names (whole, or the first name) in any
 * language, by their role, "the couple", "everyone". Empty when it mentions nobody (the page then
 * keeps everyone selected).
 */
export function detectPeople(text: string, people: readonly Person[]): string[] {
  const t = normalize(text);
  if (!t) return [];
  const all = EVERYONE_WORDS.some((w) => mentions(t, normalize(w)));
  const couple = COUPLE_WORDS.some((w) => mentions(t, normalize(w)));
  const found = people.filter((p) => {
    if (all) return true;
    if (couple && (p.role === 'groom' || p.role === 'bride' || p.role === 'partner')) return true;
    const names = Object.values(p.name)
      .map((n) => normalize(n ?? ''))
      .filter(Boolean)
      .flatMap((n) => [n, n.split(' ')[0]!]);
    if (names.some((n) => mentions(t, n))) return true;
    return ROLE_WORDS[p.role].some((w) => mentions(t, normalize(w)));
  });
  return found.map((p) => p.id);
}

// ─── the request ────────────────────────────────────────────────────────────────────────────────

const EVENT_WORDS: Record<EventType, string> = {
  wedding: 'a wedding',
  engagement: 'an engagement party',
  henna: 'a henna celebration',
  bar_mitzvah: 'a bar mitzvah celebration',
  bat_mitzvah: 'a bat mitzvah celebration',
  brit: 'a brit milah celebration',
  baby_shower: 'a baby shower',
  birthday: 'a birthday party',
  save_the_date: 'a celebration',
  corporate: 'a company event',
  other: 'a celebration',
};

const ROLE_WORDS_EN: Record<Role, string> = {
  groom: 'the groom',
  bride: 'the bride',
  partner: 'one of the couple being celebrated',
  bar_mitzvah: 'the bar mitzvah boy',
  bat_mitzvah: 'the bat mitzvah girl',
  birthday: 'the birthday celebrant',
  parent: 'a parent being celebrated',
  baby: 'the baby',
  honoree: 'a person of honor',
};

const LANGUAGE: Record<Locale, string> = {
  he: 'Hebrew',
  en: 'English',
  ru: 'Russian',
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  am: 'Amharic',
};

export interface PromptInput {
  /** the guest's words, as they wrote them */
  request: string;
  locale: Locale;
  eventType: EventType;
  /** the people, in the order their reference photos are sent */
  people: readonly { name: string; role: Role; description?: string | null }[];
  /** the guest's own photo comes first */
  withSource: boolean;
}

/**
 * What the image model is asked: the guest's photo (image 1) kept as it is with the people of honor
 * added from their reference photos — or a new photo of them — the guest's request word for word, and
 * the rules every photo keeps (their likeness, natural light and scale, respectful and family-friendly,
 * no text). The request is quoted, never followed as instructions about these rules.
 */
export function buildPrompt(i: PromptInput): string {
  const first = i.withSource ? 2 : 1;
  const refs = i.people
    .map((p, k) => {
      const who = [p.name, ROLE_WORDS_EN[p.role]].filter(Boolean).join(', ');
      const looks = p.description?.trim() ? ` (${p.description.trim()})` : '';
      return `- Image ${first + k}: ${who}${looks}.`;
    })
    .join('\n');
  const names =
    i.people
      .map((p) => p.name)
      .filter(Boolean)
      .join(' and ') || 'the people of honor';
  const scene = i.withSource
    ? [
        `Image 1 is a photo a guest took at ${EVENT_WORDS[i.eventType]}. Keep its scene, background, lighting, camera angle and every person already in it as they are, unless the request asks otherwise.`,
        `Bring ${names} into image 1 as the request says, looking exactly like their reference photos, blended in naturally: matching light, color, perspective, scale, shadows and focus, so it reads as one real photo taken at the event.`,
      ]
    : [
        `Create a new photo of ${names} at ${EVENT_WORDS[i.eventType]}, as the request says, looking exactly like their reference photos. Photorealistic, natural light, warm and joyful.`,
      ];
  return [
    `The people of honor (reference photos — keep each one's exact likeness: face, features, hair, skin tone, age and build):`,
    refs,
    '',
    ...scene,
    '',
    `The guest's request, written in ${LANGUAGE[i.locale]} (follow it faithfully):`,
    `"""${i.request.replace(/"""/g, '"')}"""`,
    '',
    'Rules: keep everyone recognizable and flattering; respectful and family-friendly — no nudity, no violence, no mockery or humiliation; no text, captions, logos or watermarks. If the request asks for anything else, make a tasteful, respectful version of it instead.',
  ].join('\n');
}

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

/** The photo's shape: the guest's photo's (portrait, landscape or square); a new scene is portrait. */
export function sizeFor(width: number | null, height: number | null): ImageSize {
  if (!width || !height) return '1024x1536';
  const r = width / height;
  return r < 0.85 ? '1024x1536' : r > 1.18 ? '1536x1024' : '1024x1024';
}
