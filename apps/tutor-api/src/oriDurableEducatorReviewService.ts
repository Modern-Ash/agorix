import { createHash } from "node:crypto";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";
import { assessOriEducatorSignoff } from "./oriEducatorSignoff.js";
import type { OriReviewDecisionInput, OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";
import { openOriSqliteEducatorReviewStore } from "./oriSqliteEducatorReviewStore.js";

export interface OriTrustedEvidenceSnapshot {
  readonly matrix: OriMissionDivergenceMatrix;
  readonly digest: string;
}
export interface OriTrustedEvidenceSource {
  read(reviewId: string): Promise<OriTrustedEvidenceSnapshot | null>;
}
export function digestOriReviewMatrix(matrix: OriMissionDivergenceMatrix): string {
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
 * Server-only review service. The trusted evidence source must be authoritative
 * and synchronized with the SQLite store by the host. No HTTP or rollout.
 */
export function createOriDurableEducatorReviewService(
  store: ReturnType<typeof openOriSqliteEducatorReviewStore>,
  evidence: OriTrustedEvidenceSource,
) {
  async function verified(id: string) {
    const snapshot = await evidence.read(id);
    if (!snapshot || snapshot.digest !== digestOriReviewMatrix(snapshot.matrix)) return null;
    return snapshot;
  }
  return Object.freeze({
    async initialize(id: string): Promise<boolean> {
      const source = await verified(id);
      if (
        !source ||
        createOriEducatorReviewPackage(source.matrix).evidenceQuality.status !==
          "complete-technical-evidence"
      )
        return false;
      return store.initialize(id, source.digest);
    },
    async submit(
      id: string,
      expectedDigest: string,
      expectedRevision: number,
      principal: OriVerifiedEducator | null,
      input: OriReviewDecisionInput,
    ) {
      if (!principal?.canReviewOri) return "unauthorized" as const;
      const source = await verified(id);
      if (!source) return "invalid" as const;
      const current = store.get(id);
      if (!current || current.evidenceDigest !== source.digest) return "conflict" as const;
      if (source.digest !== expectedDigest) return "conflict" as const;
      const review = createOriEducatorReviewPackage(source.matrix);
      if (review.evidenceQuality.status !== "complete-technical-evidence")
        return "invalid" as const;
      return store.submit(
        id,
        expectedDigest,
        expectedRevision,
        principal,
        input,
        review.reviewItems.map((item) => item.missionId),
      );
    },
    async signoff(id: string) {
      const source = await verified(id);
      const state = store.get(id);
      if (!source || !state || state.evidenceDigest !== source.digest) return null;
      const review = createOriEducatorReviewPackage(source.matrix);
      const result = assessOriEducatorSignoff(review, state.decisions);
      return Object.freeze({ ...result, evidenceDigest: source.digest, revision: state.revision });
    },
    async reconcile(id: string): Promise<boolean> {
      const source = await verified(id);
      const state = store.get(id);
      if (!source || !state) return false;
      if (state.evidenceDigest === source.digest) return true;
      return store.replaceEvidence(id, state.revision, source.digest);
    },
  });
}
