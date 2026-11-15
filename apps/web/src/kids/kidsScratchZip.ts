/**
 * Reads `project.json` out of a Scratch `.sb3` (a zip). Only that one entry is read, with hard
 * limits on what is accepted, and nothing from the file is executed. A bare `project.json` is
 * accepted too.
 */
export const SCRATCH_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const SCRATCH_MAX_PROJECT_BYTES = 8 * 1024 * 1024;

const decoder = new TextDecoder();

async function inflate(data: Uint8Array, limit = SCRATCH_MAX_PROJECT_BYTES): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new RangeError("the project is too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function readScratchProject(buffer: ArrayBuffer): Promise<unknown> {
  if (buffer.byteLength > SCRATCH_MAX_FILE_BYTES) throw new RangeError("the file is too large");
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    if (bytes.length > SCRATCH_MAX_PROJECT_BYTES) throw new RangeError("the project is too large");
    return JSON.parse(decoder.decode(bytes)) as unknown;
  }
  // End of central directory: the last 22+ bytes, signature 0x06054b50.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new RangeError("not a zip file");
  const entries = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  for (let n = 0; n < entries && pointer + 46 <= bytes.length; n += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const compressed = view.getUint32(pointer + 20, true);
    const size = view.getUint32(pointer + 24, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const local = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    pointer += 46 + nameLength + extraLength + commentLength;
    if (name !== "project.json") continue;
    if (size > SCRATCH_MAX_PROJECT_BYTES) throw new RangeError("the project is too large");
    if (view.getUint32(local, true) !== 0x04034b50) throw new RangeError("not a zip file");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + compressed);
    const text =
      method === 0
        ? data
        : method === 8
          ? await inflate(data)
          : (() => {
              throw new RangeError("unsupported zip compression");
            })();
    return JSON.parse(decoder.decode(text)) as unknown;
  }
  throw new RangeError("project.json not found in the file");
}

/** Most bytes one picture inside a `.sb3` may have, before and after it is unpacked. */
export const SCRATCH_MAX_PICTURE_BYTES = 2 * 1024 * 1024;
/** Most pictures read from one file, and most bytes all of them may take together. */
export const SCRATCH_MAX_PICTURES = 32;
export const SCRATCH_MAX_PICTURES_BYTES = 12 * 1024 * 1024;

/** A picture is named by the md5 of its bytes plus its extension, as Scratch writes it. */
const PICTURE_NAME = /^[0-9a-f]{32}\.(png|svg|jpg|jpeg|webp|gif)$/;

export interface ScratchPictureFile {
  readonly name: string;
  readonly type: "image/png" | "image/svg+xml" | "image/jpeg" | "image/webp" | "image/gif";
  readonly bytes: Uint8Array;
}

const PICTURE_TYPES: Readonly<Record<string, ScratchPictureFile["type"]>> = {
  png: "image/png",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Reads only the named pictures out of an `.sb3`, never anything else: each name must look like a
 * Scratch picture file name, at most SCRATCH_MAX_PICTURES are read, and each picture and all of
 * them together stay under a size cap, before and after unpacking. A name the file does not hold,
 * or a picture over a cap, is simply not in the result. Nothing is executed or sent anywhere.
 */
export async function readScratchPictures(
  buffer: ArrayBuffer,
  wanted: readonly string[],
): Promise<readonly ScratchPictureFile[]> {
  if (buffer.byteLength > SCRATCH_MAX_FILE_BYTES) throw new RangeError("the file is too large");
  const names = new Set(
    wanted.filter((name) => PICTURE_NAME.test(name)).slice(0, SCRATCH_MAX_PICTURES),
  );
  const bytes = new Uint8Array(buffer);
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip || names.size === 0) return [];
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const entries = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const found: ScratchPictureFile[] = [];
  let total = 0;
  for (let n = 0; n < entries && pointer + 46 <= bytes.length; n += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const compressed = view.getUint32(pointer + 20, true);
    const size = view.getUint32(pointer + 24, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const local = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    pointer += 46 + nameLength + extraLength + commentLength;
    if (!names.has(name)) continue;
    if (size > SCRATCH_MAX_PICTURE_BYTES || compressed > SCRATCH_MAX_PICTURE_BYTES) continue;
    if (total + size > SCRATCH_MAX_PICTURES_BYTES) continue;
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > bytes.length) continue;
    const data = bytes.subarray(start, start + compressed);
    try {
      const unpacked =
        method === 0 ? data : method === 8 ? await inflate(data, SCRATCH_MAX_PICTURE_BYTES) : null;
      if (unpacked === null || unpacked.length !== size) continue;
      total += unpacked.length;
      found.push({
        name,
        type: PICTURE_TYPES[name.slice(name.lastIndexOf(".") + 1)]!,
        bytes: unpacked,
      });
    } catch {
      // A picture that will not unpack is left out like one that is too big.
    }
  }
  return found;
}
