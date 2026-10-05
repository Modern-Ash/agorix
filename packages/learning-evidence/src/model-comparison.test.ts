import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  ModelComparisonActivityError,
  createModelComparisonActivity,
  recordModelComparisonDecision,
} from "./index.js";

const program = (statements: ProjectProgram["scripts"][number]["statements"]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});

const baseProgram = program([]);

describe("model comparison activity", () => {
  it("compares two valid proposals with runtime evidence and no automatic winner", () => {
    const activity = createModelComparisonActivity({
      id: "cmp-1",
      baseProgram,
      world: { goal: { x: 10, y: 0 } },
      alternatives: [
        {
          id: "proposal-a",
          label: "Proposal A",
          program: program([{ type: "move", steps: 10 }]),
        },
        {
          id: "proposal-b",
          label: "Proposal B",
          program: program([
            { type: "move", steps: 5 },
            { type: "move", steps: 5 },
          ]),
        },
      ],
    });

    expect(activity).toMatchObject({
      schema: "agorix/model-comparison-activity/v1",
      alternatives: [
        {
          id: "proposal-a",
          valid: true,
          runtimeStatus: "reaches-goal",
          reachedGoal: true,
          changedFromBase: true,
        },
        {
          id: "proposal-b",
          valid: true,
          runtimeStatus: "reaches-goal",
          reachedGoal: true,
          changedFromBase: true,
        },
      ],
    });
    expect(activity).not.toHaveProperty("autoSelectedAlternativeId");

    const decision = recordModelComparisonDecision({
      activity,
      inspectedAlternativeIds: ["proposal-a", "proposal-b"],
      prediction: "reachGoal",
      conclusion: "both-work",
      reflection: "runtime-evidence",
      sequence: 3,
    });

    expect(decision).toEqual({
      evidenceBacked: true,
      event: {
        schema: "agorix/learning-evidence-event/v1",
        id: "cmp-1:decision",
        sequence: 3,
        assistanceLevel: "independent",
        kind: "modelComparisonDecided",
        alternativesCompared: 2,
        decisionJustified: true,
      },
    });
    expect(JSON.stringify(decision)).not.toMatch(/provider|winner|Proposal A|Proposal B/);
  });

  it("handles one invalid proposal without contaminating the valid candidate run", () => {
    const activity = createModelComparisonActivity({
      id: "cmp-2",
      baseProgram,
      world: { goal: { x: 3, y: 0 } },
      alternatives: [
        {
          id: "valid",
          label: "Proposal A",
          program: program([{ type: "move", steps: 3 }]),
        },
        {
          id: "invalid",
          label: "Proposal B",
          program: {
            schema: SCHEMA_VERSION,
            scripts: [
              {
                id: "main",
                trigger: { type: "onStart" },
                statements: [{ type: "teleport", steps: 3 }],
              },
            ],
          } as unknown as ProjectProgram,
        },
      ],
    });

    expect(activity.alternatives).toEqual([
      expect.objectContaining({
        id: "valid",
        valid: true,
        runtimeStatus: "reaches-goal",
        reachedGoal: true,
        stepsUsed: 1,
      }),
      expect.objectContaining({
        id: "invalid",
        valid: false,
        runtimeStatus: "invalid-proposal",
        reachedGoal: false,
        stepsUsed: 0,
      }),
    ]);
    expect(
      recordModelComparisonDecision({
        activity,
        inspectedAlternativeIds: ["valid", "invalid"],
        prediction: "reachGoal",
        conclusion: "one-works",
        reflection: "runtime-evidence",
        sequence: 4,
      }).event,
    ).toMatchObject({ kind: "modelComparisonDecided", decisionJustified: true });
  });

  it("requires inspection before a conclusion and records unsupported reasoning as unjustified", () => {
    const activity = createModelComparisonActivity({
      id: "cmp-3",
      baseProgram,
      world: { goal: { x: 10, y: 0 } },
      alternatives: [
        { id: "a", label: "Proposal A", program: program([{ type: "move", steps: 1 }]) },
        { id: "b", label: "Proposal B", program: program([{ type: "turn", degrees: 90 }]) },
      ],
    });

    expect(() =>
      recordModelComparisonDecision({
        activity,
        inspectedAlternativeIds: ["a"],
        prediction: "notReachGoal",
        conclusion: "neither-works",
        reflection: "runtime-evidence",
        sequence: 1,
      }),
    ).toThrow(ModelComparisonActivityError);

    const decision = recordModelComparisonDecision({
      activity,
      inspectedAlternativeIds: ["a", "b"],
      prediction: "notReachGoal",
      conclusion: "neither-works",
      reflection: "different-structure",
      sequence: 2,
    });
    expect(decision.evidenceBacked).toBe(true);
    expect(decision.event).toMatchObject({
      kind: "modelComparisonDecided",
      alternativesCompared: 2,
      decisionJustified: false,
    });
  });
});
