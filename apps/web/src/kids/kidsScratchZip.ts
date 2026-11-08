/**
 * Reads `project.json` out of a Scratch `.sb3` (a zip). Only that one entry is read, with hard
 * limits on what is accepted, and nothing from the file is executed. A bare `project.json` is
 * accepted too.
 */
export const SCRATCH_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const SCRATCH_MAX_PROJECT_BYTES = 8 * 1024 * 1024;

const decoder = new TextDecoder();

async function inflate(data: Uint8Array): Promise<Uint8Array> {
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
    if (total > SCRATCH_MAX_PROJECT_BYTES) {
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
