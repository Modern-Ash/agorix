import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { assessOriMig03Readiness, type OriMig03Readiness } from "./oriMig03Readiness.js";

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
      const decisions = store.decisions(reviewId);
      if (!decisions) return null;
      const readiness = assessOriMig03Readiness(state.matrix, decisions, verified);
      return Object.freeze({
        ...readiness,
        evidenceDigest: state.digest,
        revision: state.revision,
      });
    },
  });
}
