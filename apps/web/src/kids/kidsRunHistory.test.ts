import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import { lastChangeBefore, valueHistory, VALUE_CHANGES_MAX } from "./kidsRunHistory.js";
import { creativeForStudio, validateStudioProgram } from "./kidsStudioModel.js";

const flag = { type: "greenFlag" } as const;
const program = (statements: unknown[]) =>
  validateStudioProgram({
    schema: "agorix/program/v1",
    variables: [{ id: "studio-var-1", name: "score", initialValue: 0, visible: true }],
    scripts: [{ id: "studio-actor-1-nova", trigger: flag, statements }],
  } as never);
const num = (value: number) => ({ type: "numericLiteral", value });
const run = (p: ReturnType<typeof program>) =>
  runMultiActorProgram(p, creativeForStudio(p, "forest", "es"));

describe("the history of a run's values", () => {
  it("lists each change with the block that made it, in order", () => {
    const p = program([
      { type: "setVariable", variableId: "studio-var-1", value: num(5) },
      { type: "move", steps: 40 },
      { type: "changeVariable", variableId: "studio-var-1", delta: num(2) },
    ]);
    const { changes, more } = valueHistory(p, run(p));
    expect(more).toBe(0);
    expect(changes.map((c) => [c.name, c.from, c.to, c.statementType])).toEqual([
      ["score", 0, 5, "setVariable"],
      ["score", 5, 7, "changeVariable"],
    ]);
    expect(changes.map((c) => c.traceIndex)).toEqual([0, 2]);
  });

  it("says nothing for a run that changes no value, and ignores a value set to itself", () => {
    const p = program([
      { type: "move", steps: 40 },
      { type: "setVariable", variableId: "studio-var-1", value: num(0) },
    ]);
    expect(valueHistory(p, run(p)).changes).toEqual([]);
  });

  it("finds the block that gave a variable its value at a step", () => {
    const p = program([
      { type: "setVariable", variableId: "studio-var-1", value: num(5) },
      { type: "move", steps: 40 },
      { type: "changeVariable", variableId: "studio-var-1", delta: num(2) },
    ]);
    const { changes } = valueHistory(p, run(p));
    expect(lastChangeBefore(changes, "studio-var-1", 1)?.statementType).toBe("setVariable");
    expect(lastChangeBefore(changes, "studio-var-1", 2)?.to).toBe(7);
    expect(lastChangeBefore(changes, "studio-var-1", -1)).toBeUndefined();
    expect(lastChangeBefore(changes, "nothing", 5)).toBeUndefined();
  });

  it("keeps the earliest changes of a long loop and counts the rest", () => {
    const p = program([
      {
        type: "repeat",
        count: 3,
        body: [{ type: "changeVariable", variableId: "studio-var-1", delta: num(1) }],
      },
    ]);
    const { changes, more } = valueHistory(p, run(p), 2);
    expect(changes).toHaveLength(2);
    expect(more).toBe(1);
    // The loop block itself is not blamed: its steps are the blocks inside it.
    expect(changes.every((change) => change.statementType === "changeVariable")).toBe(true);
    expect(changes.length).toBeLessThanOrEqual(VALUE_CHANGES_MAX);
  });
});
