import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [
    { id: "mx", name: "Mouse X", initialValue: 0, visible: true },
    { id: "my", name: "Mouse Y", initialValue: 0, visible: true },
  ],
  scripts: [
    {
      id: "s",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "setVariable", variableId: "mx", value: { type: "mouseX" } },
        { type: "setVariable", variableId: "my", value: { type: "mouseY" } },
        { type: "if", condition: { type: "mouseDown" }, then: [{ type: "move", steps: 20 }] },
      ],
    },
  ],
};

describe("recorded stage pointer", () => {
  it("validates, runs and replays from an explicit snapshot", () => {
    expect(validateProgram(program)).toEqual(program);
    const input = { pointer: { x: 123, y: -45, down: true } };
    const first = runProgram(program, createWorldState(), input);
    expect(first.world.variables?.mx?.value).toBe(123);
    expect(first.world.variables?.my?.value).toBe(-45);
    expect(first.world.sprite.x).toBe(createWorldState().sprite.x + 20);
    expect(runProgram(program, createWorldState(), input)).toEqual(first);
    expect(JSON.stringify(first.trace)).not.toContain("pointer");
  });

  it("defaults to idle and clamps out-of-stage or invalid coordinates", () => {
    const idle = runProgram(program, createWorldState());
    expect(idle.world.variables?.mx?.value).toBe(0);
    expect(idle.world.variables?.my?.value).toBe(0);
    expect(idle.world.sprite.x).toBe(createWorldState().sprite.x);
    const bounded = runProgram(program, createWorldState(), {
      pointer: { x: 999, y: -999, down: false },
    });
    expect(bounded.world.variables?.mx?.value).toBe(320);
    expect(bounded.world.variables?.my?.value).toBe(-100);
    const invalid = runProgram(program, createWorldState(), {
      pointer: { x: Number.NaN, y: Infinity, down: false },
    });
    expect(invalid.world.variables?.mx?.value).toBe(0);
    expect(invalid.world.variables?.my?.value).toBe(0);
  });
});
