import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { getKidsAdvancedMission } from "@agorix/curriculum";
import { addReactStatement, creativeForReactProgram } from "./kidsAdvancedReactEditorModel.js";

const mission = getKidsAdvancedMission("react", "es");

describe("advanced stage-2 canonical event edits", () => {
  it("creates a friend click script in one undoable transaction", () => {
    const history = addReactStatement(createEditorHistory(mission.starterProgram), "actor:friend", {
      type: "switchCostume",
      costumeId: "asset:costume.spark",
    });
    expect(history.current.scripts[1]).toMatchObject({
      id: "advanced-react-friend",
      trigger: { type: "onActorClicked" },
    });
    expect(
      creativeForReactProgram(mission.starterCreative, history.current).actors?.[1]?.scripts,
    ).toEqual(["advanced-react-friend"]);
    expect(undoCanonicalTransaction(history).history.current).toEqual(mission.starterProgram);
  });
});
