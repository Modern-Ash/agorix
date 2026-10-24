import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import {
  addStudioActor,
  addStudioList,
  addStudioVariable,
  appendStudioStatement,
  setStudioTrigger,
} from "./kidsStudioModel.js";
import {
  createStudioProject,
  exportStudioProject,
  importStudioProject,
  listStudioProjects,
  saveStudioProject,
  setStudioBackdrop,
} from "./kidsStudioProjects.js";

function memory() {
  const data = new Map<string, string>();
  const storage: BrowserStorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    has: (key) => data.has(key),
  };
  const index = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { store: new ProjectStore({ storage }), index };
}

describe("Kids studio projects", () => {
  it("saves actors, scripts and a selected backdrop, then exports and imports a portable scene", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    let history = createEditorHistory(store.load(project.id).program);
    history = addStudioActor(history, "mika");
    history = addStudioVariable(history, "Puntos");
    history = addStudioList(history, "Objetos");
    history = setStudioTrigger(history, "actor:studio-2-mika", {
      type: "onMessage",
      message: "vamos",
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "broadcast",
      message: "vamos",
    });
    history = appendStudioStatement(history, "actor:studio-2-mika", { type: "move", steps: 40 });
    history = appendStudioStatement(history, "actor:studio-2-mika", {
      type: "listAdd",
      listId: "studio-list-1",
      value: { type: "numericLiteral", value: 2 },
    });
    saveStudioProject(project.id, history.current, "forest", "actor:studio-2-mika", "es", store);
    setStudioBackdrop(project.id, "moon", "es", store, index);
    expect(store.load(project.id).metadata.stage?.backdropId).toBe("backdrop:moon");
    expect(store.load(project.id).metadata.actors?.items).toHaveLength(2);
    const copy = importStudioProject(exportStudioProject(project.id, store), "es", store, index);
    expect(copy.id).toBe("studio-2");
    expect(copy.backdropId).toBe("moon");
    expect(store.load(copy.id).program).toEqual(history.current);
    expect(listStudioProjects(index)).toEqual([{ ...project, backdropId: "moon" }, copy]);
  });

  it("rejects a foreign program without leaving a broken project card", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const exported = JSON.parse(exportStudioProject(project.id, store)) as Record<string, unknown>;
    expect(() =>
      importStudioProject(JSON.stringify({ ...exported, program: {} }), "es", store, index),
    ).toThrow();
    expect(listStudioProjects(index)).toEqual([project]);
  });

  it("restores the saved backdrop when the project index cannot be updated", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const failingIndex = {
      getItem: index.getItem,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => setStudioBackdrop(project.id, "moon", "es", store, failingIndex)).toThrow("quota");
    expect(store.load(project.id).metadata.stage?.backdropId).toBe("backdrop:forest");
    expect(listStudioProjects(index)).toEqual([project]);
  });
});
