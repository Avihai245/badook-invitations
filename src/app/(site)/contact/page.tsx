import { Bot, Building2, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { legalContext } from '@/features/legal/context';
import { ContactForm } from '@/features/site/ContactForm.client';
import { SiteFooter } from '@/features/site/SiteFooter';
import { SiteHeader } from '@/features/site/SiteHeader.client';
import { getUi } from '@/lib/i18n/server';

const TOPICS = ['support', 'billing', 'privacy', 'accessibility', 'business', 'other'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return {
    title: t.site.contact.title,
    description: t.site.contact.description,
    robots: { index: true, follow: true },
  };
}

/** /contact — the contact form and the operator's details (the ones set in the deployment). */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [{ locale, t }, { topic }] = await Promise.all([getUi(), searchParams]);
  const c = t.site.contact;
  const o = legalContext(locale).operator;
  const details = [
    o.name ? { icon: <Building2 />, label: c.company, value: o.name } : null,
    o.email ? { icon: <Mail />, label: c.email, value: o.email, href: `mailto:${o.email}` } : null,
    o.phone
      ? { icon: <Phone />, label: c.phone, value: o.phone, href: `tel:${o.phone.replace(/[^\d+]/g, '')}` }
      : null,
    o.address ? { icon: <MapPin />, label: c.address, value: o.address } : null,
  ].filter((d) => d !== null);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="border-b border-line bg-[radial-gradient(60%_120%_at_85%_0%,#F8E3D6,transparent_70%)]">
          <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-10 sm:px-6">
            <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.01em] sm:text-[44px]">
              {c.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[16px] text-pretty text-muted">{c.subtitle}</p>
          </div>
        </div>
        <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
          <ContactForm defaultTopic={TOPICS.find((x) => x === topic) ?? 'support'} />
          <aside className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-[18px] border border-brand-line bg-brand-soft/60 p-5 text-[14px]">
              <Bot aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
              <p className="text-pretty">{c.assistant}</p>
            </div>
            {details.length ? (
              <div className="rounded-[18px] border border-line bg-surface p-5">
                <h2 className="text-[15px] font-bold">{c.details}</h2>
                <dl className="mt-3 flex flex-col gap-3 text-[14px]">
                  {details.map((d) => (
                    <div key={d.label} className="flex items-start gap-3">
                      <dt className="mt-0.5 text-muted [&_svg]:size-4">
                        {d.icon}
                        <span className="sr-only">{d.label}</span>
                      </dt>
                      <dd className="min-w-0 break-words">
                        {'href' in d && d.href ? (
                          <a
                            href={d.href}
                            className="font-medium underline-offset-2 hover:underline"
                            dir="ltr"
                          >
                            {d.value}
                          </a>
                        ) : (
                          d.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
