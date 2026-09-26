import { renderToStaticMarkup } from "react-dom/server";
import { ProjectStore } from "@agorix/persistence";
import type { ProjectProgram, Script } from "@agorix/program-model";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";
import {
  addBlockToWorkspace,
  blockNodeId,
  codeSliceForNode,
  createEditorModel,
  createEditorModelFromProgram,
  editNumericBlockField,
  resetWorkspace,
} from "./editorModel.js";
import {
  WEB_PROJECT_ID,
  WebLocalStorageAdapter,
  loadEditorProject,
  saveEditorProject,
} from "./projectStorage.js";

describe("main editor shell", () => {
  it("renders required editor regions together", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Agorix First Mission");
    expect(html).toContain("Blocks");
    expect(html).toContain("When you press Run");
    expect(html).toContain("Stage");
    expect(html).toContain("Code");
    expect(html).toContain("Tutor suggestion");
    expect(html).toContain("Get hint");
    expect(html).toContain("Hints used: 0");
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

  it("stores canonical program and metadata without generated code", () => {
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
    });
    const raw = storage.getItem(`agorix:${WEB_PROJECT_ID}`);
    const loaded = loadEditorProject(persistence);

    expect(error).toBeUndefined();
    expect(raw).toContain('"program"');
    expect(raw).toContain('"metadata"');
    expect(raw).not.toContain("sprite.move");
    expect(raw).not.toContain('"code"');
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
