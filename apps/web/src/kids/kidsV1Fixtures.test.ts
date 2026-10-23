import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFreeWorldMission } from "@agorix/curriculum";
import { ProjectStore, parseAgorixProject, type BrowserStorageAdapter } from "@agorix/persistence";
import { loadAdultSettings } from "./kidsAdults.js";
import {
  exportKidsProject,
  importKidsProject,
  kidsGoalSpec,
  listFreeProjects,
} from "./kidsProjects.js";
import { KIDS_PROGRESS_KEY, loadKidsProgress } from "./kidsProgress.js";

// Issue #437: data written by the shipped v1 build must keep loading unchanged. If a change makes
// one of these tests fail, add a migration and a new fixture; never edit these files.
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/v1/${name}`, import.meta.url), "utf8").trim();

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

describe("Kids v1 saved data stays loadable (issue #437)", () => {
  it("loads v1 progress without store projects", () => {
    const { index } = memory({ [KIDS_PROGRESS_KEY]: fixture("progress.json") });
    const store = new ProjectStore({ storage: memory().adapter });
    const progress = loadKidsProgress(index as unknown as Storage, store);
    expect(progress).toEqual({
      onboarded: true,
      avatar: "🐼",
      stars: 2,
      done: { "space:0": true, "ocean:1": true },
    });
  });

  it("loads v1 adult settings", () => {
    const { index } = memory({ "agorix.kids.adults.v1": fixture("adults.json") });
    expect(loadAdultSettings(index as unknown as Storage)).toEqual({
      oriSuggestions: false,
      readAloud: true,
      dailyLimitMinutes: 45,
    });
  });

  it("lists the v1 projects index and allocates the next id after the highest", () => {
    const { index } = memory({ "agorix.kids.projects.v1": fixture("projects-index.json") });
    expect(listFreeProjects(index).map((entry) => entry.id)).toEqual(["free-1", "free-3"]);
  });

  it("imports the v1 .agorix project fixture", () => {
    const path = new URL("./__fixtures__/v1/project.agorix.json", import.meta.url);
    if (!existsSync(path)) {
      // One-time generation with the v1 build; the committed file is then the contract.
      const gen = memory();
      const store = new ProjectStore({ storage: gen.adapter });
      const mission = createFreeWorldMission({ cx: 3, cy: 1 }, "es");
      store.save("free-1", mission.starterProject, {
        createdAt: "2026-10-21T00:00:00.000Z",
        updatedAt: "2026-10-21T00:00:00.000Z",
        missionProgress: 0,
        hintLevel: 0,
        locale: "es",
        missionSpec: { goal: kidsGoalSpec({ cx: 3, cy: 1 }), successCheck: "touches-goal" },
      });
      writeFileSync(path, exportKidsProject(store, "free-1"));
    }
    const source = readFileSync(path, "utf8");
    expect(parseAgorixProject(source).project.metadata.missionSpec?.goal).toBe("kids.cell.3.1");
    const { adapter, index } = memory({
      "agorix.kids.projects.v1": fixture("projects-index.json"),
    });
    const imported = importKidsProject(
      source,
      "robots",
      "🦊",
      new ProjectStore({ storage: adapter }),
      index,
    );
    expect(imported).toEqual({ id: "free-4", world: "robots", avatar: "🦊" });
  });
});
