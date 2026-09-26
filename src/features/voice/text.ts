import type { RenderContext } from '../invitations/renderer/context-core';
import { formatDate, DAY_MONTH_YEAR } from '../invitations/lib/dates';
import { calendarTitle } from '../invitations/renderer/calendar-event';
import { VOICE } from './config';

/**
 * What the invitation says aloud in one language (feature `voice`): what a guest needs to hear, in
 * the page's order — the opening line and the names, the date and time, the places, the host's own
 * texts, the timeline, the questions, the RSVP's ask and the closing line. The pictures, the countdown
 * and the buttons stay silent. Plain paragraphs; nothing that changes with the time of day (the text's
 * hash decides whether the audio is made again). Pure and isomorphic: the server makes the audio from
 * it, the guest's device may read it itself.
 */
export function voiceText(ctx: RenderContext): string {
  const { doc } = ctx;
  const out: string[] = [];
  const say = (...parts: (string | null | undefined)[]) => {
    const line = parts
      .map((p) => (p ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('. ')
      .replace(/([.!?…:])\./g, '$1');
    if (line) out.push(line);
  };
  const when = (hhmm: string | null | undefined) => (hhmm ? ctx.time(hhmm) : '');

  for (const s of doc.sections) {
    if (!s.enabled) continue;
    switch (s.type) {
      case 'hero':
        say(ctx.text(s.data.eyebrow), calendarTitle(ctx));
        if (s.data.showDate) say(ctx.eventDateLong, ctx.hebrewDate, when(doc.event.startTime));
        say(ctx.text(s.data.locationLine));
        break;
      case 'text':
      case 'custom':
        say(ctx.text(s.data.title), ctx.text(s.data.subtitle), ctx.text(s.data.body));
        break;
      case 'quote':
        say(ctx.text(s.data.text), ctx.text(s.data.attribution));
        break;
      case 'parents':
        say(ctx.text(s.data.title));
        for (const p of s.data.items) say(ctx.text(p.label), ctx.text(p.names));
        if (!s.data.items.length) say(ctx.text(doc.hosts.parents));
        say(ctx.text(s.data.note));
        break;
      case 'when':
        say(
          ctx.text(s.data.title),
          ctx.eventDateLong,
          s.data.showHebrewDate ? ctx.hebrewDate : null,
          s.data.showTime ? when(doc.event.startTime) : null,
          ctx.text(s.data.note),
        );
        break;
      case 'where':
        say(
          ctx.text(s.data.venue.label),
          ctx.text(s.data.venue.name),
          ctx.text(s.data.venue.address),
          ctx.text(s.data.note),
        );
        break;
      case 'venues':
        for (const v of s.data.items)
          say(
            ctx.text(v.label),
            ctx.text(v.name),
            ctx.text(v.address),
            v.date && v.date !== doc.event.date ? formatDate(v.date, ctx.locale, DAY_MONTH_YEAR) : null,
            when(v.startTime),
          );
        break;
      case 'timeline':
        say(ctx.text(s.data.title));
        for (const item of s.data.items) say(`${when(item.time)} ${ctx.text(item.label)}`);
        break;
      case 'faq':
        say(ctx.text(s.data.title));
        for (const item of s.data.items) say(ctx.text(item.q), ctx.text(item.a));
        break;
      case 'gifts':
        say(ctx.text(s.data.title), ctx.text(s.data.body));
        break;
      case 'rsvp':
        say(ctx.text(s.data.title), ctx.text(s.data.subtitle));
        break;
      case 'footer':
        say(ctx.text(s.data.closingLine));
        break;
      default:
        // countdown, gallery, reveal: nothing to read
        break;
    }
  }
  // at a paragraph, within the limit
  let text = '';
  for (const p of out) {
    const next = text ? `${text}\n\n${p}` : p;
    if (next.length > VOICE.maxChars) break;
    text = next;
  }
  return text;
}
