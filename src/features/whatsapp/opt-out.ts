/**
 * Whether a message to the system's WhatsApp number asks to stop getting messages: a STOP-like word,
 * alone or with one more ("הסר", "STOP!", "הסירו אותי", "Stop promotions") — anything longer is a guest
 * talking, not a request. The webhook puts the phone on the do-not-send list.
 */
const STOP_WORDS = new Set([
  'stop',
  'unsubscribe',
  'הסר',
  'הסרה',
  'הסירו',
  'להסיר',
  'עצור',
  'בטל',
  'הפסק',
  'הפסיקו',
]);

export function isStopRequest(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.length <= 2 && STOP_WORDS.has(words[0]!);
}
