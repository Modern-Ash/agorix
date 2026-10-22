import { describe, expect, it } from "vitest";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import {
  KIDS_PROGRESS_KEY,
  conceptStates,
  emptyKidsProgress,
  firstOpenMission,
  loadKidsProgress,
  markMissionDone,
  missionState,
  saveKidsProgress,
} from "./kidsProgress.js";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("kids progress (issue #374)", () => {
  it("starts empty and not onboarded", () => {
    expect(emptyKidsProgress()).toEqual({ onboarded: false, avatar: "🦊", stars: 0, done: {} });
  });

  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const progress = markMissionDone(
      { ...emptyKidsProgress(), onboarded: true, avatar: "🐼" },
      "ocean",
      0,
    );
    saveKidsProgress(progress, storage);
    expect(loadKidsProgress(storage)).toEqual(progress);
  });

  it("derives completion from saved mission projects even without a profile record", () => {
    const data = new Map<string, string>();
    const adapter: BrowserStorageAdapter = {
      get: (key) => data.get(key) ?? null,
      set: (key, value) => {
        data.set(key, value);
      },
      remove: (key) => {
        data.delete(key);
      },
      has: (key) => data.has(key),
    };
    const projects = new ProjectStore({ storage: adapter });
    const mission = getKidsMission(KIDS_MISSION_IDS[0], "es");
    projects.save(`kids.space.${KIDS_MISSION_IDS[0]}`, mission.starterProject, {
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      missionProgress: 1,
      hintLevel: 0,
    });
    expect(loadKidsProgress(memoryStorage(), projects)).toMatchObject({
      stars: 1,
      done: { "space:0": true },
    });
    const legacy = markMissionDone(emptyKidsProgress(), "ocean", 0);
    const profile = memoryStorage();
    saveKidsProgress(legacy, profile);
    expect(loadKidsProgress(profile, projects)).toMatchObject({
      stars: 2,
      done: { "space:0": true, "ocean:0": true },
    });
  });

  it("gives one star per mission the first time only", () => {
    let progress = markMissionDone(emptyKidsProgress(), "space", 0);
    progress = markMissionDone(progress, "space", 0);
    progress = markMissionDone(progress, "space", 1);
    expect(progress.stars).toBe(2);
    expect(progress.done).toEqual({ "space:0": true, "space:1": true });
  });

  it("opens missions in order per world and locks the rest", () => {
    const fresh = emptyKidsProgress();
    expect(firstOpenMission(fresh, "space")).toBe(0);
    expect([0, 1, 2].map((i) => missionState(fresh, "space", i))).toEqual([
      "current",
      "locked",
      "locked",
    ]);
    const one = markMissionDone(fresh, "space", 0);
    expect([0, 1, 2].map((i) => missionState(one, "space", i))).toEqual([
      "done",
      "current",
      "locked",
    ]);
    expect(missionState(one, "ocean", 0)).toBe("current");
  });

  it("keeps the last mission current once all are done", () => {
    let progress = emptyKidsProgress();
    for (const i of [0, 1, 2] as const) progress = markMissionDone(progress, "city", i);
    expect(firstOpenMission(progress, "city")).toBe(2);
    expect(missionState(progress, "city", 2)).toBe("current");
    expect(missionState(progress, "city", 0)).toBe("done");
  });

  it("summarises the three concepts from any world", () => {
    expect(conceptStates(emptyKidsProgress())).toEqual(["practicing", "soon", "soon"]);
    const progress = markMissionDone(emptyKidsProgress(), "robots", 0);
    expect(conceptStates(progress)).toEqual(["learned", "practicing", "soon"]);
  });

  it("survives broken or blocked storage", () => {
    expect(loadKidsProgress(memoryStorage({ [KIDS_PROGRESS_KEY]: "{oops" }))).toEqual(
      emptyKidsProgress(),
    );
    expect(loadKidsProgress(memoryStorage({ [KIDS_PROGRESS_KEY]: '{"stars":"many"}' }))).toEqual(
      emptyKidsProgress(),
    );
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadKidsProgress(blocked)).toEqual(emptyKidsProgress());
    expect(() => saveKidsProgress(emptyKidsProgress(), blocked)).not.toThrow();
  });
});
