/** Local-only image preparation. Never pass the input Blob to a provider or network request. */
export type KidsImageErrorCode = "unsupportedType" | "tooLarge" | "decodeFailed" | "outputTooLarge";

export class KidsImageError extends Error {
  constructor(readonly code: KidsImageErrorCode) {
    super(code);
    this.name = "KidsImageError";
  }
}

const INPUT_LIMIT = 5 * 1024 * 1024;
const OUTPUT_LIMIT = 60 * 1024;
const SIDE = 256;
// Reject suspicious dimensions before the browser allocates a decoded bitmap.
const MAX_SIDE = 4096;
const MAX_PIXELS = 12_000_000;

type ImageType = "image/png" | "image/jpeg" | "image/webp";
type Dimensions = { width: number; height: number };

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function imageType(bytes: Uint8Array): ImageType | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length >= 16 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return "image/webp";
  return null;
}

function pngDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array): Dimensions | null {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return null;
    if (
      ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)) &&
      length >= 7
    ) {
      return {
        height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
        width: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 30) return null;
  const kind = ascii(bytes, 12, 4);
  if (kind === "VP8X") {
    return {
      width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
      height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16),
    };
  }
  if (kind === "VP8L" && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
      height: 1 + (bytes[22]! >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 0x0f) << 10),
    };
  }
  if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
    };
  }
  return null;
}

function dimensions(bytes: Uint8Array, type: ImageType): Dimensions | null {
  if (type === "image/png") return pngDimensions(bytes);
  if (type === "image/jpeg") return jpegDimensions(bytes);
  return webpDimensions(bytes);
}

/** Returns a freshly encoded 256×256 data URL, never source bytes or metadata. */
export async function processKidsImage(input: Blob): Promise<string> {
  if (input.size > INPUT_LIMIT) throw new KidsImageError("tooLarge");
  if (!["image/png", "image/jpeg", "image/webp"].includes(input.type))
    throw new KidsImageError("unsupportedType");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await input.arrayBuffer());
  } catch {
    throw new KidsImageError("decodeFailed");
  }
  const type = imageType(bytes);
  if (type === null || type !== input.type) throw new KidsImageError("unsupportedType");
  const size = dimensions(bytes, type);
  if (!size || size.width === 0 || size.height === 0) throw new KidsImageError("decodeFailed");
  if (size.width > MAX_SIDE || size.height > MAX_SIDE || size.width * size.height > MAX_PIXELS)
    throw new KidsImageError("tooLarge");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input);
  } catch {
    throw new KidsImageError("decodeFailed");
  }
  try {
    // EXIF orientation may swap dimensions during decode; still enforce the allocation cap.
    if (
      bitmap.width === 0 ||
      bitmap.height === 0 ||
      bitmap.width > MAX_SIDE ||
      bitmap.height > MAX_SIDE ||
      bitmap.width * bitmap.height > MAX_PIXELS
    )
      throw new KidsImageError("tooLarge");
    const canvas = document.createElement("canvas");
    canvas.width = SIDE;
    canvas.height = SIDE;
    const context = canvas.getContext("2d");
    if (!context) throw new KidsImageError("decodeFailed");
    const crop = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      SIDE,
      SIDE,
    );
    for (const quality of [0.82, 0.68, 0.54, 0.4, 0.26]) {
      const url = canvas.toDataURL("image/webp", quality);
      // Browsers without WebP encoding silently fall back to PNG.
      if (!url.startsWith("data:image/webp;base64,")) {
        if (
          url.startsWith("data:image/png;base64,") &&
          Math.ceil((url.length - url.indexOf(",") - 1) * 0.75) < OUTPUT_LIMIT
        )
          return url;
        break;
      }
      if (Math.ceil((url.length - url.indexOf(",") - 1) * 0.75) < OUTPUT_LIMIT) return url;
    }
    throw new KidsImageError("outputTooLarge");
  } catch (error) {
    if (error instanceof KidsImageError) throw error;
    throw new KidsImageError("decodeFailed");
  } finally {
    bitmap.close();
  }
}
