import { describe, expect, it } from "vitest";
import { EVIDENCE_EVENT_SCHEMA_VERSION, validateEvidenceEvent } from "@agorix/learning-evidence";
import { emptyKidsProgress, markMissionDone } from "./kidsProgress.js";
import {
  addActiveSeconds,
  adultSummary,
  loadAdultSettings,
  readTodaySeconds,
  saveAdultSettings,
} from "./kidsAdults.js";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
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

describe("Kids adults data (#377)", () => {
  it("keeps only daily aggregate usage and resets at the local day boundary", () => {
    const storage = memoryStorage();
    addActiveSeconds(35, "2026-10-21", storage);
    addActiveSeconds(30, "2026-10-21", storage);
    expect(readTodaySeconds("2026-10-21", storage)).toBe(65);
    expect(readTodaySeconds("2026-10-22", storage)).toBe(0);
    addActiveSeconds(10, "2026-10-22", storage);
    expect(readTodaySeconds("2026-10-22", storage)).toBe(10);
    expect(JSON.stringify(storage)).not.toContain("2026-10-21T");
  });

  it("validates saved adult settings", () => {
    const storage = memoryStorage();
    expect(loadAdultSettings(storage)).toEqual({
      oriSuggestions: true,
      readAloud: true,
      dailyLimitMinutes: 30,
      ageBand: "6-8",
      bandChosen: false,
    });
    saveAdultSettings(
      {
        oriSuggestions: false,
        readAloud: false,
        dailyLimitMinutes: 45,
        ageBand: "6-8",
        bandChosen: true,
      },
      storage,
    );
    expect(loadAdultSettings(storage).dailyLimitMinutes).toBe(45);
    storage.setItem("agorix.kids.adults.v1", JSON.stringify({ dailyLimitMinutes: 999 }));
    expect(loadAdultSettings(storage).dailyLimitMinutes).toBe(30);
  });

  it("reports real completions separately from learning evidence", () => {
    const progress = markMissionDone(emptyKidsProgress(), "space", 0);
    const report = adultSummary(progress, []);
    expect(report.completedMissions).toBe(1);
    expect(report.practicedConcepts).toEqual([1, 0, 0]);
    expect(report.decisions).toEqual({ used: 0, changed: 0, rejected: 0 });
    expect(report.understandingObserved).toBe(false);
    const decision = validateEvidenceEvent({
      schema: EVIDENCE_EVENT_SCHEMA_VERSION,
      id: "decision-1",
      sequence: 1,
      assistanceLevel: "proposed",
      kind: "proposalDecided",
      decision: "modify",
      inspectedDiff: true,
      testedWithRuntime: true,
      challengedCompanion: false,
    });
    const withDecision = adultSummary(progress, [decision]);
    expect(withDecision.decisions).toEqual({ used: 0, changed: 1, rejected: 0 });
    expect(withDecision.completedMissions).toBe(1);
  });

  it("stores the age band, defaults old settings to 6-8 and rejects invalid values (issue #453)", () => {
    const storage = memoryStorage();
    saveAdultSettings(
      { oriSuggestions: true, readAloud: true, dailyLimitMinutes: 30, ageBand: "9-12" },
      storage,
    );
    expect(loadAdultSettings(storage).ageBand).toBe("9-12");
    for (const bad of ['"teen"', "7", "null", '["6-8"]']) {
      storage.setItem(
        "agorix.kids.adults.v1",
        `{"oriSuggestions":true,"readAloud":true,"dailyLimitMinutes":30,"ageBand":${bad}}`,
      );
      expect(loadAdultSettings(storage).ageBand).toBe("6-8");
    }
    storage.setItem(
      "agorix.kids.adults.v1",
      '{"oriSuggestions":false,"readAloud":true,"dailyLimitMinutes":45}',
    );
    expect(loadAdultSettings(storage)).toEqual({
      oriSuggestions: false,
      readAloud: true,
      dailyLimitMinutes: 45,
      ageBand: "6-8",
      // Settings saved before the band was asked for count as already chosen (issue #608).
      bandChosen: true,
    });
  });
});
