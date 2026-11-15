import { describe, expect, it } from "vitest";
import {
  createLearningCompanionRequest,
  type LearningCompanionRequest,
} from "@agorix/tutor-contract";
import { runOriStudioCompanion, studioCompanionModelInput } from "./oriStudioCompanion.js";

function request(capability: LearningCompanionRequest["capability"] = "explainer") {
  return createLearningCompanionRequest({
    capability,
    mission: {
      id: "first-mission.reach-goal",
      version: 1,
      concepts: ["sequence"],
      learningObjective: "reach the goal",
    },
    program: {
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "say", text: "child@example.com" }],
        },
      ],
    },
    selectedNodeIds: ["scripts[0]/statements[0]"],
    runtimeFacts: [],
    scaffoldHistory: [{ capability, level: 1 }],
    reading: { locale: "es" },
  });
}

describe("Ori VS Code Companion boundary", () => {
  it("sends structural context and accepts a safe teaching explanation", async () => {
    const input = studioCompanionModelInput(request());
    expect(input).toContain("say");
    expect(input).not.toContain("child@example.com");
    const answer = await runOriStudioCompanion(request(), {
      generate: async (_instructions, sent) => {
        expect(sent).toBe(input);
        return JSON.stringify({ message: "¿Qué muestra el bloque antes de llegar a la meta?" });
      },
    });
    expect(answer.metadata.provenance).toBe("local-provider");
    expect(answer.message).toContain("bloque");
  });

  it("falls back on unsafe, malformed or unavailable model output", async () => {
    for (const output of [
      JSON.stringify({ message: "Visit https://example.com" }),
      JSON.stringify({ message: "Hola", extra: true }),
      "broken",
    ]) {
      const answer = await runOriStudioCompanion(request(), {
        generate: async () => output,
      });
      expect(answer.metadata.provenance).toBe("deterministic-fake");
    }
    const offline = await runOriStudioCompanion(request());
    expect(offline.metadata.provenance).toBe("deterministic-fake");
  });

  it("keeps builder proposals deterministic until the review issue", async () => {
    let called = false;
    const answer = await runOriStudioCompanion(request("builder"), {
      generate: async () => {
        called = true;
        return "{}";
      },
    });
    expect(called).toBe(false);
    expect(answer.metadata.provenance).toBe("deterministic-fake");
  });
});
