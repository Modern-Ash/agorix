import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioActor,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  setStudioTrigger,
  validateStudioProgram,
} from "./kidsStudioModel.js";

describe("Kids creative studio", () => {
  it("keeps each chosen character's program independent and derives the stage from canonical scripts", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = appendStudioStatement(history, "actor:studio-2-mika", {
      type: "move",
      steps: 40,
    });
    const creative = creativeForStudio(history.current, "forest", "es");
    expect(creative.actors?.map((actor) => actor.id)).toEqual([
      "actor:studio-1-nova",
      "actor:studio-2-mika",
    ]);
    expect(creative.stage?.backdropId).toBe("backdrop:forest");
    const result = runMultiActorProgram(history.current, creative);
    expect(result.actors.find((actor) => actor.id === "actor:studio-1-nova")?.world.sprite.x).toBe(
      0,
    );
    expect(result.actors.find((actor) => actor.id === "actor:studio-2-mika")?.world.sprite.x).toBe(
      100,
    );
    const undone = undoCanonicalTransaction(history).history;
    expect(undone.current.scripts[1]?.statements).toEqual([]);
  });

  it("can change an included costume, backdrop and sound without accepting invalid assets", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "switchCostume",
      costumeId: "costume:mika",
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "switchBackdrop",
      backdropId: "backdrop:moon",
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "playSound",
      soundId: "kids:splash",
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sprite.costumeId).toBe("costume:mika");
    expect(result.stage.backdropId).toBe("backdrop:moon");
    expect(result.trace.some((entry) => entry.statementType === "playSound")).toBe(true);
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "switchBackdrop",
        backdropId: "backdrop:invented",
      }),
    ).toThrow();
    expect(() =>
      validateStudioProgram({
        ...history.current,
        scripts: [
          ...history.current.scripts,
          { id: "studio-actor-3-evil", trigger: { type: "greenFlag" }, statements: [] },
        ],
      }),
    ).toThrow();
  });

  it("runs bounded looks and wait blocks on the selected character only", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    for (const statement of [
      { type: "say", text: "¡Hola!" },
      { type: "setSize", size: 150 },
      { type: "hide" },
      { type: "wait", seconds: 1 },
      { type: "show" },
      { type: "think", text: "¿Y ahora?" },
    ] as const)
      history = appendStudioStatement(history, "actor:studio-2-mika", statement);
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sprite.bubble).toBeUndefined();
    expect(result.actors[1]?.world.sprite).toMatchObject({
      visible: true,
      size: 150,
      bubble: { kind: "think", text: "¿Y ahora?" },
    });
    expect(result.trace.map((entry) => entry.statementType)).toContain("wait");
    expect(() =>
      appendStudioStatement(history, "actor:studio-2-mika", { type: "say", text: " " }),
    ).toThrow();
  });

  it("runs a character click script only after that character is tapped", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = setStudioTrigger(history, "actor:studio-2-mika", "onActorClicked");
    history = appendStudioStatement(history, "actor:studio-2-mika", { type: "say", text: "Hola" });
    const creative = creativeForStudio(history.current, "forest", "es");
    expect(runMultiActorProgram(history.current, creative).trace).toHaveLength(0);
    const clicked = runMultiActorProgram(history.current, creative, {
      events: [{ type: "start" }, { type: "actorClicked", actorId: "actor:studio-2-mika" }],
    });
    expect(clicked.trace.map((entry) => [entry.actorId, entry.statementType])).toEqual([
      ["actor:studio-2-mika", "say"],
    ]);
    expect(clicked.actors[1]?.world.sprite.bubble?.text).toBe("Hola");
  });
});
