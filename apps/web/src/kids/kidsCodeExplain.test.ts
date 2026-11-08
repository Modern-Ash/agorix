import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectJava } from "@agorix/java-projection";
import { projectPython } from "@agorix/python-projection";
import { explainCodeLine, type ExplainedLanguage } from "./kidsCodeExplain.js";

const statements: Statement[] = [
  { type: "move", steps: 40 },
  { type: "turn", degrees: -90 },
  { type: "goTo", x: 100, y: 20 },
  { type: "say", text: "Hola, mundo", seconds: 2 },
  { type: "wait", seconds: 1 },
  { type: "setSize", size: 150 },
  { type: "hide" },
];
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements }],
};

/** The line of a top-level statement in a language, read the way the screen reads it. */
function lineOf(language: ExplainedLanguage, index: number): string {
  const nodeId = `scripts[0]/statements[${index}]`;
  const [text, range] =
    language === "python"
      ? [projectPython(program).text, projectPython(program).mapping[nodeId]?.[0]]
      : language === "java"
        ? [projectJava(program).text, projectJava(program).mapping[nodeId]?.[0]]
        : language === "typescript"
          ? [projectProgram(program).code, projectProgram(program).mapping[nodeId]]
          : [projectAgorixCode(program).text, projectAgorixCode(program).mapping[nodeId]?.[0]];
  const start = range!.start;
  const end = text.indexOf("\n", start);
  return text.slice(start, end === -1 ? undefined : end).trim();
}

describe("the explanation of a line of code", () => {
  for (const language of ["python", "typescript", "java"] as const)
    it(`breaks a call into its name and its values in ${language}`, () => {
      const move = explainCodeLine(statements[0]!, lineOf(language, 0), language, "es");
      expect(move.parts.map((part) => part.code)[1]).toBe("40");
      expect(move.parts[0]!.meaning).toContain("mueve");
      expect(move.parts[1]!.meaning).toContain("pasos");
      const goTo = explainCodeLine(statements[2]!, lineOf(language, 2), language, "es");
      expect(goTo.parts.map((part) => part.code).slice(1)).toEqual(["100", "20"]);
      const say = explainCodeLine(statements[3]!, lineOf(language, 3), language, "en");
      expect(say.parts.map((part) => part.code).slice(1)).toEqual(['"Hola, mundo"', "2"]);
      expect(say.parts[0]!.meaning).toContain("speech bubble");
    });

  it("keeps a comma inside the text from splitting it", () => {
    const say = explainCodeLine(
      { type: "say", text: "a, b", seconds: 1 },
      'say_for("a, b", 1)',
      "python",
      "es",
    );
    expect(say.parts.map((part) => part.code)).toEqual(["say_for()", '"a, b"', "1"]);
  });

  it("gives a call with no values just its name", () => {
    const hide = explainCodeLine(statements[6]!, lineOf("python", 6), "python", "es");
    expect(hide.parts).toHaveLength(1);
    expect(hide.parts[0]!.meaning).toContain("esconde");
  });

  it("explains a loop or a condition as a whole line", () => {
    const repeat = explainCodeLine(
      { type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] },
      "for _ in range(3):",
      "python",
      "es",
    );
    expect(repeat.parts[0]!.meaning).toContain("3 veces");
    const forever = explainCodeLine(
      { type: "forever", body: [{ type: "move", steps: 20 }] },
      "while True:",
      "python",
      "en",
    );
    expect(forever.parts[0]!.meaning).toContain("without stopping");
  });

  it("shows Agorix Code as it is, since it already reads like a sentence", () => {
    const line = lineOf("agorix", 0);
    expect(explainCodeLine(statements[0]!, line, "agorix", "es")).toEqual({ line, parts: [] });
  });

  it("uses voseo in Spanish", () => {
    for (const statement of statements)
      for (const part of explainCodeLine(statement, "x()", "python", "es").parts)
        expect(part.meaning).not.toMatch(/\b(tienes|puedes|haz|usa)\b/i);
  });
});
