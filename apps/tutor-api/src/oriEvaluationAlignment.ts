import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";
import { createOriSharedPedagogicalContexts } from "./oriSharedPedagogicalContext.js";
import { separateOriEvaluationContext } from "./oriNeutralEvaluationContext.js";

/**
 * Evaluation readiness matrix. Alignment is metadata-only, not evidence
 * that two tutors saw equivalent inputs or produced comparable outputs.
 */
export interface OriEvaluationAlignment {
  readonly fixtureId: string;
  readonly topic: string;
  readonly missionIndex: number;
  readonly canonicalMissionId: string | null;
  readonly metadataAligned: boolean;
  readonly sameProgramContextProven: false;
  readonly comparableTextOutputsProven: false;
  readonly eligibleForBlindStudy: false;
  readonly blockers: readonly string[];
}
export function buildOriEvaluationAlignmentMatrix(): readonly OriEvaluationAlignment[] {
  const contexts = createOriSharedPedagogicalContexts();
  return Object.freeze(oriPedagogicalFixtures.map((fixture) => {
    const missionId = KIDS_MISSION_IDS[fixture.missionIndex] ?? null;
    const shared = contexts.find((context) => context.missionIndex === fixture.missionIndex);
    const separated = shared ? separateOriEvaluationContext(shared) : null;
    const metadataAligned = missionId !== null &&
      separated !== null &&
      separated.neutral.missionId === missionId &&
      separated.neutral.hintLevel === fixture.hintLevel;
    const blockers = [
      ...(missionId === null ? ["no-canonical-kids-mission"] : []),
      ...(!metadataAligned && missionId !== null ? ["hint-level-or-context-mismatch"] : []),
      "ori-shadow-does-not-receive-full-program",
      "deterministic-offer-is-not-text-hint",
    ];
    return Object.freeze({
      fixtureId: fixture.id,
      topic: fixture.topic,
      missionIndex: fixture.missionIndex,
      canonicalMissionId: missionId,
      metadataAligned,
      sameProgramContextProven: false as const,
      comparableTextOutputsProven: false as const,
      eligibleForBlindStudy: false as const,
      blockers: Object.freeze(blockers),
    });
  }));
}
