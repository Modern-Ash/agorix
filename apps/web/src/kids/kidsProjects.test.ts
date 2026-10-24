import { describe, expect, it } from "vitest";
import { createFreeWorldMission } from "@agorix/curriculum";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import {
  createFreeProject,
  createFreeProjectRef,
  deleteFreeProject,
  restoreFreeProject,
  exportKidsProject,
  importKidsProject,
  kidsGoalSpec,
  listFreeProjects,
  listFreeProjectRefs,
  parseKidsGoalSpec,
} from "./kidsProjects.js";

function memory() {
  const data = new Map<string, string>();
  const storage: BrowserStorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => {
      data.delete(key);
    },
    has: (key) => data.has(key),
  };
  const indexStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  return { storage, indexStorage };
}

describe("Kids free projects (issue #376)", () => {
  it("keeps bundled gallery choices across reload and ignores invented asset ids", () => {
    const { indexStorage } = memory();
    const created = createFreeProjectRef(
      { kind: "gallery", id: "forest" },
      { kind: "gallery", id: "nova" },
      indexStorage,
    );
    expect(listFreeProjectRefs(indexStorage)).toContainEqual(created);
    expect(listFreeProjects(indexStorage)).toContainEqual({
      id: created.id,
      world: "space",
      avatar: "🦊",
    });
    indexStorage.setItem(
      "agorix.kids.projects.v2",
      JSON.stringify([
        {
          id: "free-1",
          world: { kind: "gallery", id: "evil" },
          avatar: { kind: "gallery", id: "nova" },
        },
      ]),
    );
    expect(listFreeProjectRefs(indexStorage)).toEqual([
      {
        id: "free-1",
        world: { kind: "builtin", value: "space" },
        avatar: { kind: "emoji", value: "🦊" },
      },
    ]);
  });
  it("validates goal specs and rejects cells outside the world", () => {
    expect(parseKidsGoalSpec(kidsGoalSpec({ cx: 3, cy: 1 }))).toEqual({ cx: 3, cy: 1 });
    expect(() => parseKidsGoalSpec("kids.cell.6.1")).toThrow();
    expect(() => parseKidsGoalSpec("kids.cell.0.2")).toThrow();
    expect(() => parseKidsGoalSpec("free text")).toThrow();
  });

  it("creates numbered projects and imports a validated .agorix v1 copy", () => {
    const { storage, indexStorage } = memory();
    const store = new ProjectStore({ storage });
    const first = createFreeProject("space", "🐸", indexStorage);
    const second = createFreeProject("ocean", "🦊", indexStorage);
    expect(listFreeProjects(indexStorage).map((entry) => entry.id)).toEqual(["free-1", "free-2"]);
    const mission = createFreeWorldMission({ cx: 3, cy: 1 }, "es");
    store.save(first.id, mission.starterProject, {
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
      missionSpec: { goal: kidsGoalSpec({ cx: 3, cy: 1 }), successCheck: "touches-goal" },
    });
    const exported = exportKidsProject(store, first.id);
    const imported = importKidsProject(exported, "robots", "🐸", store, indexStorage);
    expect(imported.id).toBe("free-3");
    expect(store.load(imported.id).program.schema).toBe(SCHEMA_VERSION);
    expect(store.load(imported.id).metadata.missionSpec?.goal).toBe("kids.cell.3.1");
    expect(second.id).toBe("free-2");
    expect(exported).not.toContain("reflectionRecorded");
  });

  it("rejects malformed imports without adding a project", () => {
    const { storage, indexStorage } = memory();
    const store = new ProjectStore({ storage });
    expect(() => importKidsProject("not json", "space", "🐸", store, indexStorage)).toThrow();
    expect(listFreeProjects(indexStorage)).toEqual([]);
  });

  it("preserves an accepted turn challenge through portable export and import", () => {
    const { storage, indexStorage } = memory();
    const store = new ProjectStore({ storage });
    const first = createFreeProject("space", "🐸", indexStorage);
    const mission = createFreeWorldMission({ cx: 4, cy: 2 }, "es");
    store.save(first.id, mission.starterProject, {
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
      missionSpec: {
        goal: kidsGoalSpec({ cx: 4, cy: 2 }),
        successCheck: "touches-goal-after-turn",
      },
    });
    const imported = importKidsProject(
      exportKidsProject(store, first.id),
      "ocean",
      "🐸",
      store,
      indexStorage,
    );
    expect(store.load(imported.id).metadata.missionSpec?.successCheck).toBe(
      "touches-goal-after-turn",
    );
  });

  it("survives a full or blocked index storage (issue #440)", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(createFreeProject("space", "🦊", failing)).toEqual({
      id: "free-1",
      world: "space",
      avatar: "🦊",
    });
  });

  it("leaves no stored project behind when an import cannot be indexed (issue #441)", () => {
    const { storage, indexStorage } = memory();
    const store = new ProjectStore({ storage });
    const first = createFreeProject("space", "🐸", indexStorage);
    const mission = createFreeWorldMission({ cx: 3, cy: 1 }, "es");
    store.save(first.id, mission.starterProject, {
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
      missionSpec: { goal: kidsGoalSpec({ cx: 3, cy: 1 }), successCheck: "touches-goal" },
    });
    const exported = exportKidsProject(store, first.id);
    const failing = {
      getItem: indexStorage.getItem,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(() => importKidsProject(exported, "robots", "🐸", store, failing)).toThrow();
    expect(store.has("free-2")).toBe(false);
    expect(listFreeProjects(indexStorage).map((entry) => entry.id)).toEqual(["free-1"]);
  });

  it("deletes only the chosen free project and can restore it (issue #445)", () => {
    const { storage, indexStorage } = memory();
    const store = new ProjectStore({ storage });
    const first = createFreeProject("space", "🐸", indexStorage);
    const second = createFreeProject("ocean", "🦊", indexStorage);
    const mission = createFreeWorldMission({ cx: 3, cy: 1 }, "es");
    const metadata = {
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      missionProgress: 0 as const,
      hintLevel: 0,
      locale: "es" as const,
      missionSpec: { goal: kidsGoalSpec({ cx: 3, cy: 1 }), successCheck: "touches-goal" as const },
    };
    store.save(first.id, mission.starterProject, metadata);
    store.save(second.id, mission.starterProject, metadata);
    store.save("kids.space.kids.m1.straight", mission.starterProject, metadata);

    const removed = deleteFreeProject(second.id, store, indexStorage);
    expect(removed).not.toBeNull();
    expect(listFreeProjects(indexStorage).map((entry) => entry.id)).toEqual(["free-1"]);
    expect(store.has(second.id)).toBe(false);
    expect(store.has(first.id)).toBe(true);
    expect(store.has("kids.space.kids.m1.straight")).toBe(true);

    expect(deleteFreeProject(second.id, store, indexStorage)).toBeNull();
    expect(deleteFreeProject("kids.space.kids.m1.straight", store, indexStorage)).toBeNull();
    expect(store.has("kids.space.kids.m1.straight")).toBe(true);

    expect(restoreFreeProject(removed!, store, indexStorage)).toBe(true);
    expect(listFreeProjects(indexStorage).map((entry) => entry.id)).toEqual(["free-1", "free-2"]);
    expect(store.has(second.id)).toBe(true);
    expect(restoreFreeProject(removed!, store, indexStorage)).toBe(false);
  });

  it("does not delete anything when the index cannot be written (issue #445)", () => {
    const { storage, indexStorage } = memory();
    const store = new ProjectStore({ storage });
    const project = createFreeProject("space", "🐸", indexStorage);
    const mission = createFreeWorldMission({ cx: 3, cy: 1 }, "es");
    store.save(project.id, mission.starterProject, {
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
      missionSpec: { goal: kidsGoalSpec({ cx: 3, cy: 1 }), successCheck: "touches-goal" },
    });
    const failing = {
      getItem: indexStorage.getItem,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(deleteFreeProject(project.id, store, failing)).toBeNull();
    expect(store.has(project.id)).toBe(true);
  });
});
