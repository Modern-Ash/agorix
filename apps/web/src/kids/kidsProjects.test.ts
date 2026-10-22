import { describe, expect, it } from "vitest";
import { createFreeWorldMission } from "@agorix/curriculum";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import {
  createFreeProject,
  exportKidsProject,
  importKidsProject,
  kidsGoalSpec,
  listFreeProjects,
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
});
