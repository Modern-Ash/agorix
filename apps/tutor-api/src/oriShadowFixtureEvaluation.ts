import { runOriPairedShadow, type OriShadowScenario, type OriShadowObservation } from "./oriPairedShadowRunner.js";

/**
 * Offline, deterministic adapter seam for golden fixtures. Both evaluators
 * receive exactly the same scenario context. The caller must supply
 * independent legacy and Ori implementations; no model output is fabricated.
 */
export interface OriShadowFixture {
  readonly caseId: string;
  readonly mission: number;
  readonly hintLevel: number;
  readonly stage: "explore" | "connect" | "translate";
}
export type OriShadowEvaluator = (
  input: Readonly<{ mission: number; hintLevel: number; stage: string }>,
) => Promise<OriShadowObservation | null>;

export async function evaluateOriShadowFixtures({
  fixtures,
  legacy,
  ori,
}: {
  readonly fixtures: readonly OriShadowFixture[];
  readonly legacy: OriShadowEvaluator;
  readonly ori: OriShadowEvaluator;
}) {
  const scenarios: OriShadowScenario[] = fixtures.map((fixture) => {
    if (
      !Number.isSafeInteger(fixture.mission) || fixture.mission < 0 ||
      !Number.isSafeInteger(fixture.hintLevel) ||
      fixture.hintLevel < 1 || fixture.hintLevel > 5 ||
      !["explore", "connect", "translate"].includes(fixture.stage)
    ) throw new TypeError("Invalid Ori shadow fixture");
    return {
      caseId: fixture.caseId,
      context: { mission: fixture.mission, hintLevel: fixture.hintLevel, stage: fixture.stage },
    };
  });
  const adapt = (evaluate: OriShadowEvaluator) => async (context: OriShadowScenario["context"]) =>
    evaluate({
      mission: context["mission"] as number,
      hintLevel: context["hintLevel"] as number,
      stage: context["stage"] as string,
    });
  return runOriPairedShadow({ scenarios, legacy: adapt(legacy), ori: adapt(ori) });
}
