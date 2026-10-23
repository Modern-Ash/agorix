import { describe, expect, it } from "vitest";
import { KIDS_PROGRESS_KEY, loadKidsProgress } from "./kidsProgress.js";
import { tutorialStep, tutorialVisible } from "./kidsTutorial.js";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";

// Issue #470
const facts = { blocks: 0, numberTouched: false, predicting: false, ran: false };

describe("tutorial steps (issue #470)", () => {
  it("walks add, number, run, and finishes once a result exists", () => {
    expect(tutorialStep(facts)).toBe("add");
    expect(tutorialStep({ ...facts, blocks: 1 })).toBe("number");
    expect(tutorialStep({ ...facts, blocks: 1, numberTouched: true })).toBe("run");
    expect(tutorialStep({ ...facts, blocks: 1, numberTouched: true, ran: true })).toBeNull();
  });

  it("pressing Jugar early jumps straight to the prediction step", () => {
    expect(tutorialStep({ ...facts, blocks: 1, predicting: true })).toBe("predict");
    expect(tutorialStep({ ...facts, blocks: 0, predicting: true })).toBe("predict");
  });

  it("is visible only for mission 1, never in a free project, once, and only when enabled", () => {
    const base = { enabled: true, done: false, missionIndex: 0, freeProject: false };
    expect(tutorialVisible(base)).toBe(true);
    expect(tutorialVisible({ ...base, enabled: false })).toBe(false);
    expect(tutorialVisible({ ...base, done: true })).toBe(false);
    expect(tutorialVisible({ ...base, missionIndex: 1 })).toBe(false);
    expect(tutorialVisible({ ...base, freeProject: true })).toBe(false);
  });
});

describe("tutorial flag in saved progress (issue #470)", () => {
  const store = () => {
    const data = new Map<string, string>();
    const adapter: BrowserStorageAdapter = {
      get: (key) => data.get(key) ?? null,
      set: (key, value) => void data.set(key, value),
      remove: (key) => void data.delete(key),
      has: (key) => data.has(key),
    };
    return new ProjectStore({ storage: adapter });
  };
  const storage = (raw: string) => ({ getItem: () => raw }) as unknown as Storage;

  it("old progress without the field loads unchanged", () => {
    const loaded = loadKidsProgress(
      storage('{"onboarded":true,"avatar":"🐼","stars":0,"done":{}}'),
      store(),
    );
    expect(loaded).toEqual({ onboarded: true, avatar: "🐼", stars: 0, done: {} });
    expect("tutorialDone" in loaded).toBe(false);
  });

  it("keeps tutorialDone only when it is exactly true", () => {
    const withIt = loadKidsProgress(
      storage('{"onboarded":true,"avatar":"🐼","stars":0,"done":{},"tutorialDone":true}'),
      store(),
    );
    expect(withIt.tutorialDone).toBe(true);
    for (const bad of ['"yes"', "1", "false", "null"]) {
      const loaded = loadKidsProgress(
        storage(`{"onboarded":true,"avatar":"🐼","stars":0,"done":{},"tutorialDone":${bad}}`),
        store(),
      );
      expect("tutorialDone" in loaded).toBe(false);
    }
    expect(KIDS_PROGRESS_KEY).toBe("agorix.kids.progress.v1");
  });
});
