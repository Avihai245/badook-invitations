// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictEntries, t } from '@/features/invitations/i18n/dictionary';
import { setGuest } from '@/features/invitations/renderer/guest.client';
import { LOCALES } from '@/features/invitations/contracts/types';
import { RSVP_NOTES, showsAnswersNote } from '@/features/invitations/sections/rsvp/notes';
import { RsvpForm, type RsvpFormConfig } from '@/features/invitations/sections/rsvp/RsvpForm.client';
import { RSVP_KEYS } from '@/features/invitations/sections/rsvp/strings';

// The guest's side of the RSVP form: where a reply is remembered, the site's samples, the privacy note.

const config = (slug: string): RsvpFormConfig => ({
  slug,
  locale: 'he',
  intl: 'he-IL',
  strings: dictEntries('he', RSVP_KEYS),
  notes: RSVP_NOTES.he,
  askChildren: false,
  maxAdults: 2,
  maxChildren: 0,
  requirePhone: false,
  requireEmail: false,
  askEmail: false,
  nameFormat: 'full',
  askMessage: false,
  perAttendeeDetails: false,
  dietary: { enabled: false, options: [], note: null },
  customQuestions: [],
  messageLabel: '',
  successMessage: 'תודה, נתראה!',
  declineMessage: 'חבל!',
  closedMessage: '',
  calendar: null,
  submitMode: 'api',
});

let now = 1_790_000_000_000;
let sent: Record<string, unknown>[] = [];

function answer(body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return { json: async () => body } as Response;
    }),
  );
}

/** Coming, with the name typed (or prefilled), sent well after the form appeared. */
async function replyYes(name?: string) {
  fireEvent.click(screen.getByLabelText(t('he', 'rsvp.yes')));
  if (name)
    fireEvent.change(screen.getByLabelText(new RegExp(t('he', 'rsvp.fullName'))), {
      target: { value: name },
    });
  now += 10_000;
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: t('he', 'rsvp.submit') }));
  });
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  window.localStorage.clear();
  sent = [];
});
afterEach(() => {
  cleanup();
  act(() => setGuest(null));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RSVP form', () => {
  it('says where the reply goes, with the privacy policy', () => {
    render(<RsvpForm config={config('privacy-note')} />);
    fireEvent.click(screen.getByLabelText(t('he', 'rsvp.no')));
    expect(screen.getByText(RSVP_NOTES.he.privacy, { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: RSVP_NOTES.he.privacyLink }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it('a sample invitation: the usual thank-you, a note that nothing was sent, and nothing remembered', async () => {
    answer({ ok: true, responseId: 'r-demo', editToken: 'x'.repeat(43), demo: true });
    render(<RsvpForm config={config('demo-sample')} />);
    await replyYes('דנה לוי');
    expect(await screen.findByText('תודה, נתראה!')).toBeTruthy();
    expect(screen.getByText(RSVP_NOTES.he.demo)).toBeTruthy();
    expect(window.localStorage.getItem('rsvp:demo-sample')).toBeNull();
  });

  it("a personal link's reply is remembered for that guest only — never another guest's edit token", async () => {
    // the same browser answered through the general link before
    window.localStorage.setItem(
      'rsvp:shared-browser',
      JSON.stringify({ responseId: 'r-general', editToken: 'general-token-0123456789' }),
    );
    act(() =>
      setGuest({ token: 'GuestTokenBBBBBBBB', name: 'יוסף כהן', phone: '+972527654321', partySize: 1 }),
    );
    answer({ ok: true, responseId: 'r-yossef', editToken: 'yossef-token-0123456789' });
    render(<RsvpForm config={config('shared-browser')} />);
    expect(screen.queryByText(t('he', 'rsvp.alreadyReplied'))).toBeNull();
    await replyYes();
    await screen.findByText('תודה, נתראה!');
    expect(sent[0]).toMatchObject({ guestToken: 'GuestTokenBBBBBBBB' });
    expect(sent[0]).not.toHaveProperty('editToken');
    expect(JSON.parse(window.localStorage.getItem('rsvp:shared-browser:GuestTokenBBBBBBBB')!)).toMatchObject({
      responseId: 'r-yossef',
      editToken: 'yossef-token-0123456789',
    });
    expect(JSON.parse(window.localStorage.getItem('rsvp:shared-browser')!)).toMatchObject({
      responseId: 'r-general',
    });
  });
});

// Version 2 of the legal documents: the extra line on who sees the answers. The page is cached, so the flag
// comes in the form's config (the server data the page computes); without it the form is as it was.
describe('RSVP form: the line on who sees the answers (legal documents, version 2)', () => {
  const asks = (over: Partial<RsvpFormConfig>): RsvpFormConfig => ({
    ...config('answers-note'),
    requirePhone: true,
    ...over,
  });
  const note = () => screen.queryByTestId('rsvp-answers-note');

  it('shows with a custom question, names the hosts, and links to the privacy request form', () => {
    render(
      <RsvpForm
        config={asks({
          legalNotice: true,
          customQuestions: [{ id: 'q1', type: 'text', required: false, label: 'מה לשתות?' }],
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText(t('he', 'rsvp.no')));
    expect(note()?.textContent).toContain(RSVP_NOTES.he.answers);
    expect(screen.getByRole('link', { name: RSVP_NOTES.he.answersLink }).getAttribute('href')).toBe(
      '/privacy-request',
    );
    // the existing note and its link to the policy are still there
    expect(screen.getByRole('link', { name: RSVP_NOTES.he.privacyLink }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it('is not there without version 2, whatever the form asks', () => {
    render(
      <RsvpForm
        config={asks({
          customQuestions: [{ id: 'q1', type: 'text', required: false, label: 'מה לשתות?' }],
          askEmail: true,
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText(t('he', 'rsvp.no')));
    expect(note()).toBeNull();
    expect(screen.getByText(RSVP_NOTES.he.privacy, { exact: false })).toBeTruthy();
  });

  it('is not there when the form asks only for what it requires', () => {
    render(<RsvpForm config={asks({ legalNotice: true })} />);
    fireEvent.click(screen.getByLabelText(t('he', 'rsvp.no')));
    expect(note()).toBeNull();
  });

  it('is decided by custom questions, dietary needs, and an optional email or phone', () => {
    const base = {
      legalNotice: true,
      customQuestions: [] as unknown[],
      askEmail: false,
      requireEmail: false,
      requirePhone: true,
      dietary: { enabled: false },
    };
    expect(showsAnswersNote(base)).toBe(false);
    expect(showsAnswersNote({ ...base, customQuestions: [{}] })).toBe(true);
    expect(showsAnswersNote({ ...base, dietary: { enabled: true } })).toBe(true);
    expect(showsAnswersNote({ ...base, askEmail: true })).toBe(true);
    expect(showsAnswersNote({ ...base, askEmail: true, requireEmail: true })).toBe(false);
    expect(showsAnswersNote({ ...base, requirePhone: false })).toBe(true);
    expect(showsAnswersNote({ ...base, legalNotice: false, customQuestions: [{}] })).toBe(false);
  });

  it('is written in every language of the invitation: literal, and not a copy of another', () => {
    const seen = new Set<string>();
    for (const l of LOCALES) {
      const { answers, answersLink } = RSVP_NOTES[l];
      expect(answers.trim(), l).toBeTruthy();
      expect(answersLink.trim(), l).toBeTruthy();
      expect(answers, l).not.toMatch(/\{\w+\}/);
      expect(seen.has(answers), l).toBe(false);
      seen.add(answers);
    }
    // the same keys everywhere
    for (const l of LOCALES)
      expect(Object.keys(RSVP_NOTES[l]).sort()).toEqual(Object.keys(RSVP_NOTES.en).sort());
    expect(RSVP_NOTES.he.answers).toContain('מארחים');
    expect(RSVP_NOTES.en.answers).toContain('hosts');
  });
});
