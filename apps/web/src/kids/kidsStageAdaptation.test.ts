import { describe, expect, it } from "vitest";
import { applyEvidence, emptyMastery } from "@agorix/learning-evidence";
import { ORI_INTERVENTION_DEFAULT, shouldOfferOriIdea } from "@agorix/ori-agent";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  adaptInterventionByStage,
  BEGINNER_MAX_BLOCKS,
  stageBand,
  stagesOfProgram,
} from "./kidsStageAdaptation.js";

const moves: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "s",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "move", steps: 40 },
        { type: "move", steps: 40 },
      ],
    },
  ],
};
const empty: ProjectProgram = { ...moves, scripts: [{ ...moves.scripts[0]!, statements: [] }] };

function after(runs: number, helped = false) {
  let state = emptyMastery();
  for (let index = 0; index < runs; index += 1) {
    state = applyEvidence(
      state,
      { kind: "run", concepts: ["programming.sequence"], completed: true, helped, free: false },
      "2026-10-27",
    );
  }
  return state;
}

describe("stage-aware Ori pacing", () => {
  it("treats a concept still being discovered as a beginner's, and an empty program as neutral", () => {
    expect(stageBand(stagesOfProgram(emptyMastery(), moves))).toBe("beginner");
    expect(stageBand(stagesOfProgram(after(3), empty))).toBe("growing");
  });

  it("moves from beginner to growing to confident only with runtime evidence", () => {
    expect(stageBand(stagesOfProgram(after(0), moves))).toBe("beginner");
    expect(stageBand(stagesOfProgram(after(1), moves))).toBe("growing");
    // Help does not make a child confident, however many runs.
    expect(stageBand(stagesOfProgram(after(4, true), moves))).toBe("growing");
    expect(stageBand(stagesOfProgram(after(2), moves))).toBe("confident");
  });

  it("gives a beginner shorter ideas and a confident child more patience, never the reverse", () => {
    const base = ORI_INTERVENTION_DEFAULT;
    expect(adaptInterventionByStage(base, "beginner").maxProposalBlocks).toBe(BEGINNER_MAX_BLOCKS);
    expect(adaptInterventionByStage({ ...base, maxProposalBlocks: 2 }, "beginner")).toMatchObject({
      maxProposalBlocks: 2,
    });
    const patient = adaptInterventionByStage(base, "confident");
    expect(patient).toMatchObject({ minFailedRuns: 2, minHints: 3, maxProposalBlocks: 8 });
    expect(adaptInterventionByStage(base, "growing")).toEqual(base);
    // Capped at the ceiling of the limits, and the floor is untouched.
    expect(
      adaptInterventionByStage({ ...base, minFailedRuns: 5, minHints: 5 }, "confident"),
    ).toMatchObject({ minFailedRuns: 5, minHints: 5 });
    for (const band of ["beginner", "growing", "confident"] as const) {
      const adapted = adaptInterventionByStage(base, band);
      expect(adapted.minFailedRuns).toBeGreaterThanOrEqual(base.minFailedRuns);
      expect(adapted.minHints).toBeGreaterThanOrEqual(2);
      expect(adapted.maxProposalBlocks).toBeLessThanOrEqual(base.maxProposalBlocks);
    }
  });

  it("changes when an idea appears", () => {
    const progress = { failedRuns: 1, hintsUsed: 0 };
    expect(
      shouldOfferOriIdea(progress, adaptInterventionByStage(ORI_INTERVENTION_DEFAULT, "growing")),
    ).toBe(true);
    expect(
      shouldOfferOriIdea(progress, adaptInterventionByStage(ORI_INTERVENTION_DEFAULT, "confident")),
    ).toBe(false);
  });
});
