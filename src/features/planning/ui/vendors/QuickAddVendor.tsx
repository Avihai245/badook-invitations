'use client';

import { BookUser } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, Dialog, Field, Input, Select } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_KEYS, isCategoryKey, type CategoryKey } from '../../model/categories';
import { contactPickerAvailable, pickContact } from './contacts';

/**
 * Adding a vendor in a few seconds: a name, a category and a phone (from the phone's contacts, where the
 * browser has a contact picker). The rest is filled in later, in the vendor's details. Also what the
 * "add vendor" of each missing category opens, with that category chosen.
 */
export function QuickAddVendor({
  open,
  onOpenChange,
  category,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** chosen when it opens (a missing category's "add vendor") */
  category: CategoryKey | null;
  onAdd: (input: { name: string; category: CategoryKey | null; phone: string | null }) => unknown;
}) {
  const { t } = useUi();
  const Q = t.planning.vendors.quick;
  const formId = useId();
  const [name, setName] = useState('');
  const [cat, setCat] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(false);
  // only where the browser has a contact picker (found out after the first render: the server has none)
  const [canPick, setCanPick] = useState(false);
  useEffect(() => setCanPick(contactPickerAvailable()), []);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setCat(category ?? '');
    setError(false);
  }, [open, category]);

  const fromContacts = async () => {
    const picked = await pickContact();
    if (!picked) return;
    if (picked.name) {
      setName(picked.name);
      setError(false);
    }
    if (picked.phone) setPhone(picked.phone);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(true);
    onOpenChange(false);
    void onAdd({ name, category: isCategoryKey(cat) ? cat : null, phone: phone.trim() || null });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={Q.title}
      description={Q.description}
      closeLabel={t.planning.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.planning.common.cancel}
          </Button>
          <Button type="submit" form={formId}>
            {Q.submit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={Q.name} required error={error ? Q.nameRequired : undefined}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(false);
            }}
            placeholder={Q.namePlaceholder}
            maxLength={120}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label={Q.category}>
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{Q.categoryNone}</option>
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {t.planning.categories[key]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={Q.phone}>
          <div className="flex items-start gap-2">
            <Input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            {canPick ? (
              <Button
                variant="secondary"
                icon={<BookUser />}
                className="min-h-11 shrink-0"
                aria-label={Q.contactsLabel}
                onClick={() => void fromContacts()}
              >
                {Q.contacts}
              </Button>
            ) : null}
          </div>
        </Field>
      </form>
    </Dialog>
  );
}
