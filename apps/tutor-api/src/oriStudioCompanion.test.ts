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

  it("turns one bounded model choice into a reviewable proposal", async () => {
    const answer = await runOriStudioCompanion(request("builder"), {
      generate: async () => '{"type":"move","steps":20}',
    });
    expect(answer.metadata.provenance).toBe("local-provider");
    expect(answer.capability).toBe("builder");
    if (answer.capability !== "builder") return;
    expect(answer.payload.proposal.operations).toEqual([
      { type: "appendStatement", scriptIndex: 0, statement: { type: "move", steps: 20 } },
    ]);
    expect(answer.payload.reviewState).toBe("proposed");
  });

  it("falls back when Ori chooses an unsafe or expanded operation", async () => {
    for (const output of [
      '{"type":"move","steps":1000}',
      '{"type":"turn","degrees":45}',
      '{"type":"move","steps":20,"hidden":true}',
      "broken",
    ]) {
      const answer = await runOriStudioCompanion(request("builder"), {
        generate: async () => output,
      });
      expect(answer.metadata.provenance).toBe("deterministic-fake");
    }
  });
});
