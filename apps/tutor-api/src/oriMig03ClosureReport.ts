import type { OriMig03AcceptanceManifest } from "./oriMig03AcceptanceManifest.js";

export interface OriMig03ClosureReport {
  readonly schemaVersion: "agorix/ori-mig03-closure/v1";
  readonly reviewId: string;
  readonly evidenceDigest: string;
  readonly technicalStatus: "ready-for-review" | "blocked";
  readonly formalClosure: "pending-human-approval";
  readonly blockers: readonly string[];
  readonly nextStage: "MIG-03";
  readonly rolloutAuthorized: false;
}

/**
 * Deterministic closure preparation, never a self-approval mechanism.
 * The human evaluator must verify actual pedagogical behavior separately.
 */
export function buildOriMig03ClosureReport(
  manifest: OriMig03AcceptanceManifest,
  checks: {
    readonly crossRepoRuntimePassed: boolean;
    readonly adminHttpVerticalPassed: boolean;
    readonly formattingPassed: boolean;
  },
): OriMig03ClosureReport {
  const blockers = [...manifest.blockers];
  if (!checks.crossRepoRuntimePassed) blockers.push("cross-repo-runtime-unverified");
  if (!checks.adminHttpVerticalPassed) blockers.push("admin-http-vertical-unverified");
  if (!checks.formattingPassed) blockers.push("formatting-check-failed");
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-closure/v1",
    reviewId: manifest.reviewId,
    evidenceDigest: manifest.evidenceDigest,
    technicalStatus: blockers.length === 0 ? "ready-for-review" : "blocked",
    formalClosure: "pending-human-approval",
    blockers: Object.freeze(blockers),
    nextStage: "MIG-03",
    rolloutAuthorized: false,
  });
}
