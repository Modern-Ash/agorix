import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { programToWorkspace } from "@agorix/block-editor";
import { Canvas } from "./Canvas.js";
import { Palette } from "./Palette.js";
import { dropPointFor, toRows } from "./blockView.js";
import { chordFromEvent, parseDragPayload } from "./drag.js";
import { statusFor } from "./Workbench.js";

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
    const palette = renderToStaticMarkup(<Palette onAdd={() => undefined} />);
    expect(palette).toContain("move steps");
    expect(palette).not.toContain("when run starts");
    const canvas = renderToStaticMarkup(
      <Canvas workspace={workspace} onIntent={() => undefined} />,
    );
    expect(canvas.match(/tabindex="0"/g)).toHaveLength(3);
    expect(canvas).toContain("aria-keyshortcuts");
    expect(canvas).not.toContain("style=");
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

  it("posts a revealNode intent when a block label is clicked", () => {
    const first = toRows(workspace).flatMap((row) =>
      row.kind === "block" ? [row.block.id] : [],
    )[0]!;
    const onIntent = vi.fn();
    // Canvas has no hooks, so it can be called directly and its element tree walked.
    const labels: Array<{ onClick: () => void }> = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node !== "object" || node === null) return;
      const props = (node as { props?: Record<string, unknown> }).props;
      if (props === undefined) return;
      if (props["data-testid"] === "block-label") {
        labels.push(props as unknown as { onClick: () => void });
      }
      walk(props["children"]);
    };
    walk(Canvas({ workspace, onIntent }));
    expect(labels.length).toBeGreaterThan(0);
    labels[0]!.onClick();
    expect(onIntent).toHaveBeenCalledWith({ type: "revealNode", nodeId: first });
  });
});
