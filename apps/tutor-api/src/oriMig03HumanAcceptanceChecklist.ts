import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";
import { exportOriMig03EducatorAuditJson } from "./oriMig03EducatorAuditExport.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
export interface OriMig03HumanAcceptanceChecklist {
  readonly schema: "agorix/ori-mig03-human-acceptance/v1";
  readonly reviewId: string;
  readonly missionId: string;
  readonly auditHash: string;
  readonly technicalReady: boolean;
  readonly criteria: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly status: "requires-human-assessment";
  }[];
  readonly humanDecisionRequired: true;
  readonly rolloutAuthorized: false;
}
/**
 * Generate the explicit adult review checklist from a verified audit bundle.
 * This cannot produce an approval or a learner-facing decision.
 */
export function buildOriMig03HumanAcceptanceChecklist(
  bundle: Bundle,
): OriMig03HumanAcceptanceChecklist | null {
  if (!exportOriMig03EducatorAuditJson(bundle)) return null;
  return Object.freeze({
    schema: "agorix/ori-mig03-human-acceptance/v1",
    reviewId: bundle.reviewId,
    missionId: bundle.missionId,
    auditHash: bundle.auditHash,
    technicalReady: bundle.technicalReadiness === "ready-for-human-review",
    criteria: Object.freeze([
      {
        id: "autonomy",
        prompt: "¿La pista preserva la decisión del alumno?",
        status: "requires-human-assessment" as const,
      },
      {
        id: "conceptual-clarity",
        prompt: "¿Explica el concepto sin resolver la tarea?",
        status: "requires-human-assessment" as const,
      },
      {
        id: "age-appropriateness",
        prompt: "¿Es comprensible para la etapa educativa?",
        status: "requires-human-assessment" as const,
      },
      {
        id: "runtime-grounding",
        prompt: "¿Se sustenta en la ejecución observada?",
        status: "requires-human-assessment" as const,
      },
      {
        id: "safety",
        prompt: "¿Evita contenido riesgoso y datos personales?",
        status: "requires-human-assessment" as const,
      },
    ]),
    humanDecisionRequired: true,
    rolloutAuthorized: false,
  });
}
