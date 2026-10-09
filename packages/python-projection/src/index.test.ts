import { describe, expect, it } from "vitest";
import {
  assertLanguageProjectionConformance,
  createLanguageProjectionRegistry,
} from "@agorix/language-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectPython, pythonProjection } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 10 },
        { type: "turn", degrees: 90 },
        { type: "repeat", count: 2, body: [{ type: "move", steps: 5 }] },
        { type: "if", condition: { type: "touchingGoal" }, then: [{ type: "turn", degrees: 45 }] },
        { type: "if", condition: { type: "booleanLiteral", value: true }, then: [] },
      ],
    },
  ],
};

describe("Python projection", () => {
  it("projects current canonical operations as beginner-readable Python", () => {
    expect(projectPython(program).text).toBe(
      [
        "def on_start():",
        "    move(10)",
        "    turn(90)",
        "    for _ in range(2):",
        "        move(5)",
        "    if touching_goal():",
        "        turn(45)",
        "    if True:",
        "        pass",
        "",
      ].join("\n"),
    );
  });

  it("preserves nested node mappings and mapping boundaries", () => {
    const result = projectPython(program);
    const child = result.mapping["scripts[0]/statements[2]/body[0]"]?.[0];
    const parent = result.mapping["scripts[0]/statements[2]"]?.[0];
    expect(child).toBeDefined();
    expect(parent).toBeDefined();
    expect(parent!.start).toBeLessThan(child!.start);
    expect(parent!.end).toBeGreaterThanOrEqual(child!.end);
    expect(result.text.slice(child!.start, child!.end)).toBe("        move(5)\n");
  });

  it("is stable across repeated projections", () => {
    expect(projectPython(program)).toEqual(projectPython(structuredClone(program)));
  });

  it("passes shared conformance and can be selected from the registry", () => {
    expect(() =>
      assertLanguageProjectionConformance(pythonProjection, {
        name: "python current POC",
        program,
        requiredNodeIds: [
          "scripts[0]",
          "scripts[0]/statements[0]",
          "scripts[0]/statements[2]",
          "scripts[0]/statements[2]/body[0]",
          "scripts[0]/statements[3]/then[0]",
        ],
      }),
    ).not.toThrow();
    const registry = createLanguageProjectionRegistry([pythonProjection]);
    expect(registry.require("python")).toBe(pythonProjection);
  });

  it("declares support API assumptions and never claims arbitrary executability", () => {
    expect(projectPython(program).metadata).toMatchObject({
      supportApi: [
        "move",
        "turn",
        "touching_goal",
        "say",
        "think",
        "show",
        "hide",
        "set_size",
        "switch_costume",
        "switch_backdrop",
      ],
      executable: false,
    });
  });
});

describe("Python projection: Looks operations", () => {
  const looksProgram: ProjectProgram = {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [
          { type: "say", text: "Launch sequence" },
          { type: "think", text: "Need a better route" },
          { type: "show" },
          { type: "hide" },
          { type: "setSize", size: 120 },
          { type: "switchCostume", costumeId: "asset:costume.default" },
          { type: "switchBackdrop", backdropId: "asset:space.nebula" },
        ],
      },
    ],
  };

  it("projects Looks operations as beginner-readable Python without diagnostics", () => {
    const result = projectPython(looksProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "def on_start():",
        '    say("Launch sequence")',
        '    think("Need a better route")',
        "    show()",
        "    hide()",
        "    set_size(120)",
        '    switch_costume("asset:costume.default")',
        '    switch_backdrop("asset:space.nebula")',
        "",
      ].join("\n"),
    );
  });

  it("preserves nested node mappings and mapping boundaries", () => {
    const result = projectPython(looksProgram);
    for (const nodeId of [
      "scripts[0]/statements[0]",
      "scripts[0]/statements[1]",
      "scripts[0]/statements[2]",
      "scripts[0]/statements[3]",
      "scripts[0]/statements[4]",
      "scripts[0]/statements[5]",
      "scripts[0]/statements[6]",
    ]) {
      const range = result.mapping[nodeId]?.[0];
      expect(range).toBeDefined();
      expect(result.text.slice(range!.start, range!.end)).toMatch(/^ {4}/);
    }
  });
});
