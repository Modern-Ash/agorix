import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";
import {
  prepareOriBalancedEvaluationBatch,
  type OriBalancedEvaluationBatch,
} from "./oriBalancedEvaluationBatch.js";
import type { OriHintCandidate } from "./oriBlindComparisonPairs.js";

/**
 * Offline evaluation capture. Requires actual Ori plan responses and independently
 * supplied deterministic tutor responses; never fabricates either provider output.
 */
export interface OriDeterministicCandidate {
  readonly fixtureId: string;
  readonly hint: string;
  readonly nextStep: string;
}
export interface OriEducatorCandidateCapture {
  readonly batch: OriBalancedEvaluationBatch;
  readonly capturedFixtureIds: readonly string[];
}
export async function captureOriEducatorCandidates(
  consumer: OriPlanConsumer,
  deterministic: readonly OriDeterministicCandidate[],
  startWithOri = true,
): Promise<OriEducatorCandidateCapture | null> {
  if (deterministic.length !== oriPedagogicalFixtures.length) return null;
  const byId = new Map<string, OriDeterministicCandidate>();
  for (const candidate of deterministic) {
    if (!candidate || typeof candidate.fixtureId !== "string" || byId.has(candidate.fixtureId))
      return null;
    byId.set(candidate.fixtureId, candidate);
  }
  const cases = [];
  for (const fixture of oriPedagogicalFixtures) {
    const baseline = byId.get(fixture.id);
    if (!baseline) return null;
    const plan = await consumer.evaluate({
      missionIndex: fixture.missionIndex,
      hintLevel: fixture.hintLevel,
      scriptCount: 1,
    });
    if (!plan || plan.stage !== fixture.hintLevel || plan.context.missionStage !== fixture.missionIndex)
      return null;
    const ori: OriHintCandidate = { hint: plan.hint, nextStep: plan.steps[0] };
    const existing: OriHintCandidate = { hint: baseline.hint, nextStep: baseline.nextStep };
    cases.push({ fixture, ori, deterministic: existing });
  }
  const batch = prepareOriBalancedEvaluationBatch(cases, startWithOri);
  if (!batch) return null;
  return Object.freeze({
    batch,
    capturedFixtureIds: Object.freeze(oriPedagogicalFixtures.map((fixture) => fixture.id)),
  });
}
