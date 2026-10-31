import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { addStudioActor, appendStudioStatement, createStudioProgram } from "./kidsStudioModel.js";
import { proposeSceneGoal, rankSceneGoals } from "./kidsSceneGoalProposal.js";

const NOVA = { id: "actor:studio-1-nova", name: "Nova" };
const MIKA = { id: "actor:studio-2-mika", name: "Mika" };

describe("Ori scene goal ideas", () => {
  it("offers the edge when the child is alone", () => {
    const program = createStudioProgram("nova");
    expect(rankSceneGoals([NOVA.id], program)).toEqual([{ kind: "reachEdge", actorId: NOVA.id }]);
    expect(proposeSceneGoal([NOVA], program, "es", 0)?.message).toBe(
      "¿Podés hacer que Nova llegue al borde?",
    );
  });

  it("prefers a meeting for a character that already moves", () => {
    let history = addStudioActor(createEditorHistory(createStudioProgram("nova")), "mika");
    history = appendStudioStatement(history, MIKA.id, { type: "move", steps: 40 });
    const [best] = rankSceneGoals([NOVA.id, MIKA.id], history.current);
    expect(best).toEqual({ kind: "touchActor", actorId: MIKA.id, targetId: NOVA.id });
    expect(proposeSceneGoal([NOVA, MIKA], history.current, "en", 0)?.message).toBe(
      "Can you make Mika touch Nova?",
    );
  });

  it("cycles through every idea and always returns one of the closed choices", () => {
    const program = addStudioActor(
      createEditorHistory(createStudioProgram("nova")),
      "mika",
    ).current;
    const seen = new Set(
      [0, 1, 2, 3, 4, 5].map((attempt) =>
        JSON.stringify(proposeSceneGoal([NOVA, MIKA], program, "es", attempt)?.goal),
      ),
    );
    expect(seen.size).toBe(4);
  });
});
