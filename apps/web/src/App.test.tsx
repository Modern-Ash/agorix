import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";
import {
  addBlockToWorkspace,
  blockNodeId,
  codeSliceForNode,
  createEditorModel,
  editNumericBlockField,
  resetWorkspace,
} from "./editorModel.js";

describe("main editor shell", () => {
  it("renders required editor regions together", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Agorix First Mission");
    expect(html).toContain("Blocks");
    expect(html).toContain("When you press Run");
    expect(html).toContain("Stage");
    expect(html).toContain("Code");
    expect(html).toContain("Tutor suggestion");
    expect(html).toContain("Run");
    expect(html).toContain("Stop");
    expect(html).toContain("Reset");
  });

  it("starts with blocks and code visible at the same time", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html.indexOf("Blocks")).toBeGreaterThan(-1);
    expect(html.indexOf("This is the code behind your blocks.")).toBeGreaterThan(-1);
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
});
