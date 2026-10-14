import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The public forms (features/legal-requests/ui): the collection notice prints only the operator details
// that are filled in, the fields are labelled, and the reference field appears only without a valid link.

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

const { CollectionNotice } = await import('@/features/legal-requests/ui/CollectionNotice');
const { ReportForm } = await import('@/features/legal-requests/ui/ReportForm.client');
const { PrivacyRequestForm } = await import('@/features/legal-requests/ui/PrivacyRequestForm.client');
const { dictFor } = await import('@/lib/i18n/dict');

const he = dictFor('he').legalRequests;
const en = dictFor('en').legalRequests;
const operator = { name: 'Badook Ltd', id: '', address: '', phone: '', email: 'hello@example.com' };

describe('the collection notice', () => {
  it('names the controller with the filled-in details only, and links to the policy and the rights form', () => {
    const html = renderToStaticMarkup(<CollectionNotice kind="report" t={en.notice} operator={operator} />);
    expect(html).toContain('Badook Ltd');
    expect(html).toContain('Email: hello@example.com');
    expect(html).not.toContain('Company number');
    expect(html).not.toContain('Address:');
    expect(html).not.toContain('Phone:');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/privacy-request"');
    expect(html).toContain('not required by law');
    expect(html).toContain('but not who made it');
  });

  it('is in Hebrew too, and the request variant says what a missing name or email means', () => {
    const html = renderToStaticMarkup(<CollectionNotice kind="request" t={he.notice} operator={operator} />);
    expect(html).toContain('אינה חובה על פי דין');
    expect(html).toContain('בלעדיהם לא נוכל לטפל בה');
  });
});

describe('the report form', () => {
  const form = (token: { g?: string; a?: string; i?: string }) =>
    renderToStaticMarkup(<ReportForm t={en.report} locale="en" token={token} notice={<p>NOTICE</p>} />);

  it('asks where the content is only without a gallery link (the link is checked by the server once the page is open)', () => {
    expect(form({})).toContain('name="reference"');
    expect(form({ i: 'x' })).toContain('name="reference"');
    expect(form({ g: 'abcdefghijklmnopqrstuvwx', i: 'x' })).not.toContain('name="reference"');
    expect(form({ a: 'abcdefghijklmnopqrstuvwx', i: 'x' })).not.toContain('name="reference"');
    expect(form({ g: 'abcdefghijklmnopqrstuvwx', i: 'x' })).toContain(en.report.linkedItem);
  });

  it('a link to the gallery without an item asks which photo (who uploaded it, when, what it shows)', () => {
    const html = form({ g: 'abcdefghijklmnopqrstuvwx' });
    expect(html).toContain('name="reference"');
    expect(html).toContain(en.report.reference.labelGallery);
    expect(html).toContain(en.report.reference.helpGallery);
    expect(html).toContain(en.report.linkedGallery);
    // no text says that no explanation is needed
    for (const text of [en.report.linkedGallery, en.report.reference.helpGallery, en.report.contact.intro])
      expect(text).not.toMatch(/no need|not needed|nothing to add/i);
  });

  it('calls the child category “A child”', () => {
    expect(en.report.category.options.child_safety).toBe('A child');
    expect(he.report.category.options.child_safety).toBe('ילד/ה');
    expect(en.report.category.help.child_safety).toMatch(/photo or details of a child/);
  });

  it('has labelled fields, the honeypot, and the notice right before the button', () => {
    const html = form({ g: 'abcdefghijklmnopqrstuvwx', i: 'x' });
    for (const name of ['category', 'role', 'description', 'name', 'email', 'phone'])
      expect(html).toMatch(
        new RegExp(`<label[^>]*for="[^"]+"[^>]*>[\\s\\S]*?</label>[\\s\\S]*?name="${name}"`),
      );
    expect(html).toContain('name="website"');
    expect(html.indexOf('NOTICE')).toBeLessThan(html.indexOf(en.report.submit));
    // "intimate" shows for the harmful category only
    expect(html).not.toContain(en.report.intimate.label);
  });
});

describe('the privacy request form', () => {
  it('pre-selects the kind asked for (a child’s photo) and has the required fields', () => {
    const html = renderToStaticMarkup(
      <PrivacyRequestForm
        t={en.privacyRequest}
        locale="en"
        defaultKind="child_photo"
        notice={<p>NOTICE</p>}
      />,
    );
    expect(html).toMatch(/<option value="child_photo" selected/);
    for (const name of ['name', 'email', 'phone', 'details', 'reference'])
      expect(html).toContain(`name="${name}"`);
    expect(html.indexOf('NOTICE')).toBeLessThan(html.indexOf(en.privacyRequest.submit));
  });
});
