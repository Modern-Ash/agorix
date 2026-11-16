import { describe, expect, it } from "vitest";
import { validateProgram, SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { parseAgorixCode, projectAgorixCode } from "./index.js";

const num = (value: number) => ({ type: "numericLiteral", value }) as const;

const program = (): ProjectProgram =>
  validateProgram({
    schema: SCHEMA_VERSION,
    variables: [{ id: "var-1", name: "score", initialValue: 0, visible: true }],
    scripts: [
      {
        id: "script-1",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "move", steps: 40 },
          { type: "turn", degrees: 90 },
          { type: "say", text: "Hola", seconds: 2 },
          { type: "think", text: "Mmm" },
          { type: "wait", seconds: 1 },
          { type: "goTo", x: 40, y: -20 },
          { type: "setVariable", variableId: "var-1", value: num(5) },
          { type: "changeVariable", variableId: "var-1", delta: num(1) },
          { type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] },
          {
            type: "if",
            condition: { type: "keyDown", key: "Space" },
            then: [{ type: "turn", degrees: 90 }],
            else: [{ type: "hide" }],
          },
          { type: "if", condition: { type: "keyDown", key: "ArrowUp" }, then: [{ type: "show" }] },
          { type: "forever", body: [{ type: "move", steps: 40 }] },
        ],
      },
      {
        id: "script-2",
        trigger: { type: "onKeyPressed", key: "ArrowRight" },
        statements: [{ type: "show" }],
      },
      {
        id: "script-3",
        trigger: { type: "onMessage", message: "go" },
        statements: [{ type: "move", steps: 40 }],
      },
    ],
  } as never);

describe("Agorix Code read back into the program", () => {
  it("gives back the same program from the text it was shown as", () => {
    const original = program();
    const text = projectAgorixCode(original).text;
    const parsed = parseAgorixCode(text, original);
    expect(parsed).toEqual({ ok: true, program: original });
  });

  it("reads a text written by hand, and ids are made when there is no program to take them from", () => {
    const parsed = parseAgorixCode('variable "n" = 2\nwhen start\n  move 40\n  change "n" by 1\n');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.program.variables?.[0]).toMatchObject({
        id: "var-1",
        name: "n",
        initialValue: 2,
      });
      expect(parsed.program.scripts[0]!.statements).toHaveLength(2);
    }
  });

  it("keeps what an edit did not touch: ids by name and by position", () => {
    const original = program();
    const edited = projectAgorixCode(original).text.replace(
      "move 40\n  turn 90",
      "move 80\n  turn 90",
    );
    const parsed = parseAgorixCode(edited, original);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.program.scripts.map((s) => s.id)).toEqual(["script-1", "script-2", "script-3"]);
      expect(parsed.program.scripts[0]!.statements[0]).toEqual({ type: "move", steps: 80 });
      expect(parsed.program.variables?.[0]?.id).toBe("var-1");
    }
  });

  it.each([
    ["", "emptyText", 1],
    ["when start\n  jump 3\n", "unknownLine", 2],
    ["when start\n   move 3\n", "badIndent", 2],
    ["when start\n\tmove 3\n", "badIndent", 2],
    ["when start\n  move ten\n", "badNumber", 2],
    ["when start\n  say hola\n", "badText", 2],
    ['when start\n  set "x" to 1\n', "unknownName", 2],
    ["when start\n  else\n", "elseWithoutIf", 2],
    ["when start\n  repeat 2 times\n", "emptyBody", 2],
    ["when start\n    move 3\n", "badIndent", 2],
    ["move 3\n", "unknownLine", 1],
    ["when start\n  move 40000\n", "notValid", 1],
  ])("refuses %j with %s at line %i", (source, code, line) => {
    expect(parseAgorixCode(source)).toEqual({ ok: false, errors: [{ code, line }] });
  });

  it("refuses a text that is too long before reading it", () => {
    const long = `when start\n${"  move 1\n".repeat(500)}`;
    expect(parseAgorixCode(long)).toMatchObject({ ok: false, errors: [{ code: "tooLong" }] });
    expect(parseAgorixCode("x".repeat(20_001))).toMatchObject({
      ok: false,
      errors: [{ code: "tooLong" }],
    });
  });

  it("never returns a program the validator would refuse", () => {
    const parsed = parseAgorixCode("when start\n  repeat 0 times\n    move 1\n");
    expect(parsed.ok).toBe(false);
  });
});
