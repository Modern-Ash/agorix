import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectPython } from "@agorix/python-projection";
import { projectProgram } from "@agorix/code-generator";
import { createEditorHistory, programToWorkspace, workspaceToProgram } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioVariable,
  appendStudioStatement,
  creativeForStudio,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";

// Issue #733: the timer and key sensors are projected from the same program.
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "s",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "repeatUntil",
          condition: {
            type: "greaterThan",
            left: { type: "timer" },
            right: { type: "numericLiteral", value: 3 },
          },
          body: [
            {
              type: "if",
              condition: { type: "keyDown", key: "ArrowUp" },
              then: [{ type: "move", steps: 20 }],
            },
            { type: "wait", seconds: 0.5 },
          ],
        },
      ],
    },
  ],
};

describe("timer and key sensors", () => {
  it("project to every language and survive the block round trip", () => {
    expect(projectAgorixCode(program).text).toMatch(/timer[\s\S]*key ArrowUp is down/);
    expect(projectPython(program).text).toMatch(/timer\(\)[\s\S]*key_down\("ArrowUp"\)/);
    expect(projectProgram(program).code).toMatch(/timer\(\)[\s\S]*keyDown\("ArrowUp"\)/);
    const { workspace } = programToWorkspace(program);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});

describe("Escena libre input sensors", () => {
  const nova = "actor:studio-1-nova";

  it("accepts the five studio keys and a timer limit, and keeps held keys deterministic", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Tiempo");
    history = appendStudioStatement(history, nova, {
      type: "if",
      condition: { type: "keyDown", key: "ArrowRight" },
      then: [{ type: "move", steps: 40 }],
    });
    history = appendStudioStatement(history, nova, {
      type: "repeatUntil",
      condition: {
        type: "greaterThan",
        left: { type: "timer" },
        right: { type: "numericLiteral", value: 1 },
      },
      body: [{ type: "wait", seconds: 0.5 }],
    });
    history = appendStudioStatement(history, nova, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "timer" },
    });
    const program = validateStudioProgram(history.current);
    const scene = creativeForStudio(program, "forest", "es");
    const idle = runMultiActorProgram(program, scene);
    const held = runMultiActorProgram(program, scene, { keysDown: ["ArrowRight"] });
    expect(held.actors[0]!.world.sprite.x - idle.actors[0]!.world.sprite.x).toBe(40);
    expect(idle.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(1.5);
    expect(runMultiActorProgram(program, scene, { keysDown: ["ArrowRight"] })).toEqual(held);
  });

  it("rejects a key outside the studio set and a timer outside a number slot", () => {
    const history = createEditorHistory(createStudioProgram("nova"));
    expect(() =>
      appendStudioStatement(history, nova, {
        type: "if",
        condition: { type: "keyDown", key: "Enter" },
        then: [{ type: "move", steps: 40 }],
      }),
    ).toThrow();
  });
});
