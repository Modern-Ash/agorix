export type OriServerDecisionStatus =
  | "accepted" | "edited" | "rejected" | "stale" | "unavailable";

/** Reject malformed responses; client must not infer success from HTTP 200 alone. */
export function parseOriServerDecision(raw: unknown): OriServerDecisionStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "unavailable";
  const value = raw as Record<string, unknown>;
  if (value["appliedChanges"] !== false ||
      typeof value["status"] !== "string") return "unavailable";
  if (["accepted", "edited", "rejected", "stale"].includes(value["status"])) {
    return value["status"] as OriServerDecisionStatus;
  }
  return "unavailable";
}
