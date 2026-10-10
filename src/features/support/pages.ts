import { GUIDE_SLUGS as SLUGS } from '@/features/guide/catalog';
/**
 * Every screen of the app the support assistant may point someone to — always as a real link, never
 * just named in words. chat.ts's systemPrompt() renders SUPPORT_PAGES under a `<pages>` block and tells
 * the model to write `[label](path)` with a path from here. One specific design from the catalog is a
 * different shape — `/app/invitations/new?template=<id>` — handled separately below, since the id isn't
 * one of a fixed list of screens but any of the (changing) real, listed template ids (chat.ts's own
 * `<templates>` block, sourced from the same template registry, lists those for the model).
 *
 * A path containing ":id" is one of an invitation's own tabs: the literal token stands for whichever
 * invitation the visitor is already on — the same masking screenOf() (chat.ts) gives the model for its
 * own current screen, so the model is never shown, and can never guess, a real id. resolveSupportPath()
 * below substitutes the visitor's real current id back in, and only when there is one to substitute;
 * SupportChat.client.tsx never renders a ":id" link otherwise.
 */
export interface SupportPage {
  path: string;
  /** Its name in Hebrew, the link's text when the assistant wrote a bare path. */
  he: string;
  label: string;
}

export const SUPPORT_PAGES: SupportPage[] = [
  { path: '/app/invitations', he: 'האירועים שלי', label: 'My events (home)' },
  {
    path: '/app/invitations/new',
    he: 'אירוע חדש',
    label: 'Create a new event (the three-question start, then the design gallery)',
  },
  {
    path: '/app/invitations/:id',
    he: 'בית האירוע',
    label: 'The event home: countdown, the next step, budget gauge, RSVPs, tasks, the road',
  },
  {
    path: '/app/invitations/:id/edit',
    he: 'עיצוב ההזמנה',
    label: 'Edit the invitation design: design, text, RSVP questions',
  },
  {
    path: '/app/invitations/:id/plan',
    he: 'תכנון האירוע',
    label: 'Planning: its first-run setup (once planned, it opens the event home)',
  },
  { path: '/app/invitations/:id/plan/tasks', he: 'משימות', label: 'Plan: tasks and the calendar' },
  {
    path: '/app/invitations/:id/plan/budget',
    he: 'תקציב',
    label: 'Plan: budget gauge, categories, payments, what if',
  },
  {
    path: '/app/invitations/:id/plan/vendors',
    he: 'ספקים',
    label: 'Plan: vendors, quotes, closing a vendor',
  },
  { path: '/app/invitations/:id/plan/ideas', he: 'פתקים ורעיונות', label: 'Plan: notes and ideas board' },
  {
    path: '/app/invitations/:id/guests',
    he: 'מוזמנים',
    label: 'Invite: guest list, WhatsApp sending, RSVP status',
  },
  {
    path: '/app/invitations/:id/guests/whatsapp',
    he: 'הודעות וואטסאפ',
    label:
      'Invite: WhatsApp messages — send any approved message now (invitation, RSVP reminder, event reminder, thank-you, album) or smart scheduling (Basic/Advanced/Smart/Premium sequences), previews and what was sent',
  },
  { path: '/app/invitations/:id/responses', he: 'אישורי הגעה', label: 'Invite: RSVP responses' },
  {
    path: '/app/invitations/:id/share',
    he: 'שליחה ושיתוף',
    label: 'Invite: send & share, links and QR code',
  },
  { path: '/app/invitations/:id/seating', he: 'סידור שולחנות', label: 'Arrange: seating plan' },
  {
    path: '/app/invitations/:id/seating/cards',
    he: 'כרטיסי שולחן',
    label: 'Arrange: table cards for printing',
  },
  {
    path: '/app/invitations/:id/seating/print',
    he: 'הדפסת סידור השולחנות',
    label: 'Arrange: printable seating chart',
  },
  {
    path: '/app/invitations/:id/live',
    he: 'יום האירוע',
    label: 'Celebrate: the event day, entrance check-in',
  },
  {
    path: '/app/invitations/:id/gallery/album',
    he: 'האלבום שאחרי האירוע',
    label: 'Celebrate: the album after the event — its settings, cover, link and the thank-you to guests',
  },
  {
    path: '/app/invitations/:id/gallery/ai',
    he: 'צילומי AI עם בעלי השמחה',
    label: 'Celebrate: AI photos with the people of honor — their photos, consent, limits, the photos made',
  },
  {
    path: '/app/invitations/:id/gallery/film',
    he: 'סרט הרגעים',
    label: 'Celebrate: the moments film, made from the gallery',
  },
  {
    path: '/app/invitations/:id/gallery',
    he: 'גלריה חיה ומסך באולם',
    label: 'Celebrate: live photo gallery and the hall screen',
  },
  {
    path: '/app/invitations/:id/insights',
    he: 'תובנות',
    label: 'Insights: views and opening statistics',
  },
  {
    path: '/app/invitations/:id/settings',
    he: 'הגדרות האירוע',
    label: 'Event settings: details, planning settings, package, duplicate, archive',
  },
  { path: '/app/guide', he: 'המדריך', label: 'The written guide (all articles, search, FAQ)' },
  { path: '/app/account', he: 'הגדרות החשבון', label: 'Account settings' },
  { path: '/app/billing', he: 'חבילות ותשלומים', label: 'Plans, billing and invoices' },
  { path: '/app/support', he: 'תמיכה', label: 'Support tickets' },
  { path: '/app/support/new', he: 'פנייה חדשה לצוות', label: 'Open a new ticket ("Talk to a person")' },
  { path: '/contact', he: 'טופס יצירת קשר', label: 'The public contact form' },
  { path: '/terms', he: 'תנאי השימוש', label: 'Terms of use' },
  { path: '/privacy', he: 'מדיניות הפרטיות', label: 'Privacy policy' },
  { path: '/cookies', he: 'מדיניות עוגיות', label: 'Cookies' },
  { path: '/accessibility', he: 'הצהרת נגישות', label: 'Accessibility statement' },
  { path: '/login', he: 'התחברות', label: 'Log in' },
  { path: '/signup', he: 'הרשמה', label: 'Sign up' },
];

/** SUPPORT_PAGES, one per line, for the `<pages>` block of the system prompt. */
export function supportPagesList(): string {
  return SUPPORT_PAGES.map((p) => `- ${p.path} — ${p.label}`).join('\n');
}

const BY_PATH = new Map(SUPPORT_PAGES.map((p) => [p.path, p]));
const GUIDE_SLUGS = new Set<string>(SLUGS);

/** The invitation id in a real (unmasked) pathname, when the visitor is on one of its own pages. */
export function currentInvitationId(pathname: string): string | null {
  const id = /^\/app\/invitations\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
  return id && id !== 'new' ? id : null;
}

/**
 * A design's id in a `/app/invitations/new?template=<id>` link (chat.ts's <templates> lists the real
 * ones for the model). Only the shape is checked here — real membership is the model's job (grounded in
 * <templates>) and, at the destination, TemplateGallery's own (initialPreview()): an id that doesn't
 * exist there just opens the plain gallery, same as no id at all.
 */
const TEMPLATE_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

/**
 * A candidate path from the assistant's answer → a real, known destination, or null when it matches
 * none of SUPPORT_PAGES. A ":id" screen only resolves with `invitationId` given (the visitor's current
 * invitation, from currentInvitationId()) — never left as the literal ":id", and never guessed. The one
 * path that takes a query string is /app/invitations/new?template=<id>, for one specific design; every
 * other candidate with a "?" is rejected, same as one that matches nothing at all.
 */
export function resolveSupportPath(candidate: string, invitationId: string | null): string | null {
  const at = candidate.indexOf('?');
  const path = at === -1 ? candidate : candidate.slice(0, at);
  if (at !== -1) {
    if (path !== '/app/invitations/new') return null;
    const params = new URLSearchParams(candidate.slice(at + 1));
    const id = params.get('template');
    return id && TEMPLATE_ID.test(id) && [...params.keys()].every((k) => k === 'template')
      ? `/app/invitations/new?template=${id}`
      : null;
  }
  // one article of the written guide: /app/guide/<slug>, when that article exists
  const guide = /^\/app\/guide\/([a-z0-9-]+)\/?$/.exec(path)?.[1];
  if (guide) return GUIDE_SLUGS.has(guide) ? `/app/guide/${guide}` : null;
  const page = BY_PATH.get(path.replace(/\/+$/, ''));
  if (!page) return null;
  if (!page.path.includes(':id')) return page.path;
  // no invitation open to fill ":id" with: the invitation list, where they pick one — still a link,
  // never the literal placeholder and never a guessed id
  return invitationId ? page.path.replace(':id', invitationId) : '/app/invitations';
}

/**
 * The assistant's raw answer, before any parsing: some models JSON-escape slashes ("\/app\/…") or
 * wrap a path in backticks — both would hide a real screen from the link parser and show a path instead.
 */
export function normalizeAnswer(text: string): string {
  return text.replace(/\\\//g, '/').replace(/`(\/[^`\s]*)`/g, '$1');
}

/** A known path's human name (Hebrew or the English label), for a link the assistant wrote as a bare path — so a path never shows as text. */
export function supportPageName(candidate: string, locale: 'he' | 'en'): string | null {
  const bare = candidate.split('?')[0]!.replace(/\/+$/, '');
  const page = BY_PATH.get(bare);
  // one of the guide's articles: named as the guide
  if (!page && GUIDE_SLUGS.has(/^\/app\/guide\/([a-z0-9-]+)$/.exec(bare)?.[1] ?? ''))
    return locale === 'en' ? 'The guide' : 'המדריך';
  if (!page)
    return candidate.startsWith('/app/invitations/new?')
      ? locale === 'en'
        ? 'Open the design'
        : 'לפתיחת העיצוב'
      : null;
  return locale === 'en' ? page.label.split(/[:,(]/)[0]!.trim() : page.he;
}

/** A word of a label: letters, digits, or a quote mark inside one (״הזמנות״, don't) — never a path or punctuation. */
const WORD = '[\\p{L}\\p{N}\'"׳״]+';
/** "label (path)", the assistant's own words followed by the raw path it was told never to show. */
const LABELED_PATH = new RegExp(`((?:${WORD}[\\s-]){0,3}${WORD})\\s*\\((\\/[^\\s()]*)\\)`, 'gu');

/**
 * A safety net for when the assistant names a screen but, despite systemPrompt()'s instruction, still
 * writes its raw path next to the words instead of turning them into the link — "סידור שולחנות
 * (/app/invitations/:id/seating)" becomes "[סידור שולחנות](/app/invitations/:id/seating)", which then
 * renders exactly as if the assistant had written it correctly: SupportChat.client.tsx's own Inline
 * resolves a "[label](path)" it parses through this same resolveSupportPath(), substituting the real id
 * for ":id" at render time — so the path kept here is the candidate as written (":id" and all), never
 * pre-resolved (a real id wouldn't match SUPPORT_PAGES on that second, later resolution). Only a path
 * resolveSupportPath() actually recognizes is turned into a link; unrelated parenthetical text is left
 * exactly as written, and a path already inside a proper [label](path) is never matched here in the
 * first place (the character right before "(" there is "]", not a word).
 */
export function linkifyLabeledPaths(text: string, invitationId: string | null): string {
  return text.replace(LABELED_PATH, (whole, label: string, path: string) =>
    resolveSupportPath(path, invitationId) ? `[${label}](${path})` : whole,
  );
}
