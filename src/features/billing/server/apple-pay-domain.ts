import 'server-only';
import { inflateRawSync } from 'node:zlib';
import { serverEnv } from '@/lib/env';

/**
 * Apple Pay's domain file: Apple reads /.well-known/apple-developer-merchantid-domain-association on
 * our domain before it lets the Apple Pay button in Tranzila's form run on it. The file is Tranzila's
 * (the same for every merchant of theirs): INVITES_TRANZILA_APPLE_PAY_FILE when it is set, otherwise
 * Tranzila's public copy (a zip with the one file), kept for a day.
 */

const DAY = 24 * 60 * 60 * 1000;
const RETRY = 10 * 60 * 1000;
let cached: { file: string | null; until: number } | null = null;

export function resetAppleDomainFile() {
  cached = null;
}

/** The first file in a zip (the central directory's sizes, so data descriptors don't matter). */
export function unzipFirst(zip: Buffer): Buffer | null {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > zip.length) return null;
  const entries = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < entries; i++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const next = at + 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const local = zip.readUInt32LE(at + 42);
    at = next;
    if (name.endsWith('/') || name.startsWith('__MACOSX/') || name.split('/').pop()!.startsWith('.'))
      continue;
    if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) return null;
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data);
    return null;
  }
  return null;
}

export async function appleDomainFile(
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const env = serverEnv();
  if (env.INVITES_TRANZILA_APPLE_PAY_FILE) return env.INVITES_TRANZILA_APPLE_PAY_FILE;
  if (cached && cached.until > now) return cached.file;
  let file: string | null = null;
  try {
    const res = await fetchImpl(env.INVITES_TRANZILA_APPLE_PAY_FILE_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const body = Buffer.from(await res.arrayBuffer());
      // a zip (Tranzila's copy) or the file itself
      const raw = body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ? unzipFirst(body) : body;
      const text = raw?.toString('utf8').trim();
      file = text ? text : null;
    }
  } catch {
    file = null;
  }
  cached = { file, until: now + (file ? DAY : RETRY) };
  return file;
}
