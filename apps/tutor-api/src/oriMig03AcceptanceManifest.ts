import { createHash } from "node:crypto";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriPersistedReadinessService } from "./oriPersistedReadiness.js";

export interface OriMig03AcceptanceManifest {
  readonly schemaVersion: "agorix/ori-mig03-acceptance/v1";
  readonly reviewId: string;
  readonly evidenceDigest: string;
  readonly revision: number;
  readonly readiness: "ready-for-human-acceptance" | "blocked";
  readonly blockers: readonly string[];
  readonly auditDigest: string;
  readonly educatorDecisionCount: number;
  readonly rolloutAuthorized: false;
}

/**
 * Deterministic export for independent human review.
 * It records technical evidence and does not constitute a signed approval.
 */
export function buildOriMig03AcceptanceManifest(
  store: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  reviewId: string,
  provenance: { readonly evidenceDigest: string; readonly verified: boolean },
): OriMig03AcceptanceManifest | null {
  const state = store.get(reviewId);
  if (!state) return null;
  const readiness = createOriPersistedReadinessService(store).assess(reviewId, provenance);
  if (!readiness) return null;
  const events = store.audit(reviewId);
  const decisions = store.decisions(reviewId);
  if (!decisions) return null;
  const auditDigest = createHash("sha256").update(JSON.stringify(events)).digest("hex");
  return Object.freeze({
    schemaVersion: "agorix/ori-mig03-acceptance/v1",
    reviewId,
    evidenceDigest: state.digest,
    revision: state.revision,
    readiness: readiness.status,
    blockers: Object.freeze([...readiness.reasons]),
    auditDigest,
    educatorDecisionCount: decisions.length,
    rolloutAuthorized: false,
  });
}
