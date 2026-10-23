import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

// Issue #463: `else` survives the block round trip, and old if blocks stay unchanged.
const program = (statements: ProjectProgram["scripts"][number]["statements"]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const cond = { type: "touchingGoal" } as const;

describe("if / else blocks (issue #463)", () => {
  it("round-trips else (including empty) without loss", () => {
    const original = program([
      {
        type: "if",
        condition: cond,
        then: [{ type: "move", steps: 1 }],
        else: [{ type: "turn", degrees: 90 }],
      },
      { type: "if", condition: cond, then: [], else: [] },
    ]);
    const { workspace } = programToWorkspace(original);
    expect(workspaceToProgram(workspace).program).toEqual(original);
  });

  it("does not add an else input to existing if blocks", () => {
    const { workspace } = programToWorkspace(program([{ type: "if", condition: cond, then: [] }]));
    const block = workspace.scripts[0]?.statements[0];
    expect(block?.inputs).not.toHaveProperty("else");
    expect(workspaceToProgram(workspace).program.scripts[0]?.statements[0]).not.toHaveProperty(
      "else",
    );
  });
});
