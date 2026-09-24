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
    'מוזמן',
    'מוזמנים',
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
  partySize: [
    'כמות',
    'מספר מוזמנים',
    'כמות מוזמנים',
    'מספר אורחים',
    'כמות אורחים',
    'כמה',
    'מספר',
    'party size',
    'party',
    'guests',
    'count',
    'quantity',
    'qty',
    'number of guests',
    'pax',
    'size',
  ],
  group: ['קבוצה', 'צד', 'קטגוריה', 'שייכות', 'קרבה', 'group', 'side', 'category', 'tag', 'label'],
};

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

function titleKey(value: Cell): ColumnKey | null {
  const t = normalizeTitle(value);
  if (!t) return null;
  for (const key of Object.keys(SYNONYMS) as ColumnKey[])
    if (SYNONYMS[key].some((s) => normalizeTitle(s) === t)) return key;
  // exports with numbered columns: "Phone 1 - Value", "E-mail 1 - Value", "טלפון 2"
  if (/\b(phone|mobile|טלפון|נייד)\b/.test(t)) return 'phone';
  if (/\b(e ?mail|מייל)\b/.test(t)) return 'email';
  if (/\b(given name)\b/.test(t)) return 'firstName';
  if (/\b(family name)\b/.test(t)) return 'lastName';
  return null;
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

const looksLikePhone = (v: Cell) =>
  normalizeGuestPhone(v) !== null && /\d{7,}/.test(cellText(v).replace(/\D/g, ''));
const looksLikeEmail = (v: Cell) => EMAIL_RE.test(cellText(v));
const looksLikeCount = (v: Cell) => /^\d{1,2}$/.test(cellText(v)) && Number(cellText(v)) > 0;

/** Columns by their titles (first row), or null when the first row isn't titles. */
function mappingFromTitles(row: readonly Cell[]): ColumnMapping | null {
  const mapping: ColumnMapping = {};
  row.forEach((cell, i) => {
    const key = titleKey(cell);
    if (key && mapping[key] === undefined) mapping[key] = i;
  });
  const recognized = Object.keys(mapping).length;
  if (!recognized) return null;
  if (mapping.name === undefined && mapping.firstName === undefined && mapping.lastName === undefined) {
    // titles without a name column: the first unrecognized text column holds the names
    const free = row.findIndex((cell, i) => cellText(cell) && !Object.values(mapping).includes(i));
    if (free >= 0) mapping.name = free;
  }
  return mapping;
}

/** Without titles: phones, emails and small numbers by their look; the first other column = names. */
function mappingFromContent(rows: readonly (readonly Cell[])[]): ColumnMapping {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const sample = rows.slice(0, 50);
  const share = (i: number, test: (v: Cell) => boolean) => {
    const filled = sample.filter((r) => cellText(r[i]));
    return filled.length ? filled.filter((r) => test(r[i])).length / filled.length : 0;
  };
  const mapping: ColumnMapping = {};
  for (let i = 0; i < width; i++) {
    if (mapping.phone === undefined && share(i, looksLikePhone) >= 0.6) mapping.phone = i;
    else if (mapping.email === undefined && share(i, looksLikeEmail) >= 0.6) mapping.email = i;
    else if (mapping.partySize === undefined && share(i, looksLikeCount) >= 0.8) mapping.partySize = i;
    else if (mapping.name === undefined && share(i, (v) => /\p{L}/u.test(cellText(v))) >= 0.6)
      mapping.name = i;
  }
  return mapping;
}

/** Guest rows from a sheet: titles or not, empty rows skipped, every problem reported by row. */
export function readGuestRows(sheet: readonly (readonly Cell[])[]): ImportPreview {
  const rows = sheet
    .map((r, i) => ({ cells: r, line: i + 1 }))
    .filter((r) => r.cells.some((c) => cellText(c)));
  if (!rows.length) return { guests: [], issues: [], mapping: {}, header: false, rows: 0 };
  const titles = mappingFromTitles(rows[0]!.cells);
  const header = titles !== null;
  const data = (header ? rows.slice(1) : rows).slice(0, MAX_IMPORT_ROWS);
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
  return { guests, issues, mapping, header, rows: data.length };
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
