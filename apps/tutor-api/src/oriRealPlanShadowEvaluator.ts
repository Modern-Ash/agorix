import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import type { OriShadowEvaluator } from "./oriShadowFixtureEvaluation.js";

/**
 * Adapter for the independent Ori loopback plan API in offline paired
 * evaluation. This is not a child-facing route or a legacy baseline.
 */
export function createOriRealPlanShadowEvaluator(
  consumer: OriPlanConsumer,
  scriptCount = 1,
): OriShadowEvaluator {
  if (!Number.isSafeInteger(scriptCount) || scriptCount < 0 || scriptCount > 100)
    throw new RangeError("Invalid synthetic script count");
  return async ({ mission, hintLevel }) => {
    if (
      !Number.isSafeInteger(mission) ||
      mission < 0 ||
      !Number.isSafeInteger(hintLevel) ||
      hintLevel < 1 ||
      hintLevel > 5
    )
      return null;
    const plan = await consumer.evaluate({
      missionIndex: mission,
      hintLevel: hintLevel as 1 | 2 | 3 | 4 | 5,
      scriptCount,
    });
    if (!plan || plan.context.missionStage !== mission || plan.stage !== hintLevel) return null;
    return Object.freeze({ kind: plan.kind, hintLevel: plan.stage });
  };
}
