import { describe, expect, it } from "vitest";
import { applyWorkspaceChange, programToWorkspace, projectWorkspace } from "@agorix/block-editor";
import { validateMessage, createNonce } from "./framework.js";
import {
  createStudioCanvasViewState,
  renderStudioCanvas,
  studioCanvasInboundSchemas,
} from "./canvasEditor.js";
import { semanticHash } from "../studioCore.js";
import type { ProjectProgram } from "@agorix/program-model";

const program: ProjectProgram = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 2 }],
    },
  ],
};

describe("Studio canvas webview", () => {
  it("renders canvas, generated code and canonical hash from the same projection", () => {
    const workspace = programToWorkspace(program).workspace;
    const update = projectWorkspace(workspace);
    const view = createStudioCanvasViewState(update, {
      semanticHash: semanticHash(update.program),
      selectedNodeIds: ["scripts[0]/statements[0]"],
      canUndo: true,
    });

    const html = renderStudioCanvas(view, createNonce(), "vscode-webview:");

    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("sprite.move(2);");
    expect(html).toContain(
      "Canvas blocks, code and World Preview derive from the same canonical program",
    );
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it("validates bounded canvas messages before host code sees them", () => {
    const ok = validateMessage(studioCanvasInboundSchemas, {
      type: "agorix-canvas-apply",
      baseHash: semanticHash(program),
      change: {
        type: "addBlock",
        container: { kind: "script", scriptIndex: 0 },
        index: 1,
        block: { id: "move-2", type: "motion_move", fields: { steps: 4 } },
      },
    });
    expect(ok).toMatchObject({ ok: true });

    expect(
      validateMessage(studioCanvasInboundSchemas, {
        type: "agorix-canvas-apply",
        baseHash: semanticHash(program),
        change: {
          type: "addBlock",
          container: { kind: "script", scriptIndex: 0 },
          index: 1,
          block: { id: "bad", type: "sensing_touching_goal" },
        },
      }).ok,
    ).toBe(true);
    expect(validateMessage(studioCanvasInboundSchemas, { type: "eval" }).ok).toBe(false);
    expect(
      validateMessage(studioCanvasInboundSchemas, {
        type: "agorix-canvas-select",
        nodeId: "<script>alert(1)</script>",
      }).ok,
    ).toBe(false);
  });

  it("keeps canvas edits canonical by comparing semantic hashes after edit sequences", () => {
    const workspace = programToWorkspace(program).workspace;
    const added = applyWorkspaceChange(workspace, {
      type: "addBlock",
      container: { kind: "script", scriptIndex: 0 },
      index: 1,
      block: { id: "turn-1", type: "motion_turn", fields: { degrees: 90 } },
    });
    const edited = applyWorkspaceChange(added.workspace, {
      type: "editBlock",
      location: { container: { kind: "script", scriptIndex: 0 }, index: 0 },
      block: {
        id: added.workspace.scripts[0]?.statements[0]?.id ?? "move",
        type: "motion_move",
        fields: { steps: 3 },
      },
    });

    const roundTripped = projectWorkspace(programToWorkspace(edited.program).workspace);

    expect(semanticHash(roundTripped.program)).toBe(semanticHash(edited.program));
    expect(roundTripped.projection.code).toContain("sprite.move(3);");
    expect(roundTripped.projection.code).toContain("sprite.turn(90);");
  });
});
