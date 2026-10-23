import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import {
  addKidsBlock,
  createKidsEditor,
  duplicateKidsBlock,
  playKidsProgram,
  redoKidsEdit,
  removeKidsBlock,
  setKidsBlockNumber,
  setKidsBlockSound,
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

  it("changes a sound id in one undoable canonical transaction", () => {
    const start = addKidsBlock(createKidsEditor(mission), "sound");
    const changed = setKidsBlockSound(start, 0, "kids:bell");
    expect(changed.current.scripts[0]?.statements[0]).toEqual({
      type: "playSound",
      soundId: "kids:bell",
    });
    expect(undoKidsEdit(changed).current.scripts[0]?.statements[0]).toEqual({
      type: "playSound",
      soundId: "kids-tone",
    });
    expect(setKidsBlockSound(start, 0, "https://remote.test/file.mp3")).toBe(start);
  });

  it("duplicates blocks right after the original as one undo step (issue #446)", () => {
    const stmts = (h: ReturnType<typeof createKidsEditor>) => h.current.scripts[0]?.statements;
    let h = setKidsBlockNumber(addKidsBlock(createKidsEditor(mission), "move"), 0, 3);
    h = addKidsBlock(h, "turnR");
    const dup = duplicateKidsBlock(h, 0);
    expect(stmts(dup)).toEqual([
      { type: "move", steps: 120 },
      { type: "move", steps: 120 },
      { type: "turn", degrees: 90 },
    ]);
    expect(stmts(dup)?.[0]).not.toBe(stmts(dup)?.[1]);
    expect(stmts(undoKidsEdit(dup))).toEqual(stmts(h));
    expect(stmts(redoKidsEdit(undoKidsEdit(dup)))).toEqual(stmts(dup));
    expect(stmts(duplicateKidsBlock(h, 1))?.at(-1)).toEqual({ type: "turn", degrees: 90 });
    expect(stmts(duplicateKidsBlock(h, 1))).toHaveLength(3);
  });

  it("duplicates a repeat with its whole body and a block inside a repeat", () => {
    let h = addKidsBlock(createKidsEditor(mission), "repeat");
    h = addKidsBlock(h, "move", 0);
    h = addKidsBlock(h, "turnL", 0);
    const copy = duplicateKidsBlock(h, 0);
    const [first, second] = copy.current.scripts[0]?.statements ?? [];
    expect(second).toEqual(first);
    expect(second?.type === "repeat" && second.body).toHaveLength(2);
    if (second?.type === "repeat" && first?.type === "repeat") {
      expect(second.body).not.toBe(first.body);
    }
    const inner = duplicateKidsBlock(h, 0, 0);
    const repeat = inner.current.scripts[0]?.statements[0];
    expect(repeat?.type === "repeat" && repeat.body.map((item) => item.type)).toEqual([
      "move",
      "move",
      "turn",
    ]);
  });

  it("ignores missing blocks and stops at the program size limit without throwing", () => {
    const start = addKidsBlock(createKidsEditor(mission), "move");
    expect(duplicateKidsBlock(start, 5)).toBe(start);
    expect(duplicateKidsBlock(start, 0, 0)).toBe(start);
    let h = start;
    for (let i = 0; i < 20; i++) h = duplicateKidsBlock(h, 0);
    const length = h.current.scripts[0]?.statements.length ?? 0;
    expect(length).toBeGreaterThan(1);
    for (let i = 0; i < 2000; i++) h = duplicateKidsBlock(h, 0);
    expect(h.current.scripts[0]?.statements.length).toBeGreaterThanOrEqual(length);
  });
});
