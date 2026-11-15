import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import { firstDivergence } from "./kidsRunCompare.js";
import { creativeForStudio, validateStudioProgram } from "./kidsStudioModel.js";

const flag = { type: "greenFlag" } as const;
const num = (value: number) => ({ type: "numericLiteral", value });
const run = (statements: unknown[]) => {
  const program = validateStudioProgram({
    schema: "agorix/program/v1",
    variables: [{ id: "studio-var-1", name: "n", initialValue: 0, visible: true }],
    scripts: [{ id: "studio-actor-1-nova", trigger: flag, statements }],
  } as never);
  return runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
};
const move = { type: "move", steps: 40 };

describe("where two runs stop agreeing", () => {
  it("says the same program gives the same run", () => {
    expect(firstDivergence(run([move, move]), run([move, move]))).toEqual({
      kind: "same",
      steps: 2,
    });
  });

  it("finds the first step with another block", () => {
    const d = firstDivergence(run([move, move]), run([move, { type: "turn", degrees: 90 }]));
    expect(d).toMatchObject({ kind: "differs", index: 1, what: "block" });
  });

  it("finds a step where the same block ends somewhere else", () => {
    const d = firstDivergence(
      run([move, { type: "move", steps: 40 }]),
      run([move, { type: "move", steps: 80 }]),
    );
    expect(d).toMatchObject({ kind: "differs", index: 1, what: "position" });
    if (d.kind === "differs") expect(d.after.x).toBeGreaterThan(d.before.x);
  });

  it("finds a step where a value differs and the character did not move", () => {
    const set = (value: number) => ({
      type: "setVariable",
      variableId: "studio-var-1",
      value: num(value),
    });
    expect(firstDivergence(run([move, set(1)]), run([move, set(2)]))).toMatchObject({
      kind: "differs",
      index: 1,
      what: "value",
    });
  });

  it("says one run is longer when it agrees on all of the shorter one", () => {
    expect(firstDivergence(run([move]), run([move, move]))).toEqual({
      kind: "longer",
      index: 1,
      before: 1,
      after: 2,
    });
  });
});
