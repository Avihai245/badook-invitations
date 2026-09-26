'use client';

import { useState } from 'react';
import { Button, Dialog, Field, Input, Select, useToast } from '@/components/app';
import { upgradeReason, type UpgradeReason } from '@/features/billing/UpgradeDialog.client';
import { useUi } from '@/lib/i18n/client';
import type { Locale } from '../../contracts/types';
import { hostApi, loginUrl } from '../api';
import { normalizeGuestPhone, whatsappCapable } from '../../lib/guest-import';
import { guestPhone } from '../../lib/guest-list';
import { nativeName } from '../../lib/locales';
import type { GuestRecord } from '../../server/guests';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Add one guest, or edit one: name (required), phone, email, party size, group and — when the
 * invitation has several languages — the language they read it in (optional). A phone another guest
 * already has is refused, never merged into them; past the plan's list size the upgrade dialog takes
 * over.
 */
export function GuestDialog({
  id,
  guest,
  locales,
  defaultLocale,
  onClose,
  onSaved,
  onLimit,
}: {
  id: string;
  /** null = a new guest */
  guest: GuestRecord | null;
  /** the invitation's languages, and the one a guest without a language of their own gets */
  locales: readonly Locale[];
  defaultLocale: Locale;
  onClose: () => void;
  onSaved: (guest: GuestRecord | null) => void;
  /** the plan's guest list is full */
  onLimit: (reason: UpgradeReason) => void;
}) {
  const { t, fmt } = useUi();
  const g = t.guests;
  const f = g.form;
  const { toast } = useToast();
  const [name, setName] = useState(guest?.name ?? '');
  const [phone, setPhone] = useState(guestPhone(guest?.phone ?? null));
  const [email, setEmail] = useState(guest?.email ?? '');
  const [party, setParty] = useState(guest?.partySize ? String(guest.partySize) : '');
  const [group, setGroup] = useState(guest?.group ?? '');
  const [language, setLanguage] = useState<Locale | ''>(guest?.language ?? '');
  const choices = [
    ...locales,
    ...(guest?.language && !locales.includes(guest.language) ? [guest.language] : []),
  ];
  const [errors, setErrors] = useState<Partial<Record<'name' | 'phone' | 'email' | 'party', string>>>({});
  const [saving, setSaving] = useState(false);
  const e164 = phone.trim() ? normalizeGuestPhone(phone) : null;

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = f.required;
    if (phone.trim() && !e164) next.phone = f.badPhone;
    if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = f.badEmail;
    const size = party.trim() ? Number(party) : null;
    if (size !== null && !(Number.isInteger(size) && size >= 1 && size <= 99)) next.party = ' ';
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      partySize: size,
      group: group.trim() || null,
      language: language || null,
    };
    setSaving(true);
    const res = await hostApi<{ guest?: GuestRecord | { id: string; name: string }; code?: string }>(
      guest ? `/api/invitations/${id}/guests/${guest.id}` : `/api/invitations/${id}/guests`,
      guest ? { method: 'PATCH', body } : { method: 'POST', body: { guest: body } },
    );
    setSaving(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.status === 409) {
      const other = res.body?.guest?.name;
      return setErrors({ phone: other ? fmt(f.duplicateOf, { name: other }) : f.duplicate });
    }
    const limit = upgradeReason(res.status, res.body);
    if (limit) return onLimit(limit);
    if (!res.ok) return toast({ title: g.toast.error, variant: 'danger' });
    onSaved((res.body?.guest as GuestRecord | undefined) ?? null);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={guest ? f.editTitle : f.addTitle}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {f.save}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3.5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={f.name} required error={errors.name} className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field
          label={f.phone}
          help={e164 && !whatsappCapable(e164) ? f.landline : f.optional}
          error={errors.phone}
        >
          <Input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors(({ phone: _, ...rest }) => rest);
            }}
            dir="ltr"
            inputMode="tel"
            type="tel"
            placeholder="050-1234567"
          />
        </Field>
        <Field label={f.email} help={f.optional} error={errors.email}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            inputMode="email"
            type="email"
            placeholder="name@example.com"
          />
        </Field>
        <Field label={f.partySize} help={f.optional} error={errors.party}>
          <Input
            value={party}
            onChange={(e) => setParty(e.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            dir="ltr"
          />
        </Field>
        <Field label={f.group} help={f.groupHint}>
          <Input value={group} onChange={(e) => setGroup(e.target.value)} maxLength={60} />
        </Field>
        {choices.length > 1 ? (
          <Field label={f.language} help={f.languageHint} className="sm:col-span-2">
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Locale | '')}
              data-testid="guest-language"
            >
              <option value="">{fmt(g.language.default, { language: nativeName(defaultLocale) })}</option>
              {choices.map((l) => (
                <option key={l} value={l} lang={l}>
                  {nativeName(l)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
