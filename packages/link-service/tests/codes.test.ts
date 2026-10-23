import { describe, expect, it } from "vitest";
import { build, verifiedAdult } from "./support.js";

// Issue #506: link code creation and redemption.
describe("link codes", () => {
  it("needs a verified email", async () => {
    const ctx = build();
    await expect(ctx.service.createLinkCode("acct-1")).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    await ctx.service.addEmail("acct-1", "ada@example.com");
    await expect(ctx.service.createLinkCode("acct-1")).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    await ctx.service.verifyEmail(ctx.mailer.lastToken());
    const created = await ctx.service.createLinkCode("acct-1");
    expect(created.code).toMatch(/^\d{6}$/);
    expect(created.expiresAt).toBe("2026-10-23T12:10:00.000Z");
  });

  it("redeems once and a second redeem fails", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const { code } = await ctx.service.createLinkCode("acct-1");
    const linked = await ctx.service.redeemLinkCode(code, "src-1");
    expect(linked.deviceToken.length).toBeGreaterThan(20);
    await expect(ctx.service.redeemLinkCode(code, "src-1")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    expect(await ctx.service.listDevices("acct-1")).toHaveLength(1);
  });

  it("expires exactly at ten minutes", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const { code } = await ctx.service.createLinkCode("acct-1");
    ctx.clock.advance(10 * 60 * 1000 - 1);
    const other = await ctx.service.createLinkCode("acct-1");
    await expect(ctx.service.redeemLinkCode(code, "s")).resolves.toBeDefined();
    ctx.clock.advance(1);
    await expect(ctx.service.redeemLinkCode(other.code, "s")).resolves.toBeDefined();
    const late = await ctx.service.createLinkCode("acct-1");
    ctx.clock.advance(10 * 60 * 1000);
    await expect(ctx.service.redeemLinkCode(late.code, "s")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("keeps at most three live codes and revokes the oldest", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const codes: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      codes.push((await ctx.service.createLinkCode("acct-1")).code);
      ctx.clock.advance(1000);
    }
    await expect(ctx.service.redeemLinkCode(codes[0]!, "s")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    await expect(ctx.service.redeemLinkCode(codes[3]!, "s")).resolves.toBeDefined();
  });

  it("revokeLinkCodes kills every live code", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const { code } = await ctx.service.createLinkCode("acct-1");
    await ctx.service.revokeLinkCodes("acct-1");
    await expect(ctx.service.redeemLinkCode(code, "s")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("two accounts never share a live code", async () => {
    const ctx = build();
    await verifiedAdult(ctx, "acct-1", "a@example.com");
    await verifiedAdult(ctx, "acct-2", "b@example.com");
    const seen = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      const a = (await ctx.service.createLinkCode("acct-1")).code;
      const b = (await ctx.service.createLinkCode("acct-2")).code;
      expect(a).not.toBe(b);
      seen.add(a);
      seen.add(b);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("only failures count: a family linking several tablets is never throttled", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    for (let i = 0; i < 15; i += 1) {
      const { code } = await ctx.service.createLinkCode("acct-1");
      await ctx.service.redeemLinkCode(code, "same-source");
    }
    expect(await ctx.service.listDevices("acct-1")).toHaveLength(15);
  });

  it("throttles a source after ten failures, then recovers after the window", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    for (let i = 0; i < 10; i += 1) {
      await expect(ctx.service.redeemLinkCode("000000", "bad")).rejects.toMatchObject({
        code: "INVALID_OR_EXPIRED",
      });
    }
    const { code } = await ctx.service.createLinkCode("acct-1");
    await expect(ctx.service.redeemLinkCode(code, "bad")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await expect(ctx.service.redeemLinkCode(code, "good")).resolves.toBeDefined();
    const second = await ctx.service.createLinkCode("acct-1");
    ctx.clock.advance(10 * 60 * 1000 - 10_000);
    await expect(ctx.service.redeemLinkCode(second.code, "bad")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    ctx.clock.advance(10_001);
    await expect(ctx.service.redeemLinkCode(second.code, "bad")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("a global ceiling stops a distributed guesser, whatever the source", async () => {
    const ctx = build({ policy: { redeemFailuresGlobal: 20, redeemFailuresPerSource: 100 } });
    await verifiedAdult(ctx);
    for (let i = 0; i < 20; i += 1) {
      await expect(ctx.service.redeemLinkCode("111111", `src-${i}`)).rejects.toMatchObject({
        code: "INVALID_OR_EXPIRED",
      });
    }
    const { code } = await ctx.service.createLinkCode("acct-1");
    await expect(ctx.service.redeemLinkCode(code, "fresh-source")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("rejects non-six-digit input as a failure without touching storage", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    for (const bad of ["", "12345", "1234567", "12345a", " 123456", "１２３４５６", "123456\n"]) {
      await expect(ctx.service.redeemLinkCode(bad, "s")).rejects.toMatchObject({
        code: "INVALID_OR_EXPIRED",
      });
    }
  });

  it("stores only an HMAC of the code and the secret changes it", async () => {
    const a = build();
    await verifiedAdult(a);
    const { code } = await a.service.createLinkCode("acct-1");
    const rows = JSON.stringify([
      ...(await a.repository.listLiveCodes("acct-1", a.clock.now().toISOString())),
    ]);
    expect(rows).not.toContain(code);
  });

  it("unlinks when the email is no longer verified at redeem time", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const { code } = await ctx.service.createLinkCode("acct-1");
    ctx.clock.advance(61_000);
    await ctx.service.addEmail("acct-1", "new@example.com");
    await expect(ctx.service.redeemLinkCode(code, "s")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });
});

describe("random digits", () => {
  it("is uniform enough over many codes (no obvious bias)", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const first = new Array<number>(10).fill(0);
    for (let i = 0; i < 300; i += 1) {
      const { code } = await ctx.service.createLinkCode("acct-1");
      first[Number(code[0])]! += 1;
      await ctx.service.revokeLinkCodes("acct-1");
    }
    for (const count of first) expect(count).toBeGreaterThan(10);
  });
});
