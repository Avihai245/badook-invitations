import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * A host's guest list from a spreadsheet (Excel .xlsx or CSV): the columns are recognized by their
 * titles in Hebrew or English (שם / שם מלא / שם פרטי + שם משפחה, טלפון / נייד, מייל, כמות, קבוצה…) —
 * or, without a title row, by what the cells look like (phones, emails, the text column = names).
 * Isomorphic: the browser previews the file; the server validates the rows again before saving.
 */

export type Cell = string | number | boolean | Date | null | undefined;

export interface GuestInput {
  name: string;
  /** E.164, e.g. +972501234567 */
  phone: string | null;
  email: string | null;
  partySize: number | null;
  group: string | null;
}

export type ColumnKey = 'name' | 'firstName' | 'lastName' | 'phone' | 'email' | 'partySize' | 'group';
export type ColumnMapping = Partial<Record<ColumnKey, number>>;

export type ImportIssueCode = 'no_name' | 'bad_phone' | 'bad_email' | 'bad_party_size' | 'duplicate_phone';
export interface ImportIssue {
  /** 1-based row number in the file (as the spreadsheet shows it) */
  row: number;
  code: ImportIssueCode;
  value?: string;
}

export interface ImportPreview {
  guests: GuestInput[];
  issues: ImportIssue[];
  mapping: ColumnMapping;
  /** the file's first row was titles */
  header: boolean;
  /** data rows read (empty rows skipped) */
  rows: number;
  /** rows past MAX_IMPORT_ROWS, not read */
  truncated: number;
}

export const MAX_IMPORT_ROWS = 5000;
export const NAME_MAX = 120;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SYNONYMS: Record<ColumnKey, readonly string[]> = {
  name: [
    'שם',
    'שם מלא',
    'שם המוזמן',
    'שם האורח',
    'שם המוזמנים',
    'שמות המוזמנים',
    'מוזמן',
    'אורח',
    'שם איש קשר',
    'name',
    'full name',
    'fullname',
    'guest',
    'guest name',
    'contact',
    'contact name',
    'display name',
  ],
  firstName: ['שם פרטי', 'פרטי', 'first name', 'firstname', 'given name', 'first'],
  lastName: ['שם משפחה', 'משפחה', 'last name', 'lastname', 'surname', 'family name', 'last'],
  phone: [
    'טלפון',
    'נייד',
    'פלאפון',
    'סלולרי',
    'סלולארי',
    'מספר טלפון',
    'טלפון נייד',
    'מס טלפון',
    'מספר נייד',
    'וואטסאפ',
    'ווטסאפ',
    'phone',
    'mobile',
    'cell',
    'cellphone',
    'phone number',
    'mobile phone',
    'mobile number',
    'whatsapp',
    'tel',
    'telephone',
  ],
  email: [
    'מייל',
    'אימייל',
    'דואל',
    'דואר אלקטרוני',
    'כתובת מייל',
    'email',
    'e-mail',
    'mail',
    'email address',
  ],
  // only titles that clearly count people: a bare "מספר" is usually the row's number
  partySize: [
    'כמות',
    'מספר מוזמנים',
    'כמות מוזמנים',
    'מס מוזמנים',
    'מספר אורחים',
    'כמות אורחים',
    'מס אורחים',
    'מספר נפשות',
    'נפשות',
    'כמה מוזמנים',
    'party size',
    'number of guests',
    'no of guests',
    'guest count',
    'guests count',
    'headcount',
    'quantity',
    'qty',
    'pax',
  ],
  group: ['קבוצה', 'צד', 'קטגוריה', 'שייכות', 'קרבה', 'group', 'side', 'category', 'tag', 'label'],
};

/** Titles that are the names in one list and a head count in another: the column's cells decide. */
const NAMES_OR_COUNT = ['מוזמנים', 'אורחים', 'guests'];

/** One of `words` as whole words of a title — in any script (`\b` only knows Latin letters). */
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${list})(?![\\p{L}\\p{N}])`, 'u');
/** Exports with numbered or compound columns: "Phone 1 - Value", "E-mail 1 - Value", "טלפון 2", "מייל 1". */
const LOOSE: readonly [ColumnKey, RegExp][] = [
  ['phone', words('phone|mobile|cell|telephone|whatsapp|טלפון|נייד|פלאפון|סלולרי|סלולארי|וואטסאפ|ווטסאפ')],
  ['email', words('e ?mail|מייל|אימייל|דואל')],
  ['firstName', words('given name|first name|שם פרטי')],
  ['lastName', words('family name|last name|שם משפחה')],
];
/** "Phone 1 - Type", "E-mail 1 - Label": what kind of number it is, not the number. */
const NOT_A_VALUE = words('type|label|סוג');
/** Of several phone columns, the mobile one (WhatsApp reaches mobiles). */
const MOBILE = words('mobile|cell|cellphone|whatsapp|נייד|סלולרי|סלולארי|פלאפון|וואטסאפ|ווטסאפ');

/** "שם מלא:" / " Full_Name " / 'דוא"ל' → comparable text. */
function normalizeTitle(value: Cell): string {
  return (
    String(value ?? '')
      .toLowerCase()
      // quotes vanish (דוא"ל = דואל), other punctuation separates words
      .replace(/["'`׳״]/g, '')
      .replace(/[.:_\-–—()[\]/\\*#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function exactKey(title: string): ColumnKey | null {
  for (const key of Object.keys(SYNONYMS) as ColumnKey[])
    if (SYNONYMS[key].some((s) => normalizeTitle(s) === title)) return key;
  return null;
}

function looseKey(title: string): ColumnKey | null {
  if (NOT_A_VALUE.test(title)) return null;
  return LOOSE.find(([, re]) => re.test(title))?.[0] ?? null;
}

const cellText = (value: Cell): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  return String(value).replace(/\s+/g, ' ').trim();
};

/** A phone as a spreadsheet keeps it (050-1234567, 0501234567, 501234567 as a number, 972…) → E.164. */
export function normalizeGuestPhone(value: Cell): string | null {
  const raw = cellText(value);
  if (!raw) return null;
  let typed = raw.replace(/[^\d+]/g, '');
  if (!typed) return null;
  if (typed.startsWith('00')) typed = `+${typed.slice(2)}`;
  // 972501234567 without the plus (Excel drops it)
  if (/^972\d{8,9}$/.test(typed)) typed = `+${typed}`;
  const parsed = parsePhoneNumberFromString(typed, 'IL');
  if (parsed?.isValid()) return parsed.number;
  if (typed.startsWith('+') && parsed?.isPossible()) return parsed.number;
  return null;
}

/**
 * Whether the system's WhatsApp can reach this number: an Israeli number only as a mobile (+9725…) —
 * a landline never has WhatsApp; other countries' numbers are taken as they are. The database's
 * whatsapp_capable() says the same when it queues messages.
 */
export function whatsappCapable(e164: string | null): boolean {
  if (!e164) return false;
  return !e164.startsWith('+972') || /^\+9725\d{8}$/.test(e164);
}

const looksLikePhone = (v: Cell) =>
  normalizeGuestPhone(v) !== null && /\d{7,}/.test(cellText(v).replace(/\D/g, ''));
const looksLikeEmail = (v: Cell) => EMAIL_RE.test(cellText(v));
const looksLikeCount = (v: Cell) => /^\d{1,2}$/.test(cellText(v)) && Number(cellText(v)) > 0;
const hasLetters = (v: Cell) => /\p{L}/u.test(cellText(v));

/** Of a column's filled cells (in the first 50 rows), the share that pass `test`. */
function share(rows: readonly (readonly Cell[])[], i: number, test: (v: Cell) => boolean): number {
  const filled = rows.slice(0, 50).filter((r) => cellText(r[i]));
  return filled.length ? filled.filter((r) => test(r[i])).length / filled.length : 0;
}

/** Columns by their titles (the first row), or null when it isn't titles. `data`: the rows under it. */
function mappingFromTitles(row: readonly Cell[], data: readonly (readonly Cell[])[]): ColumnMapping | null {
  const titles = row.map(normalizeTitle);
  const mapping: ColumnMapping = {};
  const taken = (i: number) => Object.values(mapping).includes(i);
  const take = (key: ColumnKey, i: number) => {
    if (mapping[key] === undefined && !taken(i)) mapping[key] = i;
  };
  const exact = titles.map((t) => (t ? exactKey(t) : null));
  // a mobile column before any other phone column, then the other exact titles, then numbered ones
  exact.forEach((key, i) => {
    if (key === 'phone' && MOBILE.test(titles[i]!)) take('phone', i);
  });
  exact.forEach((key, i) => {
    if (key) take(key, i);
  });
  titles.forEach((t, i) => {
    const key = t && !taken(i) ? looseKey(t) : null;
    if (key) take(key, i);
  });
  titles.forEach((t, i) => {
    if (NAMES_OR_COUNT.includes(t)) take(share(data, i, looksLikeCount) >= 0.8 ? 'partySize' : 'name', i);
  });
  if (!Object.keys(mapping).length) return null;
  if (mapping.name === undefined && mapping.firstName === undefined && mapping.lastName === undefined) {
    // titles without a name column: the first other column that holds text (titled or not)
    const width = Math.max(row.length, ...data.slice(0, 50).map((r) => r.length));
    const free = Array.from({ length: width }, (_, i) => i).find(
      (i) => !taken(i) && share(data, i, hasLetters) >= 0.6,
    );
    if (free !== undefined) mapping.name = free;
  }
  return mapping;
}

/** Without titles: phones, emails and small numbers by their look; the first other column = names. */
function mappingFromContent(rows: readonly (readonly Cell[])[]): ColumnMapping {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const mapping: ColumnMapping = {};
  for (let i = 0; i < width; i++) {
    if (mapping.phone === undefined && share(rows, i, looksLikePhone) >= 0.6) mapping.phone = i;
    else if (mapping.email === undefined && share(rows, i, looksLikeEmail) >= 0.6) mapping.email = i;
    else if (mapping.partySize === undefined && share(rows, i, looksLikeCount) >= 0.8) mapping.partySize = i;
    else if (mapping.name === undefined && share(rows, i, hasLetters) >= 0.6) mapping.name = i;
  }
  return mapping;
}

/** Guest rows from a sheet: titles or not, empty rows skipped, every problem reported by row. */
export function readGuestRows(sheet: readonly (readonly Cell[])[]): ImportPreview {
  const rows = sheet
    .map((r, i) => ({ cells: r, line: i + 1 }))
    .filter((r) => r.cells.some((c) => cellText(c)));
  if (!rows.length) return { guests: [], issues: [], mapping: {}, header: false, rows: 0, truncated: 0 };
  const titles = mappingFromTitles(
    rows[0]!.cells,
    rows.slice(1).map((r) => r.cells),
  );
  const header = titles !== null;
  const all = header ? rows.slice(1) : rows;
  const data = all.slice(0, MAX_IMPORT_ROWS);
  const mapping = titles ?? mappingFromContent(data.map((r) => r.cells));
  const at = (cells: readonly Cell[], key: ColumnKey) =>
    mapping[key] === undefined ? '' : cellText(cells[mapping[key]!]);

  const guests: GuestInput[] = [];
  const issues: ImportIssue[] = [];
  const phones = new Set<string>();
  for (const { cells, line } of data) {
    const full = at(cells, 'name');
    const split = [at(cells, 'firstName'), at(cells, 'lastName')].filter(Boolean).join(' ');
    const name = (full || split).slice(0, NAME_MAX).trim();
    const phoneText = at(cells, 'phone');
    const phone = mapping.phone === undefined ? null : normalizeGuestPhone(cells[mapping.phone]);
    const emailText = at(cells, 'email');
    const sizeText = at(cells, 'partySize');
    if (!name) {
      issues.push({ row: line, code: 'no_name', value: phoneText || emailText || undefined });
      continue;
    }
    if (phoneText && !phone) {
      issues.push({ row: line, code: 'bad_phone', value: phoneText });
      continue;
    }
    if (phone && phones.has(phone)) {
      issues.push({ row: line, code: 'duplicate_phone', value: phoneText });
      continue;
    }
    let email: string | null = null;
    if (emailText) {
      if (EMAIL_RE.test(emailText) && emailText.length <= 254) email = emailText.toLowerCase();
      else issues.push({ row: line, code: 'bad_email', value: emailText });
    }
    let partySize: number | null = null;
    if (sizeText) {
      const n = Number(sizeText);
      if (Number.isInteger(n) && n >= 1 && n <= 99) partySize = n;
      else issues.push({ row: line, code: 'bad_party_size', value: sizeText });
    }
    if (phone) phones.add(phone);
    const group = at(cells, 'group').slice(0, 60) || null;
    guests.push({ name, phone, email, partySize, group });
  }
  return { guests, issues, mapping, header, rows: data.length, truncated: all.length - data.length };
}

const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** Excel's old binary format (.xls, an OLE2 file) — only .xlsx and CSV can be read. */
export const isLegacyExcel = (bytes: Uint8Array) => OLE2.every((b, i) => bytes[i] === b);

/**
 * A CSV file's text: UTF-8 (Excel's "CSV UTF-8", with its BOM), UTF-16 with a BOM, or else
 * Windows-1255 — what Excel's plain "CSV" writes on a Hebrew Windows.
 */
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

/** CSV text → rows: quotes ("a, b" and "" inside), CRLF, a BOM, and , ; or tab — whichever the first line uses. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const delimiter = [',', ';', '\t'].reduce(
    (best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best),
    ',',
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A CSV cell for Excel: quoted when needed; formulas neutralized (a leading = + - @ can't execute). */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
