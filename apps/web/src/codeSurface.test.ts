import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import { projectCodeComparison, projectCodeSurface } from "./codeSurface.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "repeat", count: 2, body: [{ type: "move", steps: 10 }] }],
    },
  ],
};

describe("Code Surface", () => {
  it.each([
    ["agorix-code", "repeat 2 times"],
    ["python", "for _ in range(2):"],
    ["typescript", "repeat(2, () => {"],
  ] as const)("projects %s from the same canonical program", (id, expected) => {
    const before = programSemanticHash(program);
    const projection = projectCodeSurface(program, id);
    expect(projection.code).toContain(expected);
    expect(programSemanticHash(program)).toBe(before);
    expect(projection.mapping["scripts[0]/statements[0]/body[0]"]).toBeDefined();
  });

  it("compares two projections without creating independent program state", () => {
    const before = programSemanticHash(program);
    const [left, right] = projectCodeComparison(program, "agorix-code", "python");
    expect(left.code).not.toBe(right.code);
    expect(left.mapping["scripts[0]/statements[0]/body[0]"]).toBeDefined();
    expect(right.mapping["scripts[0]/statements[0]/body[0]"]).toBeDefined();
    expect(programSemanticHash(program)).toBe(before);
  });
});
