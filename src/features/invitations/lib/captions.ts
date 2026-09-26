/**
 * Video captions (WebVTT), isomorphic: a host's .vtt read and normalized, an .srt converted, cues
 * typed in the editor written out — one WebVTT text per language, kept on the video in the document
 * (Media.captions) and shown as the page's language's <track kind="captions">. Only what a caption
 * needs is kept: the times and the words (cue settings, styles and notes are dropped).
 */

export interface Cue {
  /** seconds */
  start: number;
  end: number;
  text: string;
}

export const CAPTIONS = {
  /** a language's WebVTT, characters */
  maxChars: 30_000,
  maxCues: 600,
  /** a cue's words */
  maxCueChars: 300,
} as const;

/** '00:01:02.500', '01:02.5', '1:02', '62', '00:00:01,000' (SRT) → seconds (null: not a time). */
export function parseTimestamp(value: string): number | null {
  const v = value.trim().replace(',', '.');
  if (!/^\d{1,5}(?::\d{1,3}){0,2}(?:\.\d{1,3})?$/.test(v)) return null;
  const [main = '', frac = ''] = v.split('.');
  const parts = main.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : parts.length === 2 ? [0, ...parts] : [0, 0, ...parts];
  if (parts.length > 1 && s! >= 60) return null;
  if (parts.length === 3 && m! >= 60) return null;
  return h! * 3600 + m! * 60 + s! + Number(frac.padEnd(3, '0')) / 1000;
}

/** Seconds → WebVTT's 'hh:mm:ss.ttt' (hours only when there are any: 'mm:ss.ttt'). */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const ms = total % 1000;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${two(h)}:` : ''}${two(m)}:${two(s)}.${String(ms).padStart(3, '0')}`;
}

/** A short, readable time for the editor ('1:02.5'). */
export function shortTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 10));
  const m = Math.floor(total / 600);
  const s = Math.floor((total % 600) / 10);
  const tenth = total % 10;
  return `${m}:${String(s).padStart(2, '0')}${tenth ? `.${tenth}` : ''}`;
}

const TIMING = /^(\S+)\s+-->\s+(\S+)(?:\s.*)?$/;

/** The words of a cue as plain text (tags such as <v Name>, <b>, <i> and timestamps go). */
const plain = (lines: string[]) =>
  lines
    .join('\n')
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, CAPTIONS.maxCueChars);

function cuesOf(blocks: string[][], srt: boolean): Cue[] | null {
  const cues: Cue[] = [];
  for (const block of blocks) {
    let lines = block;
    // an SRT counter, or a WebVTT cue identifier, before the timing line
    if (lines.length > 1 && !lines[0]!.includes('-->')) lines = lines.slice(1);
    const timing = TIMING.exec(lines[0] ?? '');
    if (!timing) {
      // WebVTT allows notes, styles and regions between cues; an SRT block must be a cue
      if (srt) return null;
      continue;
    }
    const start = parseTimestamp(timing[1]!);
    const end = parseTimestamp(timing[2]!);
    if (start === null || end === null || end <= start) return null;
    const text = plain(lines.slice(1));
    if (!text) continue;
    cues.push({ start, end, text });
    if (cues.length > CAPTIONS.maxCues) return null;
  }
  return cues;
}

const blocksOf = (body: string) =>
  body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.split('\n').filter((l) => l.trim() !== ''))
    .filter((b) => b.length);

/** A WebVTT file's cues (null: not WebVTT, or a cue that doesn't parse). */
export function parseVtt(text: string): Cue[] | null {
  const body = text.replace(/^﻿/, '');
  if (!/^WEBVTT(?:[ \t].*)?(?:\r?\n|$)/.test(body)) return null;
  const [header, ...rest] = blocksOf(body);
  // the header block carries metadata lines; a sloppy file starts its first cue right under it
  const inHeader = header!.slice(1);
  const first = inHeader.findIndex((l) => l.includes('-->'));
  const blocks = first >= 0 ? [inHeader.slice(Math.max(0, first - 1)), ...rest] : rest;
  return cuesOf(
    blocks.filter((b) => !/^(NOTE|STYLE|REGION)\b/.test(b[0] ?? '')),
    false,
  );
}

/** An SRT file's cues (null: not SRT). */
export function parseSrt(text: string): Cue[] | null {
  const blocks = blocksOf(text.replace(/^﻿/, ''));
  if (!blocks.length) return null;
  return cuesOf(blocks, true);
}

/** A captions file of either kind (by its name, else by its first line). */
export function parseCaptionsFile(text: string, name = ''): Cue[] | null {
  if (/\.srt$/i.test(name)) return parseSrt(text);
  if (/\.vtt$/i.test(name)) return parseVtt(text);
  return /^﻿?WEBVTT/.test(text) ? parseVtt(text) : parseSrt(text);
}

/** Cues → WebVTT text (sorted by start; the words escaped). */
export function toVtt(cues: readonly Cue[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = [...cues]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((c) => `${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${esc(c.text.trim())}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

/** A stored language's captions are well formed (the document keeps only what the editor wrote). */
export const validVtt = (text: string): boolean =>
  text.length <= CAPTIONS.maxChars && (parseVtt(text)?.length ?? 0) > 0;

/** The captions as a <track>'s address (the page carries them itself: no other request). */
export const vttDataUrl = (text: string): string => `data:text/vtt;charset=utf-8,${encodeURIComponent(text)}`;
