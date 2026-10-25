import { createHash } from "node:crypto";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { computeKidsOri } from "@agorix/ori-agent";

/**
 * Reproducible synthetic canonical Kids starter-program evidence.
 * A SHA-256 fingerprint is computed from the actual serialized starter
 * program, not supplied as an unverified string.
 */
export interface OriCanonicalProgramEvidence {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly scriptCount: number;
  readonly programFingerprint: string;
  readonly deterministicKind: "move" | "turn" | "repeat" | "done" | "wall" | "passed";
  readonly hasReviewableProposal: boolean;
  readonly programUnchanged: boolean;
}
export function captureOriCanonicalProgramEvidence(): readonly OriCanonicalProgramEvidence[] {
  return Object.freeze(KIDS_MISSION_IDS.map((missionId, missionIndex) => {
    const mission = getKidsMission(missionId, "es");
    const serialized = JSON.stringify(mission.starterProject);
    const fingerprint = createHash("sha256").update(serialized, "utf8").digest("hex");
    const offer = computeKidsOri(mission.starterProject, mission, missionIndex, "es");
    return Object.freeze({
      missionId,
      missionIndex,
      scriptCount: mission.starterProject.scripts.length,
      programFingerprint: fingerprint,
      deterministicKind: offer.kind,
      hasReviewableProposal: offer.proposal !== undefined,
      programUnchanged: JSON.stringify(mission.starterProject) === serialized,
    });
  }));
}
