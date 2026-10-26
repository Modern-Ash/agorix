import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import {
  addStudioActor,
  appendStudioStatement,
  createStudioProcedure,
  createStudioProgram,
  moveStudioStatementTo,
  moveStudioStatementToActor,
  wrapStudioTail,
} from "./kidsStudioModel.js";

// Issue #593: blocks move into and out of repeat/if bodies, and between characters.
const nova = "actor:studio-1-nova";
const mika = "actor:studio-2-mika";

function scene() {
  let history = addStudioActor(createEditorHistory(createStudioProgram("nova")), "mika");
  history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
  history = appendStudioStatement(history, nova, { type: "turn", degrees: 90 });
  history = appendStudioStatement(history, nova, { type: "say", text: "Hola" });
  return wrapStudioTail(history, nova, 1, { type: "repeat", times: 3 });
}
// Program of nova: [move, turn, repeat[say]]
const kinds = (history: ReturnType<typeof scene>, actor = 0) =>
  history.current.scripts[actor]!.statements.map((statement) => statement.type);
const body = (history: ReturnType<typeof scene>) => {
  const repeat = history.current.scripts[0]!.statements[2]!;
  return repeat.type === "repeat" ? repeat.body.map((statement) => statement.type) : [];
};

describe("moving blocks into and out of bodies", () => {
  it("puts a block into a repeat's body at a place, as one undoable step", () => {
    const history = moveStudioStatementTo(scene(), nova, [0], { container: [2] }, 0);
    expect(kinds(history)).toEqual(["turn", "repeat"]);
    expect(
      (
        history.current.scripts[0]!.statements[1] as unknown as { body: { type: string }[] }
      ).body.map((statement) => statement.type),
    ).toEqual(["move", "say"]);
    expect(kinds(undoCanonicalTransaction(history).history)).toEqual(["move", "turn", "repeat"]);
  });

  it("takes a block out of a body to the program, and reorders inside a body", () => {
    let history = moveStudioStatementTo(scene(), nova, [0], { container: [2] }, 1);
    expect(body(scene())).toEqual(["say"]);
    // [turn, repeat[say, move]] -> bring "move" out to the front
    history = moveStudioStatementTo(history, nova, [1, 1], { container: null }, 0);
    expect(kinds(history)).toEqual(["move", "turn", "repeat"]);
    // and put it back first inside the body
    history = moveStudioStatementTo(history, nova, [0], { container: [2] }, 0);
    const inner = (
      history.current.scripts[0]!.statements[1] as unknown as { body: { type: string }[] }
    ).body;
    expect(inner.map((statement) => statement.type)).toEqual(["move", "say"]);
    history = moveStudioStatementTo(history, nova, [1, 0], { container: [1] }, 1);
    expect(
      (
        history.current.scripts[0]!.statements[1] as unknown as { body: { type: string }[] }
      ).body.map((statement) => statement.type),
    ).toEqual(["say", "move"]);
  });

  it("keeps the target right when a block that came earlier leaves", () => {
    // Moving the turn (index 1) out of the way must not change which repeat receives the move.
    const history = moveStudioStatementTo(scene(), nova, [1], { container: [2] }, 0);
    expect(kinds(history)).toEqual(["move", "repeat"]);
    expect(
      (
        history.current.scripts[0]!.statements[1] as unknown as { body: { type: string }[] }
      ).body.map((statement) => statement.type),
    ).toEqual(["turn", "say"]);
  });

  it("refuses to empty a body, to go into itself, and to overfill or nest too deeply", () => {
    expect(() => moveStudioStatementTo(scene(), nova, [2, 0], { container: null }, 0)).toThrow();
    expect(() => moveStudioStatementTo(scene(), nova, [2], { container: [2] }, 0)).toThrow();
    let full = scene();
    for (let i = 0; i < 2; i += 1) full = appendStudioStatement(full, nova, { type: "show" });
    full = moveStudioStatementTo(full, nova, [3], { container: [2] }, 0);
    full = moveStudioStatementTo(full, nova, [3], { container: [2] }, 0);
    expect(() => moveStudioStatementTo(full, nova, [0], { container: [2] }, 0)).toThrow();
    expect(() => moveStudioStatementTo(scene(), nova, [0], { container: [1] }, 0)).toThrow();
    expect(() => moveStudioStatementTo(scene(), nova, [9], { container: null }, 0)).toThrow();
    expect(() => moveStudioStatementTo(scene(), nova, [0], { container: null }, 9)).toThrow();
  });
});

describe("giving a block to another character", () => {
  it("moves it to the end of that character's program and undo brings it back", () => {
    const history = moveStudioStatementToActor(scene(), nova, 0, mika);
    expect(kinds(history, 0)).toEqual(["turn", "repeat"]);
    expect(kinds(history, 1)).toEqual(["move"]);
    const undone = undoCanonicalTransaction(history).history;
    expect(kinds(undone, 0)).toEqual(["move", "turn", "repeat"]);
    expect(kinds(undone, 1)).toEqual([]);
  });

  it("moves a whole repeat with what is inside it", () => {
    const history = moveStudioStatementToActor(scene(), nova, 2, mika);
    const given = history.current.scripts[1]!.statements[0]!;
    expect(given.type).toBe("repeat");
    expect(given.type === "repeat" ? given.body.length : 0).toBe(1);
  });

  it("keeps a block that uses a custom block with its character, and refuses the same or an unknown one", () => {
    let history = scene();
    history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
    history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
    history = createStudioProcedure(history, nova, 2, "Paso");
    const last = history.current.scripts[0]!.statements.length - 1;
    expect(() => moveStudioStatementToActor(history, nova, last, mika)).toThrow();
    expect(() => moveStudioStatementToActor(history, nova, 0, nova)).toThrow();
    expect(() => moveStudioStatementToActor(history, nova, 99, mika)).toThrow();
    expect(() => moveStudioStatementToActor(history, nova, 0, "actor:studio-9-nova")).toThrow();
  });
});
