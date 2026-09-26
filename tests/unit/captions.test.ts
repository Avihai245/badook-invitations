import { describe, expect, it } from 'vitest';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import { InvitationDocumentSchema as DocumentSchema } from '@/features/invitations/contracts/schemas';
import {
  CAPTIONS,
  formatTimestamp,
  parseCaptionsFile,
  parseSrt,
  parseTimestamp,
  parseVtt,
  shortTimestamp,
  toVtt,
  validVtt,
  vttDataUrl,
} from '@/features/invitations/lib/captions';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { requireTemplate } from '@/features/invitations/templates/registry';

// Video captions (Phase 5C): WebVTT read and written, SRT converted, the typed times, and the publish
// warnings for a video with speech and no captions (only when the host said so).

const VTT = `WEBVTT
Kind: captions
Language: he

NOTE the family's words

1
00:00:01.000 --> 00:00:04.500 align:start position:10%
<v Noa>Welcome, <b>everyone</b></v>

00:04.500 --> 00:07.250
We are so happy
you came &amp; stayed

STYLE
::cue { color: yellow }
`;

const SRT = `1
00:00:01,000 --> 00:00:04,500
Welcome, <i>everyone</i>

2
00:00:04,500 --> 00:00:07,250
We are so happy
`;

describe('timestamps', () => {
  it('reads what hosts and files write; refuses the rest', () => {
    expect(parseTimestamp('00:00:01.000')).toBe(1);
    expect(parseTimestamp('01:02:03.5')).toBeCloseTo(3723.5);
    expect(parseTimestamp('1:05.5')).toBe(65.5);
    expect(parseTimestamp('0:03')).toBe(3);
    expect(parseTimestamp('12')).toBe(12);
    expect(parseTimestamp('00:00:04,500')).toBe(4.5);
    for (const bad of ['', 'abc', '1:60', '1:2:3:4', '-1', '1:00:61', '00:61:00'])
      expect(parseTimestamp(bad), bad).toBeNull();
  });

  it('writes WebVTT times, and short ones for the editor', () => {
    expect(formatTimestamp(1)).toBe('00:01.000');
    expect(formatTimestamp(3723.5)).toBe('01:02:03.500');
    expect(shortTimestamp(65.5)).toBe('1:05.5');
    expect(shortTimestamp(3)).toBe('0:03');
  });
});

describe('WebVTT and SRT', () => {
  it('a WebVTT file: its cues, without settings, voices, tags, notes and styles', () => {
    expect(parseVtt(VTT)).toEqual([
      { start: 1, end: 4.5, text: 'Welcome, everyone' },
      { start: 4.5, end: 7.25, text: 'We are so happy\nyou came & stayed' },
    ]);
    // a byte-order mark and Windows line ends are fine
    expect(parseVtt(`﻿${VTT.replace(/\n/g, '\r\n')}`)).toHaveLength(2);
    // a sloppy file with its first cue right under the header
    expect(parseVtt('WEBVTT\n00:01.000 --> 00:02.000\nHi')).toEqual([{ start: 1, end: 2, text: 'Hi' }]);
  });

  it('refuses what isn’t WebVTT, or a cue whose times don’t work', () => {
    expect(parseVtt('WEBVTTX\n\n00:01.000 --> 00:02.000\nHi')).toBeNull();
    expect(parseVtt(SRT)).toBeNull();
    expect(parseVtt('WEBVTT\n\n00:03.000 --> 00:02.000\nbackwards')).toBeNull();
    expect(parseVtt('WEBVTT\n\n00:0x.000 --> 00:02.000\nbad')).toBeNull();
    expect(validVtt('WEBVTT\n')).toBe(false);
  });

  it('an SRT file converts to the same WebVTT', () => {
    const cues = parseSrt(SRT)!;
    expect(cues).toEqual([
      { start: 1, end: 4.5, text: 'Welcome, everyone' },
      { start: 4.5, end: 7.25, text: 'We are so happy' },
    ]);
    expect(parseCaptionsFile(SRT, 'wedding.srt')).toEqual(cues);
    expect(parseCaptionsFile(VTT, 'wedding.vtt')).toHaveLength(2);
    expect(parseCaptionsFile(VTT)).toHaveLength(2);
    expect(parseCaptionsFile(SRT)).toEqual(cues);
    expect(parseSrt('1\nnot a time\nhello')).toBeNull();
  });

  it('writes WebVTT that reads back the same (sorted, the words escaped)', () => {
    const cues = [
      { start: 4, end: 6, text: 'Second <3 & more' },
      { start: 0.5, end: 3, text: 'שלום לכולם' },
    ];
    const vtt = toVtt(cues);
    expect(vtt.startsWith('WEBVTT\n\n00:00.500 --> 00:03.000\nשלום לכולם')).toBe(true);
    expect(vtt).toContain('Second &lt;3 &amp; more');
    expect(parseVtt(vtt)).toEqual([cues[1], cues[0]]);
    expect(validVtt(vtt)).toBe(true);
    expect(decodeURIComponent(vttDataUrl(vtt).split(',')[1]!)).toBe(vtt);
    expect(validVtt('WEBVTT\n\n' + '00:01.000 --> 00:02.000\nx\n\n'.repeat(CAPTIONS.maxChars / 10))).toBe(
      false,
    );
  });
});

describe('the document and the publish check', () => {
  const withVideo = (over: { captions?: Record<string, string> | null; speech?: boolean | null }) => {
    const doc = structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
    const hero = doc.sections.find((s) => s.type === 'hero')!;
    if (hero.type !== 'hero') throw new Error('hero');
    hero.data.media = {
      kind: 'video',
      src: 'upload:owner/inv/hero.mp4',
      poster: 'upload:owner/inv/hero.jpg',
      focalPoint: { x: 0.5, y: 0.5 },
      ...over,
    };
    return doc;
  };
  const codes = (doc: InvitationDocument) =>
    validateDocument(doc, requireTemplate(doc.templateId).manifest, { mode: 'publish' })
      .warnings.filter((w) => w.code.startsWith('captions'))
      .map((w) => `${w.code}:${w.params?.locale}`);

  it('a video’s captions are part of the document', () => {
    expect(
      DocumentSchema.safeParse(
        withVideo({ captions: { he: toVtt([{ start: 0, end: 1, text: 'א' }]) }, speech: true }),
      ).success,
    ).toBe(true);
    expect(
      DocumentSchema.safeParse(withVideo({ captions: { he: 'x'.repeat(CAPTIONS.maxChars + 1) } })).success,
    ).toBe(false);
  });

  it('warns about a video with speech and no captions, per language — only when the host said so', () => {
    expect(codes(withVideo({}))).toEqual([]);
    expect(codes(withVideo({ speech: false }))).toEqual([]);
    expect(codes(withVideo({ speech: true }))).toEqual(['captions_missing:he', 'captions_missing:en']);
    const he = toVtt([{ start: 0, end: 2, text: 'שלום' }]);
    expect(codes(withVideo({ speech: true, captions: { he } }))).toEqual(['captions_missing:en']);
    expect(codes(withVideo({ speech: true, captions: { he, en: 'not captions' } }))).toEqual([
      'captions_invalid:en',
    ]);
    // a warning, never an error: publishing goes on
    const { errors } = validateDocument(
      withVideo({ speech: true }),
      requireTemplate('sahar-bordeaux').manifest,
      {
        mode: 'publish',
      },
    );
    expect(errors.filter((e) => e.code.startsWith('captions'))).toEqual([]);
  });
});
