'use client';

import { useState } from 'react';
import { Button, Dialog, Field, Input, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostApi, loginUrl } from '../api';
import { normalizeGuestPhone } from '../../lib/guest-import';
import { displayPhone } from '../../lib/guest-status';
import type { GuestRecord } from '../../server/guests';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Add one guest, or edit one: name (required), phone, email, party size and group (optional). */
export function GuestDialog({
  id,
  guest,
  onClose,
  onSaved,
}: {
  id: string;
  /** null = a new guest */
  guest: GuestRecord | null;
  onClose: () => void;
  onSaved: (guest: GuestRecord | null) => void;
}) {
  const { t } = useUi();
  const g = t.guests;
  const f = g.form;
  const { toast } = useToast();
  const [name, setName] = useState(guest?.name ?? '');
  const [phone, setPhone] = useState(displayPhone(guest?.phone ?? null));
  const [email, setEmail] = useState(guest?.email ?? '');
  const [party, setParty] = useState(guest?.partySize ? String(guest.partySize) : '');
  const [group, setGroup] = useState(guest?.group ?? '');
  const [errors, setErrors] = useState<Partial<Record<'name' | 'phone' | 'email' | 'party', string>>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = f.required;
    if (phone.trim() && !normalizeGuestPhone(phone)) next.phone = f.badPhone;
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
    };
    setSaving(true);
    const res = guest
      ? await hostApi<{ guest: GuestRecord; code?: string }>(`/api/invitations/${id}/guests/${guest.id}`, {
          method: 'PATCH',
          body,
        })
      : await hostApi<{ code?: string }>(`/api/invitations/${id}/guests`, {
          method: 'POST',
          body: { guests: [body] },
        });
    setSaving(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.status === 409) return setErrors({ phone: f.duplicate });
    if (res.status === 402) return toast({ title: g.import.upgrade, variant: 'danger' });
    if (!res.ok) return toast({ title: g.toast.error, variant: 'danger' });
    onSaved(guest ? ((res.body as { guest?: GuestRecord } | null)?.guest ?? null) : null);
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
        <Field label={f.phone} help={f.optional} error={errors.phone}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
