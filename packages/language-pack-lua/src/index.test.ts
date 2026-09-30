import { describe, expect, it } from "vitest";
import {
  assertLanguageProjectionConformance,
  createLanguagePackRegistry,
} from "@agorix/language-projection";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { luaLanguagePack, luaProjection, projectLua } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [{
    id: "main",
    trigger: { type: "onStart" },
    statements: [
      { type: "repeat", count: 2, body: [{ type: "move", steps: 10 }] },
      { type: "if", condition: { type: "touchingGoal" }, then: [{ type: "turn", degrees: 90 }] },
    ],
  }],
};

describe("Lua language pack spike", () => {
  it("projects through the unchanged generic LanguageProjection contract", () => {
    expect(projectLua(program).text).toBe(
      [
        "function on_start()",
        "  for _ = 1, 2 do",
        "    move(10)",
        "  end",
        "  if touching_goal() then",
        "    turn(90)",
        "  end",
        "end",
        "",
      ].join("\n"),
    );
  });

  it("passes common conformance and maps nested canonical nodes", () => {
    expect(() =>
      assertLanguageProjectionConformance(luaProjection, {
        name: "lua spike",
        program,
        requiredNodeIds: [
          "scripts[0]",
          "scripts[0]/statements[0]",
          "scripts[0]/statements[0]/body[0]",
          "scripts[0]/statements[1]/then[0]",
        ],
      }),
    ).not.toThrow();
  });

  it("is discovered from generic pack metadata", () => {
    const registry = createLanguagePackRegistry([luaLanguagePack]);
    expect(registry.require("lua").projection).toBe(luaProjection);
    expect(registry.list()[0]).toMatchObject({
      id: "lua",
      version: "spike-1",
      projection: { id: "lua" },
    });
  });

  it("does not claim arbitrary Lua execution", () => {
    expect(projectLua(program).metadata).toMatchObject({ executable: false });
  });
});
