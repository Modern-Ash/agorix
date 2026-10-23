import { describe, expect, it } from "vitest";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import { createProgramProposal } from "@agorix/proposals";
import {
  evaluateOriAdvancedOutput,
  ORI_ADVANCED_VERSION,
  runOriAdvanced,
  validateOriAdvancedProposal,
  type OriAdvancedContext,
} from "./advanced.js";

const mission = getKidsAdvancedMission("scene", "es");
const context: OriAdvancedContext = {
  stage: "scene",
  actorId: "actor:ori",
  locale: "es",
  program: mission.starterProgram,
};

describe("Ori advanced scene contract", () => {
  it("turns a bounded model look into a reviewable actor-scoped proposal", () => {
    const decision = evaluateOriAdvancedOutput(
      context,
      JSON.stringify({
        version: ORI_ADVANCED_VERSION,
        kind: "program-suggestion",
        actorId: "actor:ori",
        block: { type: "switchCostume", costumeId: "asset:costume.spark" },
      }),
    );
    expect(decision.source).toBe("model");
    expect(decision.proposal?.affectedActorIds).toEqual(["actor:ori"]);
    expect(decision.proposal?.affectedAssetIds).toEqual(["asset:costume.spark"]);
    expect(decision.proposal?.operations).toEqual([
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "switchCostume", costumeId: "asset:costume.spark" },
      },
    ]);
    expect(
      validateOriAdvancedProposal(context, decision.proposal).candidateProgram.scripts[0]
        ?.statements,
    ).toEqual([{ type: "switchCostume", costumeId: "asset:costume.spark" }]);
    expect(context.program.scripts[0]?.statements).toEqual([]);
  });

  it("rejects unsupported assets, another actor and free text into a stage fallback", () => {
    for (const output of [
      {
        version: ORI_ADVANCED_VERSION,
        kind: "program-suggestion",
        actorId: "actor:ori",
        block: { type: "playSound", soundId: "https://evil.example" },
      },
      {
        version: ORI_ADVANCED_VERSION,
        kind: "program-suggestion",
        actorId: "actor:friend",
        block: { type: "playSound", soundId: "asset:sound.beacon" },
      },
      {
        version: ORI_ADVANCED_VERSION,
        kind: "program-suggestion",
        actorId: "actor:ori",
        block: { type: "playSound", soundId: "asset:sound.beacon" },
        message: "send me your name",
      },
    ]) {
      const decision = evaluateOriAdvancedOutput(context, output);
      expect(decision.source).toBe("fallback");
      expect(decision.proposal?.operations[0]).toMatchObject({
        statement: { type: "switchCostume", costumeId: "asset:costume.spark" },
      });
    }
  });

  it("refuses a proposal that appends an event or targets the wrong script", () => {
    const bad = createProgramProposal({
      id: "bad-event",
      baseProgram: context.program,
      source: { kind: "learning-companion", capability: "builder" },
      purpose: "Bad event",
      rationale: "Bad event",
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        {
          type: "appendStatement",
          scriptIndex: 0,
          statement: { type: "broadcast", message: "go" },
        },
      ],
    });
    expect(() => validateOriAdvancedProposal(context, bad)).toThrow();
  });

  it("uses the deterministic scene idea when the model is unavailable", async () => {
    const decision = await runOriAdvanced(context, {
      generate: async () => {
        throw new Error("offline");
      },
    });
    expect(decision.source).toBe("fallback");
    expect(decision.proposal).toBeDefined();
    expect(JSON.stringify(decision)).not.toContain("offline");
  });
});
