import { describe, expect, it } from "vitest";
import { getKidsMission } from "@agorix/curriculum";
import { runOriAgent } from "./index.js";
import { ORI_EVAL_FIXTURES } from "./evals.fixtures.js";

const mission = getKidsMission("kids.m1.straight", "es");
const context = {
  mission,
  missionIndex: 0 as const,
  program: mission.starterProject,
  locale: "es" as const,
  hintLevel: 1 as const,
};

describe("Ori fake-model eval set", () => {
  it.each(ORI_EVAL_FIXTURES)("$id -> $expected", async ({ output, expected }) => {
    const calls: { system: string; input: string }[] = [];
    const decision = await runOriAgent(context, {
      generate(system, input) {
        calls.push({ system, input });
        return output;
      },
    });
    expect(decision.source).toBe(expected);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.system).toContain("agorix/ori-agent/v1");
    expect(JSON.parse(calls[0]!.input)).toMatchObject({
      mission: { id: mission.id },
      hintLevel: 1,
    });
    expect(decision.source === "refusal" ? decision.proposal : decision.proposal?.source.kind).toBe(
      decision.source === "refusal" ? undefined : "learning-companion",
    );
  });

  it("falls back when a fake model fails without leaking its error to the child", async () => {
    const decision = await runOriAgent(context, {
      generate() {
        throw new Error("secret provider detail");
      },
    });
    expect(decision.source).toBe("fallback");
    expect(decision.message).not.toContain("secret");
  });
});
