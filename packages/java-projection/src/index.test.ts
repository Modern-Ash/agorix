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
        "class AgorixProgram {",
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

  it("diagnoses unsupported nodes instead of claiming semantic parity", () => {
    const unsupported: ProjectProgram = {
      ...program,
      scripts: [{ ...program.scripts[0]!, statements: [{ type: "say", text: "hello" }] }],
    };
    expect(projectJava(unsupported).diagnostics).toMatchObject([
      { code: "unsupported-node", nodeId: "scripts[0]/statements[0]" },
    ]);
  });
});
