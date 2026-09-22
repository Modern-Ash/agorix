import { describe, expect, it } from "vitest";
import { validateProgram } from "./validate.js";
import { DOCUMENTED_EXAMPLE_PROGRAM, FULL_COVERAGE_PROGRAM } from "./fixtures.js";

describe("serialization snapshots", () => {
  // Deterministic JSON serialization, per PROGRAMMING_MODEL.md's invariant
  // ("serialization is deterministic enough for snapshots and evidence").
  it("serializes the documented example deterministically", () => {
    expect(JSON.stringify(validateProgram(DOCUMENTED_EXAMPLE_PROGRAM), null, 2)).toMatchSnapshot();
  });

  it("serializes the full-coverage program deterministically", () => {
    expect(JSON.stringify(validateProgram(FULL_COVERAGE_PROGRAM), null, 2)).toMatchSnapshot();
  });
});
