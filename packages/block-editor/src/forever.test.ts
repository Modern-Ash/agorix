import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("forever block", () => {
  it("round-trips its canonical body", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "forever", body: [{ type: "move", steps: 1 }] }],
        },
      ],
    };
    const { workspace } = programToWorkspace(program);
    expect(workspace.scripts[0]?.statements[0]).toMatchObject({ type: "control_forever" });
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});
