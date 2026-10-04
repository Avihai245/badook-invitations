import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * "Act as a customer" (remote support from the admin console): a staff member keeps their own sign-in
 * and carries this signed, short-lived cookie naming whom they act as. session.ts honours it only for
 * the same staff member who started it, while they still have the permission (admin/server/act-as.ts).
 */
export const ACT_AS_COOKIE = 'badook_act_as';
export const ACT_AS_SECONDS = 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActAsClaim {
  staffId: string;
  targetId: string;
  /** seconds since the epoch */
  exp: number;
}

function mac(secret: string, body: string): Buffer {
  const key = createHmac('sha256', secret).update('badook:act-as:v1').digest();
  return createHmac('sha256', key).update(body).digest();
}

export function signActAs(secret: string, staffId: string, targetId: string, now = Date.now()): string {
  if (!secret) throw new Error('act as: no signing secret');
  const body = `${staffId}.${targetId}.${Math.floor(now / 1000) + ACT_AS_SECONDS}`;
  return `${body}.${mac(secret, body).toString('base64url')}`;
}

/** The claim in a cookie value — null when it's malformed, forged, or expired. */
export function readActAs(secret: string, value: string | undefined, now = Date.now()): ActAsClaim | null {
  if (!secret || !value) return null;
  const [staffId, targetId, exp, sig, ...rest] = value.split('.');
  if (rest.length || !staffId || !targetId || !exp || !sig) return null;
  if (!UUID.test(staffId) || !UUID.test(targetId) || !/^\d{1,12}$/.test(exp)) return null;
  const expected = mac(secret, `${staffId}.${targetId}.${exp}`);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(exp) * 1000 <= now) return null;
  return { staffId, targetId, exp: Number(exp) };
}
