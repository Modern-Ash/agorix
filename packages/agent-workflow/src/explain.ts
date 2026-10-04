import type { AgentTaskId } from "./plan.js";

export const CONCEPT_IDS = ["sequence", "repetition", "condition", "event"] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

export function relevantConcept(task: AgentTaskId): ConceptId {
  return task === "repeat-pattern" ? "repetition" : "sequence";
}

/** Feedback only; explaining never blocks progress. */
export function checkExplanation(task: AgentTaskId, chosen: ConceptId): "relevant" | "other" {
  return chosen === relevantConcept(task) ? "relevant" : "other";
}
