import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { SCHEMA_VERSION, type ProjectProgram, type Script } from "@agorix/program-model";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioActor,
  cloneActorOfScript,
  cloneScriptId,
  createStudioProgram,
  creativeForStudio,
  mainScripts,
  STUDIO_EDGE_CONDITION,
  validateStudioProgram,
} from "./kidsStudioModel.js";

const cloneScript = (index: number, character: "nova" | "mika", statements: Script["statements"]) =>
  ({
    id: cloneScriptId(index, character),
    trigger: { type: "onCloneStart" },
    statements,
  }) as Script;

function withClone(...statements: Script["statements"]): ProjectProgram {
  const base = createStudioProgram("nova");
  return { ...base, scripts: [...base.scripts, cloneScript(1, "nova", statements)] };
}

describe("a character's second script, the one its copies start with (#1311)", () => {
  it("names the script by its character and reads the name back", () => {
    expect(cloneScriptId(2, "mika")).toBe("studio-actor-2-mika-clone");
    expect(cloneActorOfScript("studio-actor-2-mika-clone")).toEqual({
      index: 2,
      characterId: "mika",
    });
    expect(cloneActorOfScript("studio-actor-2-mika")).toBeNull();
    expect(cloneActorOfScript("studio-actor-2-nobody-clone")).toBeNull();
  });

  it("accepts one copy script after the characters' own, where delete this clone means something", () => {
    const program = validateStudioProgram(
      withClone(
        { type: "move", steps: 20 },
        {
          type: "if",
          condition: STUDIO_EDGE_CONDITION,
          then: [{ type: "deleteThisClone" }],
        },
      ),
    );
    expect(program.scripts.map((script) => script.id)).toEqual([
      "studio-actor-1-nova",
      "studio-actor-1-nova-clone",
    ]);
    expect(mainScripts(program)).toHaveLength(1);
  });

  it("refuses everything that would make the rule unclear", () => {
    const main = createStudioProgram("nova").scripts[0]!;
    const refuse = (scripts: Script[]) =>
      expect(() => validateStudioProgram({ schema: SCHEMA_VERSION, scripts })).toThrow();
    // Before the character's own script.
    refuse([cloneScript(1, "nova", []), main]);
    // Two for one character.
    refuse([main, cloneScript(1, "nova", []), cloneScript(1, "nova", [])]);
    // For a character that is not in the scene, or another character's name.
    refuse([main, cloneScript(2, "nova", [])]);
    refuse([main, cloneScript(1, "mika", [])]);
    // Not started by the copy hat.
    refuse([main, { ...cloneScript(1, "nova", []), trigger: { type: "greenFlag" } }]);
    // Custom blocks of its own.
    refuse([
      main,
      {
        ...cloneScript(1, "nova", []),
        procedures: [{ id: "proc-1-1", name: "a", params: [], body: [] }],
      } as Script,
    ]);
    // A copy hat on the character itself, or "delete this clone" where nothing is a copy.
    refuse([{ ...main, trigger: { type: "onCloneStart" } }]);
    refuse([{ ...main, statements: [{ type: "deleteThisClone" }] }]);
    refuse([
      {
        ...main,
        statements: [{ type: "repeat", count: 2, body: [{ type: "deleteThisClone" }] }],
      } as Script,
    ]);
  });

  it("keeps the copy script when a character is added, and the order stays valid", () => {
    const history = createEditorHistory(withClone({ type: "move", steps: 20 }));
    const next = addStudioActor(history, "mika").current;
    expect(next.scripts.map((script) => script.id)).toEqual([
      "studio-actor-1-nova",
      "studio-actor-2-mika",
      "studio-actor-1-nova-clone",
    ]);
  });

  it("draws and runs only the characters, never the copy script on its own", () => {
    const program = validateStudioProgram(withClone({ type: "move", steps: 20 }));
    const creative = creativeForStudio(program, "forest", "es");
    expect(creative.actors).toHaveLength(1);
    const run = runMultiActorProgram(program, creative);
    // Nothing starts a copy yet: the copy script does not run by itself.
    expect(run.activations.map((item) => item.scriptId)).toEqual(["studio-actor-1-nova"]);
  });
});
