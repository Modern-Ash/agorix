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
