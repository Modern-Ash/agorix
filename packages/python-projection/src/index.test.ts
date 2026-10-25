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
  it("shows the actor-click callback instead of on_start", () => {
    const clicked: ProjectProgram = {
      ...program,
      scripts: [{ ...program.scripts[0]!, trigger: { type: "onActorClicked" }, statements: [] }],
    };
    expect(projectPython(clicked).text).toBe("def on_actor_clicked():\n    pass\n");
  });
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
        "go_to",
        "turn",
        "point_in_direction",
        "point_towards",
        "bounce_on_edge",
        "go_to_layer",
        "touching_goal",
        "touching_actor",
        "touching_stage_edge",
        "distance_to_actor",
        "x_position",
        "y_position",
        "say",
        "think",
        "show",
        "hide",
        "set_size",
        "switch_costume",
        "switch_backdrop",
        "play_sound",
        "stop_sounds",
        "set_volume",
        "change_volume",
        "show_variable",
        "hide_variable",
        "random_number",
        "random_integer",
        "list_add",
        "list_remove_at",
        "list_item",
        "show_list",
        "wait",
      ],
      executable: false,
    });
  });
});

describe("Python projection: variables and operators", () => {
  const variablesProgram: ProjectProgram = {
    schema: SCHEMA_VERSION,
    variables: [{ id: "score", name: "score", initialValue: 0, visible: true }],
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [
          {
            type: "changeVariable",
            variableId: "score",
            delta: {
              type: "add",
              left: { type: "variable", variableId: "score" },
              right: { type: "numericLiteral", value: 1 },
            },
          },
          {
            type: "setVariable",
            variableId: "score",
            value: {
              type: "random",
              min: { type: "numericLiteral", value: 1 },
              max: { type: "numericLiteral", value: 10 },
            },
          },
          {
            type: "if",
            condition: {
              type: "and",
              left: {
                type: "lessThan",
                left: { type: "variable", variableId: "score" },
                right: { type: "numericLiteral", value: 10 },
              },
              right: { type: "not", value: { type: "booleanLiteral", value: false } },
            },
            then: [
              { type: "showVariable", variableId: "score" },
              { type: "hideVariable", variableId: "score" },
            ],
          },
        ],
      },
    ],
  };

  it("projects variables, operators and deterministic random without diagnostics", () => {
    const result = projectPython(variablesProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "score = 0",
        'show_variable("score")',
        "",
        "def on_start():",
        "    global score",
        "    score += (score + 1)",
        "    score = random_number(1, 10)",
        "    if ((score < 10) and (not False)):",
        '        show_variable("score")',
        '        hide_variable("score")',
        "",
      ].join("\n"),
    );
  });

  it("maps variable declarations and statements to their visible text", () => {
    const result = projectPython(variablesProgram);
    const declaration = result.mapping["variables/score"]?.[0];
    expect(declaration).toBeDefined();
    expect(result.text.slice(declaration!.start, declaration!.end)).toBe("score = 0\n");
    for (const nodeId of [
      "scripts[0]/statements[0]",
      "scripts[0]/statements[1]",
      "scripts[0]/statements[2]/then[0]",
      "scripts[0]/statements[2]/then[1]",
    ]) {
      expect(result.mapping[nodeId]?.length).toBeGreaterThan(0);
    }
  });

  it("passes shared conformance for variable and operator programs", () => {
    expect(() =>
      assertLanguageProjectionConformance(pythonProjection, {
        name: "python variables and operators",
        program: variablesProgram,
        requiredNodeIds: ["scripts[0]", "scripts[0]/statements[0]", "scripts[0]/statements[2]"],
      }),
    ).not.toThrow();
  });

  it("escapes Python reserved words used as variable names", () => {
    const keywordProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [{ id: "kw", name: "class", initialValue: 0, visible: false }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "setVariable", variableId: "kw", value: { type: "numericLiteral", value: 1 } },
            {
              type: "if",
              condition: {
                type: "equals",
                left: { type: "variable", variableId: "kw" },
                right: { type: "numericLiteral", value: 1 },
              },
              then: [],
            },
          ],
        },
      ],
    };

    const result = projectPython(keywordProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("class_ = 0");
    expect(result.text).toContain("    global class_");
    expect(result.text).toContain("class_ = 1");
    expect(result.text).toContain("(class_ == 1)");
  });

  it("aligns variable reads and writes on one sanitized identifier", () => {
    const spacedProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [{ id: "total", name: "Total Hits!", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "total",
              value: {
                type: "add",
                left: { type: "variable", variableId: "total" },
                right: { type: "numericLiteral", value: 1 },
              },
            },
            {
              type: "if",
              condition: {
                type: "equals",
                left: { type: "variable", variableId: "total" },
                right: { type: "numericLiteral", value: 1 },
              },
              then: [],
            },
          ],
        },
      ],
    };

    const result = projectPython(spacedProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("totalHits = 0");
    expect(result.text).toContain("    global totalHits");
    expect(result.text).toContain("totalHits = (totalHits + 1)");
    expect(result.text).toContain("if (totalHits == 1):");
  });

  it("escapes variables that collide with generated helpers and builtins", () => {
    const collisionProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [
        { id: "helper", name: "move", initialValue: 0, visible: false },
        { id: "builtin", name: "range", initialValue: 0, visible: false },
        { id: "api", name: "say", initialValue: 0, visible: false },
      ],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "repeat", count: 1, body: [] },
            { type: "showVariable", variableId: "helper" },
          ],
        },
      ],
    };

    const result = projectPython(collisionProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("move_ = 0");
    expect(result.text).toContain("range_ = 0");
    expect(result.text).toContain("say_ = 0");
    expect(result.text).toContain('show_variable("move_")');
    expect(result.text).not.toContain("move(");
  });

  it("encodes initial watcher visibility in the declaration block", () => {
    const visibilityProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [
        { id: "shown", name: "shown", initialValue: 0, visible: true },
        { id: "hidden", name: "hidden", initialValue: 0, visible: false },
      ],
      scripts: [],
    };

    const result = projectPython(visibilityProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('shown = 0\nshow_variable("shown")');
    expect(result.text).toContain("hidden = 0");
    expect(result.text.split("show_variable")).toHaveLength(2);
  });

  it("keeps watcher operations keyed to disambiguated identifiers", () => {
    const duplicateProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [
        { id: "first", name: "score", initialValue: 0, visible: true },
        { id: "second", name: "score", initialValue: 0, visible: true },
      ],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "showVariable", variableId: "first" },
            { type: "showVariable", variableId: "second" },
            { type: "hideVariable", variableId: "second" },
          ],
        },
      ],
    };

    const result = projectPython(duplicateProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("score = 0");
    expect(result.text).toContain("score2 = 0");
    expect(result.text).toContain('show_variable("score")');
    expect(result.text).toContain('show_variable("score2")');
    expect(result.text).toContain('hide_variable("score2")');
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

describe("Python projection: Sound operations", () => {
  const soundProgram: ProjectProgram = {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [{ type: "playSound", soundId: "asset:sound.beacon" }, { type: "stopSounds" }],
      },
    ],
  };

  it("projects Sound operations as beginner-readable Python without diagnostics", () => {
    const result = projectPython(soundProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["def on_start():", '    play_sound("asset:sound.beacon")', "    stop_sounds()", ""].join(
        "\n",
      ),
    );
  });

  it("maps each Sound statement to its visible text", () => {
    const result = projectPython(soundProgram);
    for (const nodeId of ["scripts[0]/statements[0]", "scripts[0]/statements[1]"]) {
      const range = result.mapping[nodeId]?.[0];
      expect(range).toBeDefined();
      expect(result.text.slice(range!.start, range!.end)).toMatch(/^ {4}/);
    }
  });
});

describe("Python projection: Volume operations", () => {
  const volumeProgram: ProjectProgram = {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [
          { type: "setVolume", volume: 40 },
          { type: "changeVolume", delta: -10 },
        ],
      },
    ],
  };

  it("projects volume operations as beginner-readable Python without diagnostics", () => {
    const result = projectPython(volumeProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["def on_start():", "    set_volume(40)", "    change_volume(-10)", ""].join("\n"),
    );
  });

  it("maps each volume statement to its visible text", () => {
    const result = projectPython(volumeProgram);
    for (const nodeId of ["scripts[0]/statements[0]", "scripts[0]/statements[1]"]) {
      const range = result.mapping[nodeId]?.[0];
      expect(range).toBeDefined();
      expect(result.text.slice(range!.start, range!.end)).toMatch(/^ {4}/);
    }
  });
});

describe("Python projection: heading operations", () => {
  it("projects point and bounce blocks as beginner-readable Python", () => {
    const result = projectPython({
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "pointInDirection", degrees: -90 },
            { type: "pointTowards", actorId: "actor:studio-2-fox" },
            { type: "bounceOnEdge" },
          ],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "def on_start():",
        "    point_in_direction(-90)",
        '    point_towards("actor:studio-2-fox")',
        "    bounce_on_edge()",
        "",
      ].join("\n"),
    );
  });
});

describe("Python projection: repeat until", () => {
  it("projects the loop with its condition", () => {
    const result = projectPython({
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "repeatUntil",
              condition: { type: "touchingStageEdge", minX: 0, maxX: 320, minY: -100, maxY: 120 },
              body: [{ type: "move", steps: 20 }],
            },
          ],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("while not (");
    expect(result.text).toContain("        move(20)");
  });
});

describe("Python projection: change size", () => {
  it("projects change_size", () => {
    const result = projectPython({
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "changeSize", delta: -25 }],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(["def on_start():", "    change_size(-25)", ""].join("\n"));
  });
});

describe("Python projection: modulo", () => {
  it("projects the remainder operator", () => {
    const result = projectPython({
      schema: SCHEMA_VERSION,
      variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "n",
              value: {
                type: "modulo",
                left: { type: "variable", variableId: "n" },
                right: { type: "numericLiteral", value: 2 },
              },
            },
          ],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain(" % 2)");
  });
});

describe("projection: math functions", () => {
  it("projects the function applied to its operand", () => {
    const result = projectPython({
      schema: "agorix/program/v1",
      variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "n",
              value: {
                type: "mathFunction",
                function: "round",
                value: { type: "variable", variableId: "n" },
              },
            },
          ],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("round(");
  });
});

describe("Python projection: layers", () => {
  it("projects go to front and back", () => {
    const result = projectPython({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "goToLayer", layer: "front" }],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('go_to_layer("front")');
  });
});
