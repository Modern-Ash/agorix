import type { OriPedagogicalFixture } from "./oriPedagogicalEvaluation.js";
import {
  prepareOriBlindComparisonPair,
  type OriBlindComparisonBundle,
  type OriHintCandidate,
} from "./oriBlindComparisonPairs.js";

/**
 * Balanced, deterministic A/B batches for synthetic educator evaluations.
 * Source mapping must remain restricted to the evaluation coordinator.
 */
export interface OriEvaluationCase {
  readonly fixture: OriPedagogicalFixture;
  readonly ori: OriHintCandidate;
  readonly deterministic: OriHintCandidate;
}
export interface OriBalancedEvaluationBatch {
  readonly pairs: readonly OriBlindComparisonBundle["pair"][];
  readonly keys: readonly OriBlindComparisonBundle["key"][];
}
export function prepareOriBalancedEvaluationBatch(
  cases: readonly OriEvaluationCase[],
  startWithOri = true,
): OriBalancedEvaluationBatch | null {
  if (typeof startWithOri !== "boolean" || cases.length === 0 || cases.length > 100) return null;
  const seen = new Set<string>();
  const pairs: OriBlindComparisonBundle["pair"][] = [];
  const keys: OriBlindComparisonBundle["key"][] = [];
  for (const [index, entry] of cases.entries()) {
    if (!entry?.fixture || seen.has(entry.fixture.id)) return null;
    seen.add(entry.fixture.id);
    const bundle = prepareOriBlindComparisonPair(
      entry.fixture,
      entry.ori,
      entry.deterministic,
      index % 2 === 0 ? startWithOri : !startWithOri,
    );
    if (!bundle) return null;
    pairs.push(bundle.pair);
    keys.push(bundle.key);
  }
  return Object.freeze({
    pairs: Object.freeze(pairs),
    keys: Object.freeze(keys),
  });
}
