import { createHash } from "node:crypto";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { assessOriMig03Readiness, type OriMig03Readiness } from "./oriMig03Readiness.js";
import type { OriEducatorDecision } from "./oriEducatorSignoff.js";

/**
 * Reconstructs human review decisions from append-only audit events and
 * validates them against the current atomic evidence snapshot.
 * Caller must be an authenticated adult administrative host.
 */
export function createOriPersistedReadinessService(
  store: ReturnType<typeof openOriAtomicEducatorReviewStore>,
) {
  return Object.freeze({
    assess(reviewId: string, provenance: {
      readonly evidenceDigest: string;
      readonly verified: boolean;
    }): (OriMig03Readiness & {
      readonly evidenceDigest: string;
      readonly revision: number;
    }) | null {
      const state = store.get(reviewId);
      if (!state) return null;
      const verified = provenance.verified && provenance.evidenceDigest === state.digest;
      const events = store.audit(reviewId);
      const decisions: OriEducatorDecision[] = events.filter((event) =>
        event["digest"] === state.digest &&
        (event["event"] === "approve" || event["event"] === "reject")
      ).map((event) => ({
        missionId: String(event["mission_id"]),
        reviewerId: String(event["reviewer_id"]),
        decision: String(event["event"]) as "approve" | "reject",
        // The audit event alone does not retain the rationale; never fabricate it.
        rationale: "",
      }));
      // Audit-only records are insufficient to establish reasoned signoff.
      const readiness = assessOriMig03Readiness(state.matrix, decisions, verified);
      return Object.freeze({
        ...readiness,
        evidenceDigest: state.digest,
        revision: state.revision,
      });
    },
  });
}
