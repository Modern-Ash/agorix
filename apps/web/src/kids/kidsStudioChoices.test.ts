import { describe, expect, it } from "vitest";
import {
  STUDIO_BRIGHTNESS_VALUES,
  STUDIO_EFFECT_DELTAS,
  STUDIO_LEVEL_VALUES,
  STUDIO_MOVE_CELLS,
  STUDIO_POINT_DIRECTIONS,
  STUDIO_REPEAT_COUNTS,
  STUDIO_SIZE_DELTAS,
  STUDIO_SIZES,
  STUDIO_TURN_AMOUNTS,
  STUDIO_WAIT_SECONDS,
} from "./kidsStudioChoices.js";
import { MISSION_PALETTE_STATEMENTS } from "./kidsCreationCoverage.js";
import { STUDIO_BLOCK_CATEGORY } from "./kidsPaletteCatalog.js";
import { createEditorHistory } from "@agorix/block-editor";
import {
  appendStudioStatement,
  createStudioProgram,
  validateStudioProgram,
  type StudioStatement,
} from "./kidsStudioModel.js";

const accepted = (statement: StudioStatement) => {
  try {
    const history = appendStudioStatement(
      createEditorHistory(createStudioProgram("nova")),
      "actor:studio-1-nova",
      statement,
    );
    validateStudioProgram(history.current);
    return true;
  } catch {
    return false;
  }
};

describe("closed value lists of the free scene (issue #1133)", () => {
  it("offers only values the model accepts", () => {
    for (const size of STUDIO_SIZES) expect(accepted({ type: "setSize", size })).toBe(true);
    for (const delta of STUDIO_SIZE_DELTAS)
      expect(accepted({ type: "changeSize", delta })).toBe(true);
    for (const seconds of STUDIO_WAIT_SECONDS)
      expect(accepted({ type: "wait", seconds })).toBe(true);
    for (const degrees of STUDIO_TURN_AMOUNTS) {
      expect(accepted({ type: "turn", degrees })).toBe(true);
      expect(accepted({ type: "turn", degrees: -degrees })).toBe(true);
    }
    for (const degrees of STUDIO_POINT_DIRECTIONS)
      expect(accepted({ type: "pointInDirection", degrees })).toBe(true);
    for (const cells of STUDIO_MOVE_CELLS) {
      expect(accepted({ type: "move", steps: cells * 40 })).toBe(true);
      expect(accepted({ type: "move", steps: -cells * 40 })).toBe(true);
    }
    for (const effect of ["color", "ghost"] as const)
      for (const value of STUDIO_LEVEL_VALUES)
        expect(accepted({ type: "setEffect", effect, value })).toBe(true);
    for (const value of STUDIO_BRIGHTNESS_VALUES)
      expect(accepted({ type: "setEffect", effect: "brightness", value })).toBe(true);
    for (const delta of STUDIO_EFFECT_DELTAS)
      expect(accepted({ type: "changeEffect", effect: "ghost", delta })).toBe(true);
    for (const count of STUDIO_REPEAT_COUNTS)
      expect(accepted({ type: "repeat", count, body: [{ type: "move", steps: 40 }] })).toBe(true);
  });

  it("rejects values outside the lists", () => {
    expect(accepted({ type: "setSize", size: 60 })).toBe(false);
    expect(accepted({ type: "wait", seconds: 4 })).toBe(false);
    expect(accepted({ type: "setEffect", effect: "ghost", value: -25 })).toBe(false);
  });

  it("keeps every mission block inside the scene catalog", () => {
    for (const kind of Object.values(MISSION_PALETTE_STATEMENTS))
      expect(STUDIO_BLOCK_CATEGORY).toHaveProperty(kind);
  });
});
