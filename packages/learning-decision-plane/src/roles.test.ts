import { describe, expect, it } from "vitest";
import { learningRoleProfile, roleCanUseDeterministicFixture } from "./roles.js";
import type { LearningCompanionRequest } from "@agorix/tutor-contract";

function request(capability: LearningCompanionRequest["capability"]): LearningCompanionRequest {
  return {
    schema: "agorix/learning-companion-request/v1",
    capability,
    mission: {
      id: "m",
      version: 1,
      concepts: ["movement"],
      learningObjective: "Understand movement",
    },
    program: {
      schema: "agorix/program/v1",
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    },
    selectedNodeIds: ["n1"],
    runtimeFacts: [],
    scaffoldHistory: [],
  };
}

describe("learning role profiles", () => {
  it("keeps every role provider-neutral and auditable by capability", () => {
    for (const capability of [
      "coach",
      "builder",
      "debugger",
      "explainer",
      "challenger",
      "reflector",
    ] as const) {
      expect(learningRoleProfile(capability).capability).toBe(capability);
    }
  });
  it("challenger is deterministic-capable before execution", () => {
    expect(roleCanUseDeterministicFixture(request("challenger"))).toBe(true);
    expect(learningRoleProfile("challenger").requiredPrompt).toBe("prediction");
  });
  it("reflector requires runtime context and never solution authority", () => {
    const profile = learningRoleProfile("reflector");
    expect(profile.defaultContext).toBe("runtime");
    expect(profile.requiredPrompt).toBe("reflection");
    expect(profile.solutionAllowance).toBe("none");
  });
  it("explainer points to program context without mutation authority", () => {
    const profile = learningRoleProfile("explainer");
    expect(profile.defaultContext).toBe("program");
    expect(profile.solutionAllowance).toBe("none");
  });
  it("debugger can use deterministic run-first fixture without evidence", () => {
    expect(roleCanUseDeterministicFixture(request("debugger"))).toBe(true);
  });
});
