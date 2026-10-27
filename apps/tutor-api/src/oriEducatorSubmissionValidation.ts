import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

export interface OriEducatorSubmission {
  readonly missionId: string;
  readonly reviewerId: string;
  readonly disposition: "approve" | "reject";
  readonly rationale: string;
  readonly evidenceRefs: Readonly<Record<string, string>>;
}
export interface OriEducatorSubmissionValidation {
  readonly status: "complete-for-recording" | "blocked";
  readonly blockers: readonly string[];
  readonly reviewed: number;
  readonly required: number;
  readonly rolloutAuthorized: false;
}

/**
 * Checks the completeness of human-provided decisions without fabricating
 * evidence or verifying its authenticity. The host must authenticate the
 * reviewer, resolve evidence refs and bind submissions to an evidence digest.
 */
export function validateOriEducatorSubmissions(
  handoff: OriMig03ReviewHandoff,
  submissions: readonly OriEducatorSubmission[],
): OriEducatorSubmissionValidation {
  const blockers: string[] = [];
  const expected = new Map(handoff.pendingEvidence.map((item) => [item.missionId, item]));
  const seen = new Set<string>();
  for (const submission of submissions) {
    const item = expected.get(submission.missionId);
    if (!item || seen.has(submission.missionId)) {
      blockers.push("unknown-or-duplicate-mission");
      continue;
    }
    seen.add(submission.missionId);
    if (!submission.reviewerId.trim() || submission.reviewerId.length > 128 ||
        submission.rationale.trim().length < 12 || submission.rationale.length > 2000)
      blockers.push("invalid-reviewer-or-rationale");
    if (submission.disposition !== "approve" && submission.disposition !== "reject")
      blockers.push("invalid-disposition");
    if (submission.disposition === "reject") blockers.push("educator-rejection");
    if (item.requiredEvidence.some((key) => {
      const value = submission.evidenceRefs?.[key];
      return typeof value !== "string" || value.trim().length === 0 || value.length > 512;
    })) blockers.push("missing-required-evidence");
  }
  if (seen.size !== expected.size || handoff.deferredMissionIds.length > 0)
    blockers.push("review-coverage-incomplete");
  if (handoff.unresolvedMissionIds.length > 0)
    blockers.push("unresolved-technical-findings");
  return Object.freeze({
    status: blockers.length === 0 ? "complete-for-recording" : "blocked",
    blockers: Object.freeze([...new Set(blockers)]),
    reviewed: seen.size,
    required: expected.size,
    rolloutAuthorized: false,
  });
}
