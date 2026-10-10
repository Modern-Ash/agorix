import { renderToStaticMarkup } from "react-dom/server";
import { getWorld } from "@agorix/curriculum";
import { ProjectStore } from "@agorix/persistence";
import { createStageState } from "@agorix/stage";
import type { ProjectProgram, Script } from "@agorix/program-model";
import { SCHEMA_VERSION, migrateLegacyTriggers } from "@agorix/program-model";
import { describe, expect, it } from "vitest";
import { App, ProgramBlockCard, StageView, updateActor } from "./App.js";
import { assertCatalogCompleteness, resolveLocale, t } from "./i18n.js";
import {
  addBlockToWorkspace,
  addBlockToWorkspaceAt,
  addScriptToWorkspace,
  addVariableSetBlockFor,
  blockNodeId,
  blockNodeIdForPath,
  codeSliceForNode,
  createEditorModel,
  createEditorModelFromProgram,
  defaultVariableIdFor,
  duplicateBlockInWorkspace,
  editBlockFieldAt,
  editIfConditionAt,
  editIfConditionNumberAt,
  editNumericBlockField,
  editVariableNumberInputAt,
  editScriptTriggerField,
  makeVariableInWorkspace,
  moveBlockInWorkspaceByPath,
  resetWorkspace,
  variableNamed,
} from "./editorModel.js";
import {
  WEB_PROJECT_ID,
  WebLocalStorageAdapter,
  loadEditorProject,
  saveEditorProject,
} from "./projectStorage.js";

describe("stage-first controls (#298)", () => {
  it("puts Run, Step, Stop and Reset in the stage panel and not in the header", () => {
    const html = renderToStaticMarkup(<App />);
    const header = html.slice(html.indexOf('<header class="topbar">'), html.indexOf("</header>"));
    const stage = html.slice(html.indexOf('class="stage-panel'));
    for (const label of ["Run", "Step", "Stop", "Reset"]) {
      expect(header).not.toContain(`>${label}</button>`);
      expect(stage).toContain(label);
    }
    expect(html).toContain('data-testid="play-controls"');
    expect(stage.indexOf('data-testid="play-controls"')).toBeLessThan(
      stage.indexOf('data-testid="world-identity"'),
    );
  });

  it("starts with Stop disabled and no progress bar until something runs", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toMatch(/<button[^>]*class="stop-button"[^>]*disabled=""/);
    expect(html).not.toContain('data-testid="stage-progress"');
  });
});

describe("main editor shell", () => {
  it("renders required editor regions together", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Agorix First Mission");
    expect(html).toContain("Mission: Get your sprite to the goal.");
    expect(html).toContain("Action palette");
    expect(html).toContain("Costume");
    expect(html).toContain("Nova default");
    expect(html).toContain("Backdrop");
    expect(html).toContain("Space trailhead");
    expect(html).toContain('data-backdrop-id="asset:space.trailhead"');
    expect(html).toContain('data-costume-id="asset:costume.default"');
    expect(html).toContain("When green flag clicked");
    expect(html).toContain("+ key");
    expect(html).toContain("+ click");
    expect(html).toContain("+ message");
    expect(html).toContain("Stage");
    expect(html).toContain("Code");
    expect(html).toContain("Use AI as a reviewer");
    expect(html).toContain("Product language");
    expect(html).toContain("English");
    expect(html).toContain("Español");
    expect(html).toContain("Hint");
    expect(html).toContain("Hints: 0");
    expect(html).toContain("Build");
    expect(html).toContain("Run");
    expect(html).toContain("Reflect");
    expect(html).toContain("Attempts: 0");
    expect(html).toContain("Run");
    expect(html).toContain("Stop");
    expect(html).toContain("Step");
    expect(html).toContain("Reset");
  });

  it("keeps actor edits inside the shared creative contract", () => {
    const creative = {
      actors: [
        {
          id: "actor:main",
          name: "Nova",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          costumeId: "asset:costume.default",
        },
      ],
      assets: [
        {
          id: "asset:costume.default",
          kind: "costume",
          name: "Nova default",
          source: "builtin:costume.default",
        },
      ],
    } as const;

    expect(updateActor(creative, "actor:main", { size: 120 }).actors?.[0]?.size).toBe(120);
    expect(updateActor(creative, "actor:main", { size: 0 })).toBe(creative);
    expect(updateActor(creative, "actor:missing", { x: 24 })).toBe(creative);
    expect(updateActor(creative, "actor:main", { costumeId: "asset:costume.missing" })).toBe(
      creative,
    );
  });

  it("shows the coach ready from the start, with no suggestion applied (issue #99)", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("AI");
    expect(html).not.toContain('data-provenance="unavailable"');
    expect(html).not.toContain('data-provenance="suggestion"');
    expect(html).not.toContain('data-provenance="accepted"');
  });

  it("starts focused on tools, blocks and stage, with subtle code always visible", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html.indexOf("Action palette")).toBeGreaterThan(-1);
    expect(html.indexOf("When green flag clicked")).toBeGreaterThan(-1);
    expect(html.indexOf("Stage")).toBeGreaterThan(-1);
    expect(html).toContain("Behind the scenes");
    expect(html).toContain("whenGreenFlagClicked");
    expect(html).not.toContain("This is the code behind your blocks.");
  });

  it("renders compact visual blocks with inline values and canonical node mapping", () => {
    const html = renderToStaticMarkup(
      <ProgramBlockCard
        block={{ id: "move-1", type: "motion_move", fields: { steps: 12 } }}
        path={[0]}
        siblingIndex={0}
        siblingTotal={1}
        depth={0}
        selected={true}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale="en"
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );

    expect(html).toContain('class="block-node block-card block-motion block-shape-command active"');
    expect(html).toContain('data-block-state="selected"');
    expect(html).toContain('data-canonical-node-id="scripts[0]/statements[0]"');
    expect(html).toContain('aria-label="Move steps"');
    expect(html).toContain('value="12"');
    expect(html).not.toContain("<form");
  });

  it("renders variable blocks with editable inline numbers", () => {
    const html = renderToStaticMarkup(
      <ProgramBlockCard
        block={{
          id: "change-1",
          type: "variables_change",
          fields: { variableId: "score" },
          inputs: { delta: { id: "delta-1", type: "literal_number", fields: { value: 3 } } },
        }}
        path={[0]}
        siblingIndex={0}
        siblingTotal={1}
        depth={0}
        selected={false}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale="en"
        assets={[]}
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );

    expect(html).toContain("Change variable");
    expect(html).toContain('value="3"');
    expect(html).toContain('aria-label="Change variable change"');
    expect(html).toContain("block-variables");
  });

  it("renders a variable picker with declared names on show/hide blocks", () => {
    const html = renderToStaticMarkup(
      <ProgramBlockCard
        block={{
          id: "show-1",
          type: "variables_show",
          fields: { variableId: "points" },
        }}
        path={[0]}
        siblingIndex={0}
        siblingTotal={1}
        depth={0}
        selected={false}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale="en"
        variables={[
          { id: "score", name: "score", initialValue: 0, visible: true },
          { id: "points", name: "Points", initialValue: 0, visible: true },
        ]}
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Show variable variable"');
    expect(html).toContain("<select");
    expect(html).toContain(">score</option>");
    expect(html).toContain(">Points</option>");
    expect(html).toContain('value="points"');
    expect(html).not.toContain("Show variable points");
  });

  it("renders if blocks with a compact condition selector", () => {
    const html = renderToStaticMarkup(
      <ProgramBlockCard
        block={{
          id: "if-1",
          type: "control_if",
          inputs: {
            condition: {
              id: "cond-1",
              type: "operator_less_than",
              inputs: {
                left: { id: "left-1", type: "variables_value", fields: { variableId: "score" } },
                right: { id: "right-1", type: "literal_number", fields: { value: 7 } },
              },
            },
            then: [],
          },
        }}
        path={[0]}
        siblingIndex={0}
        siblingTotal={1}
        depth={0}
        selected={false}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale="en"
        assets={[]}
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onCommitCondition={() => undefined}
        onCommitConditionValue={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );

    expect(html).toContain("<select");
    expect(html).toContain('value="scoreLessThan" selected=""');
    expect(html).toContain('value="7"');
    expect(html).toContain("score &lt;");
  });

  it("renders visible variable watchers on the stage", () => {
    const html = renderToStaticMarkup(
      <StageView
        world={getWorld("space.trailhead")}
        frame={undefined}
        fallback={createStageState({
          variables: [{ id: "score", label: "score", value: 7, visible: true }],
        })}
        locale="en"
        feedback={{
          phase: "idle",
          reachedGoal: false,
          trail: [],
          total: 0,
        }}
        codePreview="whenStarted(() => {});"
        reducedMotion={true}
        runStatus="idle"
        onRun={() => undefined}
        onStop={() => undefined}
        onOpenCode={() => undefined}
      />,
    );

    expect(html).toContain('class="stage-watchers"');
    expect(html).toContain('data-variable-id="score"');
    expect(html).toContain("<span>score</span>");
    expect(html).toContain("<strong>7</strong>");
  });

  it("renders active sound evidence on the stage from shared assets", () => {
    const html = renderToStaticMarkup(
      <StageView
        world={getWorld("space.trailhead")}
        frame={undefined}
        fallback={createStageState({
          sounds: { activeSoundIds: ["asset:sound.beacon"] },
        })}
        assets={[
          {
            id: "asset:sound.beacon",
            kind: "sound",
            name: "Beacon ping",
            source: "builtin:sound.beacon",
          },
        ]}
        locale="en"
        feedback={{
          phase: "idle",
          reachedGoal: false,
          trail: [],
          total: 0,
        }}
        codePreview='sound.play("asset:sound.beacon");'
        reducedMotion={true}
        runStatus="idle"
        onRun={() => undefined}
        onStop={() => undefined}
        onOpenCode={() => undefined}
      />,
    );

    expect(html).toContain('class="stage-sounds"');
    expect(html).toContain("Sounds playing");
    expect(html).toContain("Beacon ping");
  });

  it("renders editable Looks fields from the shared asset catalog", () => {
    const sayHtml = renderToStaticMarkup(
      <ProgramBlockCard
        block={{ id: "say-1", type: "looks_say", fields: { text: "Hello" } }}
        path={[0]}
        siblingIndex={0}
        siblingTotal={1}
        depth={0}
        selected={false}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale="en"
        assets={[]}
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onCommitField={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );
    const costumeHtml = renderToStaticMarkup(
      <ProgramBlockCard
        block={{
          id: "costume-1",
          type: "looks_switch_costume",
          fields: { costumeId: "asset:costume.spark" },
        }}
        path={[0]}
        siblingIndex={0}
        siblingTotal={1}
        depth={0}
        selected={false}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale="en"
        assets={[
          {
            id: "asset:costume.spark",
            kind: "costume",
            name: "Nova spark",
            source: "builtin:costume.spark",
          },
        ]}
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onCommitField={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );

    expect(sayHtml).toContain('value="Hello"');
    expect(sayHtml).toContain('aria-label="Say Text"');
    expect(costumeHtml).toContain("<select");
    expect(costumeHtml).toContain("Nova spark");
  });
});

describe("input parity semantics (issue #201)", () => {
  function renderCard(locale: "en" | "es", index: number, total: number, depth: number) {
    return renderToStaticMarkup(
      <ProgramBlockCard
        block={{ id: "move-1", type: "motion_move", fields: { steps: 12 } }}
        path={depth === 0 ? [index] : [0, index]}
        siblingIndex={index}
        siblingTotal={total}
        depth={depth}
        selected={false}
        suggestionAffected={false}
        canonicalNodeId="scripts[0]/statements[0]"
        locale={locale}
        onSelect={() => undefined}
        onCommitValue={() => undefined}
        onMove={() => undefined}
        onNest={() => undefined}
        onOutdent={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onDragStart={() => undefined}
        onDropBefore={() => undefined}
        onDropAfter={() => undefined}
        onDropInside={() => undefined}
      />,
    );
  }

  it("describes position, nesting level and keyboard shortcuts to assistive tech", () => {
    const html = renderCard("en", 1, 3, 1);
    expect(html).toContain("Position 2 of 3, nesting level 2.");
    expect(html).toContain("aria-describedby");
    expect(html).toContain("workspace-keyboard-hint");
    expect(html).toContain('aria-keyshortcuts="Alt+ArrowUp');
    expect(html).toContain('role="group"');
  });

  it("localizes position semantics", () => {
    expect(renderCard("es", 0, 2, 0)).toContain("Posición 1 de 2, nivel de anidación 1.");
  });

  it("hides drag-only snap targets from the accessibility tree and keeps action buttons", () => {
    const html = renderCard("en", 1, 3, 1);
    expect(html).not.toContain("Drop before");
    expect(html).toContain('class="snap-target snap-before" aria-hidden="true"');
    for (const name of ["Up", "Down", "Nest", "Outdent", "Duplicate", "Delete"]) {
      expect(html).toContain(`aria-label="${name}"`);
    }
  });

  it("renders a polite status announcer and keyboard hint in the editor shell", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('data-testid="editor-announcer"');
    expect(html).toContain('role="status"');
    expect(html).toContain('id="workspace-keyboard-hint"');
  });
});

describe("web i18n", () => {
  it("has complete catalogs and deterministic fallback", () => {
    expect(() => assertCatalogCompleteness()).not.toThrow();
    expect(resolveLocale("es-AR")).toBe("es");
    expect(resolveLocale("pt-BR")).toBe("en");
    expect(t("es", "run")).toBe("Ejecutar");
    expect(t("es", "trace")).toBe("Traza");
  });
});

describe("editor model", () => {
  it("updates canonical code when blocks are added and edited", () => {
    const initial = createEditorModel();
    const added = addBlockToWorkspace(initial.workspace, "motion_move");
    const edited = editNumericBlockField(added.workspace, 0, "steps", 20);

    expect(added.program.scripts[0]?.statements).toEqual([{ type: "move", steps: 10 }]);
    expect(edited.program.scripts[0]?.statements).toEqual([{ type: "move", steps: 20 }]);
    expect(edited.code).toContain("sprite.move(20);");
  });

  it("updates canonical variables when variable block inputs are edited", () => {
    const initial = createEditorModel();
    const added = addBlockToWorkspace(initial.workspace, "variables_change");
    const edited = editVariableNumberInputAt(added.workspace, [0], 5);

    expect(added.program.variables).toEqual([
      { id: "score", name: "score", initialValue: 0, visible: true },
    ]);
    expect(edited.program.scripts[0]?.statements).toEqual([
      {
        type: "changeVariable",
        variableId: "score",
        delta: { type: "numericLiteral", value: 5 },
      },
    ]);
    expect(edited.code).toContain("score += 5;");
  });

  it("creates variables through canonical projection and targets a set block at them", () => {
    const initial = createEditorModel();
    const made = makeVariableInWorkspace(initial.workspace, "Points");
    const variableId = made.workspace.variables?.[0]?.id;
    const withBlock = addVariableSetBlockFor(made.workspace, variableId ?? "score");

    expect(made.program.variables).toEqual([
      { id: "points", name: "Points", initialValue: 0, visible: true },
    ]);
    expect(withBlock.program.variables).toEqual([
      { id: "points", name: "Points", initialValue: 0, visible: true },
    ]);
    expect(withBlock.program.scripts[0]?.statements).toEqual([
      { type: "setVariable", variableId: "points", value: { type: "numericLiteral", value: 0 } },
    ]);
    expect(withBlock.code).toContain("points = 0;");
    expect(withBlock.code).toContain('showVariable("Points");');
  });

  it("rejects a duplicate variable id and dedupes ids for repeated names", () => {
    const initial = createEditorModel();
    const first = makeVariableInWorkspace(initial.workspace, "Score");
    expect(first.workspace.variables?.[0]?.id).toBe("score");
    expect(first.workspace.variables?.[0]?.name).toBe("Score");
    expect(variableNamed(first.workspace.variables, "Score")).toBe("score2");
    expect(defaultVariableIdFor(first.workspace)).toBe("score");
    expect(defaultVariableIdFor({ ...initial.workspace, variables: [] })).toBe("score");
  });

  it("defaults new variable blocks to the first declared variable", () => {
    const initial = createEditorModel();
    const made = makeVariableInWorkspace(initial.workspace, "Lives");
    const added = addBlockToWorkspaceAt(made.workspace, "variables_change", [], 0, 0);
    const addedBlock = added.workspace.scripts[0]?.statements[0];

    expect(addedBlock?.fields?.variableId).toBe("lives");
    expect(added.workspace.variables).toEqual([
      { id: "lives", name: "Lives", initialValue: 0, visible: true },
    ]);
    expect(added.program.scripts[0]?.statements[0]).toEqual({
      type: "changeVariable",
      variableId: "lives",
      delta: { type: "numericLiteral", value: 1 },
    });
  });

  it("updates if conditions to score comparisons through canonical projection", () => {
    const initial = createEditorModel();
    const added = addBlockToWorkspace(initial.workspace, "control_if");
    const compared = editIfConditionAt(added.workspace, [0], "scoreLessThan");
    const edited = editIfConditionNumberAt(compared.workspace, [0], 12);

    expect(compared.program.variables).toEqual([
      { id: "score", name: "score", initialValue: 0, visible: true },
    ]);
    expect(edited.program.scripts[0]?.statements[0]).toMatchObject({
      type: "if",
      condition: {
        type: "lessThan",
        left: { type: "variable", variableId: "score" },
        right: { type: "numericLiteral", value: 12 },
      },
    });
    expect(edited.code).toContain("if ((score < 12))");
  });

  it("updates Looks text and asset references through canonical projection", () => {
    const initial = createEditorModel();
    const say = addBlockToWorkspace(initial.workspace, "looks_say");
    const editedSay = editBlockFieldAt(say.workspace, [0], "text", "Launch");
    const costume = addBlockToWorkspace(editedSay.workspace, "looks_switch_costume");
    const editedCostume = editBlockFieldAt(
      costume.workspace,
      [1],
      "costumeId",
      "asset:costume.spark",
    );

    expect(editedSay.program.scripts[0]?.statements[0]).toEqual({
      type: "say",
      text: "Launch",
    });
    expect(editedSay.code).toContain('sprite.say("Launch");');
    expect(editedCostume.program.scripts[0]?.statements[1]).toEqual({
      type: "switchCostume",
      costumeId: "asset:costume.spark",
    });
    expect(editedCostume.code).toContain('sprite.switchCostume("asset:costume.spark");');
  });

  it("adds event scripts and edits blocks in the selected script slot", () => {
    const initial = createEditorModel();
    const withKeyScript = addScriptToWorkspace(initial.workspace, "event_on_key_pressed");
    const withKeyMove = addBlockToWorkspace(withKeyScript.workspace, "motion_move", 1);

    expect(withKeyMove.program.scripts[1]).toMatchObject({
      id: "key-1",
      trigger: { type: "onKeyPressed", key: "Space" },
      statements: [{ type: "move", steps: 10 }],
    });
    expect(withKeyMove.program.scripts[0]?.statements).toEqual([]);
    expect(withKeyMove.code).toContain('whenKeyPressed("Space")');
  });

  it("edits event trigger fields through canonical projection", () => {
    const initial = createEditorModel();
    const withKeyScript = addScriptToWorkspace(initial.workspace, "event_on_key_pressed");
    const editedKey = editScriptTriggerField(withKeyScript.workspace, 1, "key", "ArrowRight");
    const withMessageScript = addScriptToWorkspace(editedKey.workspace, "event_on_message");
    const editedMessage = editScriptTriggerField(withMessageScript.workspace, 2, "message", "win");

    expect(editedKey.program.scripts[1]?.trigger).toEqual({
      type: "onKeyPressed",
      key: "ArrowRight",
    });
    expect(editedMessage.program.scripts[2]?.trigger).toEqual({
      type: "onMessage",
      message: "win",
    });
    expect(editedMessage.code).toContain('whenKeyPressed("ArrowRight")');
    expect(editedMessage.code).toContain('whenMessageReceived("win")');
  });

  it("keeps node ids aligned for visual and code highlighting", () => {
    const initial = createEditorModel();
    const added = addBlockToWorkspace(initial.workspace, "motion_turn");
    const nodeId = blockNodeId(0);

    expect(codeSliceForNode(added, nodeId)).toBe("  sprite.turn(90);\n");
  });

  it("reset restores an empty starter workspace", () => {
    const initial = createEditorModel();
    const added = addBlockToWorkspace(initial.workspace, "motion_move");
    const reset = resetWorkspace();

    expect(added.workspace.scripts[0]?.statements).toHaveLength(1);
    expect(reset.workspace.scripts[0]?.statements).toEqual([]);
  });

  it("adds, moves and outdents blocks through nested canonical paths", () => {
    const initial = createEditorModel();
    const repeat = addBlockToWorkspace(initial.workspace, "control_repeat");
    const nested = addBlockToWorkspaceAt(repeat.workspace, "motion_move", [0], 0);
    const outdented = moveBlockInWorkspaceByPath(nested.workspace, [0, 0], [], 1);

    expect(nested.program.scripts[0]?.statements).toEqual([
      { type: "repeat", count: 3, body: [{ type: "move", steps: 10 }] },
    ]);
    expect(blockNodeIdForPath(nested.workspace, [0, 0])).toBe("scripts[0]/statements[0]/body[0]");
    expect(outdented.program.scripts[0]?.statements).toEqual([
      { type: "repeat", count: 3, body: [] },
      { type: "move", steps: 10 },
    ]);
  });

  it("duplicates a container subtree with fresh visual ids and synchronized code", () => {
    const initial = createEditorModel();
    const repeat = addBlockToWorkspace(initial.workspace, "control_repeat");
    const nested = addBlockToWorkspaceAt(repeat.workspace, "motion_turn", [0], 0);
    const duplicated = duplicateBlockInWorkspace(nested.workspace, [0]);
    const ids = JSON.stringify(duplicated.workspace);

    expect(duplicated.program.scripts[0]?.statements).toEqual([
      { type: "repeat", count: 3, body: [{ type: "turn", degrees: 90 }] },
      { type: "repeat", count: 3, body: [{ type: "turn", degrees: 90 }] },
    ]);
    expect(ids).toContain(":copy");
    expect(new Set(ids.match(/workspace:[^"]+/g) ?? []).size).toBe(
      (ids.match(/workspace:[^"]+/g) ?? []).length,
    );
    expect(duplicated.code).toContain("repeat(3");
  });
});

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const makeScript = (statements: Script["statements"]): Script => ({
  id: "main",
  trigger: { type: "onStart" },
  statements,
});

describe("editor persistence", () => {
  it("reconstructs visual workspace and regenerates code from the canonical program", () => {
    const initial = createEditorModel();
    const added = addBlockToWorkspace(initial.workspace, "motion_move");
    const edited = editNumericBlockField(added.workspace, 0, "steps", 24);

    const reloaded = createEditorModelFromProgram(edited.program);

    expect(reloaded.workspace.scripts[0]?.statements[0]?.fields).toEqual({ steps: 24 });
    expect(reloaded.program).toEqual(edited.program);
    expect(reloaded.code).toBe(edited.code);
    expect(reloaded.code).toContain("sprite.move(24);");
  });

  it("stores canonical program and metadata without generated code while locale stays metadata-only", () => {
    const storage = new MemoryStorage();
    const store = new ProjectStore({ storage: new WebLocalStorageAdapter(storage) });
    const persistence = { projectId: WEB_PROJECT_ID, store };
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [makeScript([{ type: "move", steps: 24 }])],
    };

    const error = saveEditorProject(persistence, program, {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
      missionProgress: 1,
      hintLevel: 0,
      locale: "es",
    });
    const raw = storage.getItem(`agorix:${WEB_PROJECT_ID}`);
    const loaded = loadEditorProject(persistence);

    expect(error).toBeUndefined();
    expect(raw).toContain('"program"');
    const parsed = JSON.parse(raw ?? "{}") as { program: ProjectProgram };

    expect(raw).toContain('"metadata"');
    expect(raw).toContain('"locale":"es"');
    expect(parsed.program).toEqual(program);
    expect(JSON.stringify(parsed.program)).not.toContain("locale");
    expect(raw).not.toContain("sprite.move");
    expect(raw).not.toContain('"code"');
    // A project saved with the legacy "When you press Run" hat opens with the green flag.
    expect(loaded.model?.program).toEqual(migrateLegacyTriggers(program));
    expect(loaded.metadata?.locale).toBe("es");
    expect(loaded.model?.code).toContain("sprite.move(24);");
  });

  it("surfaces version mismatch without overwriting the saved project", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      `agorix:${WEB_PROJECT_ID}`,
      JSON.stringify({
        schemaVersion: "agorix/program/v99",
        program: { schema: SCHEMA_VERSION, scripts: [makeScript([])] },
        metadata: { createdAt: "", updatedAt: "", missionProgress: 0, hintLevel: 0 },
      }),
    );
    const persistence = {
      projectId: WEB_PROJECT_ID,
      store: new ProjectStore({ storage: new WebLocalStorageAdapter(storage) }),
    };

    const loaded = loadEditorProject(persistence);

    expect(loaded.model).toBeUndefined();
    expect(loaded.message).toContain("different version of Agorix");
    expect(storage.getItem(`agorix:${WEB_PROJECT_ID}`)).toContain("agorix/program/v99");
  });

  it("surfaces corrupt saved data without overwriting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(`agorix:${WEB_PROJECT_ID}`, "not-json");
    const persistence = {
      projectId: WEB_PROJECT_ID,
      store: new ProjectStore({ storage: new WebLocalStorageAdapter(storage) }),
    };

    const loaded = loadEditorProject(persistence);

    expect(loaded.model).toBeUndefined();
    expect(loaded.message).toContain("couldn't open the saved project");
    expect(storage.getItem(`agorix:${WEB_PROJECT_ID}`)).toBe("not-json");
  });
});

describe("intent-to-plan dialogue (issue #86)", () => {
  it("keeps AI planning available without opening the coach by default", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("AI");
    expect(html).toContain("Challenge");
    expect(html).not.toContain("Plan your idea first");
    expect(html).not.toContain('aria-label="What should happen?"');
    expect(html).not.toContain("Show my plan");
    expect(html).not.toContain('data-testid="intent-plan"');
    expect(html).not.toContain('data-testid="intent-clarification"');
  });

  it("keeps the intent dialogue in the same catalog as the rest of the product", () => {
    expect(() => assertCatalogCompleteness()).not.toThrow();
    expect(t("es", "intentTitle")).toBe("Primero planea tu idea");
    expect(t("es", "intentPlanAction")).toBe("Ver mi plan");
    expect(t("es", "intentRejectPlan")).toBe("Rechazar plan");
  });

  it("shows no provider or credential surface next to the intent field", () => {
    const html = renderToStaticMarkup(<App />).toLowerCase();

    expect(html).not.toContain("api key");
    expect(html).not.toContain("api_key");
    expect(html).not.toContain("base url");
    expect(html).not.toContain("bearer");
  });
});
