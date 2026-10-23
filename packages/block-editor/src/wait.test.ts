import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("wait block (issue #466)", () => {
  it("round-trips", () => {
    const original: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        { id: "main", trigger: { type: "onStart" }, statements: [{ type: "wait", seconds: 1.5 }] },
      ],
    };
    expect(workspaceToProgram(programToWorkspace(original).workspace).program).toEqual(original);
  });
});
