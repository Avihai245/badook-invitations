'use client';

import { CreditCard, KeyRound, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, Dialog, Field, Hint, Input, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

export interface AccountScreenData {
  email: string;
  fullName: string;
  phone: string;
  provider: 'email' | 'google' | 'partner';
  plan: string;
}

/** /app/account: name and phone, how the host signs in, the plan, and deleting the account. */
export function AccountScreen({ data }: { data: AccountScreenData }) {
  const { t } = useUi();
  const a = t.accountPage;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    setPhoneError(null);
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: String(form.get('fullName') ?? ''),
        phone: String(form.get('phone') ?? ''),
      }),
    }).catch(() => null);
    setSaving(false);
    const body = (await res?.json().catch(() => null)) as { fields?: string[] } | null;
    if (res?.ok) return toast({ title: a.saved, variant: 'success' });
    if (body?.fields?.includes('phone')) return setPhoneError(a.badPhone);
    toast({ title: a.error, variant: 'danger' });
  };

  const remove = async () => {
    setDeleting(true);
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    }).catch(() => null);
    if (res?.ok) return window.location.assign('/?deleted=1');
    setDeleting(false);
    toast({ title: a.error, variant: 'danger' });
  };

  return (
    <div className="mx-auto max-w-[760px] px-4 pt-8 pb-16 sm:px-6">
      <h1 className="text-[26px] font-bold tracking-[-.01em]">{a.title}</h1>
      <p className="mt-1 text-muted">{a.subtitle}</p>

      <Card padding="lg" className="mt-6">
        <h2 className="text-[17px] font-bold">{a.profile}</h2>
        <form onSubmit={(e) => void save(e)} className="mt-4 flex flex-col gap-4" data-testid="profile-form">
          <Field label={a.fullName}>
            <Input name="fullName" defaultValue={data.fullName} maxLength={120} autoComplete="name" />
          </Field>
          <Field label={a.phone} help={a.phoneHint} error={phoneError ?? undefined}>
            <Input
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={data.phone}
              maxLength={40}
              autoComplete="tel"
            />
          </Field>
          <Field label={a.email}>
            <Input value={data.email} readOnly dir="ltr" />
          </Field>
          <p className="text-[14px]">
            <span className="text-muted">{a.signIn}: </span>
            <span className="font-semibold">{a.providers[data.provider]}</span>
          </p>
          <div>
            <Hint text={a.help.save}>
              <Button type="submit" icon={<Save />} loading={saving}>
                {a.save}
              </Button>
            </Hint>
          </div>
        </form>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card padding="lg" className="flex flex-col items-start gap-2">
          <p className="text-[13px] font-semibold text-muted">{a.plan}</p>
          <p className="text-[20px] font-bold">{data.plan}</p>
          <Button variant="secondary" size="sm" icon={<CreditCard />} asChild>
            <Link href="/app/billing">{a.planLink}</Link>
          </Button>
        </Card>
        {data.provider === 'email' ? (
          <Card padding="lg" className="flex flex-col items-start gap-2">
            <p className="text-[13px] font-semibold text-muted">{a.password}</p>
            <Button variant="secondary" size="sm" icon={<KeyRound />} asChild>
              <Link href="/auth/update-password">{a.passwordLink}</Link>
            </Button>
          </Card>
        ) : null}
      </div>

      <Card padding="lg" className="mt-8 border-[#fecaca]">
        <h2 className="text-[17px] font-bold text-danger">{a.danger}</h2>
        <p className="mt-2 text-[14px] text-pretty text-muted">{a.dangerBody}</p>
        <Hint text={a.help.delete}>
          <Button variant="danger" className="mt-4" icon={<Trash2 />} onClick={() => setConfirming(true)}>
            {a.delete}
          </Button>
        </Hint>
      </Card>

      {confirming ? (
        <Dialog
          open
          onOpenChange={(open) => !open && !deleting && setConfirming(false)}
          title={a.confirmTitle}
          description={a.dangerBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                {a.keep}
              </Button>
              <Button
                variant="danger"
                disabled={!understood}
                loading={deleting}
                onClick={() => void remove()}
              >
                {deleting ? a.deleting : a.confirm}
              </Button>
            </>
          }
        >
          <Checkbox checked={understood} onCheckedChange={setUnderstood} label={a.confirmCheck} />
        </Dialog>
      ) : null}
    </div>
  );
}
