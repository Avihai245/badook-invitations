'use client';

import { CircleCheck, ExternalLink, Mail, MessageCircle, Phone } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, Drawer, Field, Input, Select, Textarea } from '@/components/app';
import { formatPhone } from '@/features/invitations/lib/phone';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_KEYS, VENDOR_STATUSES, isCategoryKey, type VendorStatus } from '../../model/categories';
import type { PlanVendor } from '../../model/plan';
import { mailLink, normalizeUrl, parseAmount, telLink, waLink } from './helpers';
import { Stars } from './Stars';
import type { VendorFields } from './useVendorActions';
import { VendorFiles } from './VendorFiles';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sameFiles = (a: PlanVendor['attachments'], b: PlanVendor['attachments']) =>
  a.length === b.length && a.every((x, i) => x.path === b[i]?.path);

/** A way to reach the vendor: a plain link, nothing is sent by the system. */
const reach =
  'inline-flex min-h-11 items-center gap-2 rounded-btn px-4 text-[14px] font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Everything about one vendor: quick ways to reach it (call, WhatsApp, email, website), all its fields,
 * the rating, notes and — with the Pro tool — files. The fields are edited together and saved with one
 * button (only what changed is sent); "close vendor" saves them and opens the closing dialog.
 */
export function VendorDrawer({
  vendor,
  exportEnabled,
  onDismiss,
  onSave,
  onDelete,
}: {
  /** the vendor shown (null: closed) */
  vendor: PlanVendor | null;
  exportEnabled: boolean;
  onDismiss: () => void;
  /** a change to the vendor's fields (a status of "booked" is a close: the screen asks how) */
  onSave: (id: string, fields: VendorFields) => void;
  onDelete: (vendor: PlanVendor) => void;
}) {
  return vendor ? (
    <DrawerBody
      key={vendor.id}
      vendor={vendor}
      exportEnabled={exportEnabled}
      onDismiss={onDismiss}
      onSave={onSave}
      onDelete={onDelete}
    />
  ) : null;
}

function DrawerBody({
  vendor,
  exportEnabled,
  onDismiss,
  onSave,
  onDelete,
}: {
  vendor: PlanVendor;
  exportEnabled: boolean;
  onDismiss: () => void;
  onSave: (id: string, fields: VendorFields) => void;
  onDelete: (vendor: PlanVendor) => void;
}) {
  const { t } = useUi();
  const V = t.planning.vendors;
  const D = V.drawer;
  const shownPhone = vendor.phone ? formatPhone(vendor.phone) : '';
  const [name, setName] = useState(vendor.name);
  const [category, setCategory] = useState<string>(vendor.category ?? '');
  const [status, setStatus] = useState<VendorStatus>(vendor.status);
  const [phone, setPhone] = useState(shownPhone);
  const [email, setEmail] = useState(vendor.email ?? '');
  const [url, setUrl] = useState(vendor.url ?? '');
  const [quote, setQuote] = useState(vendor.quoteAmount === null ? '' : String(vendor.quoteAmount));
  const [terms, setTerms] = useState(vendor.paymentTerms ?? '');
  const [included, setIncluded] = useState(vendor.included ?? '');
  const [rating, setRating] = useState<number | null>(vendor.rating);
  const [notes, setNotes] = useState(vendor.notes ?? '');
  const [files, setFiles] = useState(vendor.attachments);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'url' | 'quote', string>>>({});

  const site = normalizeUrl(url);
  const links = [
    { key: 'call', href: telLink(phone), label: D.call, icon: <Phone />, tone: 'plain' as const },
    { key: 'wa', href: waLink(phone), label: D.whatsapp, icon: <MessageCircle />, tone: 'wa' as const },
    { key: 'mail', href: mailLink(email.trim()), label: D.mail, icon: <Mail />, tone: 'plain' as const },
    {
      key: 'site',
      href: site.ok ? site.url : null,
      label: D.site,
      icon: <ExternalLink />,
      tone: 'plain' as const,
    },
  ].filter((l): l is typeof l & { href: string } => !!l.href);

  /** Checks the fields and sends what changed; `forced` is a status chosen by a button ("close"). */
  const submit = (forced?: VendorStatus) => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = D.errors.name;
    if (email.trim() && !EMAIL.test(email.trim())) errs.email = D.errors.email;
    if (!site.ok) errs.url = D.errors.url;
    const amount = parseAmount(quote);
    if (amount === undefined) errs.quote = D.errors.amount;
    if (Object.keys(errs).length > 0) return setErrors(errs);

    const next = forced ?? status;
    const fields: VendorFields = {};
    if (name.trim() !== vendor.name) fields.name = name.trim();
    const cat = isCategoryKey(category) ? category : null;
    if (cat !== vendor.category) fields.category = cat;
    if (next !== vendor.status) fields.status = next;
    if (phone !== shownPhone) fields.phone = phone.trim() || null;
    if ((email.trim() || null) !== vendor.email) fields.email = email.trim() || null;
    if (site.url !== vendor.url) fields.url = site.url;
    if (amount !== vendor.quoteAmount) fields.quoteAmount = amount ?? null;
    if ((terms.trim() || null) !== vendor.paymentTerms) fields.paymentTerms = terms.trim() || null;
    if ((included.trim() || null) !== vendor.included) fields.included = included.trim() || null;
    if (rating !== vendor.rating) fields.rating = rating;
    if ((notes.trim() || null) !== vendor.notes) fields.notes = notes.trim() || null;
    if (!sameFiles(files, vendor.attachments)) fields.attachments = files;
    if (Object.keys(fields).length > 0) onSave(vendor.id, fields);
    onDismiss();
  };

  const categoryName = vendor.category ? t.planning.categories[vendor.category] : undefined;
  const clear = (key: keyof typeof errors) => setErrors((e) => ({ ...e, [key]: undefined }));
  const row = (children: ReactNode) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      title={D.title}
      description={categoryName}
      closeLabel={D.close}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              onDismiss();
              onDelete(vendor);
            }}
            className="me-auto min-h-11 rounded-btn px-3 text-[14px] font-semibold text-danger hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-focus"
          >
            {D.delete}
          </button>
          {vendor.status !== 'booked' ? (
            <Button
              variant="secondary"
              icon={<CircleCheck />}
              className="min-h-11"
              onClick={() => submit('booked')}
            >
              {D.closeVendor}
            </Button>
          ) : null}
          <Button className="min-h-11" onClick={() => submit()}>
            {D.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {links.length > 0 ? (
          <section aria-label={D.contact} className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                {...(l.key === 'wa' || l.key === 'site'
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className={
                  l.tone === 'wa'
                    ? `${reach} border border-wa-line bg-wa-soft text-wa-ink hover:bg-wa-soft-strong`
                    : `${reach} border border-line bg-surface text-ink shadow-sm hover:bg-subtle`
                }
              >
                <span aria-hidden className="inline-flex shrink-0 [&_svg]:size-4 [&_svg]:stroke-[1.75]">
                  {l.icon}
                </span>
                {l.label}
              </a>
            ))}
          </section>
        ) : null}

        <Field label={D.name} required error={errors.name}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clear('name');
            }}
            maxLength={120}
            autoComplete="off"
          />
        </Field>
        {row(
          <>
            <Field label={D.category}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{D.categoryNone}</option>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t.planning.categories[key]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={D.status}>
              <Select value={status} onChange={(e) => setStatus(e.target.value as VendorStatus)}>
                {VENDOR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {V.statuses[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </>,
        )}
        {row(
          <>
            <Field label={D.phone}>
              <Input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                autoComplete="off"
              />
            </Field>
            <Field label={D.email} error={errors.email}>
              <Input
                type="email"
                inputMode="email"
                dir="ltr"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clear('email');
                }}
                maxLength={254}
                autoComplete="off"
              />
            </Field>
          </>,
        )}
        <Field label={D.url} error={errors.url}>
          <Input
            inputMode="url"
            dir="ltr"
            value={url}
            placeholder={D.urlPlaceholder}
            onChange={(e) => {
              setUrl(e.target.value);
              clear('url');
            }}
            maxLength={500}
            autoComplete="off"
          />
        </Field>
        <Field label={D.quote} help={D.quoteHint} error={errors.quote}>
          <Input
            inputMode="decimal"
            dir="ltr"
            value={quote}
            onChange={(e) => {
              setQuote(e.target.value);
              clear('quote');
            }}
            autoComplete="off"
          />
        </Field>
        <Field label={D.terms} help={D.termsHint}>
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder={D.termsPlaceholder}
            maxLength={500}
            rows={2}
          />
        </Field>
        <Field label={D.included}>
          <Textarea
            value={included}
            onChange={(e) => setIncluded(e.target.value)}
            placeholder={D.includedPlaceholder}
            maxLength={1000}
            rows={3}
          />
        </Field>
        <div>
          <p className="mb-1 text-[13px] font-semibold">{D.rating}</p>
          <Stars value={rating} onChange={setRating} label={D.rating} />
        </div>
        <Field label={D.notes}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={D.notesPlaceholder}
            maxLength={2000}
            rows={4}
          />
        </Field>
        <VendorFiles value={files} onChange={setFiles} enabled={exportEnabled} />
      </div>
    </Drawer>
  );
}
