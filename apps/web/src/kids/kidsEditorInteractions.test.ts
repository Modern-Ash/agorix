import { describe, expect, it } from "vitest";
import { dropSlot, nextZoom } from "./kidsEditorInteractions.js";
import {
  addKidsBlock,
  createKidsEditor,
  insertKidsBlock,
  moveKidsBlock,
} from "./kidsEditorModel.js";
import { getKidsMission } from "@agorix/curriculum";

describe("Kids block zoom (#449)", () => {
  it("clamps zoom to four levels", () => {
    expect(nextZoom(100, 1)).toBe(125);
    expect(nextZoom(150, 1)).toBe(150);
    expect(nextZoom(80, -1)).toBe(80);
  });
  it("maps a 150% pointer position to the second insertion slot", () => {
    expect(dropSlot(190, 100, [24, 72, 120], 150)).toBe(1);
    expect(dropSlot(100, 100, [24, 72, 120], 150)).toBe(0);
    expect(dropSlot(300, 100, [24, 72, 120], 150)).toBe(3);
  });
  it("inserts and reorders canonical blocks without changing their meaning", () => {
    const mission = getKidsMission("kids.m1.straight", "es");
    let history = addKidsBlock(createKidsEditor(mission), "move");
    history = insertKidsBlock(history, "turnR", 1);
    history = insertKidsBlock(history, "sound", 1);
    expect(history.current.scripts[0]?.statements.map((item) => item.type)).toEqual([
      "move",
      "playSound",
      "turn",
    ]);
    history = moveKidsBlock(history, 2, 0);
    expect(history.current.scripts[0]?.statements.map((item) => item.type)).toEqual([
      "turn",
      "move",
      "playSound",
    ]);
  });
});
