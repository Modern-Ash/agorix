import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("stop block", () => {
  it.each(["script", "actor", "scene"] as const)("round-trips %s scope", (scope) => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        { id: "main", trigger: { type: "onStart" }, statements: [{ type: "stop", scope }] },
      ],
    };
    const { workspace } = programToWorkspace(program);
    expect(workspace.scripts[0]?.statements[0]).toMatchObject({
      type: "control_stop",
      fields: { scope },
    });
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});
