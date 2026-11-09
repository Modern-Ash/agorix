import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { SCHEMA_VERSION, type ProjectProgram, type Script } from "@agorix/program-model";
import { runMultiActorProgram } from "@agorix/runtime";
import { diagnoseRun } from "@agorix/run-evidence";
import {
  addStudioActor,
  addStudioCloneEdgeDelete,
  addStudioCloneScript,
  appendStudioStatement,
  hasStudioCloneScript,
  removeStudioCloneScript,
  studioCloneStatements,
  studioCloneTarget,
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

describe("editing a character's copy script through the Studio model (#1311)", () => {
  const NOVA = "actor:studio-1-nova";
  const start = () => createEditorHistory(createStudioProgram("nova"));

  it("adds the script once, edits it with the closed blocks, and removes it again", () => {
    let history = addStudioCloneScript(start(), NOVA);
    expect(hasStudioCloneScript(history.current, NOVA)).toBe(true);
    expect(() => addStudioCloneScript(history, NOVA)).toThrow();
    history = appendStudioStatement(history, studioCloneTarget(NOVA), { type: "move", steps: 20 });
    history = addStudioCloneEdgeDelete(history, NOVA);
    expect(studioCloneStatements(history.current, NOVA).map((item) => item.type)).toEqual([
      "move",
      "if",
    ]);
    // The character's own script is untouched.
    expect(history.current.scripts[0]!.statements).toEqual([]);
    history = removeStudioCloneScript(history, NOVA);
    expect(hasStudioCloneScript(history.current, NOVA)).toBe(false);
  });

  it("only accepts delete this clone in the copy script", () => {
    const history = addStudioCloneScript(start(), NOVA);
    expect(() => appendStudioStatement(history, NOVA, { type: "deleteThisClone" })).toThrow();
    expect(() =>
      appendStudioStatement(history, studioCloneTarget(NOVA), { type: "deleteThisClone" }),
    ).not.toThrow();
  });

  it("offers copies with a script only to a character that has one, and takes it back with the script", () => {
    const make = { type: "createCopies", count: 3, rule: "spread", withScript: true } as const;
    expect(() => appendStudioStatement(start(), NOVA, make)).toThrow();
    let history = addStudioCloneScript(start(), NOVA);
    history = appendStudioStatement(history, NOVA, make);
    expect(history.current.scripts[0]!.statements[0]).toEqual(make);
    history = removeStudioCloneScript(history, NOVA);
    expect(history.current.scripts[0]!.statements[0]).toEqual({
      type: "createCopies",
      count: 3,
      rule: "spread",
    });
  });

  it("runs a scene end to end: copies are born, run their script and end", () => {
    let history = addStudioCloneScript(start(), NOVA);
    history = appendStudioStatement(history, studioCloneTarget(NOVA), { type: "move", steps: 20 });
    history = appendStudioStatement(history, studioCloneTarget(NOVA), {
      type: "deleteThisClone",
    });
    history = appendStudioStatement(history, NOVA, {
      type: "createCopies",
      count: 2,
      rule: "fall",
      withScript: true,
    });
    const program = validateStudioProgram(history.current);
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(run.activations.map((item) => item.actorId)).toEqual([NOVA, `${NOVA}#1`, `${NOVA}#2`]);
    expect(run.actors.map((actor) => actor.id)).toEqual([NOVA]);
  });

  it("tells a child when the copy script never started (a finding, copies belong to their character)", () => {
    const history = addStudioCloneScript(start(), NOVA);
    const program = validateStudioProgram(history.current);
    const creative = creativeForStudio(program, "forest", "es");
    const run = runMultiActorProgram(program, creative);
    const found = diagnoseRun({ program, creative, run, actorId: NOVA });
    expect(found.map((item) => `${item.kind}:${item.event?.type}`)).toContain("neverStarted:clone");
  });
});
