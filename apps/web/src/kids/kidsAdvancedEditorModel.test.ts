import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { getKidsAdvancedMission, evaluateKidsAdvancedMission } from "@agorix/curriculum";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addAdvancedStatement,
  creativeForAdvancedProgram,
  replaceAdvancedStatement,
} from "./kidsAdvancedEditorModel.js";

describe("Kids advanced scene editor", () => {
  const mission = getKidsAdvancedMission("scene", "es");

  it("edits each actor in the canonical program and completes only with runtime evidence", () => {
    let history = createEditorHistory(mission.starterProgram);
    history = addAdvancedStatement(history, "actor:friend", {
      type: "switchCostume",
      costumeId: "asset:costume.spark",
    });
    history = addAdvancedStatement(history, "actor:friend", {
      type: "playSound",
      soundId: "asset:sound.beacon",
    });
    expect(history.current.scripts).toHaveLength(2);
    expect(history.current.scripts[0]?.statements).toHaveLength(0);
    const creative = creativeForAdvancedProgram(mission.starterCreative, history.current);
    expect(creative.actors?.[1]?.scripts).toEqual(["advanced-scene-friend"]);
    expect(
      evaluateKidsAdvancedMission("scene", runMultiActorProgram(history.current, creative)),
    ).toBe(true);
    const undone = undoCanonicalTransaction(history).history;
    expect(
      evaluateKidsAdvancedMission(
        "scene",
        runMultiActorProgram(
          undone.current,
          creativeForAdvancedProgram(mission.starterCreative, undone.current),
        ),
      ),
    ).toBe(false);
  });

  it("rejects unsupported assets and keeps the previous program", () => {
    const history = createEditorHistory(mission.starterProgram);
    expect(() =>
      addAdvancedStatement(history, "actor:ori", {
        type: "playSound",
        soundId: "not-an-asset",
      }),
    ).toThrow();
    expect(history.current.scripts[0]?.statements).toHaveLength(0);
    expect(() =>
      replaceAdvancedStatement(history, "actor:ori", 0, {
        type: "switchCostume",
        costumeId: "asset:costume.spark",
      }),
    ).toThrow();
  });
});
