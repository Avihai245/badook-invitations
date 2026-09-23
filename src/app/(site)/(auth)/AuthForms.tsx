'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { Button, Field, Input } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthErrorKey,
  type AuthState,
} from './actions';

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[400px] rounded-dialog border border-line bg-surface p-8 shadow-md">
      <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 mb-6 text-[14px] text-muted">{subtitle}</p>
      {children}
    </div>
  );
}

function FormError({ error }: { error?: AuthErrorKey }) {
  const { t } = useUi();
  return (
    <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">
      {error ? t.auth.errors[error] : null}
    </p>
  );
}

export function LoginForm({ next, initialError }: { next: string; initialError?: AuthErrorKey }) {
  const { t } = useUi();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signIn,
    initialError ? { error: initialError } : null,
  );
  return (
    <AuthCard title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label={t.auth.email} required>
          <Input
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            inputMode="email"
            defaultValue={state?.email}
            required
          />
        </Field>
        <Field
          label={t.auth.password}
          required
          labelAside={
            <Link href="/auth/forgot" className="text-[12px] text-muted underline-offset-2 hover:underline">
              {t.auth.forgot}
            </Link>
          }
        >
          <Input name="password" type="password" dir="ltr" autoComplete="current-password" required />
        </Field>
        <FormError error={state?.error} />
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {t.auth.login}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">
        {t.auth.noAccount}{' '}
        <Link
          href={next === '/app/invitations' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          {t.auth.toSignup}
        </Link>
      </p>
    </AuthCard>
  );
}

export function SignupForm() {
  const { t, fmt } = useUi();
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  if (state?.sent) {
    return (
      <AuthCard title={t.auth.checkEmailTitle} subtitle={fmt(t.auth.checkEmail, { email: state.email ?? '' })}>
        <Button asChild variant="secondary" fullWidth>
          <Link href="/login">{t.auth.toLogin}</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t.auth.signupTitle} subtitle={t.auth.signupSubtitle}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label={t.auth.name}>
          <Input name="name" autoComplete="name" maxLength={80} />
        </Field>
        <Field label={t.auth.email} required>
          <Input
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            inputMode="email"
            defaultValue={state?.email}
            required
          />
        </Field>
        <Field label={t.auth.password} required help={t.auth.passwordHint}>
          <Input name="password" type="password" dir="ltr" autoComplete="new-password" minLength={8} required />
        </Field>
        <FormError error={state?.error} />
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {t.auth.signup}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">
        {t.auth.haveAccount}{' '}
        <Link href="/login" className="font-semibold text-ink underline-offset-2 hover:underline">
          {t.auth.toLogin}
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const { t } = useUi();
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  return (
    <AuthCard title={t.auth.forgotTitle} subtitle={state?.sent ? t.auth.linkSent : t.auth.forgotSubtitle}>
      {state?.sent ? (
        <Button asChild variant="secondary" fullWidth>
          <Link href="/login">{t.auth.toLogin}</Link>
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <Field label={t.auth.email} required>
            <Input
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              defaultValue={state?.email}
              required
            />
          </Field>
          <FormError error={state?.error} />
          <Button type="submit" size="lg" fullWidth loading={pending}>
            {t.auth.sendLink}
          </Button>
          <Link href="/login" className="text-center text-[13px] text-muted underline-offset-2 hover:underline">
            {t.auth.toLogin}
          </Link>
        </form>
      )}
    </AuthCard>
  );
}

export function UpdatePasswordForm() {
  const { t } = useUi();
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, null);
  return (
    <AuthCard title={t.auth.updateTitle} subtitle={t.auth.updateSubtitle}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label={t.auth.newPassword} required help={t.auth.passwordHint}>
          <Input name="password" type="password" dir="ltr" autoComplete="new-password" minLength={8} required />
        </Field>
        <FormError error={state?.error} />
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {t.auth.updatePassword}
        </Button>
      </form>
    </AuthCard>
  );
}
