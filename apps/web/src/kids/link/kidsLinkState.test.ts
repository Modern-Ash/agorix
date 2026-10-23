import { describe, expect, it } from "vitest";
import { parseLinkSummary } from "@agorix/link-service";
import { emptyKidsProgress, markMissionDone } from "../kidsProgress.js";
import { recordLinkedUsage, readUsageDays, KIDS_USAGE_DAYS_KEY } from "./kidsUsageDays.js";
import { KIDS_LINK_KEY, clearLink, loadLink, saveLink } from "./kidsLink.js";
import { buildLinkSummary } from "./kidsSync.js";
import { addActiveSeconds } from "../kidsAdults.js";

// Issues #511 and #512: what the child device keeps, and what it would upload.
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789_-AB";

function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("device link state", () => {
  it("round-trips a token and the sharing switch", () => {
    const s = memory();
    expect(loadLink(s)).toBeNull();
    expect(saveLink({ token: TOKEN, sharing: true }, s)).toBe(true);
    expect(loadLink(s)).toEqual({ token: TOKEN, sharing: true });
    saveLink({ token: TOKEN, sharing: false }, s);
    expect(loadLink(s)?.sharing).toBe(false);
    clearLink(s);
    expect(loadLink(s)).toBeNull();
  });

  it("rejects corrupt or hostile values", () => {
    for (const raw of [
      "{not json",
      "null",
      "[]",
      '{"token":5}',
      '{"token":"short"}',
      `{"token":"${TOKEN}!!"}`,
      `{"token":"${"a".repeat(300)}"}`,
    ]) {
      expect(loadLink(memory({ [KIDS_LINK_KEY]: raw })), raw).toBeNull();
    }
    expect(
      loadLink(memory({ [KIDS_LINK_KEY]: `{"token":"${TOKEN}","sharing":"no"}` }))?.sharing,
    ).toBe(true);
  });

  it("reports false when storage is blocked and never throws", () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(saveLink({ token: TOKEN, sharing: true }, blocked)).toBe(false);
    expect(saveLink({ token: TOKEN, sharing: true }, undefined)).toBe(false);
    expect(() => clearLink(blocked)).not.toThrow();
    expect(loadLink(blocked)).toBeNull();
  });
});

describe("daily usage trail exists only while linked", () => {
  it("writes nothing when not linked", () => {
    const s = memory();
    recordLinkedUsage("2026-10-23", 30, s);
    expect(s.data.has(KIDS_USAGE_DAYS_KEY)).toBe(false);
  });

  it("keeps 14 days, clamps and ignores junk when linked", () => {
    const s = memory();
    saveLink({ token: TOKEN, sharing: true }, s);
    for (let day = 1; day <= 20; day += 1) {
      recordLinkedUsage(`2026-10-${String(day).padStart(2, "0")}`, 60, s);
    }
    recordLinkedUsage("2026-10-20", 90_000, s);
    recordLinkedUsage("bad-day", 10, s);
    recordLinkedUsage("2026-10-21", -5, s);
    recordLinkedUsage("2026-10-21", Number.NaN, s);
    const days = readUsageDays(s);
    expect(Object.keys(days)).toHaveLength(14);
    expect(Object.keys(days)[0]).toBe("2026-10-07");
    expect(days["2026-10-20"]).toBeLessThanOrEqual(86_400);
    expect(readUsageDays(memory({ [KIDS_USAGE_DAYS_KEY]: "[1,2]" }))).toEqual({});
  });

  it("addActiveSeconds feeds it through the existing usage tick", () => {
    const s = memory();
    saveLink({ token: TOKEN, sharing: true }, s);
    addActiveSeconds(45, "2026-10-23", s as unknown as Storage);
    expect(readUsageDays(s)["2026-10-23"]).toBe(45);
    const unlinked = memory();
    addActiveSeconds(45, "2026-10-23", unlinked as unknown as Storage);
    expect(unlinked.data.has(KIDS_USAGE_DAYS_KEY)).toBe(false);
  });
});

describe("the uploaded summary", () => {
  const settings = {
    oriSuggestions: true,
    readAloud: true,
    dailyLimitMinutes: 45,
    ageBand: "9-12",
  } as const;

  it("is exactly the adults-panel aggregates plus minutes, and passes the server schema", () => {
    let progress = markMissionDone(emptyKidsProgress(), "space", 0);
    progress = markMissionDone(progress, "ocean", 1);
    const summary = buildLinkSummary({
      progress,
      events: [],
      settings,
      usageDays: { "2026-10-22": 600, "2026-10-21": 125, "2026-10-23": 59 },
    });
    expect(summary).toEqual({
      version: 1,
      completedMissions: 2,
      practicedConcepts: [1, 1, 0],
      decisions: { used: 0, changed: 0, rejected: 0 },
      minutesByDay: [
        { day: "2026-10-21", minutes: 2 },
        { day: "2026-10-22", minutes: 10 },
        { day: "2026-10-23", minutes: 0 },
      ],
      ageBand: "9-12",
      dailyLimitMinutes: 45,
    });
    expect(parseLinkSummary(summary)).toEqual(summary);
  });

  it("has a fixed set of keys: adding a field must be a deliberate, reviewed change", () => {
    const summary = buildLinkSummary({
      progress: emptyKidsProgress(),
      events: [],
      settings,
      usageDays: {},
    });
    expect(Object.keys(summary).sort()).toEqual([
      "ageBand",
      "completedMissions",
      "dailyLimitMinutes",
      "decisions",
      "minutesByDay",
      "practicedConcepts",
      "version",
    ]);
    const text = JSON.stringify(summary);
    expect(text).not.toMatch(/avatar|project|chat|image|audio|timestamp|email|name/i);
  });

  it("stays valid at the extremes", () => {
    const progress = {
      ...emptyKidsProgress(),
      done: Object.fromEntries(
        ["space", "ocean", "robots", "city"].flatMap((w) =>
          [0, 1, 2].map((i) => [`${w}:${i}`, true as const]),
        ),
      ),
    };
    const summary = buildLinkSummary({
      progress,
      events: [],
      settings: { ...settings, dailyLimitMinutes: 120 },
      usageDays: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          `2026-10-${String(i + 1).padStart(2, "0")}`,
          999_999,
        ]),
      ),
    });
    expect(summary.completedMissions).toBe(12);
    expect(summary.minutesByDay).toHaveLength(14);
    expect(() => parseLinkSummary(summary)).not.toThrow();
  });
});
