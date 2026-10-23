import { describe, expect, it } from "vitest";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import {
  ORI_ADVANCED_REACT_VERSION,
  evaluateOriReactOutput,
  runOriReact,
  validateOriReactProposal,
  type OriReactContext,
} from "./advancedReact.js";

const context: OriReactContext = {
  stage: "react",
  actorId: "actor:ori",
  locale: "es",
  program: getKidsAdvancedMission("react", "es").starterProgram,
};

describe("Ori stage-2 event contract", () => {
  it("proposes only an action inside the actor-click script", () => {
    const decision = evaluateOriReactOutput(context, {
      version: ORI_ADVANCED_REACT_VERSION,
      kind: "event-suggestion",
      actorId: "actor:ori",
      event: "actorClicked",
      block: { type: "switchCostume", costumeId: "asset:costume.spark" },
    });
    expect(decision.source).toBe("model");
    expect(decision.proposal?.operations).toEqual([
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "switchCostume", costumeId: "asset:costume.spark" },
      },
    ]);
    expect(
      validateOriReactProposal(context, decision.proposal).candidateProgram.scripts[0]?.trigger,
    ).toEqual({ type: "onActorClicked" });
  });

  it("rejects a stage-1 scene program, another actor and unsupported event output", () => {
    expect(() =>
      validateOriReactProposal(
        { ...context, program: getKidsAdvancedMission("scene", "es").starterProgram },
        {},
      ),
    ).toThrow();
    const decision = evaluateOriReactOutput(context, {
      version: ORI_ADVANCED_REACT_VERSION,
      kind: "event-suggestion",
      actorId: "actor:friend",
      event: "onMessage",
      block: { type: "broadcast", message: "secret" },
    });
    expect(decision.source).toBe("fallback");
    expect(decision.proposal?.operations[0]).toMatchObject({
      statement: { type: "switchCostume", costumeId: "asset:costume.spark" },
    });
  });

  it("falls back without model access or on malformed model output", async () => {
    expect((await runOriReact(context)).source).toBe("fallback");
    expect((await runOriReact(context, { generate: async () => "not JSON" })).source).toBe(
      "fallback",
    );
  });
});
