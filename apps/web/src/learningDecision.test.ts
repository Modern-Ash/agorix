import { describe, expect, it } from "vitest";
import { createLearningCompanionRequest } from "@agorix/tutor-contract";
import { decideStaticWebLearningRoute } from "./learningDecision.js";

function request(capability: "challenger" | "reflector" | "debugger", withRuntime = false) {
  return createLearningCompanionRequest({
    capability,
    mission: {
      id: "first",
      version: 1,
      concepts: ["movement"],
      learningObjective: "Reach the goal",
    },
    program: {
      schema: "agorix/program/v1",
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    },
    selectedNodeIds: [],
    ...(withRuntime
      ? {
          runtime: {
            outcome: "completed" as const,
            stepsUsed: 1,
            finalWorld: {
              sprite: { x: 0, y: 0, heading: 0, radius: 8 },
              goal: { x: 10, y: 0, radius: 8 },
            },
            observations: [],
          },
          runtimeFacts: [
            {
              id: "fact-1",
              observationIndex: 0,
              fact: "The runtime completed.",
            },
          ],
        }
      : { runtimeFacts: [] }),
    scaffoldHistory: [],
  });
}

describe("static Web Learning Decision Plane", () => {
  it("bypasses providers for Challenger", () => {
    const route = decideStaticWebLearningRoute(request("challenger"));
    expect(route.diagnostics).toMatchObject({
      capability: "challenger",
      generativeNeeded: "no",
      reasoningTier: "deterministic",
      providerSelectionBypassed: true,
    });
  });

  it("bypasses providers for evidence-backed Reflector", () => {
    expect(decideStaticWebLearningRoute(request("reflector", true)).diagnostics).toMatchObject({
      generativeNeeded: "no",
      providerSelectionBypassed: true,
    });
  });

  it("keeps debugger deterministic until runtime evidence exists", () => {
    expect(decideStaticWebLearningRoute(request("debugger")).diagnostics).toMatchObject({
      generativeNeeded: "no",
      reasoningTier: "deterministic",
      providerSelectionBypassed: true,
    });
  });
});
