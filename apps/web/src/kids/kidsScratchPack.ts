/**
 * Packs a Scratch `.sb3`: a zip with `project.json` and the picture files it names. Everything is
 * stored without compression, so the writer is a few lines and its output is byte-for-byte the same
 * for the same input. A Scratch project names each asset by the MD5 of its bytes, so MD5 lives here
 * too; it is only a file name, never a security check.
 */
const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = Array.from({ length: 64 }, (_value, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32),
);

/** The MD5 of some bytes as 32 lowercase hex digits. */
export function md5Hex(input: Uint8Array): string {
  const padded = new Uint8Array((((input.length + 8) >> 6) << 6) + 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (input.length << 3) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(input.length / 2 ** 29), true);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let offset = 0; offset < padded.length; offset += 64) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i += 1) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const sum = (a + f + K[i]! + view.getUint32(offset + g * 4, true)) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << SHIFTS[i]!) | (sum >>> (32 - SHIFTS[i]!)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((word, index) => out.setUint32(index * 4, word, true));
  return [...new Uint8Array(out.buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface PackedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** A zip of stored (uncompressed) files. */
export function zipStored(files: readonly PackedFile[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length + file.bytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.bytes.length, true);
    lv.setUint32(22, file.bytes.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(file.bytes, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.bytes.length, true);
    cv.setUint32(24, file.bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const size = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
