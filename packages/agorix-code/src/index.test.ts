import { describe, expect, it } from "vitest";
import { assertLanguageProjectionConformance } from "@agorix/language-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { agorixCodeProjection, projectAgorixCode } from "./index.js";

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
        { type: "if", condition: { type: "numericLiteral", value: 1 }, then: [] },
      ],
    },
  ],
};

describe("Agorix Code projection", () => {
  it("shows an actor-click script as an event, not as an unconditional start", () => {
    const clicked: ProjectProgram = {
      ...program,
      scripts: [{ ...program.scripts[0]!, trigger: { type: "onActorClicked" }, statements: [] }],
    };
    expect(projectAgorixCode(clicked).text).toBe("when actor clicked\n");
  });
  it("projects every current canonical operation with visible nesting", () => {
    expect(projectAgorixCode(program).text).toBe(
      [
        "when start",
        "  move 10",
        "  turn 90",
        "  repeat 2 times",
        "    move 5",
        "  if touching goal",
        "    turn 45",
        "  if true",
        "  if 1",
        "",
      ].join("\n"),
    );
  });

  it("maps stable canonical statement ids to visible text", () => {
    const result = projectAgorixCode(program);
    for (const nodeId of [
      "scripts[0]",
      "scripts[0]/statements[0]",
      "scripts[0]/statements[2]",
      "scripts[0]/statements[2]/body[0]",
      "scripts[0]/statements[3]/then[0]",
    ]) {
      expect(result.mapping[nodeId]?.length).toBeGreaterThan(0);
    }
  });

  it("passes shared LanguageProjection conformance", () => {
    expect(() =>
      assertLanguageProjectionConformance(agorixCodeProjection, {
        name: "current POC operations",
        program,
        requiredNodeIds: [
          "scripts[0]",
          "scripts[0]/statements[0]",
          "scripts[0]/statements[1]",
          "scripts[0]/statements[2]",
          "scripts[0]/statements[3]",
        ],
      }),
    ).not.toThrow();
  });
});

describe("Agorix Code projection: Looks operations", () => {
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

  it("projects Looks operations as readable Agorix Code without diagnostics", () => {
    const result = projectAgorixCode(looksProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "when start",
        '  say "Launch sequence"',
        '  think "Need a better route"',
        "  show",
        "  hide",
        "  set size to 120",
        '  switch costume to "asset:costume.default"',
        '  switch backdrop to "asset:space.nebula"',
        "",
      ].join("\n"),
    );
  });

  it("maps each Looks statement to its visible text", () => {
    const result = projectAgorixCode(looksProgram);
    for (const nodeId of [
      "scripts[0]/statements[0]",
      "scripts[0]/statements[1]",
      "scripts[0]/statements[2]",
      "scripts[0]/statements[3]",
      "scripts[0]/statements[4]",
      "scripts[0]/statements[5]",
      "scripts[0]/statements[6]",
    ]) {
      expect(result.mapping[nodeId]?.length).toBeGreaterThan(0);
      const range = result.mapping[nodeId]![0]!;
      expect(result.text.slice(range.start, range.end)).toMatch(/^ {2}/);
    }
  });
});

describe("Agorix Code projection: variables and operators", () => {
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
    const result = projectAgorixCode(variablesProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        'variable "score" = 0',
        'show "score"',
        "",
        "when start",
        '  change "score" by ("score" + 1)',
        '  set "score" to random 1 to 10',
        '  if (("score" < 10) and not false)',
        '    show "score"',
        '    hide "score"',
        "",
      ].join("\n"),
    );
  });

  it("maps variable declarations and statements to their visible text", () => {
    const result = projectAgorixCode(variablesProgram);
    const declaration = result.mapping["variables/score"]?.[0];
    expect(declaration).toBeDefined();
    expect(result.text.slice(declaration!.start, declaration!.end)).toBe('variable "score" = 0\n');
    for (const nodeId of [
      "scripts[0]/statements[0]",
      "scripts[0]/statements[1]",
      "scripts[0]/statements[2]/then[0]",
      "scripts[0]/statements[2]/then[1]",
    ]) {
      expect(result.mapping[nodeId]?.length).toBeGreaterThan(0);
    }
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

    const result = projectAgorixCode(visibilityProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('variable "shown" = 0\nshow "shown"');
    expect(result.text).toContain('variable "hidden" = 0');
    expect(result.text.split("\nshow ")).toHaveLength(2);
  });

  it("quotes variable names so hostile labels cannot inject code", () => {
    const hostileProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [
        {
          id: "hostile",
          name: 'score"\n  move 100\nsay "pwned',
          initialValue: 0,
          visible: true,
        },
      ],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "showVariable", variableId: "hostile" },
            {
              type: "setVariable",
              variableId: "hostile",
              value: { type: "numericLiteral", value: 1 },
            },
          ],
        },
      ],
    };

    const result = projectAgorixCode(hostileProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        'variable "score\\"\\n  move 100\\nsay \\"pwned" = 0',
        'show "score\\"\\n  move 100\\nsay \\"pwned"',
        "",
        "when start",
        '  show "score\\"\\n  move 100\\nsay \\"pwned"',
        '  set "score\\"\\n  move 100\\nsay \\"pwned" to 1',
        "",
      ].join("\n"),
    );
  });

  it("disambiguates duplicate variable labels", () => {
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
            {
              type: "setVariable",
              variableId: "second",
              value: {
                type: "add",
                left: { type: "variable", variableId: "first" },
                right: { type: "numericLiteral", value: 1 },
              },
            },
          ],
        },
      ],
    };

    const result = projectAgorixCode(duplicateProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('variable "score" = 0');
    expect(result.text).toContain('variable "score2" = 0');
    expect(result.text).toContain('show "score"');
    expect(result.text).toContain('show "score2"');
    expect(result.text).toContain('set "score2" to ("score" + 1)');
  });

  it("passes shared conformance for variable and operator programs", () => {
    expect(() =>
      assertLanguageProjectionConformance(agorixCodeProjection, {
        name: "agorix-code variables and operators",
        program: variablesProgram,
        requiredNodeIds: ["scripts[0]", "scripts[0]/statements[0]", "scripts[0]/statements[2]"],
      }),
    ).not.toThrow();
  });
});

describe("Agorix Code projection: Sound operations", () => {
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

  it("projects Sound operations as readable Agorix Code without diagnostics", () => {
    const result = projectAgorixCode(soundProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["when start", '  play sound "asset:sound.beacon"', "  stop all sounds", ""].join("\n"),
    );
  });

  it("maps each Sound statement to its visible text", () => {
    const result = projectAgorixCode(soundProgram);
    for (const nodeId of ["scripts[0]/statements[0]", "scripts[0]/statements[1]"]) {
      const range = result.mapping[nodeId]?.[0];
      expect(range).toBeDefined();
      expect(result.text.slice(range!.start, range!.end)).toMatch(/^ {2}/);
    }
  });
});

describe("Agorix Code projection: Volume operations", () => {
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

  it("projects volume operations as readable Agorix Code without diagnostics", () => {
    const result = projectAgorixCode(volumeProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["when start", "  set volume to 40", "  change volume by -10", ""].join("\n"),
    );
  });

  it("maps each volume statement to its visible text", () => {
    const result = projectAgorixCode(volumeProgram);
    for (const nodeId of ["scripts[0]/statements[0]", "scripts[0]/statements[1]"]) {
      const range = result.mapping[nodeId]?.[0];
      expect(range).toBeDefined();
      expect(result.text.slice(range!.start, range!.end)).toMatch(/^ {2}/);
    }
  });
});

describe("Agorix Code projection: heading operations", () => {
  it("projects point and bounce blocks as readable Agorix Code", () => {
    const result = projectAgorixCode({
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
        "when start",
        "  point in direction -90",
        '  point towards "actor:studio-2-fox"',
        "  bounce on edge",
        "",
      ].join("\n"),
    );
  });
});

describe("Agorix Code projection: repeat until", () => {
  it("projects the loop with its condition", () => {
    const result = projectAgorixCode({
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
    expect(result.text).toMatch(/^ {2}repeat until .+\n {4}move 20\n/m);
  });
});

describe("Agorix Code projection: change size", () => {
  it("projects change size", () => {
    const result = projectAgorixCode({
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
    expect(result.text).toBe(["when start", "  change size by -25", ""].join("\n"));
  });
});

describe("Agorix Code projection: modulo", () => {
  it("projects the remainder operator", () => {
    const result = projectAgorixCode({
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
    expect(result.text).toContain(" mod 2)");
  });
});

describe("projection: math functions", () => {
  it("projects the function applied to its operand", () => {
    const result = projectAgorixCode({
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
    expect(result.text).toContain("round ");
  });
});

describe("Agorix Code projection: layers", () => {
  it("projects go to front layer", () => {
    const result = projectAgorixCode({
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
    expect(result.text).toContain("go to front layer");
  });
});

describe("Agorix Code projection: glide", () => {
  it("projects glide", () => {
    const result = projectAgorixCode({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "glideTo", x: 120, y: -40, seconds: 2 }],
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("glide to 120, -40 in 2 seconds");
  });
});
