import { describe, expect, it } from "vitest";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import {
  evaluateOriScoreOutput,
  ORI_ADVANCED_SCORE_VERSION,
  runOriScore,
  validateOriScoreProposal,
  type OriScoreContext,
} from "./advancedScore.js";

const context: OriScoreContext = {
  stage: "score",
  actorId: "actor:ori",
  locale: "es",
  program: getKidsAdvancedMission("score", "es").starterProgram,
};

describe("Ori stage-3 data contract", () => {
  it("proposes only a bounded change to the visible score", () => {
    const decision = evaluateOriScoreOutput(context, {
      version: ORI_ADVANCED_SCORE_VERSION,
      kind: "data-suggestion",
      actorId: "actor:ori",
      block: { type: "changeVariable", variableId: "score", delta: 1 },
    });
    expect(decision.source).toBe("model");
    expect(decision.proposal?.operations[0]).toMatchObject({
      type: "appendStatement",
      scriptIndex: 0,
      statement: { type: "changeVariable", variableId: "score" },
    });
    expect(
      validateOriScoreProposal(context, decision.proposal).candidateProgram.scripts[0]?.statements,
    ).toHaveLength(1);
  });

  it("falls back on another variable, actor or unsupported value", () => {
    for (const block of [
      { type: "changeVariable", variableId: "other", delta: 1 },
      { type: "changeVariable", variableId: "score", delta: 100 },
      { type: "setVariable", variableId: "score", value: "5" },
    ]) {
      const decision = evaluateOriScoreOutput(context, {
        version: ORI_ADVANCED_SCORE_VERSION,
        kind: "data-suggestion",
        actorId: "actor:ori",
        block,
      });
      expect(decision.source).toBe("fallback");
    }
    expect(() => validateOriScoreProposal({ ...context, actorId: "actor:friend" }, {})).toThrow();
  });

  it("works without a model or with malformed output", async () => {
    expect((await runOriScore(context)).source).toBe("fallback");
    expect((await runOriScore(context, { generate: async () => "not JSON" })).source).toBe(
      "fallback",
    );
  });
});
