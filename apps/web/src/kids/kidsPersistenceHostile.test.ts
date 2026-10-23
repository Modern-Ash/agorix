import { describe, expect, it } from "vitest";
import { createFreeWorldMission } from "@agorix/curriculum";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import { addActiveSeconds, loadAdultSettings, localDay, readTodaySeconds } from "./kidsAdults.js";
import {
  createFreeProject,
  exportKidsProject,
  importKidsProject,
  kidsGoalSpec,
  listFreeProjects,
} from "./kidsProjects.js";
import { KIDS_PROGRESS_KEY, loadKidsProgress } from "./kidsProgress.js";
import { KIDS_FLAGS_KEY, kidsV2Features } from "./kidsFlags.js";

// Issue #442: hostile persistence inputs are handled today. Pin them so Kids v2 cannot regress.
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
  return { data, adapter, index, storage: index as unknown as Storage };
}

function validExport(): string {
  const { adapter, index } = memory();
  const store = new ProjectStore({ storage: adapter });
  const project = createFreeProject("space", "🦊", index);
  const mission = createFreeWorldMission({ cx: 3, cy: 1 }, "es");
  store.save(project.id, mission.starterProject, {
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
    locale: "es",
    missionSpec: { goal: kidsGoalSpec({ cx: 3, cy: 1 }), successCheck: "touches-goal" },
  });
  return exportKidsProject(store, project.id);
}

// Test-only loose JSON view for building hostile variants of a valid export.
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function mutated(change: (project: Json) => void): string {
  const envelope = JSON.parse(validExport()) as Json;
  change(envelope["project"]);
  return JSON.stringify(envelope);
}

describe("hostile .agorix imports (issue #442)", () => {
  const cases: Record<string, string> = {
    "empty object": "{}",
    null: "null",
    array: "[]",
    "5 MB string": "x".repeat(5_000_000),
    "proto pollution": '{"__proto__":{"x":1}}',
    "unknown schemaVersion": mutated((p) => (p["schemaVersion"] = 999)),
    "goal outside the grid": mutated((p) => (p["metadata"]["missionSpec"].goal = "kids.cell.6.1")),
    "goal on the start cell": mutated((p) => (p["metadata"]["missionSpec"].goal = "kids.cell.0.2")),
    "free text goal": mutated((p) => (p["metadata"]["missionSpec"].goal = "free text")),
    "huge move steps": mutated((p) => {
      p["program"].scripts[0].statements.push({ type: "move", steps: 1e308 });
    }),
    "50 nested repeats": mutated((p) => {
      let body: unknown[] = [{ type: "move", steps: 1 }];
      for (let level = 0; level < 50; level++) body = [{ type: "repeat", count: 2, body }];
      p["program"].scripts[0].statements = body;
    }),
    "10000 statements": mutated((p) => {
      p["program"].scripts[0].statements = Array.from({ length: 10_000 }, () => ({
        type: "move",
        steps: 1,
      }));
    }),
  };

  for (const [name, source] of Object.entries(cases)) {
    it(`rejects ${name} without writing anything and without hanging`, () => {
      const { data, adapter, index } = memory();
      const store = new ProjectStore({ storage: adapter });
      const started = performance.now();
      expect(() => importKidsProject(source, "space", "🦊", store, index)).toThrow();
      expect(performance.now() - started).toBeLessThan(1000);
      expect([...data.keys()]).toEqual([]);
    });
  }
});

describe("corrupt local data falls back to safe defaults (issue #442)", () => {
  const corrupt = ['{"missions":"x","stars":-5}', "[]", "42", "null", "{not json", '"text"'];

  for (const raw of corrupt) {
    it(`progress ${raw}`, () => {
      const { storage, adapter } = memory({ [KIDS_PROGRESS_KEY]: raw });
      expect(loadKidsProgress(storage, new ProjectStore({ storage: adapter }))).toEqual({
        onboarded: false,
        avatar: "🦊",
        stars: 0,
        done: {},
      });
    });
    it(`adult settings ${raw}`, () => {
      const { storage } = memory({ "agorix.kids.adults.v1": raw });
      expect(loadAdultSettings(storage)).toEqual({
        oriSuggestions: true,
        readAloud: true,
        dailyLimitMinutes: 30,
        ageBand: "6-8",
      });
    });
    it(`flags ${raw}`, () => {
      expect(kidsV2Features({ storage: memory({ [KIDS_FLAGS_KEY]: raw }).index }).size).toBe(0);
    });
  }

  it("rejects out-of-range limits and ignores stars below zero or fractional", () => {
    const limits = memory({
      "agorix.kids.adults.v1": '{"oriSuggestions":true,"readAloud":true,"dailyLimitMinutes":9999}',
    });
    expect(loadAdultSettings(limits.storage).dailyLimitMinutes).toBe(30);
    const stars = memory({
      [KIDS_PROGRESS_KEY]: '{"onboarded":true,"avatar":"💥","stars":1.5,"done":{}}',
    });
    expect(
      loadKidsProgress(stars.storage, new ProjectStore({ storage: memory().adapter })),
    ).toEqual({ onboarded: false, avatar: "🦊", stars: 0, done: {} });
  });

  it("filters index entries with unknown worlds, avatars, ids or shapes", () => {
    const raw = JSON.stringify([
      { id: "free-1", world: "space", avatar: "🦊", extra: "x" },
      { id: "free-2", world: "moon", avatar: "🦊" },
      { id: "free-3", world: "space", avatar: "💥" },
      { id: "../etc", world: "space", avatar: "🦊" },
      { id: "free-0", world: "space", avatar: "🦊" },
      null,
      7,
      "free-9",
    ]);
    const listed = listFreeProjects(memory({ "agorix.kids.projects.v1": raw }).index);
    expect(listed.map((entry) => entry.id)).toEqual(["free-1"]);
    expect(listFreeProjects(memory({ "agorix.kids.projects.v1": '{"a":1}' }).index)).toEqual([]);
  });
});

describe("shared storage and the clock (issue #442)", () => {
  it("two tabs creating projects get unique, increasing ids", () => {
    const { index } = memory();
    const ids = [
      createFreeProject("space", "🦊", index),
      createFreeProject("ocean", "🐼", index),
      createFreeProject("city", "🐸", index),
    ].map((project) => project.id);
    expect(new Set(ids).size).toBe(3);
    expect(listFreeProjects(index).map((entry) => entry.id)).toEqual(ids);
  });

  it("localDay follows the local calendar, including DST changes", () => {
    expect(localDay(new Date(2026, 9, 21, 23, 59, 59))).toBe("2026-10-21");
    expect(localDay(new Date(2026, 9, 22, 0, 0, 0))).toBe("2026-10-22");
    expect(localDay(new Date(2026, 2, 8, 12))).toBe("2026-03-08");
    expect(localDay(new Date(2026, 10, 1, 1, 30))).toBe("2026-11-01");
  });

  it("usage resets exactly once when the day changes and never goes negative", () => {
    const { storage } = memory();
    addActiveSeconds(60, "2026-10-21", storage);
    addActiveSeconds(60, "2026-10-21", storage);
    expect(readTodaySeconds("2026-10-21", storage)).toBe(120);
    expect(readTodaySeconds("2026-10-22", storage)).toBe(0);
    addActiveSeconds(10, "2026-10-22", storage);
    expect(readTodaySeconds("2026-10-22", storage)).toBe(10);
    expect(readTodaySeconds("2026-10-21", storage)).toBe(0);
    addActiveSeconds(-5, "2026-10-22", storage);
    addActiveSeconds(Number.NaN, "2026-10-22", storage);
    addActiveSeconds(Number.POSITIVE_INFINITY, "2026-10-22", storage);
    expect(readTodaySeconds("2026-10-22", storage)).toBe(10);
  });
});
