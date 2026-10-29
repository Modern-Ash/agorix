import { captureOriDeterministicBaseline } from "./oriDeterministicBaseline.js";
import { compareOriMissionBaselines } from "./oriMissionSemanticReport.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import type { OriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Offline read-only mission capture using the independent Ori plan consumer.
 * Failures are recorded as missing; no synthetic replacement or child data.
 */
export async function captureOriMissionParity(consumer: OriPlanConsumer, hintLevel: 2 | 3 = 2) {
  const plans = new Map<number, OriShadowPlan>();
  for (const mission of captureOriDeterministicBaseline()) {
    try {
      const plan = await consumer.evaluate({
        missionIndex: mission.missionIndex,
        hintLevel,
        scriptCount: 1,
      });
      if (
        plan &&
        plan.context.missionStage === mission.missionIndex &&
        plan.stage === hintLevel &&
        plan.appliedChanges === false
      )
        plans.set(mission.missionIndex, plan);
    } catch {
      // Missing candidate evidence is explicitly reported, never replaced.
    }
  }
  const findings = compareOriMissionBaselines(plans);
  return Object.freeze({
    missions: findings.length,
    available: findings.filter((item) => item.candidateAvailable).length,
    missing: findings.filter((item) => !item.candidateAvailable).length,
    findings,
  });
}
