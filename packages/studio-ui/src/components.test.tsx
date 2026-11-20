import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyWorkspaceChange, programToWorkspace } from "@agorix/block-editor";
import { Canvas } from "./Canvas.js";
import { Palette, matchesPaletteBlockSearch, paletteCategories } from "./Palette.js";
import { ProcedureNavigator, ProcedureTools } from "./ProcedureTools.js";
import { SceneLibrary } from "./SceneLibrary.js";
import {
  ActorInspector,
  AssetPanel,
  EventTracePanel,
  VisualDebuggerPanel,
  ProgramFindingsPanel,
  MissionSpecPanel,
  StagePanel,
  stageDropPosition,
  stageNudgePosition,
  stagePointerDragPosition,
  ValidationPanel,
  Workbench,
  statusFor,
} from "./Workbench.js";
import { densityAnnouncement } from "./density.js";
import { dropPointFor, nestedMoveIntent, toRows } from "./blockView.js";
import { chordFromEvent, parseDragPayload } from "./drag.js";
import { copyFor } from "./i18n.js";
import { imageForAsset, imageForId } from "./visualArt.js";

const program = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "repeat", count: 2, body: [{ type: "turn", degrees: 90 }] },
      ],
    },
  ],
} as const;
const workspace = programToWorkspace(program as never).workspace;
const script = { kind: "script", scriptIndex: 0 } as const;

describe("studio-ui", () => {
  it("hides the project custom block navigator when no script defines one", () => {
    expect(
      renderToStaticMarkup(
        <ProcedureNavigator workspace={workspace} copy={copyFor("en")} onOpen={() => undefined} />,
      ),
    ).toBe("");
  });
  it("renders a custom block body as a visual canvas with its own canonical slots", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "callProcedure", procedureId: "proc:wave" }],
          procedures: [{ id: "proc:wave", name: "Wave", body: [{ type: "move", steps: 3 }] }],
        },
      ],
    }).workspace;
    const rows = toRows(workspace);
    expect(rows.some((row) => row.kind === "slot" && row.slot.container.kind === "procedure")).toBe(
      true,
    );
    const html = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        activeProcedureId="proc:wave"
        onCloseProcedure={() => undefined}
        onIntent={() => undefined}
      />,
    );
    expect(html).toContain("Custom block: Wave");
    expect(html).toContain("Back to script");
    expect(html).toContain("Move [N] steps");
    expect(html).not.toContain("Call custom block");
  });
  it("shows custom-block creation beside the selected script and an explicit delete decision", () => {
    const created = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "callProcedure", procedureId: "proc:wave" }],
          procedures: [{ id: "proc:wave", name: "Wave", body: [{ type: "move", steps: 3 }] }],
        },
      ],
    }).workspace;
    const html = renderToStaticMarkup(
      <ProcedureTools
        workspace={created}
        scriptIndex={0}
        copy={copyFor("en")}
        onIntent={() => undefined}
      />,
    );
    expect(html).toContain("My blocks");
    expect(html).toContain("Create from last blocks");
    expect(html).toContain("Blocks to turn into one call");
    expect(html).toContain("Wave");
    expect(html).toContain("Delete block");
  });
  it("shows parameter controls and each call argument in the visual workspace", () => {
    const parameterWorkspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "callProcedure",
              procedureId: "proc:count",
              args: [{ type: "numericLiteral", value: 7 }],
            },
          ],
          procedures: [
            {
              id: "proc:count",
              name: "Count",
              parameters: [{ id: "param:times", name: "Times" }],
              body: [
                {
                  type: "changeVariable",
                  variableId: "n",
                  delta: { type: "parameter", parameterId: "param:times" },
                },
              ],
            },
          ],
        },
      ],
    }).workspace;
    const tools = renderToStaticMarkup(
      <ProcedureTools
        workspace={parameterWorkspace}
        scriptIndex={0}
        copy={copyFor("en")}
        onIntent={() => undefined}
      />,
    );
    expect(tools).toContain("Add number parameter");
    expect(tools).toContain("Remove parameter: Times");
    const canvas = renderToStaticMarkup(
      <Canvas workspace={parameterWorkspace} onIntent={() => undefined} />,
    );
    expect(canvas).toContain("Arguments: Times");
    expect(canvas).toContain('value="7"');
    expect(canvas).toContain('value="variable"');
    expect(canvas).toContain('value="xPosition"');
    const bodyCanvas = renderToStaticMarkup(
      <Canvas
        workspace={parameterWorkspace}
        activeProcedureId="proc:count"
        onIntent={() => undefined}
      />,
    );
    expect(bodyCanvas).toContain('value="parameter"');
  });
  it("renders bounded pre-play finding cards with inspect and Ori actions", () => {
    const copy = copyFor("en");
    const markup = renderToStaticMarkup(
      <ProgramFindingsPanel
        copy={copy}
        findings={[{ kind: "loop-never-exits", nodeId: "scripts[0]/statements[0]" }]}
        onInspect={() => undefined}
        onAskOri={() => undefined}
      />,
    );
    expect(markup).toContain("Before you play");
    expect(markup).toContain("condition is always false");
    expect(markup).toContain("Inspect block");
    expect(markup).toContain("Ask Ori about these findings");
    const shared = renderToStaticMarkup(
      <ProgramFindingsPanel
        copy={copy}
        findings={[
          {
            kind: "shared-variable",
            nodeId: "scripts[0]/statements[0]",
            relatedNodeId: "scripts[1]/statements[0]",
          },
          { kind: "performance-budget", nodeId: "scripts[0]/statements[1]" },
        ]}
        onInspect={() => undefined}
        onAskOri={() => undefined}
      />,
    );
    expect(shared).toContain("same variable");
    expect(shared).toContain("Inspect other block");
    expect(shared).toContain("block budget");
    expect(
      renderToStaticMarkup(
        <ProgramFindingsPanel
          copy={copy}
          findings={[{ kind: "loop-never-exits", nodeId: "scripts[0]/procedures[0]/body[0]" }]}
          onInspect={() => undefined}
          onAskOri={() => undefined}
        />,
      ),
    ).toContain("Open code");
    expect(
      renderToStaticMarkup(
        <ProgramFindingsPanel
          copy={copy}
          findings={[]}
          onInspect={() => undefined}
          onAskOri={() => undefined}
        />,
      ),
    ).toBe("");
  });
  it("shows a block breakpoint and a closed-choice runtime value history", () => {
    const blockId = workspace.scripts[0]!.statements[0]!.id;
    const canvas = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        onIntent={() => undefined}
        breakpointBlockIds={new Set([blockId])}
        onToggleBreakpoint={() => undefined}
      />,
    );
    expect(canvas).toContain('aria-label="Remove breakpoint: Move');
    expect(canvas).toContain('aria-pressed="true"');
    const panel = renderToStaticMarkup(
      <VisualDebuggerPanel
        copy={copyFor("en")}
        variables={[{ id: "score", name: "Score" }]}
        selectedVariableId="score"
        onSelectVariable={() => undefined}
        pauseOnChange={true}
        onPauseOnChange={() => undefined}
        snapshot={{
          frameIndex: 2,
          step: 1,
          values: { score: 5 },
          history: {
            score: [
              { frameIndex: 0, step: 0, value: 0 },
              { frameIndex: 2, step: 1, value: 5 },
            ],
          },
        }}
      />,
    );
    expect(panel).toContain('value="score"');
    expect(panel).toContain("#0: 0");
    expect(panel).toContain("#1: 5");
    expect(panel).not.toContain('type="text"');
  });
  it("moves blocks into and out of a preceding loop through canonical slots", () => {
    const source = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "repeat", count: 2, body: [{ type: "turn", degrees: 45 }] },
            { type: "move", steps: 3 },
          ],
        },
      ],
    } as never).workspace;
    const from = { container: script, index: 1 };
    const indent = nestedMoveIntent(source, from, "in")!;
    expect(indent.to).toMatchObject({
      container: { kind: "repeatBody", statementPath: [0] },
      index: 1,
    });
    const nested = applyWorkspaceChange(source, indent).workspace;
    expect(nested.scripts[0]?.statements[0]?.inputs?.body).toHaveLength(2);
    const outdent = nestedMoveIntent(nested, { container: indent.to.container, index: 1 }, "out")!;
    expect(outdent.to).toEqual({ container: script, index: 1 });
    const restored = applyWorkspaceChange(nested, outdent).workspace;
    expect(restored.scripts[0]?.statements).toHaveLength(2);
    expect(nestedMoveIntent(source, { container: script, index: 0 }, "in")).toBeUndefined();
    expect(nestedMoveIntent(source, { container: script, index: 0 }, "out")).toBeUndefined();
    expect(nestedMoveIntent(workspace, { container: script, index: 1 }, "in")).toBeUndefined();
  });

  it("moves a block into the else branch only when an if precedes it", () => {
    const source = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "if", condition: { type: "touchingGoal" }, then: [], else: [] },
            { type: "move", steps: 3 },
          ],
        },
      ],
    } as never).workspace;
    const move = nestedMoveIntent(source, { container: script, index: 1 }, "else")!;
    expect(move.to.container.kind).toBe("ifElse");
    const next = applyWorkspaceChange(source, move).workspace;
    expect(next.scripts[0]?.statements[0]?.inputs?.else).toHaveLength(1);
    const out = nestedMoveIntent(next, { container: move.to.container, index: 0 }, "out")!;
    expect(out.to).toEqual({ container: script, index: 1 });
    expect(nestedMoveIntent(source, { container: script, index: 0 }, "else")).toBeUndefined();
  });
  it("shows actor, costume and backdrop previews in the scene library", () => {
    const markup = renderToStaticMarkup(
      <SceneLibrary
        copy={copyFor("es")}
        actors={[
          {
            id: "actor:nova",
            name: "Nova",
            x: 0,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            costumeId: "costume:nova",
          },
        ]}
        assets={[
          {
            id: "costume:nova",
            name: "Nova",
            kind: "costume",
            tags: [],
            source: "builtin:kids-gallery-costume:nova",
          },
          {
            id: "backdrop:moon",
            name: "Luna",
            kind: "backdrop",
            tags: [],
            source: "builtin:kids-gallery-backdrop:moon",
          },
        ]}
        selectedActorId="actor:nova"
        backdropId="backdrop:moon"
        onSelectActor={() => undefined}
        onCostume={() => undefined}
        onBackdrop={() => undefined}
      />,
    );
    expect(markup).toContain("Personajes");
    expect(markup).toContain("Disfraces");
    expect(markup).toContain("Fondos");
    expect(markup.match(/<img/g)).toHaveLength(3);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(4);
  });
  it("shows project sounds in Scene and limits previews to a known built-in source", () => {
    const markup = renderToStaticMarkup(
      <SceneLibrary
        copy={copyFor("es")}
        actors={[]}
        assets={[
          {
            id: "sound:beacon",
            kind: "sound",
            name: "Baliza",
            tags: [],
            source: "builtin:sound.beacon",
            durationMs: 200,
          },
          {
            id: "sound:remote",
            kind: "sound",
            name: "Remoto",
            tags: [],
            source: "https://example.com/sound.wav",
          },
        ]}
        selectedActorId={undefined}
        backdropId={undefined}
        onSelectActor={() => undefined}
        onCostume={() => undefined}
        onBackdrop={() => undefined}
      />,
    );
    expect(markup).toContain("Sonidos");
    expect(markup).toContain("Baliza");
    expect(markup).toContain("0.2 s");
    expect(markup).toContain("Escuchar sonido: Baliza");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain("https://example.com");
  });
  it("offers a local WAV import beside project sounds", () => {
    const markup = renderToStaticMarkup(
      <SceneLibrary
        copy={copyFor("en")}
        actors={[]}
        assets={[]}
        selectedActorId={undefined}
        backdropId={undefined}
        onSelectActor={() => undefined}
        onCostume={() => undefined}
        onBackdrop={() => undefined}
        onImportAsset={() => undefined}
      />,
    );
    expect(markup).toContain("Import WAV sound");
    expect(markup).toContain('accept="audio/wav,.wav"');
    expect(markup).toContain("Sound name");
  });
  it("renders shared gallery art and rejects remote or unknown image sources", () => {
    const costume = {
      id: "costume:nova",
      name: "Nova",
      kind: "costume" as const,
      tags: [],
      source: "builtin:kids-gallery-costume:nova",
    };
    const backdrop = {
      id: "backdrop:moon",
      name: "Moon",
      kind: "backdrop" as const,
      tags: [],
      source: "builtin:kids-gallery-backdrop:moon",
    };
    expect(imageForAsset(costume)).toMatch(/^data:image\/svg\+xml,/);
    expect(imageForId("backdrop:moon", [backdrop])).toMatch(/^data:image\/svg\+xml,/);
    expect(imageForAsset({ ...costume, source: "https://example.com/child.png" })).toBeUndefined();
    expect(
      imageForAsset({ ...costume, source: "builtin:kids-gallery-costume:unknown" }),
    ).toBeUndefined();
    const markup = renderToStaticMarkup(
      <AssetPanel copy={copyFor("en")} assets={[costume, backdrop]} />,
    );
    expect(markup.match(/<img/g)).toHaveLength(2);
  });
  it("renders Workbench density as host-controlled data, not inline styles", () => {
    const html = renderToStaticMarkup(
      <Workbench
        density="compact"
        locale="es"
        bridge={{
          post: () => undefined,
          subscribe: () => () => undefined,
        }}
      />,
    );
    expect(html).toContain('data-density="compact"');
    expect(html).toContain("ESPACIO AVANZADO");
    expect(html).toContain("Agorix Studio");
    expect(html).toContain('class="studio-program"');
    expect(html).toContain('class="studio-component-launcher"');
    for (const category of ["Eventos", "Sonido", "Operadores", "Variables"]) {
      expect(html).toContain(` ${category}</button>`);
    }
    expect(html).toContain('class="studio-evidence"');
    expect(html).toContain('class="ori-header"');
    expect(html).toContain('class="studio-tools"');
    expect(html).toContain("Escena");
    expect(html).toContain("Arrastrá al programa o hacé clic para agregar.");
    expect(html.indexOf('class="studio-tools"')).toBeLessThan(
      html.indexOf('class="studio-program"'),
    );
    expect(html.indexOf('class="studio-program"')).toBeLessThan(
      html.indexOf('class="studio-evidence"'),
    );
    expect(html).toContain("Ejecucion");
    expect(html).toContain("Reproducir");
    expect(html).toContain("Pausa");
    expect(html).toContain("Escenario");
    expect(html).toContain("Ejecuta o avanza el programa");
    expect(html).toContain("Que queres crear?");
    expect(html).toContain("Bloques");
    expect(html).toContain("Mover");
    expect(html).toContain("Abri un proyecto para empezar a construir.");
    expect(html).toContain("Explicar");
    expect(html).toContain("Depurar");
    expect(html).toContain("Desafio");
    expect(html).not.toContain(' style="');
  });

  it("builds rows with one slot between blocks and nested bodies one level deeper", () => {
    const rows = toRows(workspace);
    expect(rows[0]).toEqual({ kind: "script", scriptIndex: 0 });
    for (let i = 1; i < rows.length; i += 1) {
      const a = rows[i - 1];
      const b = rows[i];
      const nestedSlotAfterBody = a?.kind === "slot" && b?.kind === "slot";
      if (nestedSlotAfterBody && a.kind === "slot" && b.kind === "slot") {
        expect(a.depth).not.toBe(b.depth);
      }
    }
    const body = rows.find((r) => r.kind === "block" && r.block.type === "motion_turn");
    expect(body).toMatchObject({ depth: 1 });
    expect(body?.kind === "block" && body.block.location.container).toEqual({
      kind: "repeatBody",
      scriptIndex: 0,
      statementPath: [1],
      branchPath: ["body"],
    });
    const last = rows.filter((r) => r.kind === "slot" && r.depth === 0).pop();
    expect(last).toMatchObject({ slot: { index: 2 } });
  });

  it("renders separate then and else insertion paths, including controls nested in else", () => {
    const conditional = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "branches",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: { type: "touchingGoal" },
              then: [{ type: "move", steps: 1 }],
              else: [{ type: "repeat", count: 2, body: [{ type: "turn", degrees: 45 }] }],
            },
          ],
        },
      ],
    } as never).workspace;
    const rows = toRows(conditional);
    expect(rows.some((row) => row.kind === "elseBranch")).toBe(true);
    expect(rows.some((row) => row.kind === "slot" && row.slot.container.kind === "ifElse")).toBe(
      true,
    );
    expect(
      rows.find((row) => row.kind === "block" && row.block.type === "motion_turn"),
    ).toMatchObject({
      block: { location: { container: { branchPath: ["else", "body"] } } },
    });
    const html = renderToStaticMarkup(
      <Canvas workspace={conditional} copy={copyFor("es")} onIntent={() => undefined} />,
    );
    expect(html).toContain("Si no");
  });

  it("translates slots to final indexes and drops no-op moves", () => {
    const source = {
      kind: "block",
      nodeId: "n",
      location: { container: script, index: 0 },
    } as const;
    expect(dropPointFor(source, { container: script, index: 0 })).toBeUndefined();
    expect(dropPointFor(source, { container: script, index: 1 })).toBeUndefined();
    expect(dropPointFor(source, { container: script, index: 2 })).toEqual({
      container: script,
      index: 1,
    });
    expect(
      dropPointFor({ kind: "palette", blockType: "motion_move" }, { container: script, index: 2 }),
    ).toEqual({
      container: script,
      index: 2,
    });
  });

  it("renders an accessible palette without the trigger block and a focusable canvas", () => {
    const palette = renderToStaticMarkup(<Palette copy={copyFor("en")} onAdd={() => undefined} />);
    expect(palette).toContain("Search blocks");
    expect(palette).toContain("Motion");
    expect(palette).toContain("Control");
    expect(palette).toContain("Sensing");
    expect(palette).toContain("move steps");
    for (const label of [
      "go to coordinates",
      "glide to coordinates",
      "bounce on edge",
      "wait seconds",
      "change actor size",
    ]) {
      expect(palette).toContain(label);
    }
    expect(palette).toContain('data-tone="motion"');
    expect(palette).toContain('data-shape="container"');
    expect(palette).not.toContain("when run starts");
    expect(palette).toContain("Touching the goal?");
    expect(palette).not.toContain("disabled");
    expect(palette).toContain('draggable="true"');
    expect(palette).toContain("add numbers");
    expect(palette).toContain("remainder after division");
    expect(palette).toContain("math function");
    expect(palette).not.toContain("list length");
    expect(palette).not.toContain("call custom block");
    expect(
      renderToStaticMarkup(<Palette copy={copyFor("en")} onAdd={() => undefined} hasProcedures />),
    ).toContain("call custom block");
    const withLists = renderToStaticMarkup(
      <Palette onAdd={() => undefined} hasLists hasVariables hasActors />,
    );
    expect(withLists).toContain("list length");
    expect(withLists).toContain("list item");
    expect(withLists).toContain("variable value");
    expect(withLists).toContain("distance to character");
    const canvas = renderToStaticMarkup(
      <Canvas workspace={workspace} onIntent={() => undefined} />,
    );
    expect(canvas).toContain('data-tone="motion"');
    expect(canvas).toContain('data-shape="container"');
    // Roving tabindex: one tab stop for the whole canvas, the rest reachable with arrow keys.
    expect(canvas.match(/role="group"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(canvas).toContain("aria-keyshortcuts");
    expect(canvas).not.toContain("style=");
  });

  it("shows imported custom calls with a named procedure selector", () => {
    const { workspace } = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "callProcedure", procedureId: "proc:wave" }],
          procedures: [
            { id: "proc:wave", name: "Wave", body: [{ type: "turn", degrees: 90 }] },
            { id: "proc:step", name: "Step", body: [{ type: "move", steps: 2 }] },
          ],
        },
      ],
    });
    const html = renderToStaticMarkup(
      <Canvas workspace={workspace} copy={copyFor("en")} onIntent={() => undefined} />,
    );
    expect(html).toContain("Call custom block");
    expect(html).toContain('<option value="proc:wave" selected="">Wave</option>');
    expect(html).toContain('<option value="proc:step">Step</option>');
  });

  it("localizes the Studio palette chrome", () => {
    const palette = renderToStaticMarkup(<Palette copy={copyFor("es")} onAdd={() => undefined} />);
    expect(palette).toContain('aria-label="Bloques"');
    expect(palette).toContain("Buscar bloques");
    expect(palette).toContain("Movimiento");
    expect(palette).toContain("Sensores");
    expect(palette).toContain('aria-pressed="false"');
  });

  it("finds blocks by visible Spanish labels and ignores accents", () => {
    const copy = copyFor("es");
    const block = { type: "motion_move", label: "Move steps", accessibleName: "move steps" };
    expect(matchesPaletteBlockSearch("mover", block, "Movimiento", copy)).toBe(true);
    expect(matchesPaletteBlockSearch("movimiento", block, "Movimiento", copy)).toBe(true);
    expect(matchesPaletteBlockSearch("move", block, "Movimiento", copy)).toBe(true);
    expect(matchesPaletteBlockSearch("apariencia", block, "Movimiento", copy)).toBe(false);
    expect(matchesPaletteBlockSearch("sénsór", block, "Movimiento", copy)).toBe(false);
  });

  it("exposes every available visual category in the compact launcher", () => {
    expect(paletteCategories(copyFor("es"), false).map(({ label }) => label)).toEqual([
      "Eventos",
      "Movimiento",
      "Apariencia",
      "Sonido",
      "Control",
      "Sensores",
      "Operadores",
      "Variables",
    ]);
    expect(paletteCategories(copyFor("es"), true).at(-1)?.label).toBe("Listas");
    expect(paletteCategories(copyFor("en"), false).some(({ label }) => label === "Lists")).toBe(
      false,
    );
  });

  it("renders multi-actor stage frames and marks the selected actor", () => {
    const markup = renderToStaticMarkup(
      <StagePanel
        copy={copyFor("en")}
        selectedActorId="actor:helper"
        listNames={{ inventory: "Inventory" }}
        assets={[
          {
            id: "asset:costume.spark",
            name: "Spark",
            kind: "costume",
            tags: ["starter"],
          },
          {
            id: "asset:space.nebula",
            name: "Nebula",
            kind: "backdrop",
            tags: ["space"],
          },
          {
            id: "asset:sound.beacon",
            name: "Beacon ping",
            kind: "sound",
            tags: ["feedback"],
          },
        ]}
        frame={{
          state: {
            sprite: { x: 0, y: 0, heading: 0, radius: 10 },
            goal: { x: 100, y: 0, radius: 12 },
            viewport: { width: 264, height: 192 },
            backdropId: "asset:space.nebula",
            variables: [{ id: "score", label: "score", value: 5, visible: true }],
            lists: [
              { id: "inventory", label: "inventory", items: [3, 7], visible: true },
              { id: "hidden", label: "hidden", items: [9], visible: false },
            ],
            sounds: { activeSoundIds: ["asset:sound.beacon"], volume: 40 },
            actors: [
              {
                id: "actor:main",
                name: "Explorer",
                x: 0,
                y: 0,
                direction: 0,
                size: 100,
                visible: true,
              },
              {
                id: "actor:helper",
                name: "Helper",
                x: 40,
                y: 20,
                direction: 90,
                size: 80,
                visible: true,
                costumeId: "asset:costume.spark",
                bubble: { kind: "say", text: "Go Nova" },
              },
            ],
          },
          frameIndex: 0,
          frameCount: 1,
          step: 0,
          running: true,
          reachedGoal: false,
          actorId: "actor:helper",
          scriptId: "helper",
          statementType: "move",
        }}
      />,
    );
    expect(markup.match(/class="stage-sprite/g)).toHaveLength(2);
    expect(markup).toContain("stage-sprite selected");
    expect(markup).toContain('draggable="false"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('data-backdrop-id="asset:space.nebula"');
    expect(markup).toContain('data-costume-id="asset:costume.spark"');
    expect(markup).toContain('class="stage-art-backdrop"');
    expect(markup).toContain('class="stage-art-sprite"');
    expect(markup).toContain("Go Nova");
    expect(markup).toContain("Sprite Helper");
    expect(markup).toContain("actor:helper · helper · move");
    expect(markup).toContain('class="stage-watchers"');
    expect(markup).toContain('data-variable-id="score"');
    expect(markup).toContain("<strong>5</strong>");
    expect(markup).toContain('data-list-id="inventory"');
    expect(markup).toContain("Inventory · 2");
    expect(markup).toContain("<li>3</li>");
    expect(markup).not.toContain('data-list-id="hidden"');
    expect(markup).toContain('class="stage-sounds"');
    expect(markup).toContain("Active sounds");
    expect(markup).toContain("Beacon ping");
    expect(markup).toContain("40%");
  });

  it("maps actor drops to bounded stage coordinates and rejects unusable geometry", () => {
    const bounds = { left: 100, top: 20, width: 480, height: 360 };
    const viewport = { width: 240, height: 180 };
    expect(stageDropPosition(340, 200, bounds, viewport)).toEqual({ x: 120, y: 90 });
    expect(stageDropPosition(20, 900, bounds, viewport)).toEqual({ x: 0, y: 0 });
    expect(stageDropPosition(900, -20, bounds, viewport)).toEqual({ x: 240, y: 180 });
    expect(stageDropPosition(NaN, 200, bounds, viewport)).toBeUndefined();
    expect(stageDropPosition(340, 200, { ...bounds, width: 0 }, viewport)).toBeUndefined();
    expect(stageNudgePosition({ x: 10, y: 20 }, viewport, "ArrowRight", 1)).toEqual({
      x: 11,
      y: 20,
    });
    expect(stageNudgePosition({ x: 10, y: 20 }, viewport, "ArrowUp", 10)).toEqual({ x: 10, y: 30 });
    expect(stageNudgePosition({ x: 0, y: 0 }, viewport, "ArrowLeft", 10)).toEqual({ x: 0, y: 0 });
    expect(stageNudgePosition({ x: 10, y: 20 }, viewport, "Enter", 1)).toBeUndefined();
    expect(stageNudgePosition({ x: NaN, y: 20 }, viewport, "ArrowUp", 1)).toBeUndefined();
    expect(
      stagePointerDragPosition(
        { x: 10, y: 20 },
        { x: 100, y: 200 },
        { x: 300, y: 100 },
        bounds,
        viewport,
      ),
    ).toEqual({ x: 110, y: 70 });
    expect(
      stagePointerDragPosition(
        { x: 10, y: 20 },
        { x: 100, y: 200 },
        { x: -900, y: 900 },
        bounds,
        viewport,
      ),
    ).toEqual({ x: 0, y: 0 });
    expect(
      stagePointerDragPosition(
        { x: 10, y: 20 },
        { x: 100, y: 200 },
        { x: NaN, y: 0 },
        bounds,
        viewport,
      ),
    ).toBeUndefined();
  });

  it("renders actor costume as a visual asset-backed picker", () => {
    const markup = renderToStaticMarkup(
      <ActorInspector
        copy={copyFor("en")}
        selectedActorId="actor:main"
        onPatch={() => undefined}
        actors={[
          {
            id: "actor:main",
            name: "Explorer",
            x: 0,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            costumeId: "asset:costume.spark",
          },
        ]}
        assets={[
          {
            id: "asset:costume.spark",
            name: "Spark",
            kind: "costume",
            tags: ["starter"],
          },
          {
            id: "asset:space.nebula",
            name: "Nebula",
            kind: "backdrop",
            tags: ["space"],
          },
        ]}
      />,
    );
    expect(markup).toContain("actor-costume-preview");
    expect(markup).toContain("Choose costume: Spark");
    expect(markup).not.toContain("Choose costume: Nebula");
  });

  it("renders Studio assets with technical search and kind filters", () => {
    const markup = renderToStaticMarkup(
      <AssetPanel
        copy={copyFor("en")}
        assets={[
          {
            id: "asset:costume.spark",
            name: "Spark",
            kind: "costume",
            tags: ["starter"],
            width: 64,
            height: 64,
          },
          {
            id: "asset:space.nebula",
            name: "Nebula",
            kind: "backdrop",
            tags: ["space"],
            width: 480,
            height: 320,
          },
          {
            id: "asset:sound.beacon",
            name: "Beacon ping",
            kind: "sound",
            tags: ["feedback"],
            durationMs: 900,
          },
        ]}
      />,
    );

    expect(markup).toContain("3/3");
    expect(markup).toContain("Name, id or tag");
    expect(markup).toContain("All assets");
    expect(markup).toContain("Costumes");
    expect(markup).toContain("Backdrops");
    expect(markup).toContain("Sounds");
    expect(markup).toContain("Dimensions: 64x64");
    expect(markup).toContain("Duration: 900ms");
  });

  it("renders the Mission Spec as a compact editable runtime contract", () => {
    const markup = renderToStaticMarkup(
      <MissionSpecPanel
        copy={copyFor("en")}
        onSave={() => undefined}
        spec={{
          goal: "Guide the rocket to the beacon.",
          successCheck: "touches-goal",
          predictionPrompt: "Will it touch the beacon?",
          hash: "mission:abcd1234",
        }}
      />,
    );

    expect(markup).toContain("Mission Spec");
    expect(markup).toContain("Guide the rocket to the beacon.");
    expect(markup).toContain("Touches the goal");
    expect(markup).toContain("Will it touch the beacon?");
    expect(markup).toContain("mission:abcd1234");
    expect(markup).toContain("Save spec");
  });

  it("renders validation issues for broken actor and asset references", () => {
    const markup = renderToStaticMarkup(
      <ValidationPanel
        copy={copyFor("en")}
        issues={[
          {
            id: "validation:actor-costume:actor:main",
            severity: "error",
            kind: "missing-costume",
            path: "metadata.actors.items[0].costumeId",
            ref: "asset:costume.missing",
            message: 'Actor "actor:main" references missing costume "asset:costume.missing".',
          },
          {
            id: "validation:stage-backdrop:asset:space.missing",
            severity: "error",
            kind: "missing-backdrop",
            path: "metadata.stage.backdropId",
            ref: "asset:space.missing",
            message: 'Stage references missing backdrop "asset:space.missing".',
          },
        ]}
      />,
    );

    expect(markup).toContain("Validation");
    expect(markup).toContain("2 errors · 2 issues");
    expect(markup).toContain("Missing costume");
    expect(markup).toContain("Missing backdrop");
    expect(markup).toContain("metadata.actors.items[0].costumeId");
    expect(markup).toContain("asset:space.missing");
  });

  it("renders event trace activations as a dense runtime list", () => {
    const markup = renderToStaticMarkup(
      <EventTracePanel
        copy={copyFor("en")}
        selectedActorId="actor:main"
        state={{
          schema: "agorix/studio-protocol/v1",
          type: "executionState",
          status: "completed",
          outcome: "completed",
          frameIndex: 2,
          frameCount: 3,
          stepsUsed: 2,
          eventTrace: [
            {
              id: "activation:0",
              step: 1,
              actorId: "actor:main",
              scriptId: "starter",
              event: "start",
              reason: "Run started",
            },
            {
              id: "activation:1",
              step: 2,
              actorId: "actor:main",
              scriptId: "receiver",
              event: "message:go from actor:main",
              reason: 'Message "go" was broadcast by actor:main',
            },
            {
              id: "activation:2",
              step: 3,
              actorId: "actor:helper",
              scriptId: "helper-click",
              event: "click",
              reason: "Actor Helper was clicked",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain("Event trace");
    expect(markup).toContain("2/3");
    expect(markup).toContain("Selected actor");
    expect(markup).toContain("Script");
    expect(markup).toContain("message:go from actor:main");
    expect(markup).toContain("receiver");
    expect(markup).not.toContain("helper-click");
    expect(markup).toContain("Reason:");
  });

  it("parses drag payloads, chords and statuses defensively", () => {
    expect(parseDragPayload("{")).toBeUndefined();
    expect(parseDragPayload('{"kind":"nope"}')).toBeUndefined();
    expect(parseDragPayload('{"kind":"palette","blockType":"motion_move"}')).toBeDefined();
    expect(chordFromEvent({ altKey: true, key: "ArrowUp" })).toBe("Alt+ArrowUp");
    expect(chordFromEvent({ altKey: false, key: "ArrowUp" })).toBeUndefined();
    expect(chordFromEvent({ altKey: false, key: "Delete" })).toBe("Delete");
    expect(statusFor({ schema: "agorix/studio-protocol/v1", type: "agentUnavailable" })).toMatch(
      /not available/,
    );
    expect(
      statusFor({ schema: "agorix/studio-protocol/v1", type: "error", code: "INVALID_CHANGE" }),
    ).toMatch(/Nothing changed/);
    expect(
      statusFor({ schema: "agorix/studio-protocol/v1", type: "error", code: "STALE_EDIT" }),
    ).toMatch(/changed/);
    expect(
      statusFor({
        schema: "agorix/studio-protocol/v1",
        type: "error",
        code: "INVALID_CHANGE",
        reason: "NOT_A_CONTAINER",
      }),
    ).toBe("That block cannot hold other blocks. Nothing changed.");
    expect(
      statusFor(
        {
          schema: "agorix/studio-protocol/v1",
          type: "error",
          code: "INVALID_CHANGE",
          reason: "NOT_A_CONTAINER",
        },
        copyFor("es"),
      ),
    ).toBe("Ese bloque no puede contener otros bloques. Nada cambio.");
  });

  it("marks selected, running and failed blocks with text, not only color", () => {
    const blocks = toRows(workspace).flatMap((row) => (row.kind === "block" ? [row.block.id] : []));
    const markup = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        onIntent={() => undefined}
        sync={{
          selectedBlockId: blocks[0]!,
          executingBlockId: blocks[0]!,
          failedBlockId: blocks[1]!,
        }}
      />,
    );
    expect(markup).toContain("Failed here");
    expect(markup).toContain("Running");
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain("This block failed when the program ran");
  });

  it("localizes canvas status badges and keyboard controls", () => {
    const first = toRows(workspace).flatMap((row) =>
      row.kind === "block" ? [row.block.id] : [],
    )[0]!;
    const markup = renderToStaticMarkup(
      <Canvas
        copy={copyFor("es")}
        workspace={workspace}
        onIntent={() => undefined}
        sync={{ executingBlockId: first }}
        hints={{ hints: { [first]: "Agregar mover 10 pasos" }, skipped: [first] }}
      />,
    );
    expect(markup).toContain('aria-label="Programa"');
    expect(markup).toContain("cuando presionas Ejecutar");
    expect(markup).toContain("Omitido: Agregar mover 10 pasos");
    expect(markup).toContain("Ejecutando");
    expect(markup).toContain("Mover arriba");
    expect(markup).toContain("Eliminar");
  });

  it("renders ambient hints on the canvas without proposal state", () => {
    const first = toRows(workspace).flatMap((row) =>
      row.kind === "block" ? [row.block.id] : [],
    )[0]!;
    const anchored = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        onIntent={() => undefined}
        ambientHint={{
          blockId: first,
          label: "Companion can debug this with runtime evidence.",
          actions: ["debug"],
        }}
      />,
    );
    expect(anchored).toContain("Companion can debug this with runtime evidence.");
    expect(anchored).toContain("Companion hint");

    const global = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        onIntent={() => undefined}
        ambientHint={{
          label: "Companion can suggest a small next step.",
          actions: ["propose"],
        }}
      />,
    );
    expect(global).toContain('role="note"');
    expect(global).toContain("Companion can suggest a small next step.");
  });
});

describe("density announcements", () => {
  it("announces only an automatic change to compact, in both languages", () => {
    const en = copyFor("en");
    expect(densityAnnouncement("comfortable", { value: "compact", reason: "auto" }, en)).toBe(
      en.densityCompactNote,
    );
    expect(
      densityAnnouncement("comfortable", { value: "compact", reason: "setting" }, en),
    ).toBeUndefined();
    expect(
      densityAnnouncement("compact", { value: "compact", reason: "auto" }, en),
    ).toBeUndefined();
    expect(
      densityAnnouncement("compact", { value: "comfortable", reason: "auto" }, en),
    ).toBeUndefined();
    const es = copyFor("es");
    expect(densityAnnouncement("comfortable", { value: "compact", reason: "auto" }, es)).toMatch(
      /más compacto/,
    );
    expect(es.densityCompactNote).not.toBe(en.densityCompactNote);
  });
});
