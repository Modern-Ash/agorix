/**
 * Validates an in-memory educator review event stream for continuity.
 * This is not cryptographic proof of persistence or tamper resistance.
 */
export interface OriReviewAuditEvent {
  readonly revision: number;
  readonly evidenceDigest: string;
  readonly missionId: string;
  readonly reviewerId: string;
  readonly decision: "approve" | "reject" | "evidence-replaced";
}

export function validateOriReviewAudit(
  events: readonly OriReviewAuditEvent[],
): { readonly valid: boolean; readonly reason: string | null } {
  let previousRevision = 0;
  let currentDigest: string | null = null;
  const seen = new Set<string>();
  for (const event of events) {
    if (!Number.isSafeInteger(event.revision) || event.revision <= previousRevision)
      return { valid: false, reason: "non-monotonic-revision" };
    if (!/^[a-f0-9]{64}$/.test(event.evidenceDigest))
      return { valid: false, reason: "invalid-digest" };
    if (event.decision === "evidence-replaced") {
      if (currentDigest === event.evidenceDigest || event.missionId !== "")
        return { valid: false, reason: "invalid-evidence-transition" };
      currentDigest = event.evidenceDigest;
      seen.clear();
    } else {
      if (!event.missionId || !event.reviewerId || seen.has(event.missionId))
        return { valid: false, reason: "invalid-review-event" };
      if (currentDigest !== null && currentDigest !== event.evidenceDigest)
        return { valid: false, reason: "unannounced-evidence-change" };
      currentDigest ??= event.evidenceDigest;
      seen.add(event.missionId);
    }
    previousRevision = event.revision;
  }
  return { valid: true, reason: null };
}
