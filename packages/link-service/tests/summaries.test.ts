import { describe, expect, it } from "vitest";
import { LinkError, parseLinkSummary } from "../src/index.js";
import { build, summary, verifiedAdult } from "./support.js";

async function linked(ctx: ReturnType<typeof build>) {
  await verifiedAdult(ctx);
  const { code } = await ctx.service.createLinkCode("acct-1");
  return ctx.service.redeemLinkCode(code, "src");
}

// Issue #508: summaries, retention and deletion.
describe("summary schema", () => {
  it("accepts the documented shape", () => {
    expect(parseLinkSummary(structuredClone(summary))).toEqual(summary);
  });

  const mutations: Record<string, (s: Record<string, unknown>) => void> = {
    "extra key": (s) => (s["notes"] = "hi"),
    "free text in a number slot": (s) => (s["completedMissions"] = "three"),
    "image data": (s) => (s["avatarImage"] = "data:image/png;base64,AAAA"),
    "project contents": (s) => (s["program"] = { scripts: [] }),
    "event timestamps": (s) => (s["events"] = [{ at: "2026-10-23T12:00:00Z" }]),
    "missions out of range": (s) => (s["completedMissions"] = 13),
    "fractional count": (s) => (s["completedMissions"] = 1.5),
    "negative count": (s) => (s["completedMissions"] = -1),
    "wrong concept tuple": (s) => (s["practicedConcepts"] = [1, 2]),
    "concept out of range": (s) => (s["practicedConcepts"] = [1, 2, 5]),
    "decisions with extra": (s) =>
      (s["decisions"] = { used: 1, changed: 0, rejected: 0, text: "x" }),
    "too many days": (s) =>
      (s["minutesByDay"] = Array.from({ length: 15 }, (_, i) => ({
        day: `2026-10-${String(i + 1).padStart(2, "0")}`,
        minutes: 1,
      }))),
    "duplicate day": (s) =>
      (s["minutesByDay"] = [
        { day: "2026-10-22", minutes: 1 },
        { day: "2026-10-22", minutes: 2 },
      ]),
    "impossible day": (s) => (s["minutesByDay"] = [{ day: "2026-02-31", minutes: 1 }]),
    "day with time": (s) => (s["minutesByDay"] = [{ day: "2026-10-22T10:00:00Z", minutes: 1 }]),
    "minutes over a day": (s) => (s["minutesByDay"] = [{ day: "2026-10-22", minutes: 1441 }]),
    "unknown band": (s) => (s["ageBand"] = "teen"),
    "limit out of range": (s) => (s["dailyLimitMinutes"] = 5),
    "wrong version": (s) => (s["version"] = 2),
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    it(`rejects ${name}`, () => {
      const copy = structuredClone(summary) as unknown as Record<string, unknown>;
      mutate(copy);
      expect(() => parseLinkSummary(copy)).toThrow(LinkError);
    });
  }

  it("rejects non-objects", () => {
    for (const value of [null, undefined, 3, "x", [], [summary]]) {
      expect(() => parseLinkSummary(value)).toThrow(LinkError);
    }
  });
});

describe("summary storage", () => {
  it("stores the latest summary and the adult reads it", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    expect(await ctx.service.putSummary(linkId, summary)).toBe(true);
    ctx.clock.advance(1000);
    expect(await ctx.service.putSummary(linkId, { ...summary, completedMissions: 4 })).toBe(true);
    const views = await ctx.service.getSummaries("acct-1");
    expect(views).toHaveLength(1);
    expect(views[0]!.summary.completedMissions).toBe(4);
  });

  it("an invalid upload stores nothing", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    await expect(ctx.service.putSummary(linkId, { ...summary, note: "x" })).rejects.toBeInstanceOf(
      LinkError,
    );
    expect(await ctx.service.getSummaries("acct-1")).toEqual([]);
  });

  it("sync off drops uploads; sync on resumes", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    await ctx.service.setSyncEnabled("acct-1", linkId, false);
    expect(await ctx.service.putSummary(linkId, summary)).toBe(false);
    expect(await ctx.service.getSummaries("acct-1")).toEqual([]);
    await ctx.service.setSyncEnabled("acct-1", linkId, true);
    expect(await ctx.service.putSummary(linkId, summary)).toBe(true);
    await expect(ctx.service.setSyncEnabled("someone-else", linkId, false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("an unlinked device cannot upload", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    await ctx.service.unlinkLink("acct-1", linkId);
    await expect(ctx.service.putSummary(linkId, summary)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });
});

describe("30-day retention after unlink", () => {
  it("keeps the summary readable on day 29 and deletes it on day 31", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    await ctx.service.putSummary(linkId, summary);
    await ctx.service.unlinkLink("acct-1", linkId);
    const [device] = await ctx.service.listDevices("acct-1");
    expect(device?.summaryDeletesAt).toBe("2026-11-22T12:00:00.000Z");

    ctx.clock.advance(29 * 24 * 60 * 60 * 1000);
    expect(await ctx.service.purgeExpired()).toEqual({ purgedLinks: 0 });
    expect(await ctx.service.getSummaries("acct-1")).toHaveLength(1);

    ctx.clock.advance(2 * 24 * 60 * 60 * 1000);
    expect(await ctx.service.purgeExpired()).toEqual({ purgedLinks: 1 });
    expect(await ctx.service.getSummaries("acct-1")).toEqual([]);
    expect(await ctx.service.listDevices("acct-1")).toEqual([]);
  });

  it("a rerun is a no-op and active devices are never purged", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    await ctx.service.putSummary(linkId, summary);
    ctx.clock.advance(400 * 24 * 60 * 60 * 1000);
    expect(await ctx.service.purgeExpired()).toEqual({ purgedLinks: 0 });
    expect(await ctx.service.getSummaries("acct-1")).toHaveLength(1);
    await ctx.service.unlinkLink("acct-1", linkId);
    ctx.clock.advance(31 * 24 * 60 * 60 * 1000);
    expect(await ctx.service.purgeExpired()).toEqual({ purgedLinks: 1 });
    expect(await ctx.service.purgeExpired()).toEqual({ purgedLinks: 0 });
  });

  it("deleting the account is immediate, with no waiting period", async () => {
    const ctx = build();
    const { linkId } = await linked(ctx);
    await ctx.service.putSummary(linkId, summary);
    await ctx.service.unlinkLink("acct-1", linkId);
    await ctx.service.deleteAccountData("acct-1");
    expect(await ctx.service.getSummaries("acct-1")).toEqual([]);
    expect(ctx.repository.rowCountFor("acct-1")).toBe(0);
  });
});
