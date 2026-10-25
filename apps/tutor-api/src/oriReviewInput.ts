import type { OriExternalShadowInput } from "./oriExternalShadow.js";

/**
 * Strict parser for a future adult-only Ori review request.
 * Does not register a route or accept child data.
 */
export function parseOriReviewInput(raw: string, maxBytes = 512): OriExternalShadowInput | null {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 64 || maxBytes > 4096)
    throw new RangeError("Invalid Ori review body limit");
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "hintLevel,missionIndex,scriptCount" ||
    !Number.isSafeInteger(record.missionIndex) ||
    (record.missionIndex as number) < 0 ||
    (record.missionIndex as number) > 1000 ||
    !Number.isSafeInteger(record.hintLevel) ||
    (record.hintLevel as number) < 1 ||
    (record.hintLevel as number) > 5 ||
    !Number.isSafeInteger(record.scriptCount) ||
    (record.scriptCount as number) < 0 ||
    (record.scriptCount as number) > 1000
  )
    return null;
  return Object.freeze({
    missionIndex: record.missionIndex as number,
    hintLevel: record.hintLevel as 1 | 2 | 3 | 4 | 5,
    scriptCount: record.scriptCount as number,
  });
}
