import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import type { Expression } from "@agorix/program-model";
import {
  addStudioList,
  addStudioText,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  studioActorId,
  validateStudioProgram,
} from "./kidsStudioModel.js";

// Lists hold numbers or words (design: docs/product/WORD_LISTS_DESIGN.md, increment 3).
const nova = studioActorId(1, "nova");
const word = (value: string): Expression => ({ type: "textLiteral", value });
const at = (index: number): Expression => ({
  type: "listItem",
  listId: "studio-list-1",
  index: { type: "numericLiteral", value: index },
});
const start = () =>
  addStudioText(
    addStudioList(createEditorHistory(createStudioProgram("nova")), "Compras"),
    "Fruta",
  );

describe("the free scene's lists take words", () => {
  it("accepts a short word, a word variable and an item as what to add, insert or replace with", () => {
    let history = start();
    history = appendStudioStatement(history, nova, {
      type: "listAdd",
      listId: "studio-list-1",
      value: word("manzana"),
    });
    history = appendStudioStatement(history, nova, {
      type: "listInsertAt",
      listId: "studio-list-1",
      index: { type: "numericLiteral", value: 1 },
      value: { type: "textVariable", variableId: "studio-text-1" },
    });
    history = appendStudioStatement(history, nova, {
      type: "listReplaceAt",
      listId: "studio-list-1",
      index: { type: "numericLiteral", value: 1 },
      value: at(1),
    });
    history = appendStudioStatement(history, nova, {
      type: "setText",
      variableId: "studio-text-1",
      value: at(1),
    });
    expect(validateStudioProgram(history.current).scripts[0]!.statements).toHaveLength(4);
  });

  it("still takes a number, and keeps the list empty at the start", () => {
    const history = appendStudioStatement(start(), nova, {
      type: "listAdd",
      listId: "studio-list-1",
      value: { type: "numericLiteral", value: 7 },
    });
    const program = validateStudioProgram(history.current);
    expect(program.lists![0]!.initialItems).toEqual([]);
    expect(() =>
      validateStudioProgram({
        ...program,
        lists: [{ ...program.lists![0]!, initialItems: ["hola"] }],
      }),
    ).toThrow();
  });

  it("refuses a word longer than 20 letters, one with control characters, and an unknown list", () => {
    for (const bad of [word("x".repeat(21)), word("a\u0007b")]) {
      expect(() =>
        appendStudioStatement(start(), nova, {
          type: "listAdd",
          listId: "studio-list-1",
          value: bad,
        }),
      ).toThrow();
    }
    expect(() =>
      appendStudioStatement(start(), nova, {
        type: "listAdd",
        listId: "studio-list-9",
        value: word("hola"),
      }),
    ).toThrow();
  });

  it("runs: the words land in the list in order, and the run never stops on a word", () => {
    let history = start();
    for (const text of ["uno", "dos", "tres"])
      history = appendStudioStatement(history, nova, {
        type: "listAdd",
        listId: "studio-list-1",
        value: word(text),
      });
    history = appendStudioStatement(history, nova, {
      type: "setText",
      variableId: "studio-text-1",
      value: at(2),
    });
    const program = validateStudioProgram(history.current);
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(run.actors[0]!.world.lists?.["studio-list-1"]?.items).toEqual(["uno", "dos", "tres"]);
    expect(run.actors[0]!.world.texts?.["studio-text-1"]?.value).toBe("dos");
    expect(run.outcome).toBe("completed");
  });
});
