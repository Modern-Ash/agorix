import { bytesOfDataUrl, type ScratchPicture } from "./kidsScratchExport.js";

/**
 * A picture of the child's, kept in the project as a PNG or WebP data URL, as a PNG for a Scratch
 * file (Scratch does not open WebP). A PNG is used as it is; a WebP is redrawn on a canvas on this
 * device. Nothing leaves the device and nothing is added to the picture.
 */
export type PictureDecoder = (dataUrl: string) => Promise<ScratchPicture | null>;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngPicture(bytes: Uint8Array): ScratchPicture | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, at) => bytes[at] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { png: bytes, width, height } : null;
}

/** Redraws any image the browser can read as a PNG. */
export const decodeInBrowser: PictureDecoder = async (dataUrl) => {
  try {
    // An image element, not a fetch: a data: picture is already allowed to be shown, and a fetch
    // of it would need the page's connection rules to allow it.
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (out === null) return null;
    return pngPicture(new Uint8Array(await out.arrayBuffer()));
  } catch {
    return null;
  }
};

export async function scratchPictureOf(
  dataUrl: string,
  decode: PictureDecoder = decodeInBrowser,
): Promise<ScratchPicture | null> {
  const bytes = bytesOfDataUrl(dataUrl);
  if (bytes === null) return null;
  return pngPicture(bytes) ?? (await decode(dataUrl));
}
