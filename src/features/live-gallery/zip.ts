/**
 * A ZIP archive written as a stream while its files are still being fetched — nothing is held in
 * memory but the file being copied. Files are stored as they are (photos and videos don't compress),
 * each followed by a data descriptor with its CRC-32 and size, names in UTF-8, and ZIP64 records when
 * the archive passes 4 GB or 65,535 files. Isomorphic (the host's browser writes it; tests read it
 * back with a standard unzip).
 */

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE); pass the previous result to continue over the next chunk. */
export function crc32(data: Uint8Array, crc = 0): number {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipSource {
  /** the path inside the archive */
  name: string;
  /** shown as the file's date (local time, as ZIP stores it) */
  date: Date;
  /** the file's bytes, asked for when it is this file's turn */
  open: () => Promise<ReadableStream<Uint8Array>>;
}

export interface ZipOptions {
  /** always write ZIP64 records (tests; readers accept them for small archives too) */
  zip64?: boolean;
  /** a file starts (its position in the archive) */
  onFile?: (name: string, index: number) => void;
  /** bytes of files copied so far */
  onBytes?: (bytes: number) => void;
}

const MAX32 = 0xffffffff;
const encoder = new TextEncoder();

class Bytes {
  readonly buf: Uint8Array;
  private readonly view: DataView;
  private p = 0;
  constructor(size: number) {
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer);
  }
  u16(v: number) {
    this.view.setUint16(this.p, v, true);
    this.p += 2;
    return this;
  }
  u32(v: number) {
    this.view.setUint32(this.p, v >>> 0, true);
    this.p += 4;
    return this;
  }
  /** a 64-bit number as two halves (no BigInt: older browsers) */
  u64(v: number) {
    this.u32(v % 2 ** 32);
    this.u32(Math.floor(v / 2 ** 32));
    return this;
  }
  bytes(b: Uint8Array) {
    this.buf.set(b, this.p);
    this.p += b.length;
    return this;
  }
}

function dosDateTime(d: Date): { time: number; date: number } {
  const valid = Number.isNaN(d.getTime()) ? new Date(0) : d;
  const year = Math.min(2107, Math.max(1980, valid.getFullYear()));
  return {
    time: (valid.getHours() << 11) | (valid.getMinutes() << 5) | Math.floor(valid.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((valid.getMonth() + 1) << 5) | valid.getDate(),
  };
}

// general purpose flags: bit 3 (sizes and CRC in a data descriptor after the data), bit 11 (UTF-8 names)
const FLAGS = 0x0808;

function localHeader(name: Uint8Array, time: number, date: number): Uint8Array {
  return new Bytes(30 + name.length)
    .u32(0x04034b50)
    .u16(20)
    .u16(FLAGS)
    .u16(0) // stored
    .u16(time)
    .u16(date)
    .u32(0) // CRC, sizes: in the data descriptor
    .u32(0)
    .u32(0)
    .u16(name.length)
    .u16(0)
    .bytes(name).buf;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  return new Bytes(16).u32(0x08074b50).u32(crc).u32(size).u32(size).buf;
}

function centralHeader(
  name: Uint8Array,
  time: number,
  date: number,
  crc: number,
  size: number,
  offset: number,
  zip64: boolean,
): Uint8Array {
  const extra = zip64 ? 12 : 0;
  const b = new Bytes(46 + name.length + extra)
    .u32(0x02014b50)
    .u16(45) // made by: ZIP 4.5
    .u16(zip64 ? 45 : 20)
    .u16(FLAGS)
    .u16(0)
    .u16(time)
    .u16(date)
    .u32(crc)
    .u32(size)
    .u32(size)
    .u16(name.length)
    .u16(extra)
    .u16(0) // comment
    .u16(0) // disk
    .u16(0) // internal attributes
    .u32(0) // external attributes
    .u32(zip64 ? MAX32 : offset)
    .bytes(name);
  // ZIP64 extended information: only the local header's offset is too big for 32 bits
  if (zip64) b.u16(0x0001).u16(8).u64(offset);
  return b.buf;
}

function endRecords(count: number, cdSize: number, cdOffset: number, zip64: boolean): Uint8Array[] {
  const out: Uint8Array[] = [];
  if (zip64) {
    const zip64End = cdOffset + cdSize;
    out.push(
      new Bytes(56)
        .u32(0x06064b50)
        .u64(44) // size of the rest of this record
        .u16(45)
        .u16(45)
        .u32(0)
        .u32(0)
        .u64(count)
        .u64(count)
        .u64(cdSize)
        .u64(cdOffset).buf,
      new Bytes(20).u32(0x07064b50).u32(0).u64(zip64End).u32(1).buf,
    );
  }
  out.push(
    new Bytes(22)
      .u32(0x06054b50)
      .u16(0)
      .u16(0)
      .u16(zip64 ? 0xffff : count)
      .u16(zip64 ? 0xffff : count)
      .u32(zip64 ? MAX32 : cdSize)
      .u32(zip64 ? MAX32 : cdOffset)
      .u16(0).buf,
  );
  return out;
}

async function* chunks(files: AsyncIterable<ZipSource> | Iterable<ZipSource>, o: ZipOptions) {
  let offset = 0;
  let copied = 0;
  const central: Uint8Array[] = [];
  let index = 0;
  for await (const file of files) {
    const name = encoder.encode(file.name);
    const { time, date } = dosDateTime(file.date);
    const at = offset;
    o.onFile?.(file.name, index++);
    const header = localHeader(name, time, date);
    yield header;
    offset += header.length;
    let crc = 0;
    let size = 0;
    const reader = (await file.open()).getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value?.length) continue;
        crc = crc32(value, crc);
        size += value.length;
        if (size >= MAX32) throw new Error('zip: a single file of 4 GB or more is not supported');
        yield value;
        offset += value.length;
        copied += value.length;
        o.onBytes?.(copied);
      }
    } finally {
      reader.releaseLock();
    }
    const descriptor = dataDescriptor(crc, size);
    yield descriptor;
    offset += descriptor.length;
    central.push(centralHeader(name, time, date, crc, size, at, !!o.zip64 || at >= MAX32));
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const c of central) {
    yield c;
    cdSize += c.length;
  }
  const zip64 = !!o.zip64 || cdOffset >= MAX32 || cdSize >= MAX32 || central.length >= 0xffff;
  for (const record of endRecords(central.length, cdSize, cdOffset, zip64)) yield record;
}

/** The archive of `files`, in order, as a stream. */
export function zipStream(
  files: AsyncIterable<ZipSource> | Iterable<ZipSource>,
  options: ZipOptions = {},
): ReadableStream<Uint8Array> {
  const it = chunks(files, options);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await it.return(undefined);
    },
  });
}
