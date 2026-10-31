import { describe, expect, it } from "vitest";
import { KIDS_SOUNDS } from "./kidsSoundLibrary.js";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import { studioCategories } from "./kidsStudioCategories.js";
import { createStudioProgram, validateStudioProgram } from "./kidsStudioModel.js";
import {
  STUDIO_BLOCK_CATEGORY,
  blocksInCategory,
  extensionOfBlock,
  starterShelf,
  starterStatement,
} from "./kidsPaletteCatalog.js";

const base = createStudioProgram("nova");
const withStatement = (statement: Statement, extensions?: readonly ("pen" | "music")[]) =>
  ({
    ...base,
    ...(extensions === undefined ? {} : { extensions }),
    scripts: [{ ...base.scripts[0]!, statements: [statement] }],
  }) as ProjectProgram;

const PACK_SAMPLES: Readonly<Record<string, Statement>> = {
  penDown: { type: "penDown" },
  penUp: { type: "penUp" },
  setPenColor: { type: "setPenColor", color: "red" },
  setPenSize: { type: "setPenSize", size: 8 },
  clearPen: { type: "clearPen" },
  playNote: { type: "playNote", note: 60, beats: 1 },
  playDrum: { type: "playDrum", drum: "snare", beats: 1 },
  setInstrument: { type: "setInstrument", instrument: "piano" },
  setTempo: { type: "setTempo", bpm: 90 },
  setPitch: { type: "setPitch", semitones: 0 },
  setPan: { type: "setPan", pan: 0 },
};

function declares(program: ProjectProgram): boolean {
  try {
    validateStudioProgram(program);
    return true;
  } catch (error) {
    if (/does not declare/.test(String((error as Error).message))) return false;
    throw error;
  }
}

describe("studio block catalog", () => {
  it("places every category's blocks and only known categories", () => {
    const known = studioCategories({ pen: true, music: true });
    for (const category of known) {
      if (category !== "myBlocks")
        expect(blocksInCategory(category).length, category).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(STUDIO_BLOCK_CATEGORY))).toEqual(new Set(known));
  });

  it("puts a block in Pen or Music exactly when the engine requires that pack", () => {
    for (const kind of Object.keys(
      STUDIO_BLOCK_CATEGORY,
    ) as (keyof typeof STUDIO_BLOCK_CATEGORY)[]) {
      const pack = extensionOfBlock(kind);
      const sample = PACK_SAMPLES[kind];
      if (pack === undefined) {
        expect(sample, kind).toBeUndefined();
        continue;
      }
      expect(sample, kind).toBeDefined();
      expect(declares(withStatement(sample!)), `${kind} without ${pack}`).toBe(false);
      expect(declares(withStatement(sample!, [pack])), `${kind} with ${pack}`).toBe(true);
    }
  });
});

describe("starter shelf growth (issue #1133)", () => {
  it("starts with the three base starters and grows with the concepts the child used", () => {
    expect(starterShelf([])).toEqual(["move", "turn", "playSound"]);
    expect(starterShelf([{ type: "move", steps: 40 }])).toContain("repeat");
    expect(starterShelf([{ type: "move", steps: 40 }])).not.toContain("wait");
    expect(
      starterShelf([
        {
          type: "if",
          condition: { type: "mouseDown" },
          then: [{ type: "playSound", soundId: KIDS_SOUNDS[0]!.id }],
        },
      ]),
    ).toContain("wait");
  });

  it("only offers starters that validate", () => {
    for (const kind of ["move", "turn", "playSound", "repeat", "wait"] as const) {
      expect(declares(withStatement(starterStatement(kind, KIDS_SOUNDS[0]!.id)))).toBe(true);
    }
  });
});
