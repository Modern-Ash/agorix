import { describe, expect, it } from "vitest";
import { buildDebuggerEvidence, debuggerFactsAreGrounded } from "./debugger.js";
import type { LearningCompanionRequest, LearningCompanionRuntimeFact } from "./learning-companion.js";

function request(facts: readonly LearningCompanionRuntimeFact[]): LearningCompanionRequest {
  return { schema: "agorix/learning-companion-request/v1", capability: "debugger", mission: { id: "m", version: 1, concepts: ["movement"], learningObjective: "Reach goal" }, program: { schema: "agorix/program/v1", scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }] }, selectedNodeIds: [], runtimeFacts: facts, scaffoldHistory: [] };
}

describe("debugger evidence", () => {
  const fact: LearningCompanionRuntimeFact = { id: "runtime-observation-0", observationIndex: 0, nodeId: "n1", fact: "Runtime observed statement-end at step 1." };

  it("builds deterministic evidence without inventing execution facts", () => {
    const evidence = buildDebuggerEvidence(request([fact]));
    expect(evidence.facts).toEqual([fact]);
    expect(evidence.executedNodeIds).toEqual(["n1"]);
  });

  it("rejects a contradictory fact even when it reuses a valid id", () => {
    expect(debuggerFactsAreGrounded([fact], [{ ...fact, fact: "The node ran four times." }])).toBe(false);
  });

  it("rejects a fabricated node execution", () => {
    expect(debuggerFactsAreGrounded([fact], [{ ...fact, nodeId: "never-executed" }])).toBe(false);
  });

  it("provides a deterministic run-first fallback when evidence is absent", () => {
    const evidence = buildDebuggerEvidence(request([]));
    expect(evidence.deterministicSuggestion).toContain("Run the program first");
  });
});
