'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import {
  Fragment,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Field, Input } from '@/components/app';
import type { AppDict } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import {
  continueWithLink,
  requestPasswordReset,
  resendCode,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
  verifyCode,
  type AuthErrorKey,
  type AuthState,
} from './actions';

export type AuthNoticeKey = keyof AppDict['accountPage']['auth']['notices'];

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

/** A form's submit button that shows it is working (forms posting to a server action). */
function PendingSubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending}>
      {children}
    </Button>
  );
}

/** 6 separate boxes (LTR, numeric keyboard): auto-advance, backspace-to-previous, paste anywhere. */
function CodeInput({
  length = 6,
  onChange,
  disabled = false,
}: {
  length?: number;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { t, fmt } = useUi();
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (next: string[]) => {
    setDigits(next);
    onChange(next.join(''));
  };

  return (
    <div dir="ltr" className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1);
            const next = digits.slice();
            next[i] = d;
            update(next);
            if (d && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              e.preventDefault();
              const next = digits.slice();
              next[i - 1] = '';
              update(next);
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (!pasted) return;
            e.preventDefault();
            update(Array.from({ length }, (_, j) => pasted[j] ?? ''));
            refs.current[Math.min(pasted.length, length - 1)]?.focus();
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={1}
          autoFocus={i === 0}
          aria-label={fmt(t.auth.codeDigit, { n: i + 1 })}
          className="h-12 w-11 rounded-input border border-line bg-surface text-center text-[20px] font-semibold text-ink transition-[border-color,box-shadow] duration-150 focus:border-ink focus:shadow-ring focus:outline-hidden disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted"
        />
      ))}
    </div>
  );
}

/**
 * The 6-digit code screen: sign-up confirmation, a login stalled on confirming the email, or a
 * password reset — same UI, `kind` says which. "Resend code" below has a 60s cooldown, restarted on
 * mount (a code was just sent) and after every resend; a full code submits itself.
 */
function CodeStep({
  email,
  next,
  kind,
  title,
  onBack,
}: {
  email: string;
  next: string;
  kind: 'signup' | 'recovery';
  title: string;
  onBack: () => void;
}) {
  const { t, fmt } = useUi();
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [cooldown, setCooldown] = useState(60);
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyCode, null);
  const [resendState, resendAction, resendPending] = useActionState<AuthState, FormData>(resendCode, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // a wrong or expired code: clear the boxes and refocus the first one for another try
  useEffect(() => {
    if (state?.error) {
      setCode('');
      setAttempt((a) => a + 1);
    }
  }, [state]);

  useEffect(() => {
    if (resendState?.sent) setCooldown(60);
  }, [resendState]);

  useEffect(() => {
    if (code.length === 6 && !pending) formRef.current?.requestSubmit();
  }, [code, pending]);

  return (
    <AuthCard title={title} subtitle={fmt(t.auth.verifySubtitle, { email })}>
      <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="code" value={code} />
        <CodeInput key={attempt} onChange={setCode} disabled={pending} />
        <FormError error={state?.error} />
        <Button type="submit" size="lg" fullWidth loading={pending} disabled={code.length !== 6}>
          {t.auth.verifyCode}
        </Button>
      </form>
      <form action={resendAction} className="mt-5 flex flex-col items-center gap-2">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="kind" value={kind} />
        <button
          type="submit"
          disabled={cooldown > 0 || resendPending}
          className="text-[13px] font-medium text-ink underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          {cooldown > 0 ? fmt(t.auth.resendIn, { s: cooldown }) : t.auth.resendCode}
        </button>
        {resendState?.error ? (
          <FormError error={resendState.error} />
        ) : resendState?.sent ? (
          <p className="text-[12px] text-success">{t.auth.codeResent}</p>
        ) : null}
      </form>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 block w-full text-center text-[13px] text-muted underline-offset-2 hover:underline"
      >
        {t.auth.changeEmail}
      </button>
    </AuthCard>
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
  const message = !error
    ? null
    : error in t.auth.errors
      ? t.auth.errors[error as keyof typeof t.auth.errors]
      : t.accountPage.auth.errors[error as keyof typeof t.accountPage.auth.errors];
  return (
    <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">
      {message}
    </p>
  );
}

/** Good news on arrival (the email is confirmed, the account was deleted). */
function Notice({ notice }: { notice: AuthNoticeKey }) {
  const { t } = useUi();
  const a = t.accountPage.auth;
  return (
    <p
      role="status"
      data-testid="auth-notice"
      className="mb-5 flex items-start gap-2 rounded-card border border-success-line bg-success-bg px-3.5 py-3 text-[13.5px] text-success"
    >
      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {a.notices[notice]}
        {notice === 'deleted_charge' ? (
          <>
            {' '}
            <Link href="/contact?topic=billing" className="font-semibold underline underline-offset-2">
              {a.contact}
            </Link>
          </>
        ) : null}
      </span>
    </p>
  );
}

/** A sentence with links in place of its {placeholders}. */
function Linked({ text, links }: { text: string; links: Record<string, ReactNode> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => (
        <Fragment key={i}>{(/^\{\w+\}$/.test(part) && links[part.slice(1, -1)]) || part}</Fragment>
      ))}
    </>
  );
}

/** "By signing up you agree to the Terms and the Privacy Policy", under the sign-up button. */
function TermsLine() {
  const { t } = useUi();
  const a = t.accountPage.auth;
  const link = (href: string, label: string) => (
    <Link href={href} className="font-medium text-ink underline underline-offset-2">
      {label}
    </Link>
  );
  return (
    <p className="text-center text-[12.5px] text-pretty text-muted" data-testid="signup-terms">
      <Linked
        text={a.terms}
        links={{ terms: link('/terms', a.termsLink), privacy: link('/privacy', a.privacyLink) }}
      />
    </p>
  );
}

export function LoginForm({
  next,
  initialError,
  notice,
  google = false,
}: {
  next: string;
  initialError?: AuthErrorKey;
  notice?: AuthNoticeKey;
  google?: boolean;
}) {
  const { t } = useUi();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signIn,
    initialError ? { error: initialError } : null,
  );
  useEffect(() => {
    if (state?.step === 'code') setStep('code');
  }, [state]);
  if (step === 'code' && state?.step === 'code') {
    return (
      <CodeStep
        email={state.email}
        next={state.next}
        kind={state.kind}
        title={t.auth.verifyTitle}
        onBack={() => setStep('form')}
      />
    );
  }
  return (
    <AuthCard title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      {notice ? <Notice notice={notice} /> : null}
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

export function SignupForm({ next, google = false }: { next: string; google?: boolean }) {
  const { t } = useUi();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  const toLogin = next === '/app/invitations' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
  useEffect(() => {
    if (state?.step === 'code') setStep('code');
  }, [state]);
  if (step === 'code' && state?.step === 'code') {
    return (
      <CodeStep
        email={state.email}
        next={state.next}
        kind={state.kind}
        title={t.auth.verifyTitle}
        onBack={() => setStep('form')}
      />
    );
  }
  return (
    <AuthCard title={t.auth.signupTitle} subtitle={t.auth.signupSubtitle}>
      {google ? <GoogleSignIn next={next} /> : null}
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
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
        <TermsLine />
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">
        {t.auth.haveAccount}{' '}
        <Link href={toLogin} className="font-semibold text-ink underline-offset-2 hover:underline">
          {t.auth.toLogin}
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordForm({ initialError }: { initialError?: AuthErrorKey }) {
  const { t } = useUi();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    initialError ? { error: initialError } : null,
  );
  useEffect(() => {
    if (state?.step === 'code') setStep('code');
  }, [state]);
  if (step === 'code' && state?.step === 'code') {
    return (
      <CodeStep
        email={state.email}
        next={state.next}
        kind={state.kind}
        title={t.auth.recoveryCodeTitle}
        onBack={() => setStep('email')}
      />
    );
  }
  return (
    <AuthCard title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
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
          {t.auth.sendCode}
        </Button>
        <Link href="/login" className="text-center text-[13px] text-muted underline-offset-2 hover:underline">
          {t.auth.toLogin}
        </Link>
      </form>
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

/**
 * A one-time sign-in link from Badook Events lands here: nothing is used until the visitor clicks —
 * mail scanners and link previews only open pages (actions.ts: continueWithLink).
 */
export function ContinueForm({ tokenHash, next }: { tokenHash: string; next: string }) {
  const { t } = useUi();
  const c = t.accountPage.auth.continue;
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <form action={continueWithLink} className="flex flex-col gap-3">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="next" value={next} />
        <PendingSubmit>{c.button}</PendingSubmit>
        <p className="text-center text-[12.5px] text-muted">{c.note}</p>
      </form>
    </AuthCard>
  );
}
