import { createHash } from "node:crypto";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";
import { assessOriEducatorSignoff, type OriEducatorDecision } from "./oriEducatorSignoff.js";

/** An authenticated host supplies this identity; never accept it from a request body. */
export interface OriVerifiedEducator {
  readonly id: string;
  readonly canReviewOri: boolean;
}
export interface OriReviewDecisionInput {
  readonly missionId: string;
  readonly decision: "approve" | "reject";
  readonly rationale: string;
}
export interface OriReviewSnapshot {
  readonly evidenceDigest: string;
  readonly revision: number;
  readonly status: "pending" | "approved" | "blocked";
  readonly reviewed: number;
  readonly required: number;
  readonly rolloutAuthorized: false;
}

function digest(matrix: OriMissionDivergenceMatrix): string {
  // Stable canonical order and explicit schema prevent accidental reuse across
  // different evidence matrices. No learner data is included.
  const rows = [...matrix.rows].sort(
    (a, b) => a.missionIndex - b.missionIndex || a.missionId.localeCompare(b.missionId),
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: "agorix/ori-educator-evidence/v1",
        total: matrix.total,
        available: matrix.available,
        missing: matrix.missing,
        divergent: matrix.divergent,
        rows,
      }),
    )
    .digest("hex");
}

/**
 * In-memory administrative review workflow. A production host must provide
 * authenticated identities and durable, atomic storage before deployment.
 * Every decision is bound to a specific evidence digest and CAS revision.
 */
export function createOriEducatorReviewWorkflow(initial: OriMissionDivergenceMatrix) {
  let matrix = initial;
  let evidenceDigest = digest(matrix);
  let revision = 1;
  let decisions = new Map<string, OriEducatorDecision>();
  let audit: ReadonlyArray<{
    readonly revision: number;
    readonly evidenceDigest: string;
    readonly missionId: string;
    readonly reviewerId: string;
    readonly decision: "approve" | "reject" | "evidence-replaced";
  }> = [];

  function snapshot(): OriReviewSnapshot {
    const review = createOriEducatorReviewPackage(matrix);
    const signoff = assessOriEducatorSignoff(review, [...decisions.values()]);
    return Object.freeze({
      evidenceDigest,
      revision,
      status: decisions.size === 0 ? "pending" : signoff.status,
      reviewed: signoff.reviewed,
      required: signoff.required,
      rolloutAuthorized: false,
    });
  }

  return Object.freeze({
    snapshot,
    audit: () => Object.freeze([...audit]),
    submit(
      principal: OriVerifiedEducator | null,
      expectedDigest: string,
      expectedRevision: number,
      input: OriReviewDecisionInput,
    ): "recorded" | "unauthorized" | "conflict" | "invalid" {
      if (!principal?.canReviewOri || !principal.id || principal.id.length > 128)
        return "unauthorized";
      if (expectedDigest !== evidenceDigest || expectedRevision !== revision) return "conflict";
      const review = createOriEducatorReviewPackage(matrix);
      if (
        !review.reviewItems.some((item) => item.missionId === input.missionId) ||
        decisions.has(input.missionId) ||
        !["approve", "reject"].includes(input.decision) ||
        typeof input.rationale !== "string" ||
        input.rationale.trim().length < 12 ||
        input.rationale.length > 2000
      )
        return "invalid";
      const decision: OriEducatorDecision = Object.freeze({
        missionId: input.missionId,
        decision: input.decision,
        reviewerId: principal.id,
        rationale: input.rationale,
      });
      decisions.set(input.missionId, decision);
      revision++;
      audit = [
        ...audit,
        Object.freeze({
          revision,
          evidenceDigest,
          missionId: decision.missionId,
          reviewerId: principal.id,
          decision: decision.decision,
        }),
      ];
      return "recorded";
    },
    replaceEvidence(next: OriMissionDivergenceMatrix): boolean {
      const nextDigest = digest(next);
      if (nextDigest === evidenceDigest) return false;
      matrix = next;
      evidenceDigest = nextDigest;
      decisions = new Map();
      revision++;
      audit = [
        ...audit,
        Object.freeze({
          revision,
          evidenceDigest,
          missionId: "",
          reviewerId: "system",
          decision: "evidence-replaced" as const,
        }),
      ];
      return true;
    },
  });
}
