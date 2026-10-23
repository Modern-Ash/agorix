import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

// Issue #464: the new comparators round-trip through blocks.
describe("comparator blocks (issue #464)", () => {
  it("round-trips lessOrEqual and greaterOrEqual", () => {
    const one = { type: "numericLiteral", value: 1 } as const;
    const original: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "if", condition: { type: "lessOrEqual", left: one, right: one }, then: [] },
            { type: "if", condition: { type: "greaterOrEqual", left: one, right: one }, then: [] },
          ],
        },
      ],
    };
    const { workspace } = programToWorkspace(original);
    expect(workspaceToProgram(workspace).program).toEqual(original);
  });
});
