import { describe, expect, it } from "vitest";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import {
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
} from "./index.js";

function program(statements: readonly Statement[]): ProjectProgram {
  return {
    schema: "agorix/program/v1",
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
  };
}

describe("editor history", () => {
  it("restores exact canonical states through undo and redo", () => {
    const empty = program([]);
    const moved = program([{ type: "move", steps: 10 }]);
    const turned = program([
      { type: "move", steps: 10 },
      { type: "turn", degrees: 90 },
    ]);
    const first = recordCanonicalTransaction(createEditorHistory(empty), {
      label: "add move",
      after: moved,
    }).history;
    const second = recordCanonicalTransaction(first, {
      label: "add turn",
      after: turned,
    }).history;

    const undoTurn = undoCanonicalTransaction(second);
    const undoMove = undoCanonicalTransaction(undoTurn.history);
    const redoMove = redoCanonicalTransaction(undoMove.history);
    const redoTurn = redoCanonicalTransaction(redoMove.history);

    expect(undoTurn.program).toEqual(moved);
    expect(undoMove.program).toEqual(empty);
    expect(redoMove.program).toEqual(moved);
    expect(redoTurn.program).toEqual(turned);
    expect(redoTurn.history.canRedo).toBe(false);
  });

  it("clears the redo branch after a new canonical edit", () => {
    const empty = program([]);
    const moved = program([{ type: "move", steps: 10 }]);
    const turned = program([{ type: "turn", degrees: 90 }]);
    const initial = recordCanonicalTransaction(createEditorHistory(empty), {
      label: "add move",
      after: moved,
    }).history;
    const undone = undoCanonicalTransaction(initial).history;

    const branched = recordCanonicalTransaction(undone, {
      label: "add turn",
      after: turned,
    }).history;

    expect(branched.current).toEqual(turned);
    expect(branched.canRedo).toBe(false);
    expect(branched.future).toEqual([]);
  });

  it("does not record no-op transactions", () => {
    const empty = program([]);
    const result = recordCanonicalTransaction(createEditorHistory(empty), {
      label: "no-op",
      after: empty,
    });

    expect(result.applied).toBe(false);
    expect(result.history.past).toEqual([]);
    expect(result.history.current).toEqual(empty);
  });

  it("evicts old transactions deterministically at the configured bound", () => {
    const initial = createEditorHistory(program([]), { limit: 2 });
    const first = recordCanonicalTransaction(initial, {
      label: "one",
      after: program([{ type: "move", steps: 1 }]),
    }).history;
    const second = recordCanonicalTransaction(first, {
      label: "two",
      after: program([{ type: "move", steps: 2 }]),
    }).history;
    const third = recordCanonicalTransaction(second, {
      label: "three",
      after: program([{ type: "move", steps: 3 }]),
    }).history;

    expect(third.past.map((entry) => entry.label)).toEqual(["two", "three"]);
    expect(third.past).toHaveLength(2);
  });
});
