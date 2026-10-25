import { describe, expect, it } from "vitest";
import { createEditorHistory, programToWorkspace, workspaceToProgram } from "@agorix/block-editor";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectPython } from "@agorix/python-projection";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  appendStudioStatement,
  creativeForStudio,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";

// ADR 0011, issue #737: the pen extension in Escena libre.
const nova = "actor:studio-1-nova";

function drawn() {
  let history = createEditorHistory(createStudioProgram("nova"));
  for (const statement of [
    { type: "setPenColor", color: "red" },
    { type: "setPenSize", size: 12 },
    { type: "penDown" },
    { type: "move", steps: 40 },
    { type: "penUp" },
  ] as const)
    history = appendStudioStatement(history, nova, statement);
  return history;
}

describe("pen extension in the studio", () => {
  it("declares the extension on the first pen block and draws on the stage", () => {
    const program = validateStudioProgram(drawn().current);
    expect(program.extensions).toEqual(["pen"]);
    const result = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    const pen = result.actors[0]!.world.pen!;
    expect(pen.segments.at(-1)).toMatchObject({ color: "red", size: 12 });
    expect(pen.down).toBe(false);
  });

  it("leaves projects without pen blocks undeclared and unchanged", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
    expect(history.current.extensions).toBeUndefined();
  });

  it("projects to every language and survives the block round trip", () => {
    const program = validateStudioProgram(drawn().current);
    expect(projectAgorixCode(program).text).toMatch(
      /set pen color red[\s\S]*pen down[\s\S]*pen up/,
    );
    expect(projectPython(program).text).toMatch(/pen_down\(\)[\s\S]*pen_up\(\)/);
    expect(projectProgram(program).code).toMatch(/pen\.down\(\);[\s\S]*pen\.up\(\);/);
    const { workspace } = programToWorkspace(program);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });

  it("rejects a pen colour or width the studio does not offer", () => {
    const history = createEditorHistory(createStudioProgram("nova"));
    expect(() => appendStudioStatement(history, nova, { type: "setPenSize", size: 5 })).toThrow();
    expect(() =>
      appendStudioStatement(history, nova, { type: "setPenColor", color: "pink" as never }),
    ).toThrow();
  });
});
