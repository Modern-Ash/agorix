import { describe, expect, it } from "vitest";
import { projectProgram } from "@agorix/code-generator";
import { programToWorkspace, workspaceToProgram } from "@agorix/block-editor";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "setX", x: 40 },
        { type: "wait", seconds: 2 },
        { type: "setY", y: -15 },
        { type: "move", steps: 5 },
      ],
    },
  ],
};

describe("Scratch-style blocks: set x/y and wait", () => {
  it("run deterministically, with wait costing a step but not touching the world", () => {
    const world = createWorldState({ sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 45, y: -15 } });
    const result = runProgram(program, world);
    expect(result.world.sprite).toMatchObject({ x: 45, y: -15 });
    expect(result.trace.map((item) => item.statementType)).toEqual([
      "setX",
      "wait",
      "setY",
      "move",
    ]);
    expect(result.trace[1]?.worldBefore).toEqual(result.trace[1]?.worldAfter);
    expect(runProgram(program, world)).toEqual(result);
  });

  it("project to code and round-trip through blocks", () => {
    const code = projectProgram(program).code;
    expect(code).toContain("sprite.setX(40);");
    expect(code).toContain("wait(2);");
    expect(code).toContain("sprite.setY(-15);");
    expect(workspaceToProgram(programToWorkspace(program).workspace).program).toEqual(program);
  });

  it("reject out-of-range values", () => {
    const bad = {
      ...program,
      scripts: [{ ...program.scripts[0], statements: [{ type: "wait", seconds: 61 }] }],
    };
    expect(() => validateProgram(bad)).toThrow();
    const far = {
      ...program,
      scripts: [{ ...program.scripts[0], statements: [{ type: "setX", x: 5000 }] }],
    };
    expect(() => validateProgram(far)).toThrow();
  });
});

describe("Looks blocks: show, hide, set size and say", () => {
  const looks: ProjectProgram = {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "setSize", percent: 150 },
          { type: "say", message: "Hi!", seconds: 2 },
          { type: "move", steps: 5 },
          { type: "hide" },
          { type: "show" },
        ],
      },
    ],
  };

  it("change only the looks of the sprite and survive move and turn", () => {
    const world = createWorldState({ sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 5, y: 0 } });
    const result = runProgram(looks, world);
    expect(result.trace[2]?.worldAfter.sprite).toMatchObject({
      x: 5,
      sizePercent: 150,
      say: "Hi!",
    });
    const hidden = result.trace[3]?.worldAfter.sprite;
    expect(hidden?.hidden).toBe(true);
    expect(result.world.sprite.hidden).toBeUndefined();
    expect(result.world.sprite.sizePercent).toBe(150);
    expect(runProgram(looks, world)).toEqual(result);
  });

  it("keep plain worlds free of look fields", () => {
    const result = runProgram(program, createWorldState({ goal: { x: 45, y: -15 } }));
    expect(Object.keys(result.world.sprite).sort()).toEqual(["heading", "x", "y"]);
  });

  it("project to code and round-trip through blocks", () => {
    const code = projectProgram(looks).code;
    expect(code).toContain("sprite.setSize(150);");
    expect(code).toContain('sprite.say("Hi!", 2);');
    expect(code).toContain("sprite.hide();");
    expect(workspaceToProgram(programToWorkspace(looks).workspace).program).toEqual(looks);
  });

  it("reject bad size, long or control-character messages", () => {
    const withStatements = (statements: unknown[]) => ({
      ...looks,
      scripts: [{ ...looks.scripts[0], statements }],
    });
    expect(() => validateProgram(withStatements([{ type: "setSize", percent: 1 }]))).toThrow();
    expect(() =>
      validateProgram(withStatements([{ type: "say", message: "x".repeat(41), seconds: 1 }])),
    ).toThrow();
    expect(() =>
      validateProgram(withStatements([{ type: "say", message: "a\nb", seconds: 1 }])),
    ).toThrow();
  });
});
