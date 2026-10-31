import { describe, expect, it } from "vitest";
import { createEditorHistory, programToWorkspace, workspaceToProgram } from "@agorix/block-editor";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectPython } from "@agorix/python-projection";
import { projectJava } from "@agorix/java-projection";
import { projectProgram } from "@agorix/code-generator";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioVariable,
  appendStudioStatement,
  creativeForStudio,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";

describe("Escena libre mouse sensors", () => {
  it("offers canonical conditions and numbers across runtime, blocks and four code views", () => {
    const actor = "actor:studio-1-nova";
    let history = addStudioVariable(createEditorHistory(createStudioProgram("nova")), "Ratón");
    history = appendStudioStatement(history, actor, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "mouseX" },
    });
    history = appendStudioStatement(history, actor, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "mouseY" },
    });
    history = appendStudioStatement(history, actor, {
      type: "if",
      condition: { type: "mouseDown" },
      then: [{ type: "move", steps: 40 }],
    });
    const program = validateStudioProgram(history.current);
    const scene = creativeForStudio(program, "forest", "es");
    const active = runMultiActorProgram(program, scene, { pointer: { x: 123, y: 23, down: true } });
    const idle = runMultiActorProgram(program, scene);
    expect(active.actors[0]!.world.sprite.x - idle.actors[0]!.world.sprite.x).toBe(40);
    expect(active.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(23);
    expect(
      runMultiActorProgram(program, scene, { pointer: { x: 123, y: 23, down: true } }),
    ).toEqual(active);
    expect(projectAgorixCode(program).text).toMatch(/mouse x[\s\S]*mouse y[\s\S]*mouse is down/);
    expect(projectPython(program).text).toMatch(
      /mouse_x\(\)[\s\S]*mouse_y\(\)[\s\S]*mouse_down\(\)/,
    );
    expect(projectJava(program).text).toMatch(/mouseX\(\)[\s\S]*mouseY\(\)[\s\S]*mouseDown\(\)/);
    expect(projectProgram(program).code).toMatch(/mouseX\(\)[\s\S]*mouseY\(\)[\s\S]*mouseDown\(\)/);
    const { workspace } = programToWorkspace(program);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});
