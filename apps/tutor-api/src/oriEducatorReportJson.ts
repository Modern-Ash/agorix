import {
  buildOriEducatorOfflineReport,
  type OriEducatorReportInput,
  type OriEducatorOfflineReport,
} from "./oriEducatorOfflineReport.js";

/**
 * Strict bounded offline JSON import. No network access or persistence.
 * Source keys must be handled by a trusted evaluation coordinator.
 */
export function parseOriEducatorReportJson(
  raw: string,
  maxBytes = 65_536,
): OriEducatorOfflineReport | null {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 1_048_576)
    throw new RangeError("Invalid educator report import limit");
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "keys,submissions") return null;
  try {
    return buildOriEducatorOfflineReport(record as unknown as OriEducatorReportInput);
  } catch {
    return null;
  }
}
export function serializeOriEducatorReport(report: OriEducatorOfflineReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}
