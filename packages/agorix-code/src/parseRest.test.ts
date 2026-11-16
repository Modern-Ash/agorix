import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { parseAgorixCode, projectAgorixCode } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "var-1", name: "pick", initialValue: 0, visible: false }],
  textVariables: [{ id: "text-1", name: "who", initialValue: "", visible: false }],
  scripts: [
    {
      id: "script-1",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "askText", promptId: "name", variableId: "text-1" },
        { type: "askChoice", promptId: "path", variableId: "var-1" },
        { type: "broadcast", message: "go" },
        { type: "broadcast", message: "again", wait: true },
        { type: "createCopies", count: 3, rule: "fall" },
        { type: "createCopies", count: 2, rule: "follow", withScript: true },
      ],
    },
    {
      id: "script-2",
      trigger: { type: "onMessage", message: "go" },
      statements: [{ type: "show" }],
    },
  ],
};

describe("Agorix Code reads ask, broadcast and copies", () => {
  it("gives the same program back, with and without the base", () => {
    const text = projectAgorixCode(program).text;
    for (const base of [program, undefined])
      expect(parseAgorixCode(text, base)).toEqual({ ok: true, program });
  });

  it("refuses an ask that stores into a name nobody declared", () => {
    const text = projectAgorixCode(program).text.replace('→ "who"', '→ "nobody"');
    expect(parseAgorixCode(text, undefined).ok).toBe(false);
  });
});
