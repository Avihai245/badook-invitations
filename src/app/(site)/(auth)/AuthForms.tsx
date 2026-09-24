'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Field, Input } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import {
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
  type AuthErrorKey,
  type AuthState,
} from './actions';

/** Google's "G" (its sign-in branding asks for the standard mark on a light button). */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" width="18" height="18">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

function GoogleSubmit() {
  const { t } = useUi();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="lg" fullWidth loading={pending} icon={<GoogleMark />}>
      {t.auth.google}
    </Button>
  );
}

/** "Continue with Google", then a divider before the email form. */
function GoogleSignIn({ next }: { next: string }) {
  const { t } = useUi();
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleSubmit />
      </form>
      <div className="my-5 flex items-center gap-3 text-[12.5px] text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        {t.auth.orEmail}
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[420px] rounded-[20px] border border-line/80 bg-surface/95 p-7 shadow-[0_24px_48px_-24px_rgba(60,35,15,0.25)] backdrop-blur sm:p-9">
      <h1 className="font-display text-[30px] leading-tight font-bold tracking-[-0.01em]">{title}</h1>
      <p className="mt-2 mb-7 text-[15px] text-pretty text-muted">{subtitle}</p>
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

export function LoginForm({
  next,
  initialError,
  google = false,
}: {
  next: string;
  initialError?: AuthErrorKey;
  google?: boolean;
}) {
  const { t } = useUi();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signIn,
    initialError ? { error: initialError } : null,
  );
  return (
    <AuthCard title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      {google ? <GoogleSignIn next={next} /> : null}
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

export function SignupForm({ google = false }: { google?: boolean }) {
  const { t, fmt } = useUi();
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  if (state?.sent) {
    return (
      <AuthCard
        title={t.auth.checkEmailTitle}
        subtitle={fmt(t.auth.checkEmail, { email: state.email ?? '' })}
      >
        <Button asChild variant="secondary" fullWidth>
          <Link href="/login">{t.auth.toLogin}</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t.auth.signupTitle} subtitle={t.auth.signupSubtitle}>
      {google ? <GoogleSignIn next="/app/invitations" /> : null}
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
          <Input
            name="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={8}
            required
          />
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
          <Link
            href="/login"
            className="text-center text-[13px] text-muted underline-offset-2 hover:underline"
          >
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
          <Input
            name="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <FormError error={state?.error} />
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {t.auth.updatePassword}
        </Button>
      </form>
    </AuthCard>
  );
}
