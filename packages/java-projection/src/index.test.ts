import { describe, expect, it } from "vitest";
import {
  assertLanguageProjectionConformance,
  createLanguagePackRegistry,
} from "@agorix/language-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { javaLanguagePack, javaProjection, projectJava } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 40 },
        { type: "turn", degrees: -90 },
        {
          type: "repeat",
          count: 2,
          body: [
            { type: "playSound", soundId: "tone" },
            { type: "move", steps: 5 },
          ],
        },
      ],
    },
  ],
};

describe("Java projection", () => {
  it("projects movement, turns, repeats and sound with a stable golden output", () => {
    expect(projectJava(program).text).toBe(
      [
        "class AgorixProgram extends Sprite {",
        "    void onStart() {",
        "        move(40);",
        "        turn(-90);",
        "        for (int i2 = 0; i2 < 2; i2++) {",
        '            playSound("tone");',
        "            move(5);",
        "        }",
        "    }",
        "}",
        "",
      ].join("\n"),
    );
    expect(projectJava(program).diagnostics).toEqual([]);
  });

  it("maps nested canonical nodes and remains deterministic", () => {
    assertLanguageProjectionConformance(javaProjection, {
      name: "Java Kids program",
      program,
      requiredNodeIds: [
        "scripts[0]",
        "scripts[0]/statements[0]",
        "scripts[0]/statements[2]",
        "scripts[0]/statements[2]/body[0]",
      ],
    });
    const result = projectJava(program);
    const child = result.mapping["scripts[0]/statements[2]/body[0]"]![0]!;
    expect(result.text.slice(child.start, child.end)).toBe('            playSound("tone");\n');
    expect(createLanguagePackRegistry([javaLanguagePack]).require("java")).toBe(javaLanguagePack);
  });

  it("projects what used to be unsupported and refuses what the model does not know", () => {
    const withSay: ProjectProgram = {
      ...program,
      scripts: [{ ...program.scripts[0]!, statements: [{ type: "say", text: "hello" }] }],
    };
    const projected = projectJava(withSay);
    expect(projected.diagnostics).toEqual([]);
    expect(projected.text).toContain('say("hello");');
    const unknown = {
      ...program,
      scripts: [{ ...program.scripts[0]!, statements: [{ type: "teleport" }] }],
    } as unknown as ProjectProgram;
    expect(() => projectJava(unknown)).toThrow();
  });
});

// Issues #627 and #628: control, data, events, looks and messages.
const rich: ProjectProgram = {
  schema: SCHEMA_VERSION,
  extensions: ["pen"],
  variables: [{ id: "v", name: "Puntos", initialValue: 0, visible: true }],
  lists: [{ id: "l", name: "Tesoros", initialItems: [1, 2.5], visible: false }],
  scripts: [
    {
      id: "s",
      trigger: { type: "onKeyPressed", key: "ArrowRight" },
      statements: [
        {
          type: "setVariable",
          variableId: "v",
          value: {
            type: "add",
            left: { type: "variable", variableId: "v" },
            right: { type: "numericLiteral", value: 1 },
          },
        },
        {
          type: "if",
          condition: {
            type: "and",
            left: { type: "keyDown", key: "Space" },
            right: {
              type: "greaterThan",
              left: { type: "variable", variableId: "v" },
              right: { type: "numericLiteral", value: 2 },
            },
          },
          then: [
            { type: "say", text: "Hola" },
            {
              type: "callProcedure",
              procedureId: "p",
              args: [{ type: "numericLiteral", value: 40 }],
            },
          ],
          else: [{ type: "broadcast", message: "listo" }],
        },
        {
          type: "repeatUntil",
          condition: { type: "variable", variableId: "v" },
          body: [
            { type: "listAdd", listId: "l", value: { type: "listLength", listId: "l" } },
            { type: "wait", seconds: 0.5 },
          ],
        },
      ],
      procedures: [
        {
          id: "p",
          name: "Paso",
          params: [{ id: "p1", name: "Largo" }],
          body: [{ type: "move", steps: 40, stepsFrom: "p1" }, { type: "penDown" }],
        },
      ],
    },
    {
      id: "t",
      trigger: { type: "greenFlag" },
      statements: [{ type: "repeat", count: 3, body: [{ type: "move", steps: 20 }] }],
    },
  ],
};

describe("Java projection of the whole canonical vocabulary", () => {
  it("projects variables, lists, conditions, loops, events, messages and custom blocks", () => {
    const result = projectJava(rich);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "class AgorixProgram extends Sprite {",
        "    double puntos = 0;",
        "    java.util.ArrayList<Double> tesoros = new java.util.ArrayList<>(java.util.List.of(1.0, 2.5));",
        "    void myPaso(double n_largo) {",
        "        move(n_largo);",
        "        penDown();",
        "    }",
        "    void onKeyPressedArrowRight() {",
        "        puntos = (puntos + 1);",
        '        if ((keyDown("Space") && (puntos > 2))) {',
        '            say("Hola");',
        "            myPaso(40);",
        "        } else {",
        '            broadcast("listo");',
        "        }",
        "        while (!(puntos != 0)) {",
        "            tesoros.add((double) tesoros.size());",
        "            waitSeconds(0.5);",
        "        }",
        "    }",
        "    void onStart() {",
        "        for (int i2 = 0; i2 < 3; i2++) {",
        "            move(20);",
        "        }",
        "    }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("maps every nested node, including conditions, both branches and procedure bodies", () => {
    const { mapping } = projectJava(rich);
    for (const id of [
      "variables/v",
      "lists/l",
      "scripts[0]",
      "scripts[0]/statements[1]",
      "scripts[0]/statements[1]/then[1]",
      "scripts[0]/statements[1]/else[0]",
      "scripts[0]/statements[2]/body[1]",
      "scripts[0]/procedures[0]",
      "scripts[0]/procedures[0]/body[0]",
      "scripts[1]/statements[0]/body[0]",
    ])
      expect(mapping[id]?.length, id).toBeGreaterThan(0);
  });

  it("gives two scripts with the same trigger and two blocks with the same name distinct methods", () => {
    const twin = (id: string) => ({
      id,
      trigger: { type: "greenFlag" as const },
      statements: [{ type: "move" as const, steps: 1 }],
      procedures: [{ id: `${id}-p`, name: "Paso", body: [{ type: "move" as const, steps: 2 }] }],
    });
    const text = projectJava({ schema: SCHEMA_VERSION, scripts: [twin("a"), twin("b")] }).text;
    const names = [...text.matchAll(/ void (\w+)\(/g)].map((match) => match[1]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(4);
  });

  it("keeps a child's names from clashing with Java words or the support methods", () => {
    const text = projectJava({
      schema: SCHEMA_VERSION,
      variables: [
        { id: "a", name: "class", initialValue: 1, visible: false },
        { id: "b", name: "move", initialValue: 2, visible: false },
        { id: "c", name: "Puntos", initialValue: 0, visible: false },
        { id: "d", name: "puntos", initialValue: 0, visible: false },
        { id: "e", name: "123", initialValue: 0, visible: false },
      ],
      scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements: [] }],
    }).text;
    expect(text).toContain("double class_ = 1;");
    expect(text).toContain("double move_ = 2;");
    expect(text).toContain("double puntos = 0;");
    expect(text).toContain("double puntos2 = 0;");
    expect(text).toContain("double v123 = 0;");
  });

  it("treats numbers and true/false the way the runtime does", () => {
    const text = projectJava({
      schema: SCHEMA_VERSION,
      variables: [{ id: "v", name: "n", initialValue: 0, visible: false }],
      scripts: [
        {
          id: "s",
          trigger: { type: "greenFlag" },
          statements: [
            {
              type: "if",
              condition: { type: "variable", variableId: "v" },
              then: [
                {
                  type: "setVariable",
                  variableId: "v",
                  value: { type: "touchingGoal" },
                },
              ],
            },
          ],
        },
      ],
    }).text;
    expect(text).toContain("if ((n != 0)) {");
    expect(text).toContain("n = (touchingGoal() ? 1 : 0);");
  });
});
