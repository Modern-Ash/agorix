import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import {
  createFreeProject,
  createFreeProjectRef,
  deleteFreeProject,
  isCustomRefId,
  listFreeProjectRefs,
  listFreeProjects,
  restoreFreeProject,
} from "./kidsProjects.js";

// Issue #456: custom explorer/backdrop references without breaking the v1 index.
const V1 = "agorix.kids.projects.v1";
const V2 = "agorix.kids.projects.v2";
const fixture = readFileSync(
  new URL("./__fixtures__/v1/projects-index.json", import.meta.url),
  "utf8",
).trim();

function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
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
  return { data, adapter, index };
}
const customAvatar = { kind: "custom", id: "custom-1" } as const;
const customWorld = { kind: "custom", id: "custom-2" } as const;

describe("v1 index stays loadable as references (issue #456)", () => {
  it("lists the v1 fixture with the same avatar and world", () => {
    const { index } = memory({ [V1]: fixture });
    expect(listFreeProjectRefs(index)).toEqual([
      {
        id: "free-1",
        world: { kind: "builtin", value: "ocean" },
        avatar: { kind: "emoji", value: "🐼" },
      },
      {
        id: "free-3",
        world: { kind: "builtin", value: "city" },
        avatar: { kind: "emoji", value: "🦄" },
      },
    ]);
    expect(listFreeProjects(index).map((project) => project.id)).toEqual(["free-1", "free-3"]);
  });

  it("allocates the next id after the highest across both indexes", () => {
    const { index } = memory({ [V1]: fixture });
    const created = createFreeProjectRef({ kind: "builtin", value: "space" }, customAvatar, index);
    expect(created.id).toBe("free-4");
  });
});

describe("custom references round-trip and degrade for an older build", () => {
  it("round-trips a custom explorer and backdrop through v2", () => {
    const { index } = memory({ [V1]: fixture });
    createFreeProjectRef(customWorld, customAvatar, index);
    const refs = listFreeProjectRefs(index);
    expect(refs.map((ref) => ref.id)).toEqual(["free-1", "free-3", "free-4"]);
    expect(refs[2]).toEqual({ id: "free-4", world: customWorld, avatar: customAvatar });
    expect(refs[0]?.avatar).toEqual({ kind: "emoji", value: "🐼" });
  });

  it("an older build (v1 reader) still lists every project with safe fallbacks", () => {
    const { index } = memory({ [V1]: fixture });
    createFreeProjectRef(customWorld, customAvatar, index);
    expect(listFreeProjects(index)).toEqual([
      { id: "free-1", world: "ocean", avatar: "🐼" },
      { id: "free-3", world: "city", avatar: "🦄" },
      { id: "free-4", world: "space", avatar: "🦊" },
    ]);
  });

  it("a project created by an older build after v2 exists is merged, not lost", () => {
    const { index } = memory({ [V1]: fixture });
    createFreeProjectRef(customWorld, customAvatar, index);
    createFreeProject("robots", "🐸", index); // older v1-only writer
    const refs = listFreeProjectRefs(index);
    expect(refs.map((ref) => ref.id)).toEqual(["free-1", "free-3", "free-4", "free-5"]);
    expect(refs[2]?.avatar).toEqual(customAvatar);
    expect(refs[3]).toMatchObject({ world: { kind: "builtin", value: "robots" } });
  });
});

describe("delete and undo keep both indexes in step", () => {
  it("does not resurrect a deleted custom project and restores it with its reference", () => {
    const { index, adapter } = memory();
    const store = new ProjectStore({ storage: adapter });
    const project = createFreeProjectRef(customWorld, customAvatar, index);
    const removed = deleteFreeProject(project.id, store, index);
    expect(removed).not.toBeNull();
    expect(listFreeProjectRefs(index)).toEqual([]);
    expect(listFreeProjects(index)).toEqual([]);
    expect(restoreFreeProject(removed!, store, index)).toBe(true);
    expect(listFreeProjectRefs(index)).toEqual([project]);
  });
});

describe("hostile references are rejected (issue #456)", () => {
  it("accepts only custom-1 to custom-99", () => {
    for (const ok of ["custom-1", "custom-12", "custom-99"]) expect(isCustomRefId(ok)).toBe(true);
    for (const bad of [
      "custom-0",
      "custom-100",
      "custom-01",
      "custom-1;drop",
      "../x",
      "custom-",
      "free-1",
      1,
      null,
      undefined,
    ])
      expect(isCustomRefId(bad)).toBe(false);
  });

  it("drops corrupt v2 entries and falls back to v1", () => {
    const raw = JSON.stringify([
      {
        id: "free-1",
        world: { kind: "custom", id: "custom-0" },
        avatar: { kind: "emoji", value: "🦊" },
      },
      {
        id: "free-2",
        world: { kind: "builtin", value: "moon" },
        avatar: { kind: "emoji", value: "🦊" },
      },
      {
        id: "free-3",
        world: { kind: "builtin", value: "space" },
        avatar: { kind: "emoji", value: "💥" },
      },
      {
        id: "../etc",
        world: { kind: "builtin", value: "space" },
        avatar: { kind: "emoji", value: "🦊" },
      },
      null,
      7,
    ]);
    const { index } = memory({ [V1]: fixture, [V2]: raw });
    expect(listFreeProjectRefs(index).map((ref) => ref.id)).toEqual(["free-1", "free-3"]);
    expect(listFreeProjectRefs(memory({ [V2]: "{not json" }).index)).toEqual([]);
    expect(listFreeProjectRefs(memory({ [V2]: '{"a":1}' }).index)).toEqual([]);
  });

  it("survives blocked storage", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(createFreeProjectRef(customWorld, customAvatar, failing).id).toBe("free-1");
  });
});
