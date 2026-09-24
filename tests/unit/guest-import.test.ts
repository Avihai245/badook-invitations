import { describe, expect, it } from 'vitest';
import {
  csvCell,
  decodeCsv,
  isLegacyExcel,
  MAX_IMPORT_ROWS,
  normalizeGuestPhone,
  parseCsv,
  readGuestRows,
  whatsappCapable,
} from '@/features/invitations/lib/guest-import';

describe('guest list import', () => {
  it('reads Hebrew titles in any order, first + last names, Excel numbers and groups', () => {
    const r = readGuestRows([
      ['טלפון נייד', 'שם פרטי', 'שם משפחה', 'דוא"ל', 'כמות', 'צד'],
      [501234567, 'דנה', 'לוי', 'Dana@Example.com', 2, 'כלה'],
      ['052-765-4321', 'משה', '', '', '', 'חתן'],
    ]);
    expect(r.header).toBe(true);
    expect(r.guests).toEqual([
      { name: 'דנה לוי', phone: '+972501234567', email: 'dana@example.com', partySize: 2, group: 'כלה' },
      { name: 'משה', phone: '+972527654321', email: null, partySize: null, group: 'חתן' },
    ]);
    expect(r.issues).toEqual([]);
  });

  it('reads English titles, including numbered export columns', () => {
    const r = readGuestRows([
      ['Name', 'Phone 1 - Value', 'E-mail 1 - Value'],
      ['Noa Cohen', '+972 54-111-2222', 'noa@example.com'],
    ]);
    expect(r.guests[0]).toMatchObject({
      name: 'Noa Cohen',
      phone: '+972541112222',
      email: 'noa@example.com',
    });
  });

  it('without a title row, finds the columns by what they hold', () => {
    const r = readGuestRows([
      ['0501111111', 'רינה כהן', 'rina@example.com'],
      ['0502222222', 'אבי', ''],
    ]);
    expect(r.header).toBe(false);
    expect(r.mapping).toMatchObject({ phone: 0, name: 1, email: 2 });
    expect(r.guests.map((g) => [g.name, g.phone])).toEqual([
      ['רינה כהן', '+972501111111'],
      ['אבי', '+972502222222'],
    ]);
  });

  it('reports rows it cannot use, by their row number, and skips repeated phones', () => {
    const r = readGuestRows([
      ['שם', 'טלפון', 'מייל', 'כמות'],
      ['', '0501234567', '', ''],
      ['רק שם', '', '', ''],
      ['טלפון שגוי', '12', '', ''],
      ['כפול', '050-123-4567', '', ''],
      ['שוב כפול', '0501234567', 'not-an-email', '300'],
    ]);
    expect(r.guests.map((g) => g.name)).toEqual(['רק שם', 'כפול']);
    expect(r.issues).toEqual([
      { row: 2, code: 'no_name', value: '0501234567' },
      { row: 4, code: 'bad_phone', value: '12' },
      { row: 6, code: 'duplicate_phone', value: '0501234567' },
    ]);
    const lax = readGuestRows([
      ['שם', 'מייל', 'כמות'],
      ['דנה', 'not-an-email', '300'],
    ]);
    expect(lax.guests).toEqual([{ name: 'דנה', phone: null, email: null, partySize: null, group: null }]);
    expect(lax.issues.map((i) => i.code)).toEqual(['bad_email', 'bad_party_size']);
  });

  it('normalizes the ways spreadsheets keep Israeli phones', () => {
    for (const v of [
      '0501234567',
      '050-1234567',
      '050 123 4567',
      501234567,
      '972501234567',
      '+972501234567',
      '00972501234567',
    ])
      expect(normalizeGuestPhone(v)).toBe('+972501234567');
    expect(normalizeGuestPhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizeGuestPhone('12345')).toBeNull();
    expect(normalizeGuestPhone('')).toBeNull();
  });

  it('parses CSV with quotes, CRLF, a BOM and ; or tab separators', () => {
    expect(parseCsv('﻿שם,טלפון\r\n"לוי, דנה",050-1234567\r\n"a ""b""",1\n')).toEqual([
      ['שם', 'טלפון'],
      ['לוי, דנה', '050-1234567'],
      ['a "b"', '1'],
    ]);
    expect(parseCsv('name;phone\nDana;0501234567')).toEqual([
      ['name', 'phone'],
      ['Dana', '0501234567'],
    ]);
    expect(parseCsv('name\tphone\nDana\t0501234567')[1]).toEqual(['Dana', '0501234567']);
  });

  it('reads numbered and compound titles in Hebrew too, never a "Type" column, a mobile column first', () => {
    const he = readGuestRows([
      ['שם', 'טלפון 1', 'טלפון 2', 'מייל 1'],
      ['דנה', '050-1234567', '03-1234567', 'dana@example.com'],
    ]);
    expect(he.mapping).toEqual({ name: 0, phone: 1, email: 3 });
    expect(he.guests[0]).toMatchObject({ phone: '+972501234567', email: 'dana@example.com' });
    // a contacts export: "… - Type" says what kind of number it is
    const google = readGuestRows([
      ['Name', 'E-mail 1 - Type', 'E-mail 1 - Value', 'Phone 1 - Type', 'Phone 1 - Value'],
      ['Noa Cohen', '* Home', 'noa@example.com', 'Mobile', '054-111-2222'],
    ]);
    expect(google.mapping).toEqual({ name: 0, email: 2, phone: 4 });
    expect(google.issues).toEqual([]);
    const both = readGuestRows([
      ['שם', 'טלפון', 'נייד'],
      ['דנה', '03-1234567', '050-1234567'],
    ]);
    expect(both.guests[0]!.phone).toBe('+972501234567');
  });

  it('only a clear title is a party size: a bare "מספר" is the row number', () => {
    const numbered = readGuestRows([
      ['מספר', 'שם', 'טלפון'],
      ['1', 'דנה', '0501234567'],
      ['2', 'יוסי', '0527654321'],
    ]);
    expect(numbered.mapping.partySize).toBeUndefined();
    expect(numbered.guests.map((g) => [g.name, g.partySize])).toEqual([
      ['דנה', null],
      ['יוסי', null],
    ]);
    // without a name title, the text column holds the names (not the numbers)
    expect(
      readGuestRows([
        ['מספר', 'טלפון', ''],
        ['1', '0501234567', 'דנה'],
      ]).mapping,
    ).toMatchObject({
      phone: 1,
      name: 2,
    });
    // "מוזמנים" / "guests": a head count when it holds small numbers, the names when it holds text
    const counts = readGuestRows([
      ['שם', 'מוזמנים'],
      ['דנה', '2'],
    ]);
    expect(counts.mapping).toEqual({ name: 0, partySize: 1 });
    expect(counts.guests[0]!.partySize).toBe(2);
    const names = readGuestRows([
      ['guests', 'phone'],
      ['Dana Levi', '0501234567'],
    ]);
    expect(names.mapping).toEqual({ name: 0, phone: 1 });
    expect(
      readGuestRows([
        ['שם', 'מספר מוזמנים'],
        ['דנה', 3],
      ]).guests[0]!.partySize,
    ).toBe(3);
  });

  it('says how many rows past the limit it did not read', () => {
    const sheet = [['שם'], ...Array.from({ length: MAX_IMPORT_ROWS + 3 }, (_, i) => [`אורח ${i}`])];
    const r = readGuestRows(sheet);
    expect(r.rows).toBe(MAX_IMPORT_ROWS);
    expect(r.guests).toHaveLength(MAX_IMPORT_ROWS);
    expect(r.truncated).toBe(3);
    expect(readGuestRows([['שם'], ['דנה']]).truncated).toBe(0);
  });

  it("decodes CSV as UTF-8, or as Windows-1255 (Excel's plain CSV on Hebrew Windows)", () => {
    const utf8 = new TextEncoder().encode('\uFEFFשם,טלפון\nדנה,0501234567');
    expect(parseCsv(decodeCsv(utf8))).toEqual([
      ['שם', 'טלפון'],
      ['דנה', '0501234567'],
    ]);
    // "שם,טלפון" in Windows-1255
    const cp1255 = new Uint8Array([0xf9, 0xed, 0x2c, 0xe8, 0xec, 0xf4, 0xe5, 0xef]);
    expect(decodeCsv(cp1255)).toBe('שם,טלפון');
    const utf16 = new Uint8Array([0xff, 0xfe, 0xe9, 0x05, 0xdd, 0x05]);
    expect(decodeCsv(utf16)).toBe('שם');
  });

  it('knows an old .xls file by its first bytes', () => {
    expect(isLegacyExcel(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]))).toBe(true);
    expect(isLegacyExcel(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
    expect(isLegacyExcel(new Uint8Array([]))).toBe(false);
  });

  it('WhatsApp reaches Israeli mobiles only; other countries as they are', () => {
    expect(whatsappCapable('+972501234567')).toBe(true);
    expect(whatsappCapable('+97231234567')).toBe(false);
    expect(whatsappCapable('+972771234567')).toBe(false);
    expect(whatsappCapable('+442079460958')).toBe(true);
    expect(whatsappCapable(null)).toBe(false);
  });

  it('writes CSV cells that Excel opens safely', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell(null)).toBe('');
    expect(csvCell('050-123-4567')).toBe('050-123-4567');
  });
});
