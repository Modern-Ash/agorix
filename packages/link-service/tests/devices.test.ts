import { describe, expect, it } from "vitest";
import { build, summary, verifiedAdult } from "./support.js";

async function linked(ctx: ReturnType<typeof build>, accountId = "acct-1") {
  await verifiedAdult(ctx, accountId, `${accountId}@example.com`);
  const { code } = await ctx.service.createLinkCode(accountId);
  return ctx.service.redeemLinkCode(code, `src-${accountId}`);
}

// Issue #507: device tokens.
describe("device tokens", () => {
  it("rotates on every use and keeps the previous token only for the grace period", async () => {
    const ctx = build();
    const first = await linked(ctx);
    const used = await ctx.service.resolveDevice(first.deviceToken);
    expect(used.deviceToken).not.toBe(first.deviceToken);
    ctx.clock.advance(30_000);
    const again = await ctx.service.resolveDevice(first.deviceToken); // lost response: still within grace
    expect(again.linkId).toBe(first.linkId);
    ctx.clock.advance(31_000);
    await expect(ctx.service.resolveDevice(first.deviceToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    await expect(ctx.service.resolveDevice(again.deviceToken)).resolves.toBeDefined();
  });

  it("expires after the idle and absolute limits", async () => {
    const idle = build();
    const a = await linked(idle);
    idle.clock.advance(60 * 24 * 60 * 60 * 1000);
    await expect(idle.service.resolveDevice(a.deviceToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });

    const abs = build();
    let token = (await linked(abs)).deviceToken;
    for (let i = 0; i < 4; i += 1) {
      abs.clock.advance(50 * 24 * 60 * 60 * 1000);
      if (i < 3) token = (await abs.service.resolveDevice(token)).deviceToken;
    }
    await expect(abs.service.resolveDevice(token)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("revoked, unknown and malformed tokens all fail the same way", async () => {
    const ctx = build();
    const { deviceToken, linkId } = await linked(ctx);
    await ctx.service.unlinkLink("acct-1", linkId);
    for (const token of [deviceToken, "nope", "", "a".repeat(500)]) {
      await expect(ctx.service.resolveDevice(token)).rejects.toMatchObject({
        code: "INVALID_OR_EXPIRED",
      });
    }
  });

  it("the device can unlink itself, and the adult can unlink only their own devices", async () => {
    const ctx = build();
    const mine = await linked(ctx, "acct-1");
    const theirs = await linked(ctx, "acct-2");
    await expect(ctx.service.unlinkLink("acct-1", theirs.linkId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(ctx.service.resolveDevice(theirs.deviceToken)).resolves.toBeDefined();
    await ctx.service.unlinkDevice(mine.deviceToken);
    await expect(ctx.service.resolveDevice(mine.deviceToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    const [device] = await ctx.service.listDevices("acct-1");
    expect(device?.unlinkedAt).toBeDefined();
    await expect(ctx.service.unlinkDevice(mine.deviceToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("lists only id, dates and flags: no ip, agent or fingerprint field exists", async () => {
    const ctx = build();
    await linked(ctx);
    const [device] = await ctx.service.listDevices("acct-1");
    expect(Object.keys(device!).sort()).toEqual([
      "createdAt",
      "lastSeenDay",
      "linkId",
      "syncEnabled",
    ]);
    expect(device!.lastSeenDay).toBe("2026-10-23");
  });

  it("records the last-seen day, never a time", async () => {
    const ctx = build();
    const first = await linked(ctx);
    ctx.clock.advance(2 * 24 * 60 * 60 * 1000);
    await ctx.service.resolveDevice(first.deviceToken);
    expect((await ctx.service.listDevices("acct-1"))[0]!.lastSeenDay).toBe("2026-10-25");
  });

  it("deleting the account revokes everything and leaves no rows", async () => {
    const ctx = build();
    const { deviceToken, linkId } = await linked(ctx);
    await ctx.service.resolveDevice(deviceToken);
    await ctx.service.putSummary(linkId, summary);
    expect(ctx.repository.rowCountFor("acct-1")).toBeGreaterThan(4);
    await ctx.service.deleteAccountData("acct-1");
    expect(ctx.repository.rowCountFor("acct-1")).toBe(0);
    await expect(ctx.service.resolveDevice(deviceToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("pruned: replaced tokens past grace do not pile up", async () => {
    const ctx = build();
    let token = (await linked(ctx)).deviceToken;
    for (let i = 0; i < 30; i += 1) {
      ctx.clock.advance(120_000);
      token = (await ctx.service.resolveDevice(token)).deviceToken;
    }
    expect(ctx.repository.rowCountFor("acct-1")).toBeLessThan(10);
  });
});
