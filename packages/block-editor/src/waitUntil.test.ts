import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("waitUntil block", () => {
  it("round-trips a compound condition without separate block state", () => {
    const condition = {
      type: "and" as const,
      left: { type: "keyDown" as const, key: "Space" },
      right: { type: "touchingGoal" as const },
    };
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "waitUntil", condition }],
        },
      ],
    };
    const { workspace } = programToWorkspace(program);
    expect(workspace.scripts[0]?.statements[0]).toMatchObject({ type: "control_wait_until" });
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});
