import { describe, expect, it } from "vitest";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import { ensureMissionStudio, missionOfStudio } from "./kidsMissionStudio.js";
import { listStudioProjects, studioSceneGoal } from "./kidsStudioProjects.js";
import { setStudioSceneGoal } from "./kidsStudioProjects.js";

function memory() {
  const data = new Map<string, string>();
  const adapter: BrowserStorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    has: (key) => data.has(key),
  };
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { store: new ProjectStore({ storage: adapter }), storage };
}

describe("mission scenes", () => {
  it("uses one scene for the mission, with its original start and goal", () => {
    const { store, storage } = memory();
    const id = ensureMissionStudio("space", 0, "🐸", "es", store, storage);
    expect(id).toMatch(/^studio-/);
    expect(ensureMissionStudio("space", 0, "🐸", "es", store, storage)).toBe(id);
    expect(missionOfStudio(id!, storage)).toEqual({ world: "space", index: 0 });
    expect(listStudioProjects(storage)).toHaveLength(1);
    const saved = store.load(id!);
    expect(saved.metadata.actors?.items[0]).toMatchObject({ x: 0, y: 80 });
    expect(studioSceneGoal(id!, store)).toEqual({
      kind: "reachCell",
      actorId: "actor:studio-1-tito",
      cx: 4,
      cy: 2,
    });
    setStudioSceneGoal(id!, null, store);
    expect(ensureMissionStudio("space", 0, "🐸", "es", store, storage)).toBe(id);
    expect(studioSceneGoal(id!, store)).toMatchObject({ kind: "reachCell", cx: 4, cy: 2 });
  });

  it("copies a saved block sequence without removing the old project", () => {
    const { store, storage } = memory();
    const mission = getKidsMission(KIDS_MISSION_IDS[0], "es");
    const oldId = `kids.space.${mission.id}`;
    store.save(
      oldId,
      {
        ...mission.starterProject,
        scripts: [
          {
            ...mission.starterProject.scripts[0]!,
            statements: [
              { type: "move", steps: 40 },
              { type: "turn", degrees: 90 },
            ],
          },
        ],
      },
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        locale: "es",
        hintLevel: 2,
        missionProgress: 0,
      },
    );
    const id = ensureMissionStudio("space", 0, "🐼", "es", store, storage);
    expect(id).toMatch(/^studio-/);
    expect(store.load(id!).program.scripts[0]?.statements).toEqual(
      store.load(oldId).program.scripts[0]?.statements,
    );
    expect(store.load(id!).metadata.hintLevel).toBe(2);
    expect(store.has(oldId)).toBe(true);
  });
});
