import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Expression, type ProjectProgram } from "@agorix/program-model";
import { projectPython } from "@agorix/python-projection";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgramLanguage } from "@agorix/code-generator";

// Lists hold numbers or words: every view shows a word as a quoted word, and a number as a number.
const word = (value: string): Expression => ({ type: "textLiteral", value });
const at = (index: number): Expression => ({
  type: "listItem",
  listId: "l",
  index: { type: "numericLiteral", value: index },
});
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "n", name: "n", initialValue: 0, visible: false }],
  textVariables: [{ id: "t", name: "t", initialValue: "", visible: false }],
  lists: [{ id: "l", name: "Palabras", initialItems: ["a", 2], visible: true }],
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "listAdd", listId: "l", value: word("hola") },
        { type: "showList", listId: "l" },
        { type: "hideList", listId: "l" },
        {
          type: "setVariable",
          variableId: "n",
          value: { type: "listIndexOf", listId: "l", value: word("hola") },
        },
        {
          type: "if",
          condition: { type: "listContains", listId: "l", value: word("a") },
          then: [{ type: "listClear", listId: "l" }],
        },
        { type: "setText", variableId: "t", value: at(1) },
        {
          type: "if",
          condition: { type: "equals", left: at(1), right: word("uno") },
          then: [
            {
              type: "setVariable",
              variableId: "n",
              value: { type: "add", left: at(2), right: { type: "numericLiteral", value: 1 } },
            },
          ],
        },
      ],
    },
  ],
};

describe("the code views of a list that holds numbers and words", () => {
  it("Python writes words quoted and numbers plain, in the start and in the blocks", () => {
    const text = projectPython(program).text;
    expect(text).toContain('palabras = ["a", 2]');
    expect(text).toContain('list_add(palabras, "hola")');
    expect(text).toContain('== "uno"');
    expect(text).toContain('list_index_of(palabras, "hola")');
    expect(text).toContain('list_contains(palabras, "a")');
    expect(text).toContain("palabras.clear()");
  });

  it("Agorix code writes them the same way", () => {
    const text = projectAgorixCode(program).text;
    expect(text).toContain('list "Palabras" = "a", 2');
    expect(text).toContain('add "hola" to "Palabras"');
    expect(text).toContain('= "uno"');
    expect(text).toContain('item # of "hola" in "Palabras"');
    expect(text).toContain('delete all of "Palabras"');
  });

  it("TypeScript writes them the same way", () => {
    const text = projectProgramLanguage(program).text;
    expect(text).toContain('const palabras = ["a", 2];');
    expect(text).toContain('listAdd(palabras, "hola");');
    expect(text).toContain('=== "uno"');
    expect(text).toContain('listIndexOf(palabras, "hola")');
    expect(text).toContain('listContains(palabras, "a")');
    expect(text).toContain("listClear(palabras)");
  });
});
