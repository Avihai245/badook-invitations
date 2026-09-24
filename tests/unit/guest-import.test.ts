import { describe, expect, it } from 'vitest';
import {
  csvCell,
  normalizeGuestPhone,
  parseCsv,
  readGuestRows,
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

  it('writes CSV cells that Excel opens safely', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell(null)).toBe('');
    expect(csvCell('050-123-4567')).toBe('050-123-4567');
  });
});
