import type { LearningCompanionRequest, LearningCompanionRuntimeFact } from "./learning-companion.js";

export interface DebuggerEvidenceBundle {
  readonly facts: readonly LearningCompanionRuntimeFact[];
  readonly executedNodeIds: readonly string[];
  readonly hasError: boolean;
  readonly deterministicSuggestion: string;
}

export function buildDebuggerEvidence(request: LearningCompanionRequest): DebuggerEvidenceBundle {
  if (request.capability !== "debugger") throw new Error("debugger evidence requires debugger capability");
  const facts = request.runtimeFacts;
  const executedNodeIds = [...new Set(facts.flatMap((fact) => fact.nodeId === undefined ? [] : [fact.nodeId]))];
  const hasError = request.runtime?.error !== undefined;
  const deterministicSuggestion = hasError
    ? "Start with the runtime error and the highlighted executed node, then change one thing and run again."
    : facts.length === 0
      ? "Run the program first so debugging can use runtime evidence."
      : "Compare the last observed runtime fact with what you expected, then change one thing and run again.";
  return { facts, executedNodeIds, hasError, deterministicSuggestion };
}

export function debuggerFactsAreGrounded(
  supplied: readonly LearningCompanionRuntimeFact[],
  returned: readonly LearningCompanionRuntimeFact[],
): boolean {
  const allowed = new Map(supplied.map((fact) => [fact.id, fact]));
  return returned.every((fact) => {
    const source = allowed.get(fact.id);
    return source !== undefined && source.fact === fact.fact && source.nodeId === fact.nodeId && source.observationIndex === fact.observationIndex;
  });
}
