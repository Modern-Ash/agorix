import { describe, expect, it } from "vitest";
import {
  STUDIO_TUTORIAL_KEY,
  setStudioTutorialDone,
  studioTutorialDone,
  studioTutorialStep,
  studioTutorialText,
} from "./kidsStudioTutorial.js";

describe("Escena libre first steps (issue #1126)", () => {
  it("follows what the child is doing and ends after stepping through a run", () => {
    expect(studioTutorialStep({ blocks: 0, ran: false, stepped: false })).toBe("add");
    expect(studioTutorialStep({ blocks: 2, ran: false, stepped: false })).toBe("play");
    expect(studioTutorialStep({ blocks: 2, ran: true, stepped: false })).toBe("step");
    expect(studioTutorialStep({ blocks: 2, ran: true, stepped: true })).toBeNull();
  });

  it("never blocks: pressing Play early skips straight to Step", () => {
    expect(studioTutorialStep({ blocks: 0, ran: true, stepped: false })).toBe("add");
    expect(studioTutorialStep({ blocks: 1, ran: true, stepped: false })).toBe("step");
  });

  it("is remembered per device and can be reopened", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    expect(studioTutorialDone(store)).toBe(false);
    setStudioTutorialDone(true, store);
    expect(data.get(STUDIO_TUTORIAL_KEY)).toBe("done");
    expect(studioTutorialDone(store)).toBe(true);
    setStudioTutorialDone(false, store);
    expect(studioTutorialDone(store)).toBe(false);
  });

  it("has text in both languages for every step", () => {
    for (const locale of ["es", "en"] as const)
      for (const key of ["title", "add", "play", "step", "skip", "help"] as const)
        expect(studioTutorialText(key, locale).length).toBeGreaterThan(3);
  });
});
