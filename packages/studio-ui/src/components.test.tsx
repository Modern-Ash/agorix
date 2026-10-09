import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { programToWorkspace } from "@agorix/block-editor";
import { Canvas } from "./Canvas.js";
import { Palette } from "./Palette.js";
import {
  ActorInspector,
  AssetPanel,
  EventTracePanel,
  StagePanel,
  Workbench,
  statusFor,
} from "./Workbench.js";
import { densityAnnouncement } from "./density.js";
import { dropPointFor, toRows } from "./blockView.js";
import { chordFromEvent, parseDragPayload } from "./drag.js";
import { copyFor } from "./i18n.js";

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
    expect(html).toContain("Ejecucion");
    expect(html).toContain("Reproducir");
    expect(html).toContain("Pausa");
    expect(html).toContain("Escenario");
    expect(html).toContain("Ejecuta o avanza el programa");
    expect(html).toContain("Que queres crear?");
    expect(html).toContain("Bloques");
    expect(html).toContain("Mover [N] pasos");
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
    });
    const last = rows.filter((r) => r.kind === "slot" && r.depth === 0).pop();
    expect(last).toMatchObject({ slot: { index: 2 } });
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
    expect(palette).not.toContain("when run starts");
    expect(palette).toContain("Touching the goal?");
    expect(palette).toContain("disabled");
    expect(palette).toContain("This block fits inside another block");
    const canvas = renderToStaticMarkup(
      <Canvas workspace={workspace} onIntent={() => undefined} />,
    );
    // Roving tabindex: one tab stop for the whole canvas, the rest reachable with arrow keys.
    expect(canvas.match(/role="group"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(canvas).toContain("aria-keyshortcuts");
    expect(canvas).not.toContain("style=");
  });

  it("localizes the Studio palette chrome", () => {
    const palette = renderToStaticMarkup(<Palette copy={copyFor("es")} onAdd={() => undefined} />);
    expect(palette).toContain('aria-label="Bloques"');
    expect(palette).toContain("Buscar bloques");
    expect(palette).toContain("Movimiento");
    expect(palette).toContain("Sensores");
    expect(palette).toContain("Este bloque va dentro de otro bloque");
  });

  it("renders multi-actor stage frames and marks the selected actor", () => {
    const markup = renderToStaticMarkup(
      <StagePanel
        copy={copyFor("en")}
        selectedActorId="actor:helper"
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
            sounds: { activeSoundIds: ["asset:sound.beacon"] },
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
    expect(markup).toContain('data-backdrop-id="asset:space.nebula"');
    expect(markup).toContain('data-costume-id="asset:costume.spark"');
    expect(markup).toContain("Go Nova");
    expect(markup).toContain("Sprite Helper");
    expect(markup).toContain("actor:helper · helper · move");
    expect(markup).toContain('class="stage-watchers"');
    expect(markup).toContain('data-variable-id="score"');
    expect(markup).toContain("<strong>5</strong>");
    expect(markup).toContain('class="stage-sounds"');
    expect(markup).toContain("Active sounds");
    expect(markup).toContain("Beacon ping");
  });

  it("renders actor costume as an asset-backed inspector select", () => {
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
    expect(markup).toContain("<select");
    expect(markup).toContain("Spark · asset:costume.spark");
    expect(markup).not.toContain("Nebula · asset:space.nebula");
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
