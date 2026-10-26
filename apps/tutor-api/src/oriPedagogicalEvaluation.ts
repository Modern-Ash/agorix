import type { OriShadowPlan } from "./oriShadowPlanValidation.js";
import { validateOriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Deterministic, conservative pre-screening for synthetic pedagogical fixtures.
 * This is NOT a child-safety classifier or a substitute for educator review.
 */
export interface OriPedagogicalFixture {
  readonly id: string;
  readonly topic: "movement" | "sequence" | "loops" | "events" | "debugging";
  readonly missionIndex: number;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly expectedConcepts: readonly string[];
  readonly forbiddenPhrases: readonly string[];
}
export interface OriPedagogicalAssessment {
  readonly fixtureId: string;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}
export function assessOriPedagogicalPlan(
  fixture: OriPedagogicalFixture,
  candidate: unknown,
): OriPedagogicalAssessment {
  const reasons: string[] = [];
  const plan = validateOriShadowPlan(candidate);
  if (!plan) reasons.push("invalid-contract");
  else {
    if (plan.stage !== fixture.hintLevel || plan.context.missionStage !== fixture.missionIndex)
      reasons.push("context-mismatch");
    const text = [plan.hint, ...plan.steps].join(" ").toLocaleLowerCase("es");
    if (!fixture.expectedConcepts.some((concept) => text.includes(concept.toLocaleLowerCase("es"))))
      reasons.push("missing-learning-concept");
    if (fixture.forbiddenPhrases.some((phrase) => text.includes(phrase.toLocaleLowerCase("es"))))
      reasons.push("solution-leakage");
    if (plan.hint.trim().length < 8) reasons.push("hint-too-short");
  }
  return Object.freeze({
    fixtureId: fixture.id,
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}
export type OriPedagogicalPlan = OriShadowPlan;
