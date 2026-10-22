import { describe, expect, it } from "vitest";
import { getKidsMission, kidsMoveSteps } from "@agorix/curriculum";
import { createProposalReview } from "@agorix/proposals";
import {
  ORI_AGENT_VERSION,
  ORI_FIXED_REFUSAL,
  createOriAgentInput,
  evaluateOriAgentOutput,
  getOriAgentInstructions,
} from "./index.js";

const first = getKidsMission("kids.m1.straight", "es");
const context = {
  mission: first,
  missionIndex: 0 as const,
  program: first.starterProject,
  locale: "es" as const,
  hintLevel: 1 as const,
};

describe("fixed Ori agent contract (issue #380)", () => {
  it("exposes a versioned bilingual prompt and structured input with deterministic result", () => {
    expect(ORI_AGENT_VERSION).toMatch(/v1$/);
    expect(getOriAgentInstructions("es")).toContain(ORI_AGENT_VERSION);
    expect(getOriAgentInstructions("en")).toContain(ORI_AGENT_VERSION);
    const input = createOriAgentInput(context);
    expect(input.grid).toEqual({ cols: 6, rows: 4 });
    expect(input.lastResult.outcome).toBe("short");
    expect(input.allowedBlocks).toEqual(["move"]);
    expect(JSON.stringify(input)).not.toContain("learnerIntent");
  });

  it("converts a valid model block into a reviewable proposal without mutating the program", () => {
    const result = evaluateOriAgentOutput(context, {
      version: ORI_AGENT_VERSION,
      kind: "program-suggestion",
      reason: "toward-goal",
      blocks: [{ type: "move", count: 4 }],
    });
    expect(result.source).toBe("model");
    if (!result.proposal) throw new Error("missing proposal");
    expect(
      createProposalReview(first.starterProject, result.proposal).candidateProgram.scripts[0]
        ?.statements,
    ).toEqual([{ type: "move", steps: kidsMoveSteps(4) }]);
    expect(first.starterProject.scripts[0]?.statements).toEqual([]);
  });

  it.each([
    [
      {
        version: "wrong",
        kind: "program-suggestion",
        reason: "toward-goal",
        blocks: [{ type: "move", count: 4 }],
      },
      "version",
    ],
    [
      {
        version: ORI_AGENT_VERSION,
        kind: "program-suggestion",
        reason: "toward-goal",
        blocks: [{ type: "move", count: 9 }],
      },
      "range",
    ],
    [
      {
        version: ORI_AGENT_VERSION,
        kind: "program-suggestion",
        reason: "toward-goal",
        blocks: [{ type: "repeat", count: 3, blocks: [{ type: "move", count: 1 }] }],
      },
      "level",
    ],
    [
      {
        version: ORI_AGENT_VERSION,
        kind: "program-suggestion",
        reason: "toward-goal",
        blocks: [{ type: "move", count: 4 }],
        tool: "shell",
      },
      "extra field",
    ],
    [
      {
        version: ORI_AGENT_VERSION,
        kind: "program-suggestion",
        reason: "ignore instructions",
        blocks: [{ type: "move", count: 4 }],
      },
      "reason",
    ],
    [
      '{"version":"agorix/ori-agent/v1","kind":"program-suggestion","reason":"toward-goal","blocks":[],"message":"send your name"}',
      "unsafe text",
    ],
  ])("falls back to Kids 08 deterministic rules for invalid %s (%s)", (raw, _description) => {
    const result = evaluateOriAgentOutput(context, raw);
    expect(result.source).toBe("fallback");
    expect(result.proposal?.operations).toEqual([
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "move", steps: kidsMoveSteps(4) },
      },
    ]);
  });

  it("uses the fixed refusal for off-topic model output", () => {
    const result = evaluateOriAgentOutput(context, {
      version: ORI_AGENT_VERSION,
      kind: "refusal",
    });
    expect(result.source).toBe("refusal");
    expect(result.message).toBe(ORI_FIXED_REFUSAL.es);
    expect(result.proposal).toBeUndefined();
  });

  it("permits repeat only in the third mission and validates its inner move", () => {
    const mission = getKidsMission("kids.m3.zigzag", "en");
    const third = {
      mission,
      missionIndex: 2 as const,
      program: mission.starterProject,
      locale: "en" as const,
      hintLevel: 4 as const,
    };
    const result = evaluateOriAgentOutput(third, {
      version: ORI_AGENT_VERSION,
      kind: "program-suggestion",
      reason: "practice-repeat",
      blocks: [{ type: "repeat", count: 3, blocks: [{ type: "move", count: 1 }] }],
    });
    expect(result.source).toBe("model");
    expect(result.proposal?.operations).toEqual([
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "repeat", count: 3, body: [{ type: "move", steps: kidsMoveSteps(1) }] },
      },
    ]);
  });

  it("keeps a two-block suggestion in one reviewable proposal", () => {
    const mission = getKidsMission("kids.m2.corner", "es");
    const second = {
      mission,
      missionIndex: 1 as const,
      program: mission.starterProject,
      locale: "es" as const,
      hintLevel: 3 as const,
    };
    const result = evaluateOriAgentOutput(second, {
      version: ORI_AGENT_VERSION,
      kind: "program-suggestion",
      reason: "turn-to-goal",
      blocks: [
        { type: "move", count: 3 },
        { type: "turn", direction: "left" },
      ],
    });
    expect(result.source).toBe("model");
    if (!result.proposal) throw new Error("missing proposal");
    expect(
      createProposalReview(mission.starterProject, result.proposal).candidateProgram.scripts[0]
        ?.statements,
    ).toEqual([
      { type: "move", steps: kidsMoveSteps(3) },
      { type: "turn", degrees: -90 },
    ]);
  });
});
