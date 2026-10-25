import type { OriPedagogicalFixture } from "./oriPedagogicalEvaluation.js";

/**
 * Deterministic blinded pair preparation from synthetic teaching examples.
 * Mapping is held separately and must not be shown to educator raters.
 */
export interface OriHintCandidate {
  readonly hint: string;
  readonly nextStep: string;
}
export interface OriBlindComparisonPair {
  readonly fixtureId: string;
  readonly topic: OriPedagogicalFixture["topic"];
  readonly A: OriHintCandidate;
  readonly B: OriHintCandidate;
}
export interface OriBlindComparisonKey {
  readonly fixtureId: string;
  readonly oriCandidate: "A" | "B";
  readonly deterministicCandidate: "A" | "B";
}
export interface OriBlindComparisonBundle {
  readonly pair: OriBlindComparisonPair;
  readonly key: OriBlindComparisonKey;
}
function valid(candidate: OriHintCandidate): boolean {
  return (
    typeof candidate.hint === "string" &&
    candidate.hint.trim().length >= 8 &&
    candidate.hint.length <= 180 &&
    typeof candidate.nextStep === "string" &&
    candidate.nextStep.trim().length >= 8 &&
    candidate.nextStep.length <= 140
  );
}
export function prepareOriBlindComparisonPair(
  fixture: OriPedagogicalFixture,
  ori: OriHintCandidate,
  deterministic: OriHintCandidate,
  oriFirst: boolean,
): OriBlindComparisonBundle | null {
  if (!/^[a-z0-9-]{1,64}$/.test(fixture.id) || !valid(ori) || !valid(deterministic))
    return null;
  if (typeof oriFirst !== "boolean") return null;
  const A = Object.freeze({ ...(oriFirst ? ori : deterministic) });
  const B = Object.freeze({ ...(oriFirst ? deterministic : ori) });
  return Object.freeze({
    pair: Object.freeze({
      fixtureId: fixture.id,
      topic: fixture.topic,
      A,
      B,
    }),
    key: Object.freeze({
      fixtureId: fixture.id,
      oriCandidate: oriFirst ? "A" : "B",
      deterministicCandidate: oriFirst ? "B" : "A",
    }),
  });
}
