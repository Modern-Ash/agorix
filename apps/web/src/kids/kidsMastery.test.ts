import { describe, expect, it } from "vitest";
import { KIDS_MASTERY_KEY, loadKidsMastery, recordMastery } from "./kidsMastery.js";

// Issue #610: evidence is kept on the device as counters only, and a broken store changes nothing.
function memory(initial?: string) {
  const data = new Map<string, string>(initial ? [[KIDS_MASTERY_KEY, initial]] : []);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const run = {
  kind: "run" as const,
  concepts: ["programming.repetition" as const],
  completed: true,
  helped: false,
  free: false,
};

describe("kept mastery", () => {
  it("adds evidence run after run and survives a reload", () => {
    const store = memory();
    recordMastery(run, store, "2026-10-26");
    recordMastery(run, store, "2026-10-27");
    expect(loadKidsMastery(store).concepts["programming.repetition"].stage).toBe(3);
  });

  it("keeps only counters, stages and changes: no program, name, text or id", () => {
    const store = memory();
    recordMastery(run, store, "2026-10-26");
    const raw = store.data.get(KIDS_MASTERY_KEY)!;
    expect(Object.keys(JSON.parse(raw))).toEqual(["version", "concepts"]);
    expect(raw).not.toMatch(/scripts|statements|name|text|project|actor/i);
  });

  it("reads a damaged store as empty and never throws, with or without storage", () => {
    expect(loadKidsMastery(memory("{not json")).concepts["programming.repetition"].stage).toBe(0);
    expect(loadKidsMastery(undefined).concepts["programming.repetition"].stage).toBe(0);
    expect(() => recordMastery(run, undefined, "2026-10-26")).not.toThrow();
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => recordMastery(run, failing, "2026-10-26")).not.toThrow();
  });
});
