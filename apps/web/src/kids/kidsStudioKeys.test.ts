import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import { STUDIO_KEYS, isStudioKey, studioKeyLabel, studioKeyOfEvent } from "./kidsStudioChoices.js";
import { convertScratchProject } from "./kidsScratchImport.js";
import { exportScratchProject } from "./kidsScratchExport.js";
import { readScratchProject } from "./kidsScratchZip.js";
import {
  addStudioScript,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  studioActorId,
  studioExtraTarget,
  validateStudioProgram,
} from "./kidsStudioModel.js";

const nova = studioActorId(1, "nova");

describe("every key a Scratch child reaches for", () => {
  it("offers space, the arrows, Enter, the 26 letters and the 10 digits, once each", () => {
    expect(STUDIO_KEYS).toHaveLength(42);
    expect(new Set(STUDIO_KEYS).size).toBe(42);
    for (const key of ["Space", "ArrowUp", "Enter", "a", "w", "z", "0", "9"])
      expect(isStudioKey(key)).toBe(true);
    for (const key of ["A", "Shift", "F5", "ab", "", "Escape"])
      expect(isStudioKey(key)).toBe(false);
  });

  it("reads a physical key press as the same key, capital or not", () => {
    expect(studioKeyOfEvent({ code: "Space", key: " " })).toBe("Space");
    expect(studioKeyOfEvent({ code: "KeyA", key: "a" })).toBe("a");
    expect(studioKeyOfEvent({ code: "KeyA", key: "A" })).toBe("a");
    expect(studioKeyOfEvent({ code: "Digit5", key: "5" })).toBe("5");
    expect(studioKeyOfEvent({ code: "ArrowLeft", key: "ArrowLeft" })).toBe("ArrowLeft");
    expect(studioKeyOfEvent({ code: "Enter", key: "Enter" })).toBe("Enter");
    expect(studioKeyOfEvent({ code: "ShiftLeft", key: "Shift" })).toBeNull();
    expect(studioKeyOfEvent({ code: "F5", key: "F5" })).toBeNull();
  });

  it("shows a letter or digit in capitals and the other keys by name", () => {
    expect(studioKeyLabel("w")).toBe("W");
    expect(studioKeyLabel("7")).toBe("7");
    expect(studioKeyLabel("ArrowUp")).toBe("ArrowUp");
  });

  it("lets a character answer W and S, in two scripts, and each key moves it its own way", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioScript(history, nova, { type: "onKeyPressed", key: "w" });
    history = addStudioScript(history, nova, { type: "onKeyPressed", key: "s" });
    history = appendStudioStatement(history, studioExtraTarget(nova, 2), {
      type: "move",
      steps: 20,
    });
    history = appendStudioStatement(history, studioExtraTarget(nova, 3), {
      type: "move",
      steps: -20,
    });
    const program = validateStudioProgram(history.current);
    const creative = creativeForStudio(program, "forest", "es");
    const x = (key: string) =>
      runMultiActorProgram(program, creative, { events: [{ type: "keyPressed", key }] }).actors[0]!
        .world.sprite.x;
    const origin = x("none");
    expect(x("w")).toBe(origin + 20);
    expect(x("s")).toBe(origin - 20);
  });

  it("asks about a letter held down", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = appendStudioStatement(history, nova, {
      type: "if",
      condition: { type: "keyDown", key: "d" },
      then: [{ type: "move", steps: 40 }],
    });
    const program = validateStudioProgram(history.current);
    const creative = creativeForStudio(program, "forest", "es");
    const x = (keysDown: string[]) =>
      runMultiActorProgram(program, creative, { keysDown }).actors[0]!.world.sprite.x;
    expect(x(["d"]) - x([])).toBe(40);
  });

  it("round-trips through Scratch: the importer reads them and the exporter writes them", async () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioScript(history, nova, { type: "onKeyPressed", key: "a" });
    history = addStudioScript(history, nova, { type: "onKeyPressed", key: "Enter" });
    history = appendStudioStatement(history, studioExtraTarget(nova, 2), {
      type: "move",
      steps: 20,
    });
    history = appendStudioStatement(history, studioExtraTarget(nova, 3), {
      type: "if",
      condition: { type: "keyDown", key: "7" },
      then: [{ type: "move", steps: 40 }],
    });
    const program = validateStudioProgram(history.current);
    const { bytes, report } = exportScratchProject(program, "forest", "es");
    expect(report.left).toEqual([]);
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.report.dropped).toEqual([]);
    expect(back.program.scripts.map((script) => script.trigger)).toEqual(
      program.scripts.map((script) => script.trigger),
    );
    expect(back.program.scripts[2]!.statements).toEqual(program.scripts[2]!.statements);
  });
});
