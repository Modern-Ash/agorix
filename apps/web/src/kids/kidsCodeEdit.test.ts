import { describe, expect, it } from "vitest";
import { projectAgorixCode } from "@agorix/agorix-code";
import { applyAgorixCode, agorixCodeEditable, codeEditMessage } from "./kidsCodeEdit.js";
import { validateStudioProgram } from "./kidsStudioModel.js";

const flag = { type: "greenFlag" } as const;
const program = (statements: unknown[], extra: Record<string, unknown> = {}) =>
  validateStudioProgram({
    schema: "agorix/program/v1",
    scripts: [{ id: "studio-actor-1-nova", trigger: flag, statements }],
    ...extra,
  } as never);

describe("editing the program as Agorix Code", () => {
  it("is editable when the text gives back exactly the program", () => {
    expect(agorixCodeEditable(program([{ type: "move", steps: 40 }]))).toBe(true);
  });

  it("is not editable when a block the text cannot read is in it", () => {
    expect(agorixCodeEditable(program([{ type: "createCopies", count: 3, rule: "fall" }]))).toBe(
      false,
    );
  });

  it("is editable with pen and music blocks, and the packs follow the blocks", () => {
    expect(
      agorixCodeEditable(
        program([{ type: "penDown" }, { type: "playNote", note: 60, beats: 1 }], {
          extensions: ["pen", "music"],
        }),
      ),
    ).toBe(true);
  });

  it("is editable with calculations and conditions, and applies an edit to one", () => {
    const base = validateStudioProgram({
      schema: "agorix/program/v1",
      variables: [{ id: "studio-var-1", name: "puntos", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "studio-actor-1-nova",
          trigger: flag,
          statements: [
            {
              type: "setVariable",
              variableId: "studio-var-1",
              value: {
                type: "add",
                left: { type: "variable", variableId: "studio-var-1" },
                right: { type: "numericLiteral", value: 2 },
              },
            },
            {
              type: "if",
              condition: {
                type: "greaterThan",
                left: { type: "variable", variableId: "studio-var-1" },
                right: { type: "numericLiteral", value: 1 },
              },
              then: [{ type: "show" }],
            },
          ],
        },
      ],
    } as never);
    expect(agorixCodeEditable(base)).toBe(true);
    const edited = projectAgorixCode(base).text.replace('("puntos" > 1)', '("puntos" > 5)');
    const result = applyAgorixCode(edited, base);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(JSON.stringify(result.program.scripts[0]!.statements[1])).toContain('"value":5');
  });

  it("is editable with lists, and applies an edit that adds an item and a new list", () => {
    const listed = program(
      [{ type: "listAdd", listId: "studio-list-1", value: { type: "numericLiteral", value: 6 } }],
      { lists: [{ id: "studio-list-1", name: "Puntos", initialItems: [], visible: true }] },
    );
    expect(agorixCodeEditable(listed)).toBe(true);
    const text = projectAgorixCode(listed).text.replace("add 6", "add 7");
    const edited = applyAgorixCode(
      text.replace('show "Puntos"\n', 'show "Puntos"\nstage list "Otra" = "a"\nshow "Otra"\n'),
      listed,
    );
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.program.lists?.map((item) => item.id)).toEqual([
        "studio-list-1",
        "studio-list-2",
      ]);
      expect(JSON.stringify(edited.program.scripts)).toContain('"value":7');
    }
  });

  it("is editable with a custom block and its calls, and applies an edit to the call", () => {
    const withBlock = validateStudioProgram({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "studio-actor-1-nova",
          trigger: flag,
          procedures: [
            {
              id: "proc-1-1",
              name: "Paso",
              params: [{ id: "p1", name: "largo" }],
              body: [{ type: "move", steps: 40, stepsFrom: "p1" }],
            },
          ],
          statements: [
            {
              type: "callProcedure",
              procedureId: "proc-1-1",
              args: [{ type: "numericLiteral", value: 40 }],
            },
          ],
        },
      ],
    } as never);
    expect(agorixCodeEditable(withBlock)).toBe(true);
    const edited = applyAgorixCode(
      projectAgorixCode(withBlock).text.replace("call Paso with 40", "call Paso with 80"),
      withBlock,
    );
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(JSON.stringify(edited.program)).toContain('"value":80');
  });

  it("applies an edit and keeps what it did not touch", () => {
    const base = program([
      { type: "move", steps: 40 },
      { type: "turn", degrees: 90 },
    ]);
    const edited = projectAgorixCode(base).text.replace("move 40", "move 80");
    const result = applyAgorixCode(edited, base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.program.scripts[0]!.id).toBe("studio-actor-1-nova");
      expect(result.program.scripts[0]!.statements).toEqual([
        { type: "move", steps: 80 },
        { type: "turn", degrees: 90 },
      ]);
    }
  });

  it("gives a variable typed by hand the next Studio id", () => {
    const base = program([{ type: "move", steps: 40 }]);
    const text = `variable "puntos" = 0\nshow "puntos"\n\n${projectAgorixCode(base).text}`;
    const result = applyAgorixCode(text, base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program.variables?.[0]?.id).toBe("studio-var-1");
  });

  it("says the first problem, with its line, in both languages", () => {
    const base = program([{ type: "move", steps: 40 }]);
    const result = applyAgorixCode("when start\n  jump 3\n", base);
    expect(result).toEqual({ ok: false, code: "unknownLine", line: 2 });
    if (!result.ok) {
      expect(codeEditMessage(result.code, result.line, "es")).toBe(
        "Línea 2: No entiendo esta línea todavía.",
      );
      expect(codeEditMessage(result.code, result.line, "en")).toContain("Line 2:");
    }
  });

  it("refuses text the scene would not accept even if it reads", () => {
    const base = program([{ type: "move", steps: 40 }]);
    // Moving 3 steps is a number the scene does not offer.
    expect(applyAgorixCode("when start\n  move 3\n", base)).toMatchObject({ ok: false });
  });
});
