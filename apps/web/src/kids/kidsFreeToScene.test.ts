import { describe, expect, it } from "vitest";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import { createFreeWorldMission } from "@agorix/curriculum";
import type { Statement } from "@agorix/program-model";
import { convertFreeProject, migratedScenes } from "./kidsFreeToScene.js";
import { createFreeProjectRef } from "./kidsProjects.js";
import { addKidsCustom } from "./kidsCustom.js";
import { listStudioProjects, studioSceneGoal } from "./kidsStudioProjects.js";

function memory() {
  const data = new Map<string, string>();
  const adapter: BrowserStorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    has: (key) => data.has(key),
  };
  const index = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { store: new ProjectStore({ storage: adapter }), index };
}

function seed(
  statements: readonly Statement[],
  goal = { cx: 4, cy: 2 },
  world: "space" | "ocean" = "space",
) {
  const { store, index } = memory();
  const ref = createFreeProjectRef(
    { kind: "builtin", value: world },
    { kind: "emoji", value: "🦊" },
    index,
  );
  const mission = createFreeWorldMission(goal, "es");
  store.save(
    ref.id,
    {
      ...mission.starterProject,
      scripts: [{ ...mission.starterProject.scripts[0]!, statements: [...statements] }],
    },
    {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
      missionSpec: { goal: `kids.cell.${goal.cx}.${goal.cy}`, successCheck: "touches-goal" },
    },
  );
  return { store, index, id: ref.id };
}

describe("old free project becomes a scene (issue #1134)", () => {
  it("copies the program into a scene, keeps the old project and does not convert twice", () => {
    const blocks: Statement[] = [
      { type: "move", steps: 40 },
      { type: "turn", degrees: 90 },
      { type: "repeat", count: 2, body: [{ type: "move", steps: 40 }] },
    ];
    const { store, index, id } = seed(blocks);
    const result = convertFreeProject(id, "es", store, index);
    expect(result.kind).toBe("scene");
    if (result.kind !== "scene") return;
    expect(studioSceneGoal(result.studioId, store)).toEqual({
      kind: "reachCell",
      actorId: "actor:studio-1-mika",
      cx: 4,
      cy: 2,
    });
    expect(store.load(result.studioId).program.scripts[0]!.statements).toEqual(blocks);
    expect(store.has(id)).toBe(true);
    expect(listStudioProjects(index).map((item) => item.id)).toEqual([result.studioId]);
    expect(migratedScenes(index)).toEqual({ [id]: result.studioId });
    expect(convertFreeProject(id, "es", store, index)).toMatchObject({
      kind: "scene",
      studioId: result.studioId,
    });
    expect(listStudioProjects(index)).toHaveLength(1);
  });

  it("picks the backdrop from the old world", () => {
    const { store, index, id } = seed([], { cx: 4, cy: 2 }, "ocean");
    const result = convertFreeProject(id, "es", store, index);
    expect(result.kind).toBe("scene");
    expect(listStudioProjects(index)[0]!.backdropId).toBe("reef");
  });

  it("keeps the turn requirement of an old cell goal", () => {
    const { store, index, id } = seed([]);
    const saved = store.load(id);
    store.save(id, saved.program, {
      ...saved.metadata,
      missionSpec: { goal: "kids.cell.4.2", successCheck: "touches-goal-after-turn" },
    });
    const result = convertFreeProject(id, "es", store, index);
    expect(result.kind).toBe("scene");
    if (result.kind !== "scene") return;
    expect(studioSceneGoal(result.studioId, store)).toMatchObject({
      afterTurn: true,
      cx: 4,
      cy: 2,
    });
  });

  it("copies custom explorer and backdrop into portable scene assets", () => {
    const { store, index } = memory();
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";
    const explorer = addKidsCustom("explorer", image, index);
    const backdrop = addKidsCustom("backdrop", image, index);
    expect(explorer.ok && backdrop.ok).toBe(true);
    if (!explorer.ok || !backdrop.ok) return;
    const ref = createFreeProjectRef(
      { kind: "custom", id: backdrop.item.id },
      { kind: "custom", id: explorer.item.id },
      index,
    );
    const mission = createFreeWorldMission({ cx: 4, cy: 2 }, "es");
    store.save(ref.id, mission.starterProject, {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
    });
    const result = convertFreeProject(ref.id, "es", store, index);
    expect(result.kind).toBe("scene");
    if (result.kind !== "scene") return;
    const assets = store.load(result.studioId).metadata.assets ?? [];
    expect(
      assets
        .filter((item) => item.source === image)
        .map((item) => item.kind)
        .sort(),
    ).toEqual(["backdrop", "costume"]);
    expect(store.has(ref.id)).toBe(true);
  });

  it("keeps projects it cannot convert without loss", () => {
    const unknown = memory();
    expect(convertFreeProject("free-9", "es", unknown.store, unknown.index)).toEqual({
      kind: "kept",
      reason: "unknown",
    });
    const { store, index, id } = seed([{ type: "move", steps: 40 }]);
    const stored = store.load(id);
    store.save(
      id,
      {
        ...stored.program,
        scripts: [{ ...stored.program.scripts[0]!, statements: [{ type: "hide" } as Statement] }],
      },
      stored.metadata,
    );
    expect(convertFreeProject(id, "es", store, index)).toEqual({
      kind: "kept",
      reason: "unsupported-block",
    });
    expect(listStudioProjects(index)).toEqual([]);
    expect(migratedScenes(index)).toEqual({});
  });
});
