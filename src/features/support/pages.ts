import { GUIDE_ARTICLES } from '@/features/guide/articles';
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
  label: string;
}

export const SUPPORT_PAGES: SupportPage[] = [
  { path: '/app/invitations', label: 'My events (home)' },
  {
    path: '/app/invitations/new',
    label: 'Create a new event (the three-question start, then the design gallery)',
  },
  {
    path: '/app/invitations/:id',
    label: 'The event home: countdown, the next step, budget gauge, RSVPs, tasks, the road',
  },
  { path: '/app/invitations/:id/edit', label: 'Edit the invitation design: design, text, RSVP questions' },
  { path: '/app/invitations/:id/plan/tasks', label: 'Plan: tasks and the calendar' },
  { path: '/app/invitations/:id/plan/budget', label: 'Plan: budget gauge, categories, payments, what if' },
  { path: '/app/invitations/:id/plan/vendors', label: 'Plan: vendors, quotes, closing a vendor' },
  { path: '/app/invitations/:id/plan/ideas', label: 'Plan: notes and ideas board' },
  { path: '/app/invitations/:id/guests', label: 'Invite: guest list, WhatsApp sending, RSVP status' },
  { path: '/app/invitations/:id/responses', label: 'Invite: RSVP responses' },
  { path: '/app/invitations/:id/share', label: 'Invite: send & share, links and QR code' },
  { path: '/app/invitations/:id/seating', label: 'Arrange: seating plan' },
  { path: '/app/invitations/:id/live', label: 'Celebrate: the event day, entrance check-in' },
  { path: '/app/invitations/:id/gallery', label: 'Celebrate: live photo gallery and the hall screen' },
  { path: '/app/invitations/:id/gallery/film', label: 'Celebrate: the moments film' },
  { path: '/app/invitations/:id/insights', label: 'Insights: views and opening statistics' },
  {
    path: '/app/invitations/:id/settings',
    label: 'Event settings: details, planning settings, package, duplicate, archive',
  },
  { path: '/app/guide', label: 'The written guide (all articles, search, FAQ)' },
  { path: '/app/account', label: 'Account settings' },
  { path: '/app/billing', label: 'Plans, billing and invoices' },
  { path: '/app/support', label: 'Support tickets' },
  { path: '/app/support/new', label: 'Open a new ticket ("Talk to a person")' },
  { path: '/contact', label: 'The public contact form' },
  { path: '/terms', label: 'Terms of use' },
  { path: '/privacy', label: 'Privacy policy' },
  { path: '/cookies', label: 'Cookies' },
  { path: '/accessibility', label: 'Accessibility statement' },
  { path: '/login', label: 'Log in' },
  { path: '/signup', label: 'Sign up' },
];

/** SUPPORT_PAGES, one per line, for the `<pages>` block of the system prompt. */
export function supportPagesList(): string {
  return SUPPORT_PAGES.map((p) => `- ${p.path} — ${p.label}`).join('\n');
}

const BY_PATH = new Map(SUPPORT_PAGES.map((p) => [p.path, p]));
const GUIDE_SLUGS = new Set(GUIDE_ARTICLES.map((a) => a.slug));

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
  return invitationId ? page.path.replace(':id', invitationId) : null;
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
