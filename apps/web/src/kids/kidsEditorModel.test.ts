import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import {
  addKidsBlock,
  createKidsEditor,
  playKidsProgram,
  redoKidsEdit,
  removeKidsBlock,
  setKidsBlockNumber,
  undoKidsEdit,
} from "./kidsEditorModel.js";

const mission = getKidsMission(KIDS_MISSION_IDS[0], "es");

describe("Kids canonical editor (issue #375)", () => {
  it("builds, undoes and redoes a move using canonical history", () => {
    const start = createKidsEditor(mission);
    const added = addKidsBlock(start, "move");
    const four = setKidsBlockNumber(added, 0, 4);
    expect(four.current.scripts[0]?.statements).toEqual([{ type: "move", steps: 160 }]);
    expect(undoKidsEdit(four).current.scripts[0]?.statements).toEqual([
      { type: "move", steps: 40 },
    ]);
    expect(redoKidsEdit(undoKidsEdit(four)).current).toEqual(four.current);
  });

  it("runs the real runtime and interprets success, passed and wall", () => {
    const start = addKidsBlock(createKidsEditor(mission), "move");
    expect(playKidsProgram(setKidsBlockNumber(start, 0, 4), mission).evaluation.outcome).toBe(
      "success",
    );
    expect(playKidsProgram(setKidsBlockNumber(start, 0, 5), mission).evaluation.outcome).toBe(
      "passed",
    );
    expect(
      playKidsProgram(addKidsBlock(setKidsBlockNumber(start, 0, 5), "move"), mission).evaluation
        .outcome,
    ).toBe("wall");
  });

  it("exposes per-node trace and removes blocks without a second program store", () => {
    const added = addKidsBlock(createKidsEditor(mission), "move");
    const run = playKidsProgram(added, mission);
    expect(run.result.trace[0]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(removeKidsBlock(added, 0).current.scripts[0]?.statements).toEqual([]);
  });

  it("executes repeat children and a sound through canonical statements", () => {
    const repeat = addKidsBlock(createKidsEditor(mission), "repeat");
    const child = addKidsBlock(repeat, "move", 0);
    const sound = addKidsBlock(child, "sound");
    expect(sound.current.scripts[0]?.statements).toEqual([
      { type: "repeat", count: 2, body: [{ type: "move", steps: 40 }] },
      { type: "playSound", soundId: "kids-tone" },
    ]);
    expect(
      playKidsProgram(sound, mission).result.trace.map((entry) => entry.statementType),
    ).toEqual(["move", "move", "repeat", "playSound"]);
  });
});
