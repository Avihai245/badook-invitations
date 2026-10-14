import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The public contact page hands the form its collection notice only while version 2 of the legal documents
// is in force (and prints only the operator details that are filled in); otherwise the form is as it was.

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ active: false }));
vi.mock('@/features/legal/context', () => ({
  legalStatus: () => ({ active: state.active }),
  legalContext: () => ({
    operator: { name: 'Badook Ltd', id: '', address: '', phone: '', email: 'hello@example.com' },
  }),
}));
vi.mock('@/lib/i18n/server', async () => {
  const { dictFor } = await import('@/lib/i18n/dict');
  return { getUi: async () => ({ locale: 'en', t: dictFor('en') }) };
});
vi.mock('@/features/site/SiteHeader.client', () => ({ SiteHeader: () => null }));
vi.mock('@/features/site/SiteFooter', () => ({ SiteFooter: () => null }));
vi.mock('@/features/site/ContactForm.client', () => ({ ContactForm: () => null }));

const { default: ContactPage } = await import('@/app/(site)/contact/page');
const { ContactForm } = await import('@/features/site/ContactForm.client');
const { ContactNotice } = await import('@/features/site/ContactNotice');

/** The props of the first <ContactForm> in the page's element tree. */
function formProps(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(formProps).find(Boolean) ?? null;
  const el = node as ReactElement<Record<string, unknown>>;
  if (el.type === ContactForm) return el.props;
  return formProps(el.props?.children);
}

describe('/contact', () => {
  beforeEach(() => {
    state.active = false;
  });

  it('gives the form no notice while version 2 is not in force', async () => {
    const page = await ContactPage({ searchParams: Promise.resolve({}) });
    expect(formProps(page)).toMatchObject({ defaultTopic: 'support' });
    expect(formProps(page)?.notice).toBeUndefined();
  });

  it('gives the form the notice, with the operator’s details, once it is', async () => {
    state.active = true;
    const page = await ContactPage({ searchParams: Promise.resolve({}) });
    const notice = formProps(page)?.notice as ReactElement<{ operator: { name: string; address: string } }>;
    expect(notice.type).toBe(ContactNotice);
    expect(notice.props.operator.name).toBe('Badook Ltd');
  });
});
