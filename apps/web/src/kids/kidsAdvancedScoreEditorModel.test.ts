import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addScoreStatement,
  removeScoreStatement,
  scoreStatements,
} from "./kidsAdvancedScoreEditorModel.js";

describe("advanced score editor", () => {
  it("stores score blocks in the canonical program and the watcher sees runtime truth", () => {
    const mission = getKidsAdvancedMission("score", "es");
    const start = createEditorHistory(mission.starterProgram);
    const history = addScoreStatement(start, {
      type: "changeVariable",
      variableId: "score",
      delta: { type: "numericLiteral", value: 1 },
    });
    expect(scoreStatements(history.current)).toHaveLength(1);
    const result = runMultiActorProgram(history.current, mission.starterCreative);
    expect(result.actors[0]?.world.variables?.score).toMatchObject({ value: 1, visible: true });
    expect(scoreStatements(undoCanonicalTransaction(history).history.current)).toHaveLength(0);
    expect(scoreStatements(removeScoreStatement(history, 0).current)).toHaveLength(0);
  });

  it("rejects edits to another variable or an unbounded value", () => {
    const history = createEditorHistory(getKidsAdvancedMission("score", "es").starterProgram);
    expect(() =>
      addScoreStatement(history, {
        type: "changeVariable",
        variableId: "other",
        delta: { type: "numericLiteral", value: 1 },
      }),
    ).toThrow();
    expect(() =>
      addScoreStatement(history, {
        type: "setVariable",
        variableId: "score",
        value: { type: "numericLiteral", value: 999 },
      }),
    ).toThrow();
  });
});
