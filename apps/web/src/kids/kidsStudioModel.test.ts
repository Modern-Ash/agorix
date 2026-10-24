import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioActor,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
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
});
