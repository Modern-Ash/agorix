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
  addStudioArt,
  createStudioProject,
  exportStudioProject,
  importStudioProject,
  listStudioProjects,
  moveStudioActorLayer,
  saveStudioProject,
  selectStudioArt,
  setStudioActorPosition,
  setStudioBackdrop,
} from "./kidsStudioProjects.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";

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
  it("keeps a child's costume and backdrop in a portable scene only with adult media opt-in", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const costume = addStudioArt(
      project.id,
      "costume",
      "actor:studio-1-nova",
      png,
      "es",
      store,
      index,
    );
    const backdrop = addStudioArt(
      project.id,
      "backdrop",
      "actor:studio-1-nova",
      png,
      "es",
      store,
      index,
    );
    expect(store.load(project.id).metadata.actors?.items[0]?.costumeId).toBe(costume);
    expect(store.load(project.id).metadata.stage?.backdropId).toBe(backdrop);
    expect(() => exportStudioProject(project.id, store)).toThrow(/adult opt-in/);
    const portable = exportStudioProject(project.id, store, true);
    const copy = importStudioProject(portable, "es", store, index);
    expect(store.load(copy.id).metadata.actors?.items[0]?.costumeId).toBe(costume);
    expect(store.load(copy.id).metadata.stage?.backdropId).toBe(backdrop);
    expect(store.load(copy.id).metadata.assets?.find((item) => item.id === costume)?.source).toBe(
      png,
    );
    const secondCostume = addStudioArt(
      copy.id,
      "costume",
      "actor:studio-1-nova",
      png,
      "es",
      store,
      index,
    );
    selectStudioArt(copy.id, costume, "actor:studio-1-nova", "es", store, index);
    expect(store.load(copy.id).metadata.actors?.items[0]?.costumeId).toBe(costume);
    expect(secondCostume).not.toBe(costume);
    saveStudioProject(
      copy.id,
      store.load(copy.id).program,
      "forest",
      "actor:studio-1-nova",
      "es",
      store,
    );
    expect(store.load(copy.id).metadata.stage?.backdropId).toBe(backdrop);
    expect(store.load(copy.id).metadata.actors?.items[0]?.costumeId).toBe(costume);
  });

  it("rejects an invalid drawn image without changing the scene", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const before = store.load(project.id);
    expect(() =>
      addStudioArt(
        project.id,
        "costume",
        "actor:studio-1-nova",
        "data:image/svg+xml;base64,PHN2Zz4=",
        "es",
        store,
        index,
      ),
    ).toThrow();
    expect(store.load(project.id)).toEqual(before);
  });
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
    setStudioActorPosition(project.id, "actor:studio-2-mika", 180, -40, store);
    expect(moveStudioActorLayer(project.id, "actor:studio-1-nova", "forward", store)).toBe(true);
    setStudioBackdrop(project.id, "moon", "es", store, index);
    expect(store.load(project.id).metadata.stage?.backdropId).toBe("backdrop:moon");
    expect(store.load(project.id).metadata.actors?.items).toHaveLength(2);
    const copy = importStudioProject(exportStudioProject(project.id, store), "es", store, index);
    expect(copy.id).toBe("studio-2");
    expect(copy.backdropId).toBe("moon");
    expect(store.load(copy.id).program).toEqual(history.current);
    expect(store.load(copy.id).metadata.actors?.items[1]).toMatchObject({ x: 180, y: -40 });
    expect(store.load(copy.id).metadata.stage?.actorOrder).toEqual([
      "actor:studio-2-mika",
      "actor:studio-1-nova",
    ]);
    expect(listStudioProjects(index)).toEqual([{ ...project, backdropId: "moon" }, copy]);
  });

  it("rejects positions outside the stage and unknown actors without changing the project", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const before = store.load(project.id);
    expect(() =>
      setStudioActorPosition(project.id, "actor:studio-1-nova", 400, 0, store),
    ).toThrow();
    expect(() => setStudioActorPosition(project.id, "actor:missing", 100, 0, store)).toThrow();
    expect(() => moveStudioActorLayer(project.id, "actor:missing", "forward", store)).toThrow();
    expect(store.load(project.id)).toEqual(before);
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
