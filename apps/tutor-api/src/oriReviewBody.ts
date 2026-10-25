import type { IncomingMessage } from "node:http";
import { parseOriReviewInput } from "./oriReviewInput.js";
import type { OriExternalShadowInput } from "./oriExternalShadow.js";

/**
 * Bounded streaming parser for future adult-only Ori review routes.
 * No route is registered. Never logs or retains rejected payloads.
 */
export async function readOriReviewBody(
  request: AsyncIterable<Uint8Array>,
  maxBytes = 512,
): Promise<OriExternalShadowInput | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 64 || maxBytes > 4096)
    throw new RangeError("Invalid Ori review body limit");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of request) {
      total += chunk.byteLength;
      if (total > maxBytes) return null;
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    return parseOriReviewInput(text, maxBytes);
  } catch {
    return null;
  }
}
export type OriReviewBodySource = IncomingMessage;
