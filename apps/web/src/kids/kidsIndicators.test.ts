import { describe, expect, it } from "vitest";
import {
  bumpIndicator,
  clearIndicators,
  INDICATOR_COUNTERS,
  INDICATORS_RETENTION_DAYS,
  KIDS_INDICATORS_KEY,
  loadIndicators,
  readIndicators,
  summarizeIndicators,
} from "./kidsIndicators.js";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe("learning indicators", () => {
  it("keeps whole-number counters per day and nothing else", () => {
    const store = memory();
    bumpIndicator("runs", 1, store, "2026-10-27");
    bumpIndicator("runs", 1, store, "2026-10-27");
    bumpIndicator("hints", 3, store, "2026-10-27");
    const stored = JSON.parse(store.data.get(KIDS_INDICATORS_KEY)!);
    expect(Object.keys(stored)).toEqual(["days"]);
    expect(Object.keys(stored.days["2026-10-27"]).sort()).toEqual([...INDICATOR_COUNTERS].sort());
    expect(stored.days["2026-10-27"].runs).toBe(2);
    expect(JSON.stringify(stored)).not.toMatch(/[a-z]{4,}\s[a-z]{4,}/i);
  });

  it("drops days past the retention window", () => {
    const store = memory();
    bumpIndicator("runs", 1, store, "2026-10-01");
    bumpIndicator("runs", 1, store, "2026-10-27");
    const days = Object.keys(loadIndicators(store).days);
    expect(days).toEqual(["2026-10-27"]);
    bumpIndicator("runs", 1, store, "2026-10-20");
    expect(INDICATORS_RETENTION_DAYS).toBe(14);
  });

  it("does not trust stored data", () => {
    const hostile = {
      days: {
        "2026-10-27": { runs: -4, hints: 2.5, predictions: "7", oriFallbacks: 1e12, extra: 9 },
        "not a day": { runs: 1 },
        "2026-10-26": "x",
      },
      note: "free text",
    };
    const read = readIndicators(hostile);
    expect(Object.keys(read.days)).toEqual(["2026-10-27"]);
    expect(read.days["2026-10-27"]).toMatchObject({
      runs: 0,
      hints: 0,
      predictions: 0,
      oriFallbacks: 9_999,
    });
    expect("extra" in read.days["2026-10-27"]!).toBe(false);
    expect(readIndicators("nope")).toEqual({ days: {} });
    expect(readIndicators(null)).toEqual({ days: {} });
  });

  it("summarizes the last seven days with definitions that can be checked by hand", () => {
    const store = memory();
    for (const [name, amount] of [
      ["runs", 10],
      ["independentRuns", 6],
      ["completedRuns", 8],
      ["hints", 5],
      ["predictions", 4],
      ["predictionsMatched", 3],
    ] as const) {
      bumpIndicator(name, amount, store, "2026-10-25");
    }
    bumpIndicator("runs", 10, store, "2026-10-12");
    const summary = summarizeIndicators(loadIndicators(store), 7, "2026-10-27");
    expect(summary.days).toBe(1);
    expect(summary.independentPercent).toBe(60);
    expect(summary.completedPercent).toBe(80);
    expect(summary.predictionPercent).toBe(75);
    expect(summary.hintsPerRun).toBe(0.5);
    const empty = summarizeIndicators({ days: {} }, 7, "2026-10-27");
    expect(empty.independentPercent).toBeNull();
    expect(empty.hintsPerRun).toBeNull();
  });

  it("clears on request and never throws without storage", () => {
    const store = memory();
    bumpIndicator("runs", 1, store, "2026-10-27");
    clearIndicators(store);
    expect(loadIndicators(store).days).toEqual({});
    expect(() => bumpIndicator("runs", 1, undefined)).not.toThrow();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => bumpIndicator("runs", 1, broken)).not.toThrow();
    expect(loadIndicators(broken)).toEqual({ days: {} });
  });
});
