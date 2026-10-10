import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Apple Pay's domain file: served from Tranzila's zip (or the env), kept for a day, and missing → 404.

vi.mock('server-only', () => ({}));

const FILE =
  '7B227073704964223A2246413638363435383338384441383141453045373736303833363236373938363938413435333037313031313136443039343630343542433843353536424138222C2276657273696F6E223A317D';

/** A zip with the given files (deflated), as Tranzila's merchant_authentication_file.zip. */
function zip(files: [string, string][]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = deflateRawSync(Buffer.from(text));
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(text.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(text.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const load = async () => {
  vi.resetModules();
  return import('@/features/billing/server/apple-pay-domain');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Apple Pay domain file', () => {
  it('unzips the first real file (skipping folders and macOS extras)', async () => {
    const { unzipFirst } = await load();
    const z = zip([
      ['__MACOSX/', ''],
      ['__MACOSX/._apple-developer-merchantid-domain-association', 'junk'],
      ['apple-developer-merchantid-domain-association', FILE],
    ]);
    expect(unzipFirst(z)?.toString()).toBe(FILE);
    expect(unzipFirst(Buffer.from('not a zip'))).toBeNull();
  });

  it('takes Tranzila’s copy once a day, and the env’s file over it', async () => {
    const { appleDomainFile } = await load();
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array(zip([['apple-developer-merchantid-domain-association', FILE]]))),
    );
    expect(await appleDomainFile(1000, fetchImpl as unknown as typeof fetch)).toBe(FILE);
    expect(await appleDomainFile(2000, fetchImpl as unknown as typeof fetch)).toBe(FILE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe(
      'https://api.tranzila.com/assets/apple_pay/merchant_authentication_file.zip',
    );

    vi.stubEnv('INVITES_TRANZILA_APPLE_PAY_FILE', 'from-env');
    const fresh = await load();
    const none = vi.fn();
    expect(await fresh.appleDomainFile(1000, none as unknown as typeof fetch)).toBe('from-env');
    expect(none).not.toHaveBeenCalled();
  });

  it('Tranzila not answering: no file (the route answers 404), tried again later', async () => {
    const { appleDomainFile } = await load();
    const down = vi.fn(async () => new Response('', { status: 503 }));
    expect(await appleDomainFile(0, down as unknown as typeof fetch)).toBeNull();
    expect(await appleDomainFile(60_000, down as unknown as typeof fetch)).toBeNull();
    expect(down).toHaveBeenCalledTimes(1);
    expect(await appleDomainFile(11 * 60_000, down as unknown as typeof fetch)).toBeNull();
    expect(down).toHaveBeenCalledTimes(2);
  });
});
