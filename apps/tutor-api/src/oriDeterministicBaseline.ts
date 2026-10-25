import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { computeKidsOri } from "@agorix/ori-agent";

/**
 * Reproducible execution of the existing Kids deterministic rule provider.
 * The output is a structured offer, NOT a pedagogical hint or a shadow plan.
 * Do not relabel it as a hint in educator A/B evaluation.
 */
export interface OriDeterministicBaselineRecord {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly source: "agorix-deterministic-rule";
  readonly kind: "move" | "turn" | "repeat" | "done" | "wall" | "passed";
  readonly amount?: number;
  readonly hasReviewableProposal: boolean;
  readonly starterProgramUnchanged: boolean;
}
export function captureOriDeterministicBaseline(): readonly OriDeterministicBaselineRecord[] {
  return Object.freeze(KIDS_MISSION_IDS.map((missionId, missionIndex) => {
    const mission = getKidsMission(missionId, "es");
    const before = JSON.stringify(mission.starterProject);
    const offer = computeKidsOri(mission.starterProject, mission, missionIndex, "es");
    const unchanged = JSON.stringify(mission.starterProject) === before;
    return Object.freeze({
      missionId,
      missionIndex,
      source: "agorix-deterministic-rule" as const,
      kind: offer.kind,
      ...(offer.amount === undefined ? {} : { amount: offer.amount }),
      hasReviewableProposal: offer.proposal !== undefined,
      starterProgramUnchanged: unchanged,
    });
  }));
}
