import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";

export type OriPedagogicalCriterion =
  | "learner-agency"
  | "hint-progression"
  | "conceptual-clarity"
  | "age-appropriateness"
  | "safe-non-application";

export interface OriPedagogicalReviewCase {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly priority: "high" | "normal";
  readonly evidenceReason: string;
  readonly criteria: readonly OriPedagogicalCriterion[];
  readonly outcome: "pending-human-review";
  readonly prompts: readonly string[];
}

const criteria: readonly OriPedagogicalCriterion[] = Object.freeze([
  "learner-agency",
  "hint-progression",
  "conceptual-clarity",
  "age-appropriateness",
  "safe-non-application",
]);
const prompts = Object.freeze([
  "¿El alumno conserva la decisión final y puede rechazar la sugerencia?",
  "¿La pista progresa sin revelar prematuramente la solución?",
  "¿La explicación conecta el concepto con la misión y el programa?",
  "¿El lenguaje y la carga cognitiva son apropiados para la etapa?",
  "¿No se modifica el programa sin una aprobación explícita?",
]);

/** Human evaluation rubric; no LLM score or synthetic parity becomes approval. */
export function buildOriPedagogicalReviewCorpus(
  matrix: OriMissionDivergenceMatrix,
): readonly OriPedagogicalReviewCase[] {
  const review = createOriEducatorReviewPackage(matrix);
  return Object.freeze(
    review.reviewItems.map((item) =>
      Object.freeze({
        missionId: item.missionId,
        missionIndex: item.missionIndex,
        priority: item.priority,
        evidenceReason: item.reason,
        criteria,
        outcome: "pending-human-review" as const,
        prompts,
      }),
    ),
  );
}
