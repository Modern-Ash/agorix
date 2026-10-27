import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import type { OriReviewDecisionInput, OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriPersistedReadinessService } from "./oriPersistedReadiness.js";
import { buildOriMig03AcceptanceManifest } from "./oriMig03AcceptanceManifest.js";

/**
 * Internal, server-only administrative facade. The host must authenticate and
 * authorize the educator. No browser-controlled principal or rollout switch.
 */
export function createOriAtomicAdminService(
  store: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  authorize: (session: unknown) => Promise<OriVerifiedEducator | null>,
) {
  const readiness = createOriPersistedReadinessService(store);
  return Object.freeze({
    async acceptanceManifest(session: unknown, id: string, provenance: {
      readonly evidenceDigest: string;
      readonly verified: boolean;
    }) {
      const principal = await authorize(session);
      if (!principal?.canReviewOri) return null;
      return buildOriMig03AcceptanceManifest(store, id, provenance);
    },
    async readiness(session: unknown, id: string, provenance: {
      readonly evidenceDigest: string;
      readonly verified: boolean;
    }) {
      const principal = await authorize(session);
      if (!principal?.canReviewOri) return null;
      return readiness.assess(id, provenance);
    },
    async publishEvidence(id: string, matrix: OriMissionDivergenceMatrix,
      expectedRevision?: number) {
      // Publication is a trusted system operation, not an educator action.
      return store.publish(id, matrix, expectedRevision);
    },
    async snapshot(session: unknown, id: string) {
      const principal = await authorize(session);
      if (!principal?.canReviewOri) return null;
      const state = store.get(id);
      if (!state) return null;
      return Object.freeze({
        evidenceDigest: state.digest,
        revision: state.revision,
        missions: state.matrix.rows.map((row) => row.missionId),
        signoff: store.signoff(id),
        rolloutAuthorized: false as const,
      });
    },
    async decide(session: unknown, id: string, expectedDigest: string,
      expectedRevision: number, input: OriReviewDecisionInput) {
      const principal = await authorize(session);
      if (!principal?.canReviewOri) return "unauthorized" as const;
      return store.submit(id, expectedDigest, expectedRevision, principal, input);
    },
    async audit(session: unknown, id: string) {
      const principal = await authorize(session);
      if (!principal?.canReviewOri) return null;
      return store.audit(id);
    },
  });
}
