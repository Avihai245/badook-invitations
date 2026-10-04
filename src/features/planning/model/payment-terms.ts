import type { UiLocale } from '@/lib/i18n/app';

/**
 * A vendor's payment terms are free text — "30% מקדמה, 70% ביום האירוע", "מקדמה 5,000 ₪ והיתרה ביום
 * האירוע", "שליש מקדמה, שליש חודש לפני, שליש ביום האירוע", "50/50", "deposit 20%, balance on the day",
 * "תשלום מלא בחתימה". This turns them into a proposed schedule the host reviews (and edits) when closing
 * the vendor: nothing here is saved. Pure, never throws, and the amounts are whole agorot that add up
 * to the total exactly.
 *
 * What it understands: shares as percentages, fractions (שליש, חצי, רבע, "a third"), absolute amounts
 * (thousands separators, ₪ / ש"ח), "the balance", "in full", "N equal payments", "a/b/c" splits that add up
 * to 100; and when: on signing / booking (today), on the event day, "N days / weeks / months before"
 * (never earlier than today), "N days after", "N days from signing", or a date. Percentages that do not
 * add up to 100 leave the remainder as a balance on the event day. Nothing understood: one balance on the
 * event day.
 */

export interface ProposedPayment {
  label: string;
  amount: number;
  /** YYYY-MM-DD; null when it depends on an event date that is not set */
  dueDate: string | null;
  /** paid at the event itself: listed on the event day */
  payOnEventDay: boolean;
}

/** The schedule a close can hold (the database takes up to 20 payments). */
export const MAX_PAYMENTS = 20;
const MAX_TEXT = 1000;

// ─── calendar days (YYYY-MM-DD), without throwing ────────────────────────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  if (y < 1000) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const fromUtc = (t: number): string | null => {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  return Number.isNaN(t) || y < 1000 || y > 9999 ? null : d.toISOString().slice(0, 10);
};

/** The date `n` days later (earlier when negative); the date itself when it would leave the calendar. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return fromUtc(Date.UTC(y, m - 1, d + Math.trunc(n))) ?? iso;
}

/** The same day `n` calendar months later (the last day of a shorter month: 31 Mar − 1 month = 28 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + Math.trunc(n), 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))) ?? iso;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

// ─── words ───────────────────────────────────────────────────────────────────────────────────────

const WORD_NUM: Record<string, number> = {
  אחד: 1,
  אחת: 1,
  שני: 2,
  שתי: 2,
  שניים: 2,
  שתיים: 2,
  שלושה: 3,
  שלוש: 3,
  ארבעה: 4,
  ארבע: 4,
  חמישה: 5,
  חמש: 5,
  שישה: 6,
  שש: 6,
  שבעה: 7,
  שבע: 7,
  שמונה: 8,
  תשעה: 9,
  תשע: 9,
  עשרה: 10,
  עשר: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  a: 1,
  an: 1,
};
const byLength = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|');
const NUM = `(\\d+(?:[.,]\\d+)?|${byLength(Object.keys(WORD_NUM))})`;
const UNIT = `(יומיים|שבועיים|חודשיים|ימים|יום|ימי|שבועות|שבוע|חודשים|חודש|days?|weeks?|months?)`;
const BEFORE = '(?:לפני|before|prior to|prior|ahead of)';
const START = '(?:^|[^\\p{L}\\d])';
const END = '(?![\\p{L}\\d])';
const re = (source: string) => new RegExp(source, 'u');
/** A word (or phrase) on its own: not inside a longer one. */
const word = (alternatives: string) => re(`${START}(?:${alternatives})${END}`);

const DEPOSIT = word(
  'מקדמה|מקדמת|דמי קדימה|דמי רצינות|דמי שריון|שריון|ערבון|פיקדון|תשלום ראשון|advance|deposit|down ?payment|retainer|booking fee|reservation fee|first payment',
);
const BALANCE = word(
  'ה?יתרה|ה?יתרת|ה?שארית|ה?שאר|ה?נותר|ה?נשאר|תשלום אחרון|תשלום סופי|balance|remainder|remaining|the rest|rest|final payment|last payment',
);
const FULL = word(
  'תשלום מלא|הסכום המלא|מלוא הסכום|במלואו|במלואה|את כל הסכום|full payment|full amount|paid in full|payment in full|in full|entire amount|whole amount',
);
const SIGNING = word(
  '(?:ב|עם |בעת |לאחר |אחרי )?(?:ה?חתימה|חתימת|ה?הזמנה|הזמנת|ה?סגירה|סגירת|ההצטרפות|אישור ההזמנה)|מיד|מיידי|מיידית|עכשיו|מראש|בהתחלה|בתחילה|signing|signature|signed|booking|reservation|confirmation|upfront|up front|immediately|right away|now|in advance|at the start|to secure|to reserve',
);
const EVENT_DAY = word(
  '(?:ב?יום|ב?ערב|ב?בוקר) ה?(?:אירוע|ארוע|חתונה|שמחה|בר מצווה|בת מצווה|ברית|חינה|אירוסין|מסיבה|חגיגה|עצמו)|ביום עצמו|היום עצמו|באירוע עצמו|באירוע|בתום האירוע|בסיום האירוע|בסוף האירוע|במועד האירוע|בתאריך האירוע|בחתונה|בהגעה|בהקמה|בשטח|on the day|on the event day|on event day|on the event|at the event|at the wedding|day of the event|day of event|day of the wedding|day-of|day of|event day|wedding day|on arrival|upon arrival|on delivery|on site|at the end of the event|on the night',
);
const AFTER_EVENT = word(
  '(?:אחרי|לאחר) ה?(?:אירוע|ארוע|חתונה|שמחה)|after the event|after the wedding|after event',
);

const CURRENCY = '(?:₪|ש"ח|שח|שקל(?:ים)?|nis|ils|shekels?)';
const PERCENT = re('(\\d+(?:[.,]\\d+)?)\\s*(?:%|אחוז(?:ים)?|percent|pct)');
const DATE_DMY = /(\d{1,2})[./](\d{1,2})[./](\d{4})/;
const DATE_ISO = /(\d{4})-(\d{2})-(\d{2})/;
const AMOUNT = new RegExp(`(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:[.,]\\d+)?)\\s*(${CURRENCY})?`, 'gu');
const INDEX_WORD = re('(?:תשלום|תשלומים|פעימה|פעימות|payment|installment|no\\.?|#)\\s*$');
const INSTALLMENTS = re(
  `${START}${NUM}\\s*(?:equal\\s+)?(?:תשלומים|פעימות|payments|installments)(?:\\s*(?:שווים|שוות|equal))?${END}`,
);

const FRACTIONS: [RegExp, number][] = [
  [word('שני שלישים|שני שליש|two[- ]thirds?'), 2 / 3],
  [word('שלושה רבעים|שלושת הרבעים|שלושת רבעי|three[- ]quarters?'), 3 / 4],
  [word('שליש|(?:a|one|1/3)[ -]third'), 1 / 3],
  [word('רבע|(?:a|one)[ -]quarter|quarter'), 1 / 4],
  [word('מחצית|חצי|half'), 1 / 2],
];
const NUMERIC_FRACTION = /(?:^|[^\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/;

// ─── clauses ─────────────────────────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .slice(0, MAX_TEXT)
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’`´]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/[ \t]+/g, ' ')
    .toLowerCase()
    .replace(/ +/g, ' ')
    .trim();
}

/** The clauses of the text: split at commas, semicolons, "and", "+", a Hebrew vav — never inside 5,000. */
function clausesOf(text: string): string[] {
  return text
    .replace(/(\d),(\d)/g, '$1\u0001$2')
    .split(/[;\n\r•·|,]+|\.\s+|\s\+\s|\s(?:and|then|&)\s|\s+ו-?(?=\d)|\s+ו(?=[א-ת])/u)
    .map((c) => c.replace(/\u0001/g, ',').trim())
    .filter(Boolean);
}

function toNumber(s: string): number {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  return Number(s.replace(',', '.'));
}
const numberOrWord = (s: string | undefined): number | null => {
  if (!s) return null;
  if (/^\d/.test(s)) return toNumber(s);
  return WORD_NUM[s] ?? null;
};

type Share = { kind: 'pct'; v: number } | { kind: 'amount'; v: number } | { kind: 'full' };
type When =
  | { kind: 'signing'; days: number }
  | { kind: 'event' }
  | { kind: 'before'; days: number; months: number }
  | { kind: 'after'; days: number }
  | { kind: 'date'; date: string }
  | { kind: 'spread'; frac: number };
type Role = 'deposit' | 'balance' | 'payment';
interface Part {
  share: Share | null;
  when: When | null;
  role: Role;
  /** the text's order */
  order: number;
}

function unitDays(unit: string, n: number | null): { days: number; months: number } | null {
  const u = unit.toLowerCase();
  const dual = /^(יומיים|שבועיים|חודשיים)$/.test(u);
  const plural = /^(ימים|ימי|שבועות|חודשים|days|weeks|months)$/.test(u);
  const count = n ?? (dual ? 2 : plural ? null : 1);
  if (count === null || !Number.isFinite(count) || count <= 0 || count > 400) return null;
  if (/^(יום|ימים|ימי|day|days)$/.test(u) || u === 'יומיים') return { days: count, months: 0 };
  if (/^(שבוע|שבועות|week|weeks)$/.test(u) || u === 'שבועיים')
    return { days: Math.round(count * 7), months: 0 };
  return { days: 0, months: Math.round(count) };
}

/** "N days / weeks / months" in front of or behind a word, taken out of the clause. */
function takeOffset(s: string, pattern: RegExp, groups: { n: number; unit: number }) {
  const m = pattern.exec(s);
  if (!m) return null;
  const span = unitDays(m[groups.unit]!, numberOrWord(m[groups.n]));
  const rest = s.replace(m[0], ' ');
  return span ? { span, rest } : { span: null, rest };
}

const OFFSET_SIGNING = re(
  `${START}(?:${NUM}\\s*)?${UNIT}\\s+(?:מהחתימה|מיום החתימה|מההזמנה|מהסגירה|מהאישור|אחרי החתימה|לאחר החתימה|from signing|after signing|from booking|after booking|from confirmation|after confirmation|from the signing|from signature)${END}`,
);
const OFFSET_AFTER = re(
  `${START}(?:${NUM}\\s*)?${UNIT}\\s+(?:אחרי|לאחר|after)\\s+(?:the\\s+)?ה?(?:אירוע|ארוע|חתונה|שמחה|event|wedding|party)${END}`,
);
const OFFSET_BEFORE_A = re(`${START}(?:${NUM}\\s*)?${UNIT}\\s+${BEFORE}${END}`);
const OFFSET_BEFORE_B = re(`${START}${BEFORE}\\s+(?:${NUM}\\s*)?${UNIT}${END}`);

/** One clause: how much, when, and what the host calls it. Null when it says none of those. */
function parseClause(raw: string, order: number): Part | null {
  let s = ` ${raw} `;
  let when: When | null = null;
  let share: Share | null = null;

  // when: a date, "N days after signing", "N days after the event", "N days / weeks / months before"
  const dmy = DATE_DMY.exec(s) ?? null;
  const iso = DATE_ISO.exec(s) ?? null;
  if (iso || dmy) {
    const found = iso ?? dmy!;
    const date = iso
      ? `${iso[1]}-${iso[2]}-${iso[3]}`
      : `${dmy![3]}-${dmy![2]!.padStart(2, '0')}-${dmy![1]!.padStart(2, '0')}`;
    if (isIsoDate(date)) when = { kind: 'date', date };
    s = s.replace(found[0], ' ');
  }
  const fromSigning = takeOffset(s, OFFSET_SIGNING, { n: 1, unit: 2 });
  if (fromSigning) {
    s = fromSigning.rest;
    if (fromSigning.span && !when)
      when = { kind: 'signing', days: fromSigning.span.days + fromSigning.span.months * 30 };
  }
  const after = takeOffset(s, OFFSET_AFTER, { n: 1, unit: 2 });
  if (after) {
    s = after.rest;
    if (after.span && !when) when = { kind: 'after', days: after.span.days + after.span.months * 30 };
  }
  for (const pattern of [OFFSET_BEFORE_A, OFFSET_BEFORE_B]) {
    const before = takeOffset(s, pattern, { n: 1, unit: 2 });
    if (!before) continue;
    s = before.rest;
    if (before.span && !when) when = { kind: 'before', ...before.span };
  }
  if (!when && AFTER_EVENT.test(s)) {
    // "after the event" with no number: a week after
    when = { kind: 'after', days: 7 };
    s = s.replace(AFTER_EVENT, ' ');
  }

  // how much: a percentage, a fraction, the whole, an amount
  const pct = PERCENT.exec(s);
  if (pct) {
    const v = toNumber(pct[1]!);
    if (Number.isFinite(v) && v > 0) share = { kind: 'pct', v: Math.min(v, 100) };
    s = s.replace(pct[0], ' ');
  }
  if (!share) {
    for (const [pattern, fraction] of FRACTIONS) {
      if (pattern.test(s)) {
        share = { kind: 'pct', v: fraction * 100 };
        s = s.replace(pattern, ' ');
        break;
      }
    }
  }
  if (!share) {
    const nf = NUMERIC_FRACTION.exec(s);
    if (nf && Number(nf[1]) > 0 && Number(nf[1]) < Number(nf[2])) {
      share = { kind: 'pct', v: (Number(nf[1]) / Number(nf[2])) * 100 };
      s = s.replace(nf[0], ' ');
    }
  }
  if (!share && FULL.test(s)) {
    share = { kind: 'full' };
    s = s.replace(FULL, ' ');
  }

  const role: Role = DEPOSIT.test(s) ? 'deposit' : BALANCE.test(s) ? 'balance' : 'payment';

  if (!share) {
    for (const m of s.matchAll(AMOUNT)) {
      const v = toNumber(m[1]!);
      const currency = !!m[2];
      // "payment 2", "12 payments": a number that counts, not one that pays
      const counts = !currency && v <= 24 && INDEX_WORD.test(s.slice(0, m.index));
      if (!Number.isFinite(v) || v <= 0 || v > 1_000_000_000 || counts) continue;
      if (currency || v > 100) share = { kind: 'amount', v };
      // a bare small number beside "deposit" or a date reads as a percentage
      else if (role !== 'payment' || when) share = { kind: 'pct', v };
      else continue;
      break;
    }
  }

  // when, from the words
  if (!when) {
    const at = (pattern: RegExp) => {
      const m = pattern.exec(s);
      return m ? m.index : -1;
    };
    const sign = at(SIGNING);
    const day = at(EVENT_DAY);
    if (sign >= 0 && (day < 0 || sign < day)) when = { kind: 'signing', days: 0 };
    else if (day >= 0) when = { kind: 'event' };
  }

  if (!share && !when && role === 'payment') return null;
  return { share, when, role, order };
}

// ─── the schedule ────────────────────────────────────────────────────────────────────────────────

const LABELS = {
  he: {
    deposit: 'מקדמה',
    balance: 'יתרה',
    full: 'תשלום מלא',
    payment: (n: number) => `תשלום ${n}`,
    single: 'תשלום',
  },
  en: {
    deposit: 'Deposit',
    balance: 'Balance',
    full: 'Full payment',
    payment: (n: number) => `Payment ${n}`,
    single: 'Payment',
  },
} as const;

interface Resolved {
  due: string | null;
  onDay: boolean;
  /** signing 0 · dated or before the event 1 · the event 2 · after 3 */
  rank: number;
  /** within the rank */
  key: number;
}

function resolve(when: When, today: string, event: string | null): Resolved {
  const daysLeft = event ? dayNumber(event) - dayNumber(today) : null;
  switch (when.kind) {
    case 'signing': {
      const due = addDays(today, when.days);
      return { due, onDay: false, rank: when.days > 0 ? 1 : 0, key: when.days };
    }
    case 'event':
      return { due: event, onDay: true, rank: 2, key: 0 };
    case 'before': {
      const nominal = event
        ? when.months
          ? addMonths(event, -when.months)
          : addDays(event, -when.days)
        : null;
      // a date that has already gone by is due now
      const due = nominal ? (nominal < today ? today : nominal) : null;
      return { due, onDay: false, rank: 1, key: -(when.days + when.months * 30) };
    }
    case 'after':
      return { due: event ? addDays(event, when.days) : null, onDay: false, rank: 3, key: when.days };
    case 'date':
      return {
        due: when.date,
        onDay: false,
        rank: event && when.date > event ? 3 : 1,
        key: dayNumber(when.date),
      };
    case 'spread': {
      const due =
        daysLeft !== null && daysLeft > 0
          ? addDays(today, Math.round(daysLeft * when.frac))
          : event
            ? today
            : null;
      return { due, onDay: false, rank: 1, key: when.frac * 10_000 };
    }
  }
}

/** n equal parts, the first on signing, the last on the event day, the others spread between. */
function equalParts(shares: number[]): Part[] {
  return shares.map((v, i) => ({
    share: { kind: 'pct', v },
    when:
      i === 0
        ? { kind: 'signing', days: 0 }
        : i === shares.length - 1
          ? { kind: 'event' }
          : { kind: 'spread', frac: i / (shares.length - 1) },
    role: 'payment',
    order: i,
  }));
}

interface Row {
  p: Part;
  r: Resolved;
  amount: number;
}

const byTime = (a: Row, b: Row) => {
  if (a.r.rank !== b.r.rank) return a.r.rank - b.r.rank;
  if (a.r.due && b.r.due && a.r.due !== b.r.due) return a.r.due < b.r.due ? -1 : 1;
  return a.r.key - b.r.key || a.p.order - b.p.order;
};

/** Amounts (whole agorot, adding up to the total exactly) and labels for the parts, in time order. */
function schedule(
  parts: Part[],
  totalCents: number,
  ctx: { today: string; event: string | null; lang: 'he' | 'en' },
): ProposedPayment[] | null {
  // a part with no timing of its own: a deposit is on signing, a balance on the day, the others in between
  const middle = parts.filter((p) => !p.when && p.role === 'payment');
  let between = 0;
  for (const p of parts) {
    if (p.when) continue;
    if (p.role === 'deposit') p.when = { kind: 'signing', days: 0 };
    else if (p.role === 'balance') p.when = { kind: 'event' };
    else if (parts.length === 1) p.when = { kind: 'event' };
    else if (p === parts[0]) p.when = { kind: 'signing', days: 0 };
    else if (p === parts[parts.length - 1]) p.when = { kind: 'event' };
    else p.when = { kind: 'spread', frac: ++between / (middle.length + 1) };
  }
  const rows: Row[] = parts
    .map((p) => ({ p, r: resolve(p.when!, ctx.today, ctx.event), amount: 0 }))
    .sort(byTime);

  // what the parts say; more than the whole is scaled down to it
  const said = rows.map((row) => {
    const s = row.p.share;
    if (!s) return null;
    return s.kind === 'amount' ? s.v * 100 : s.kind === 'full' ? totalCents : (totalCents * s.v) / 100;
  });
  const saidSum = said.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const scale = saidSum > totalCents ? totalCents / saidSum : 1;
  rows.forEach((row, i) => {
    if (said[i] !== null) row.amount = Math.round(said[i]! * scale);
  });
  const unsaid = rows.filter((row) => !row.p.share);
  const rest = totalCents - rows.reduce((sum, row) => sum + row.amount, 0);

  if (unsaid.length > 0) {
    // what is left is shared by the parts that did not say (the balance, usually the only one)
    if (rest > 0) {
      const each = Math.floor(rest / unsaid.length);
      unsaid.forEach((row, i) => (row.amount = i === unsaid.length - 1 ? rest - each * i : each));
    }
  } else if (rest !== 0) {
    // rounding ("33% × 3", a third of 10,000) goes to the last payment; a real remainder is a balance
    const relativeOnly = rows.every((row) => row.p.share!.kind !== 'amount');
    const rounding = scale < 1 || rest < 0 || (relativeOnly && rest <= totalCents * 0.0101);
    if (rounding) rows[rows.length - 1]!.amount += rest;
    else {
      const when: When = { kind: 'event' };
      rows.push({
        p: { share: null, when, role: 'balance', order: Number.MAX_SAFE_INTEGER },
        r: resolve(when, ctx.today, ctx.event),
        amount: rest,
      });
      rows.sort(byTime);
    }
  }

  const kept = rows.filter((row) => row.amount > 0);
  if (kept.length === 0 || kept.length > MAX_PAYMENTS) return null;
  const L = LABELS[ctx.lang];
  return kept.map((row, i) => {
    const { role } = row.p;
    const label =
      role === 'deposit'
        ? L.deposit
        : role === 'balance'
          ? L.balance
          : kept.length === 1
            ? row.p.share?.kind === 'full' || (row.p.share?.kind === 'pct' && row.p.share.v >= 100)
              ? L.full
              : row.r.onDay
                ? L.balance
                : L.single
            : i === 0 && row.r.rank === 0
              ? L.deposit
              : i === kept.length - 1 && row.r.rank >= 2
                ? L.balance
                : L.payment(i + 1);
    return { label, amount: row.amount / 100, dueDate: row.r.due, payOnEventDay: row.r.onDay };
  });
}

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/**
 * The payment schedule the vendor's terms describe, for a total of `amount`, an event on `eventDate` and
 * a today of `today`. `locale` names the payments ("מקדמה" / "Deposit"); without it the language of the text
 * is used. Empty when there is no amount to split.
 */
export function parsePaymentTerms(
  text: string | null | undefined,
  amount: number | null | undefined,
  eventDate: string | null | undefined,
  today: string,
  locale?: UiLocale,
): ProposedPayment[] {
  const total = typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  if (total <= 0) return [];
  const raw = typeof text === 'string' ? text : '';
  const lang: 'he' | 'en' = locale ?? (hasHebrew(raw) || !/[a-z]/i.test(raw) ? 'he' : 'en');
  const event = isIsoDate(eventDate) ? eventDate : null;
  const day = isIsoDate(today) ? today : new Date().toISOString().slice(0, 10);
  const ctx = { today: day, event, lang };
  const fallback = (): ProposedPayment[] => [
    { label: LABELS[lang].balance, amount: total / 100, dueDate: event, payOnEventDay: true },
  ];
  try {
    const t = normalize(raw);
    if (!t) return fallback();

    // "50/50", "30/30/40": a split that adds up to 100, the first on signing, the last on the day
    const slash = /(?:^|[^\d/.])(\d{1,3}(?:\s*\/\s*\d{1,3}){1,5})(?![\d/])/.exec(t);
    if (slash) {
      const shares = slash[1]!.split('/').map((v) => Number(v.trim()));
      if (Math.abs(shares.reduce((a, b) => a + b, 0) - 100) < 0.5 && shares.every((v) => v > 0))
        return schedule(equalParts(shares), total, ctx) ?? fallback();
    }
    // "3 equal payments"
    const inst = INSTALLMENTS.exec(t);
    if (inst) {
      const n = numberOrWord(inst[1]);
      const rest = t.replace(inst[0], ' ');
      if (n && n >= 2 && n <= 12 && !/[%₪]|ש"ח|nis/.test(rest) && !/\d{3,}/.test(rest))
        return schedule(equalParts(Array.from({ length: n }, () => 100 / n)), total, ctx) ?? fallback();
    }

    const parts: Part[] = [];
    clausesOf(t).forEach((clause, i) => {
      const part = parseClause(clause, i);
      if (part) parts.push(part);
    });
    if (parts.length === 0) return fallback();
    // "deposit" and nothing about how much or what is left: there is nothing to base an amount on
    if (parts.length === 1 && parts[0]!.role === 'deposit' && !parts[0]!.share) return fallback();
    return schedule(parts, total, ctx) ?? fallback();
  } catch {
    return fallback();
  }
}
