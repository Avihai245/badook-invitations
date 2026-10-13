import type { z } from 'zod';
import type { EmailContent } from '@/features/invitations/lib/notify-email';

/** What the public routes of the report and privacy-request forms answer (a status and a JSON body). */
export type ApiResult = { status: number; body: Record<string, unknown> };

export const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, error, ...extra },
});

/** The fields a validation failed on (the form puts the error beside each). */
export const fieldsOf = (error: z.ZodError) => [
  ...new Set(error.issues.map((i) => String(i.path[0] ?? 'form'))),
];

/** What the flows need from the deployment: where the team's notices go, the brand and the site. */
export interface LegalConfig {
  /** INVITES_PRIVACY_EMAIL, else INVITES_SUPPORT_EMAIL ('' when neither is set) */
  teamEmail: string;
  brand: string;
  /** INVITES_PUBLIC_BASE_URL */
  site: string;
}

/** Sends one email; false when it did not go (Resend failed). Never throws. */
export type SendMail = (email: EmailContent & { to: string; replyTo?: string }) => Promise<boolean>;

/**
 * One notice, best effort: sends it, and records in the database whether it went (the console shows
 * what did not, so the team can follow up by hand). Nothing here ever throws or changes what the
 * visitor was told — the stored record is the system of record, not the email.
 */
export async function notice(
  label: string,
  send: () => Promise<boolean>,
  record: (ok: boolean) => Promise<unknown>,
): Promise<void> {
  let sent = false;
  try {
    sent = await send();
  } catch (err) {
    console.error(`[legal] ${label} notice failed`, err);
  }
  try {
    await record(sent);
  } catch (err) {
    console.error(`[legal] ${label} notice could not be recorded`, err);
  }
}
