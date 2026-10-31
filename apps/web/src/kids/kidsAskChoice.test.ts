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

describe("Escena libre bundled choices", () => {
  it("keeps one canonical block across runtime, editors and four code views", () => {
    const actor = "actor:studio-1-nova";
    let history = addStudioVariable(createEditorHistory(createStudioProgram("nova")), "Camino");
    history = appendStudioStatement(history, actor, {
      type: "askChoice",
      promptId: "path",
      variableId: "studio-var-1",
    });
    history = appendStudioStatement(history, actor, { type: "move", steps: 40 });
    const program = validateStudioProgram(history.current);
    const scene = creativeForStudio(program, "forest", "es");
    const waiting = runMultiActorProgram(program, scene);
    expect(waiting.outcome).toBe("stopped");
    expect(waiting.trace.at(-1)?.note).toBe("askChoice: awaiting path");
    const chosen = runMultiActorProgram(program, scene, { choices: { path: 1 } });
    expect(chosen.outcome).toBe("completed");
    expect(chosen.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(1);
    expect(projectAgorixCode(program).text).toContain("ask path");
    expect(projectPython(program).text).toContain('ask_choice("path")');
    expect(projectJava(program).text).toContain('askChoice("path")');
    expect(projectProgram(program).code).toContain('askChoice("path")');
    const { workspace } = programToWorkspace(program);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});
