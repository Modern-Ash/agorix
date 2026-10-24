import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { getKidsAdvancedMission, evaluateKidsAdvancedMission } from "@agorix/curriculum";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addAdvancedStatement,
  addCuratedSceneActor,
  creativeForAdvancedProgram,
  replaceAdvancedStatement,
  validateAdvancedSceneProgram,
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

  it("adds two curated actors with independent scripts and one-cell movement", () => {
    let history = createEditorHistory(mission.starterProgram);
    history = addCuratedSceneActor(history, "actor:robot");
    history = addCuratedSceneActor(history, "actor:frog");
    expect(() => addCuratedSceneActor(history, "actor:robot")).toThrow();
    history = addAdvancedStatement(history, "actor:robot", { type: "move", steps: 1 });
    history = addAdvancedStatement(history, "actor:frog", { type: "move", steps: 1 });
    const program = validateAdvancedSceneProgram(history.current);
    const creative = creativeForAdvancedProgram(mission.starterCreative, program);
    const run = runMultiActorProgram(program, creative);
    expect(run.actors.find((actor) => actor.id === "actor:robot")?.world.sprite.x).toBe(161);
    expect(run.actors.find((actor) => actor.id === "actor:frog")?.world.sprite.x).toBe(241);
    expect(program.scripts[0]?.statements).toHaveLength(0);
    const undone = undoCanonicalTransaction(
      undoCanonicalTransaction(undoCanonicalTransaction(history).history).history,
    ).history;
    expect(
      creativeForAdvancedProgram(mission.starterCreative, undone.current).actors?.map(
        (actor) => actor.id,
      ),
    ).toEqual(["actor:ori", "actor:friend", "actor:robot"]);
  });

  it("switches to each of three safe looks and exposes it in the next runtime frame", () => {
    let history = createEditorHistory(mission.starterProgram);
    history = addAdvancedStatement(history, "actor:ori", {
      type: "switchCostume",
      costumeId: "asset:costume.explorer",
    });
    const run = runMultiActorProgram(
      history.current,
      creativeForAdvancedProgram(mission.starterCreative, history.current),
    );
    expect(
      run.frames[0]?.actors.find((actor) => actor.id === "actor:ori")?.world.sprite.costumeId,
    ).toBe("asset:costume.explorer");
    history = replaceAdvancedStatement(history, "actor:ori", 0, {
      type: "switchCostume",
      costumeId: "asset:costume.spark",
    });
    expect(
      runMultiActorProgram(
        history.current,
        creativeForAdvancedProgram(mission.starterCreative, history.current),
      ).actors[0]?.world.sprite.costumeId,
    ).toBe("asset:costume.spark");
    expect(() =>
      addAdvancedStatement(history, "actor:ori", { type: "move", steps: 500 }),
    ).toThrow();
    expect(() =>
      validateAdvancedSceneProgram({
        ...history.current,
        scripts: [
          ...history.current.scripts,
          { id: "unsafe", trigger: { type: "greenFlag" }, statements: [] },
        ],
      }),
    ).toThrow();
  });
});
