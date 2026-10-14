// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/app';
import { HintProvider } from '@/components/app/Hint';
import { GuestDialog } from '@/features/invitations/app/guests/GuestDialog';
import { ImportDialog } from '@/features/invitations/app/guests/ImportDialog';
import { AiNote } from '@/features/legal/notices/AiNote.client';
import { CollectionNote } from '@/features/legal/notices/CollectionNote';
import { LegalNoticesProvider } from '@/features/legal/notices/flag.client';
import type { PlanVendor } from '@/features/planning/model/plan';
import { QuickAddVendor } from '@/features/planning/ui/vendors/QuickAddVendor';
import { VendorDrawer } from '@/features/planning/ui/vendors/VendorDrawer';
import { ContactForm } from '@/features/site/ContactForm.client';
import { ContactNotice } from '@/features/site/ContactNotice';
import { SupportChat } from '@/features/support/SupportChat.client';
import { ChatHandoff } from '@/features/support/tickets/ui/ChatHandoff.client';
import { NewTicket } from '@/features/support/tickets/ui/NewTicket.client';
import { dictFor } from '@/lib/i18n/dict';
import { UiProvider } from '@/lib/i18n/provider';

// The collection notices of version 2 of the legal documents (Privacy Protection Law s.11) at the places
// that had none: each shows with version 2 in force and leaves the screen exactly as it was without it;
// each is short, with the long form in a disclosure, and links to the right part of the right document.

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => '/app/invitations',
}));

const he = dictFor('he').collectionNotes;
const en = dictFor('en').collectionNotes;

type Locale = 'he' | 'en';
function show(ui: ReactNode, active: boolean, locale: Locale = 'he') {
  return render(
    <UiProvider locale={locale}>
      <ToastProvider label="t" viewportLabel="t" closeLabel="x">
        <HintProvider>
          <LegalNoticesProvider active={active}>{ui}</LegalNoticesProvider>
        </HintProvider>
      </ToastProvider>
    </UiProvider>,
  );
}
const href = (el: HTMLElement) => el.getAttribute('href');

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('the notice component', () => {
  it('is a short text with a disclosure for the long form, and links that say they open a new tab', () => {
    const html = renderToStaticMarkup(
      <CollectionNote
        title="Title"
        more="More"
        newTab="(new tab)"
        rows={[
          { label: 'Voluntary', value: 'Yes' },
          { label: 'Empty', value: '' },
        ]}
        links={[{ href: '/privacy#roles', label: 'Policy' }]}
      >
        Short text
      </CollectionNote>,
    );
    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="Title"');
    expect(html).toContain('<summary');
    expect(html).toContain('Voluntary');
    expect(html).not.toContain('Empty');
    expect(html).toContain('href="/privacy#roles"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('(new tab)');
    // a notice, not a consent: nothing to tick
    expect(html).not.toContain('type="checkbox"');
  });

  it('leaves the disclosure out when there is nothing to put in it', () => {
    const html = renderToStaticMarkup(
      <CollectionNote title="T" more="More" newTab="x">
        Short
      </CollectionNote>,
    );
    expect(html).not.toContain('<details');
  });
});

describe('the guest list dialogs (host-facing)', () => {
  const props = {
    id: 'inv-1',
    guest: null,
    locales: ['he'] as const,
    defaultLocale: 'he' as const,
    onClose: () => {},
    onSaved: () => {},
    onLimit: () => {},
  };

  it('adding a guest: the host decides and answers for being allowed; links to who is responsible for what', () => {
    show(<GuestDialog {...props} />, true);
    const note = screen.getByTestId('guests-note');
    expect(note.textContent).toContain(he.guests.short);
    expect(note.textContent).toContain(he.guests.add.voluntary);
    expect(note.textContent).toContain(he.guests.recipients);
    expect(note.querySelector('details')).toBeTruthy();
    expect(href(within(note).getByRole('link'))).toBe('/privacy#roles');
    expect(within(note).getByRole('link').getAttribute('target')).toBe('_blank');
    // no consent box was added to the form
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('adding a guest: nothing new without version 2', () => {
    show(<GuestDialog {...props} />, false);
    expect(screen.queryByTestId('guests-note')).toBeNull();
    expect(document.body.textContent).not.toContain(he.guests.short);
  });

  it('uploading a file: the notice says which columns are read and that a nameless row is not imported', () => {
    show(<ImportDialog id="inv-1" maxGuests={100} onClose={() => {}} onImported={() => {}} />, true);
    const note = screen.getByTestId('guests-note');
    expect(note.textContent).toContain(he.guests.import.voluntary);
    expect(note.textContent).not.toContain(he.guests.add.voluntary);
    expect(href(within(note).getByRole('link'))).toBe('/privacy#roles');
  });

  it('uploading a file: nothing new without version 2', () => {
    show(<ImportDialog id="inv-1" maxGuests={100} onClose={() => {}} onImported={() => {}} />, false);
    expect(screen.queryByTestId('guests-note')).toBeNull();
  });

  it('speaks English too', () => {
    show(<GuestDialog {...props} />, true, 'en');
    expect(screen.getByTestId('guests-note').textContent).toContain(en.guests.short);
  });
});

describe('the planning forms', () => {
  const add = () => <QuickAddVendor open onOpenChange={() => {}} category={null} onAdd={() => undefined} />;

  it('the vendor form says the contacts are the host’s and links to the planning section', () => {
    show(add(), true);
    const note = screen.getByTestId('planning-note');
    expect(note.textContent).toContain(he.planning.vendor);
    expect(href(within(note).getByRole('link'))).toBe('/privacy#planning');
  });

  it('is described by the field it sits under, and absent without version 2', () => {
    const { unmount } = show(add(), true);
    const phone = screen.getAllByRole('textbox').find((i) => i.getAttribute('type') === 'tel')!;
    const described = phone.getAttribute('aria-describedby') ?? '';
    expect(described).toBeTruthy();
    expect(document.getElementById(described.split(' ')[0]!)?.textContent).toContain(he.planning.vendor);
    unmount();
    show(add(), false);
    expect(screen.queryByTestId('planning-note')).toBeNull();
    const plain = screen.getAllByRole('textbox').find((i) => i.getAttribute('type') === 'tel')!;
    expect(plain.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('the vendor details', () => {
  const vendor: PlanVendor = {
    id: '44444444-4444-4444-8444-444444444441',
    name: 'Garden Hall',
    category: 'venue',
    phone: null,
    email: null,
    url: null,
    status: 'idea',
    quoteAmount: null,
    paymentTerms: null,
    included: null,
    rating: null,
    notes: null,
    attachments: [],
    sort: 10,
  };
  const drawer = () => (
    <VendorDrawer
      vendor={vendor}
      exportEnabled={false}
      onDismiss={() => {}}
      onSave={() => {}}
      onDelete={() => {}}
    />
  );

  it('carries the one-line note under the phone and email, only with version 2', () => {
    const { unmount } = show(drawer(), true, 'en');
    const note = screen.getByTestId('planning-note');
    expect(note.textContent).toContain(en.planning.vendor);
    expect(href(within(note).getByRole('link'))).toBe('/privacy#planning');
    unmount();
    show(drawer(), false, 'en');
    expect(screen.queryByTestId('planning-note')).toBeNull();
  });
});

describe('the contact form', () => {
  const t = dictFor('en');
  const operator = { name: 'Badook Ltd', id: '', address: '', phone: '', email: 'hello@example.com' };

  it('names the controller with the filled-in details only, and links to the rights form and the policy', () => {
    const html = renderToStaticMarkup(<ContactNotice t={t} operator={operator} />);
    expect(html).toContain('Badook Ltd');
    expect(html).toContain('Email: hello@example.com');
    expect(html).not.toContain('Company number');
    expect(html).not.toContain('Address:');
    expect(html).not.toContain('Phone:');
    expect(html).toContain('href="/privacy-request"');
    expect(html).toContain('href="/privacy#support"');
    expect(html).toContain(en.contact.voluntary);
    expect(html).toContain('<details');
  });

  it('is in Hebrew too', () => {
    const html = renderToStaticMarkup(<ContactNotice t={dictFor('he')} operator={operator} />);
    expect(html).toContain(he.contact.voluntary);
  });

  it('replaces the one-line privacy text above the button when it is given, and changes nothing without it', () => {
    const sent = t.tickets.contactSent;
    const { unmount } = show(
      <ContactForm sent={sent} notice={<p data-testid="slot">NOTICE</p>} />,
      true,
      'en',
    );
    expect(screen.getByTestId('slot')).toBeTruthy();
    expect(screen.queryByText(t.site.contact.privacy)).toBeNull();
    const form = screen.getByTestId('contact-form');
    const slot = form.querySelector('[data-testid="slot"]')!;
    const button = form.querySelector('button[type="submit"]')!;
    expect(slot.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    show(<ContactForm sent={sent} />, false, 'en');
    expect(screen.queryByTestId('slot')).toBeNull();
    expect(screen.getByText(t.site.contact.privacy)).toBeTruthy();
  });
});

describe('support', () => {
  it('the assistant says its answers come from an outside AI provider, and links to the support section', () => {
    show(<SupportChat />, true);
    fireEvent.click(screen.getByTestId('support-launcher'));
    fireEvent.click(document.querySelector('[data-help-tab="assistant"]')!);
    const note = screen.getByTestId('support-ai-note');
    expect(note.textContent).toContain(he.support.assistant);
    expect(note.textContent).toContain('Anthropic');
    expect(href(within(note).getByRole('link'))).toBe('/privacy#support');
  });

  it('the assistant is as it was without version 2', () => {
    show(<SupportChat />, false);
    fireEvent.click(screen.getByTestId('support-launcher'));
    fireEvent.click(document.querySelector('[data-help-tab="assistant"]')!);
    expect(screen.getByTestId('support-input')).toBeTruthy();
    expect(screen.queryByTestId('support-ai-note')).toBeNull();
  });

  const conversation = [
    { role: 'user' as const, content: 'How do I add guests?' },
    { role: 'assistant' as const, content: 'Open the guests tab.' },
  ];
  it('"talk to a person" says the conversation goes to the team and is kept in the ticket', () => {
    show(
      <ChatHandoff conversation={conversation} onBack={() => {}} onFinish={() => {}} onNavigate={() => {}} />,
      true,
    );
    const note = screen.getByTestId('handoff-note');
    expect(note.textContent).toContain(he.support.handoff);
    expect(href(within(note).getByRole('link'))).toBe('/privacy#support');
  });

  it('"talk to a person" is as it was without version 2', () => {
    show(
      <ChatHandoff conversation={conversation} onBack={() => {}} onFinish={() => {}} onNavigate={() => {}} />,
      false,
    );
    expect(screen.queryByTestId('handoff-note')).toBeNull();
  });

  const ticket = () => <NewTicket invitations={[]} defaults={{ category: 'support', invitationId: null }} />;
  it('the ticket form has a layered notice with the rights form and the support section', () => {
    show(ticket(), true, 'en');
    const note = screen.getByTestId('ticket-note');
    expect(note.textContent).toContain(en.support.ticket.short);
    expect(note.querySelector('details')).toBeTruthy();
    expect(within(note).getAllByRole('link').map(href)).toEqual(['/privacy-request', '/privacy#support']);
  });

  it('the ticket form is as it was without version 2', () => {
    show(ticket(), false, 'en');
    expect(screen.queryByTestId('ticket-note')).toBeNull();
    expect(screen.getByTestId('ticket-form')).toBeTruthy();
  });
});

describe('the host AI features', () => {
  it('say which provider processes the text or the photos, with the policy section', () => {
    show(
      <>
        <AiNote kind="text" provider="Anthropic" anchor="planning" />
        <AiNote kind="photos" provider="Anthropic" anchor="studio" />
      </>,
      true,
      'en',
    );
    const notes = screen.getAllByTestId('ai-note');
    expect(notes[0]!.textContent).toContain('The text is sent to Anthropic');
    expect(notes[1]!.textContent).toContain('Reduced copies of the photos you chose are sent to Anthropic');
    expect(notes.map((n) => href(within(n).getByRole('link')))).toEqual([
      '/privacy#planning',
      '/privacy#studio',
    ]);
  });

  it('show nothing without version 2', () => {
    show(<AiNote kind="text" provider="Anthropic" />, false);
    expect(screen.queryByTestId('ai-note')).toBeNull();
  });
});

describe('the strings', () => {
  const flat = (o: unknown, p = ''): [string, string][] =>
    typeof o === 'string'
      ? [[p, o]]
      : Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k));

  it('have the same keys in Hebrew and English, none empty, with the same placeholders', () => {
    const a = flat(he);
    const b = flat(en);
    expect(b.map(([k]) => k)).toEqual(a.map(([k]) => k));
    for (const [i, [key, text]] of a.entries()) {
      expect(text.trim(), key).toBeTruthy();
      expect(b[i]![1].trim(), key).toBeTruthy();
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(b[i]![1]), key).toBe(ph(text));
    }
  });

  it('are notices, never consents', () => {
    for (const [key, text] of [...flat(he), ...flat(en)])
      expect(text, key).not.toMatch(/\bI (agree|consent)\b|אני מסכים|אני מסכימה|אני מאשר/i);
  });
});
