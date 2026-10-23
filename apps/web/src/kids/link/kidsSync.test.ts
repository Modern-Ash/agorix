import { describe, expect, it } from "vitest";
import { LinkApiError, type DeviceSummary } from "./linkApi.js";
import { KIDS_LINK_KEY, loadLink, saveLink } from "./kidsLink.js";
import { createSyncScheduler, syncOnce, type SyncResult } from "./kidsSync.js";

// Issue #512: silent, debounced, token-safe sync.
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789_-AB";
const NEXT = "ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210_-ab";
const summary: DeviceSummary = {
  version: 1,
  completedMissions: 0,
  practicedConcepts: [0, 0, 0],
  decisions: { used: 0, changed: 0, rejected: 0 },
  minutesByDay: [],
  ageBand: "6-8",
  dailyLimitMinutes: 30,
};

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("syncOnce", () => {
  it("does nothing when unlinked or when sharing is switched off on the device", async () => {
    const s = memory();
    let calls = 0;
    const api = { putSummary: async () => (calls++, { deviceToken: NEXT, stored: true }) };
    expect(await syncOnce({ api, summary: () => summary, storage: s })).toBe("skipped");
    saveLink({ token: TOKEN, sharing: false }, s);
    expect(await syncOnce({ api, summary: () => summary, storage: s })).toBe("skipped");
    expect(calls).toBe(0);
  });

  it("stores the rotated token or the link would be lost", async () => {
    const s = memory();
    saveLink({ token: TOKEN, sharing: true }, s);
    const seen: string[] = [];
    const api = {
      putSummary: async (token: string) => (seen.push(token), { deviceToken: NEXT, stored: true }),
    };
    expect(await syncOnce({ api, summary: () => summary, storage: s })).toBe("stored");
    expect(loadLink(s)?.token).toBe(NEXT);
    await syncOnce({ api, summary: () => summary, storage: s });
    expect(seen).toEqual([TOKEN, NEXT]);
  });

  it("reports sync-off when the adult paused it and keeps the link", async () => {
    const s = memory();
    saveLink({ token: TOKEN, sharing: true }, s);
    const api = { putSummary: async () => ({ deviceToken: NEXT, stored: false }) };
    expect(await syncOnce({ api, summary: () => summary, storage: s })).toBe("sync-off");
    expect(loadLink(s)?.token).toBe(NEXT);
  });

  it("clears the link quietly when the adult unlinked it (401)", async () => {
    const s = memory();
    saveLink({ token: TOKEN, sharing: true }, s);
    const api = {
      putSummary: async () => {
        throw new LinkApiError("unauthenticated");
      },
    };
    expect(await syncOnce({ api, summary: () => summary, storage: s })).toBe("unlinked");
    expect(s.data.has(KIDS_LINK_KEY)).toBe(false);
  });

  it("keeps the link and asks to retry on offline, transient or unknown failures", async () => {
    for (const kind of ["offline", "transient", "rate-limited", "unavailable"] as const) {
      const s = memory();
      saveLink({ token: TOKEN, sharing: true }, s);
      const api = {
        putSummary: async () => {
          throw new LinkApiError(kind);
        },
      };
      expect(await syncOnce({ api, summary: () => summary, storage: s })).toBe("retry");
      expect(loadLink(s)?.token).toBe(TOKEN);
    }
    const s = memory();
    saveLink({ token: TOKEN, sharing: true }, s);
    const weird = {
      putSummary: async () => {
        throw new Error("boom");
      },
    };
    await expect(syncOnce({ api: weird, summary: () => summary, storage: s })).resolves.toBe(
      "retry",
    );
  });
});

describe("sync scheduler", () => {
  function harness(minIntervalMs = 300_000) {
    let now = 0;
    const timers: { at: number; fn: () => void; id: number }[] = [];
    let id = 0;
    const runs: number[] = [];
    let outcome: SyncResult = "stored";
    const scheduler = createSyncScheduler({
      run: async () => (runs.push(now), outcome),
      minIntervalMs,
      retryMs: 60_000,
      now: () => now,
      setTimer: (fn, ms) => (timers.push({ at: now + ms, fn, id: ++id }), id),
      clearTimer: (handle) => {
        const index = timers.findIndex((t) => t.id === handle);
        if (index >= 0) timers.splice(index, 1);
      },
    });
    const advance = async (ms: number) => {
      now += ms;
      for (const timer of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
      await Promise.resolve();
      await Promise.resolve();
    };
    return { scheduler, runs, advance, setOutcome: (o: SyncResult) => (outcome = o), timers };
  }

  it("runs the first request at once, then at most once per interval however many requests arrive", async () => {
    const h = harness();
    h.scheduler.request();
    await h.advance(0);
    expect(h.runs).toEqual([0]);
    for (let i = 0; i < 20; i += 1) h.scheduler.request();
    expect(h.runs).toHaveLength(1);
    expect(h.timers).toHaveLength(1);
    await h.advance(299_999);
    expect(h.runs).toHaveLength(1);
    await h.advance(1);
    expect(h.runs).toEqual([0, 300_000]);
  });

  it("force skips the wait (right after linking)", async () => {
    const h = harness();
    h.scheduler.request();
    await h.advance(0);
    h.scheduler.request();
    h.scheduler.request({ force: true });
    await h.advance(0);
    expect(h.runs).toHaveLength(2);
  });

  it("retries after a minute when the attempt asked for it, and stops on dispose", async () => {
    const h = harness();
    h.setOutcome("retry");
    h.scheduler.request();
    await h.advance(0);
    expect(h.runs).toHaveLength(1);
    await h.advance(60_000);
    expect(h.runs).toHaveLength(2);
    h.scheduler.dispose();
    await h.advance(600_000);
    expect(h.runs).toHaveLength(2);
    h.scheduler.request({ force: true });
    await h.advance(0);
    expect(h.runs).toHaveLength(2);
  });
});
