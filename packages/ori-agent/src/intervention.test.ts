import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  ORI_INTERVENTION_DEFAULT,
  ORI_INTERVENTION_LIMITS,
  oriIntentSize,
  oriIntentsWithin,
  shouldOfferOriIdea,
  simulateOriIntervention,
  validateOriInterventionPolicy,
} from "./intervention.js";
import { ORI_STUDIO_INTENTS, proposeOriStudioIntent } from "./studio.js";

describe("Ori intervention policy", () => {
  it("keeps the defaults inside their own limits and offers nothing on entry", () => {
    expect(validateOriInterventionPolicy(ORI_INTERVENTION_DEFAULT)).toEqual(
      ORI_INTERVENTION_DEFAULT,
    );
    expect(shouldOfferOriIdea({ failedRuns: 0, hintsUsed: 0 })).toBe(false);
    expect(shouldOfferOriIdea({ failedRuns: 0, hintsUsed: 1 })).toBe(false);
    expect(shouldOfferOriIdea({ failedRuns: 1, hintsUsed: 0 })).toBe(true);
    expect(shouldOfferOriIdea({ failedRuns: 0, hintsUsed: 2 })).toBe(true);
  });

  it("refuses anything under the safety floor or over the ceiling", () => {
    const bad = [
      { ...ORI_INTERVENTION_DEFAULT, minFailedRuns: 0 },
      { ...ORI_INTERVENTION_DEFAULT, minHints: 1 },
      { ...ORI_INTERVENTION_DEFAULT, minHints: 0 },
      { ...ORI_INTERVENTION_DEFAULT, maxProposalBlocks: 9 },
      { ...ORI_INTERVENTION_DEFAULT, maxProposalBlocks: 0 },
      { ...ORI_INTERVENTION_DEFAULT, minFailedRuns: 1.5 },
      { ...ORI_INTERVENTION_DEFAULT, minFailedRuns: "1" },
      { ...ORI_INTERVENTION_DEFAULT, extra: 1 },
      { minFailedRuns: 1, minHints: 2 },
      null,
      [],
    ];
    for (const value of bad) expect(() => validateOriInterventionPolicy(value)).toThrow();
    expect(ORI_INTERVENTION_LIMITS.minHints.min).toBe(2);
    expect(ORI_INTERVENTION_LIMITS.minFailedRuns.min).toBe(1);
  });

  it("knows the real size of every goal", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements: [] }],
    };
    const context = { actorId: "actor:studio-1-nova", locale: "es" as const, program };
    for (const intent of ORI_STUDIO_INTENTS) {
      expect(proposeOriStudioIntent(context, intent).operations).toHaveLength(
        oriIntentSize(intent),
      );
    }
  });

  it("hides the goals that no longer fit and simulates synthetic learners", () => {
    const small = { ...ORI_INTERVENTION_DEFAULT, maxProposalBlocks: 3 };
    expect(oriIntentsWithin(small)).toEqual(["ahead", "cheer"]);
    const rows = simulateOriIntervention({ minFailedRuns: 2, minHints: 3, maxProposalBlocks: 6 });
    const offers = Object.fromEntries(rows.map((row) => [row.learner, row.offersIdea]));
    expect(offers).toEqual({
      "just-arrived": false,
      "first-miss": false,
      "two-misses": true,
      "first-hint": false,
      "second-hint": false,
      "stuck-with-hints": true,
    });
    expect(rows.every((row) => !row.offersIdea || row.maxBlocks === 6)).toBe(true);
  });
});
