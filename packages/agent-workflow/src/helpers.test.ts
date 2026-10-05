import { describe, expect, it } from "vitest";
import {
  checkExplanation,
  comparePrediction,
  needsClarification,
  normalizeIntent,
  planTasks,
  taskForId,
  type AgentTaskId,
} from "./index.js";

const both: AgentTaskId[] = ["first-step", "repeat-pattern"];

describe("agent helpers", () => {
  it("bounds intent text", () => {
    expect(normalizeIntent(3)).toBeUndefined();
    expect(normalizeIntent("   ")).toBeUndefined();
    expect(normalizeIntent("a".repeat(141))).toBeUndefined();
    expect(normalizeIntent("move\u0000 now")).toBe("move now");
  });

  it("plans by keyword and offers what it can do otherwise", () => {
    expect(planTasks("repite 3 veces", both).map((t) => t.id)).toEqual(["repeat-pattern"]);
    expect(planTasks("avanzár", both).map((t) => t.id)).toEqual(["first-step"]);
    expect(planTasks("hola", both)).toHaveLength(2);
    expect(planTasks("move", [])).toEqual([]);
  });

  it("compares predictions and checks explanations without blocking", () => {
    expect(comparePrediction("yes", true)).toBe("matched");
    expect(comparePrediction("no", true)).toBe("mismatched");
    expect(comparePrediction(undefined, false)).toBe("skipped");
    expect(checkExplanation("repeat-pattern", "repetition")).toBe("relevant");
    expect(checkExplanation("first-step", "condition")).toBe("other");
  });
});

describe("clarification", () => {
  it("asks only when nothing matches and there is a real choice", () => {
    expect(needsClarification("hola", both)).toBe(true);
    expect(needsClarification("repite 3 veces", both)).toBe(false);
    expect(needsClarification("move and repeat", both)).toBe(false);
    expect(needsClarification("hola", ["first-step"])).toBe(false);
    expect(needsClarification("hola", [])).toBe(false);
    expect(taskForId("first-step")).toEqual({
      id: "first-step",
      title: "Try one visible movement step",
    });
  });
});
