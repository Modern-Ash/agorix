import { decodeBundle } from "@agorix/group-lockstep";
import { renderSVG } from "uqr";

export const MAX_PAIRING_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PAIRING_IMAGE_SIDE = 4096;
const MAX_PAIRING_TEXT_CHARS = 2_400;

export type PairingQrErrorCode = "INVALID_IMAGE" | "NO_QR" | "INVALID_BUNDLE";

export class PairingQrError extends Error {
  constructor(readonly code: PairingQrErrorCode) {
    super(code);
    this.name = "PairingQrError";
  }
}

export interface PairingPixels {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export type PairingQrDecoder = (pixels: PairingPixels) => string | null;

export interface PairingQrDependencies {
  readonly loadPixels?: (file: File) => Promise<PairingPixels>;
  readonly decode?: PairingQrDecoder;
}

export function pairingQrDataUrl(value: string): string {
  const svg = renderSVG(value, {
    ecc: "L",
    border: 2,
    pixelSize: 4,
    blackColor: "#17201D",
    whiteColor: "#FFFFFF",
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function isPairingBundle(value: string): boolean {
  try {
    decodeBundle(value.trim());
    return true;
  } catch {
    return false;
  }
}

async function loadPixels(file: File): Promise<PairingPixels> {
  if (typeof createImageBitmap !== "function") throw new PairingQrError("INVALID_IMAGE");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new PairingQrError("INVALID_IMAGE");
  });
  try {
    const { width, height } = bitmap;
    if (
      width < 1 ||
      height < 1 ||
      width > MAX_PAIRING_IMAGE_SIDE ||
      height > MAX_PAIRING_IMAGE_SIDE
    ) {
      throw new PairingQrError("INVALID_IMAGE");
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new PairingQrError("INVALID_IMAGE");
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    return { data: imageData.data, width, height };
  } finally {
    bitmap.close();
  }
}

async function decodePixels(pixels: PairingPixels): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const result = jsQR(pixels.data, pixels.width, pixels.height, {
    inversionAttempts: "dontInvert",
  });
  return result?.data ?? null;
}

export async function readPairingQr(
  file: File,
  dependencies: PairingQrDependencies = {},
): Promise<string> {
  if (
    file.size === 0 ||
    file.size > MAX_PAIRING_IMAGE_BYTES ||
    (file.type !== "" && !file.type.startsWith("image/"))
  ) {
    throw new PairingQrError("INVALID_IMAGE");
  }
  const pixels = await (dependencies.loadPixels ?? loadPixels)(file);
  if (
    pixels.width < 1 ||
    pixels.height < 1 ||
    pixels.width > MAX_PAIRING_IMAGE_SIDE ||
    pixels.height > MAX_PAIRING_IMAGE_SIDE
  ) {
    throw new PairingQrError("INVALID_IMAGE");
  }
  const text = await (dependencies.decode ?? decodePixels)(pixels);
  if (text === null) throw new PairingQrError("NO_QR");
  const value = text.trim();
  if (value.length > MAX_PAIRING_TEXT_CHARS || !isPairingBundle(value)) {
    throw new PairingQrError("INVALID_BUNDLE");
  }
  return value;
}
