import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  MAX_STUDIO_EXTRA_SCRIPTS,
  addStudioActor,
  addStudioScript,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  extraActorOfScript,
  extraScriptId,
  mainScripts,
  removeStudioScript,
  studioActorId,
  studioBlocksUsed,
  studioExtraScripts,
  studioExtraTarget,
  validateStudioProgram,
} from "./kidsStudioModel.js";

const nova = studioActorId(1, "nova");
const start = () => createEditorHistory(createStudioProgram("nova"));
const right = { type: "onKeyPressed", key: "ArrowRight" } as const;
const left = { type: "onKeyPressed", key: "ArrowLeft" } as const;
const up = { type: "onKeyPressed", key: "ArrowUp" } as const;

describe("a character's extra scripts (#1363)", () => {
  it("names an extra script by its character and slot, and reads the name back", () => {
    expect(extraScriptId(2, "mika", 3)).toBe("studio-actor-2-mika-s3");
    expect(extraActorOfScript("studio-actor-2-mika-s3")).toEqual({
      index: 2,
      characterId: "mika",
      slot: 3,
    });
    expect(extraActorOfScript("studio-actor-2-mika-s4")).toBeNull();
    expect(extraActorOfScript("studio-actor-2-mika-clone")).toBeNull();
    expect(extraActorOfScript("studio-actor-2-mika")).toBeNull();
  });

  it("lets a character answer two keys, and each script acts on the same character", () => {
    let history = start();
    history = addStudioScript(history, nova, right);
    history = addStudioScript(history, nova, left);
    history = appendStudioStatement(history, studioExtraTarget(nova, 2), {
      type: "move",
      steps: 20,
    });
    history = appendStudioStatement(history, studioExtraTarget(nova, 3), {
      type: "move",
      steps: -20,
    });
    const program = validateStudioProgram(history.current);
    expect(studioExtraScripts(program, nova).map((item) => item.slot)).toEqual([2, 3]);
    const creative = creativeForStudio(program, "forest", "es");
    expect(creative.actors![0]!.scripts).toHaveLength(3);
    const go = (key: string) =>
      runMultiActorProgram(program, creative, { events: [{ type: "keyPressed", key }] }).actors[0]!
        .world.sprite.x;
    const origin = go("none");
    expect(go("ArrowRight")).toBe(origin + 20);
    expect(go("ArrowLeft")).toBe(origin - 20);
  });

  it("allows at most the character's own script and two more", () => {
    expect(MAX_STUDIO_EXTRA_SCRIPTS).toBe(2);
    let history = addStudioScript(addStudioScript(start(), nova, right), nova, left);
    expect(() => addStudioScript(history, nova, up)).toThrow(RangeError);
    history = removeStudioScript(history, nova);
    expect(studioExtraScripts(validateStudioProgram(history.current), nova)).toHaveLength(1);
    expect(() => removeStudioScript(removeStudioScript(history, nova), nova)).toThrow(RangeError);
  });

  it("refuses an event the character already answers", () => {
    const history = addStudioScript(start(), nova, right);
    expect(() => addStudioScript(history, nova, right)).toThrow(RangeError);
    // The character's own script starts with the flag, so a second flag script is a repeat.
    expect(() => addStudioScript(start(), nova, { type: "greenFlag" })).toThrow(RangeError);
  });

  it("refuses a gap in the slots, the copy hat, custom blocks and a foreign character", () => {
    const base = createStudioProgram("nova");
    const script = (id: string, trigger: unknown, extra: Record<string, unknown> = {}) =>
      ({ id, trigger, statements: [], ...extra }) as never;
    const withExtra = (...extras: unknown[]) =>
      ({ ...base, scripts: [...base.scripts, ...extras] }) as never;
    expect(() => validateStudioProgram(withExtra(script("studio-actor-1-nova-s3", right)))).toThrow(
      RangeError,
    );
    expect(() =>
      validateStudioProgram(withExtra(script("studio-actor-1-nova-s2", { type: "onCloneStart" }))),
    ).toThrow(RangeError);
    expect(() =>
      validateStudioProgram(
        withExtra(
          script("studio-actor-1-nova-s2", right, {
            procedures: [{ id: "proc-1-1", name: "a", params: [], body: [] }],
          }),
        ),
      ),
    ).toThrow();
    expect(() => validateStudioProgram(withExtra(script("studio-actor-1-mika-s2", right)))).toThrow(
      RangeError,
    );
  });

  it("counts the blocks of all of a character's scripts against the one limit", () => {
    let history = addStudioScript(start(), nova, right);
    history = appendStudioStatement(history, studioExtraTarget(nova, 2), {
      type: "move",
      steps: 20,
    });
    history = appendStudioStatement(history, nova, { type: "move", steps: 20 });
    expect(studioBlocksUsed(validateStudioProgram(history.current), nova)).toBe(2);
  });

  it("keeps a character's extra scripts when another character is added", () => {
    const history = addStudioActor(addStudioScript(start(), nova, right), "mika");
    const program = validateStudioProgram(history.current);
    expect(mainScripts(program)).toHaveLength(2);
    expect(studioExtraScripts(program, nova)).toHaveLength(1);
  });
});
