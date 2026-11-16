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
