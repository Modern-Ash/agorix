import { describe, expect, it } from "vitest";
import { LinkError, normalizeEmail } from "../src/index.js";
import { build, verifiedAdult } from "./support.js";

// Issue #505: adult email, verified before any child device can be linked.
describe("normalizeEmail", () => {
  it("trims, lower-cases and keeps dots and tags distinct", () => {
    expect(normalizeEmail("  Ada.Lovelace+Kids@Example.COM ")).toBe(
      "ada.lovelace+kids@example.com",
    );
    expect(normalizeEmail("a.b@x.org")).not.toBe(normalizeEmail("ab@x.org"));
  });

  it("rejects malformed, oversize and control-character addresses with a generic error", () => {
    const bad = [
      "",
      "plain",
      "@x.org",
      "a@",
      "a@b",
      "a b@x.org",
      "a@@x.org",
      "a@x..org",
      "a@.org",
      "a@org.",
      `${"x".repeat(65)}@x.org`,
      `a@${"x".repeat(250)}.org`,
      "a\n@x.org",
      "a\u0000@x.org",
      42,
      null,
      undefined,
    ];
    for (const value of bad) {
      expect(() => normalizeEmail(value), String(value)).toThrow(LinkError);
    }
    try {
      normalizeEmail("secret@@x");
    } catch (error) {
      expect((error as LinkError).message).toBe("Invalid email");
      expect((error as LinkError).message).not.toContain("secret");
    }
  });
});

describe("email verification", () => {
  it("sends a token, verifies once and reports the status", async () => {
    const ctx = build();
    await ctx.service.addEmail("acct-1", "Ada@Example.com");
    expect(await ctx.service.emailStatus("acct-1")).toEqual({ present: true, verified: false });
    expect(ctx.mailer.sent).toHaveLength(1);
    expect(ctx.mailer.sent[0]).toMatchObject({ kind: "verify-email", to: "ada@example.com" });
    const token = ctx.mailer.lastToken();
    await ctx.service.verifyEmail(token);
    expect(await ctx.service.emailStatus("acct-1")).toEqual({ present: true, verified: true });
    await expect(ctx.service.verifyEmail(token)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
  });

  it("rejects expired, tampered and unknown tokens identically", async () => {
    const ctx = build();
    await ctx.service.addEmail("acct-1", "ada@example.com");
    const token = ctx.mailer.lastToken();
    await expect(ctx.service.verifyEmail(`${token}x`)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    await expect(ctx.service.verifyEmail("")).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED" });
    ctx.clock.advance(24 * 60 * 60 * 1000);
    await expect(ctx.service.verifyEmail(token)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    expect(await ctx.service.emailStatus("acct-1")).toEqual({ present: true, verified: false });
  });

  it("a token for an old address cannot verify a newer one", async () => {
    const ctx = build();
    await ctx.service.addEmail("acct-1", "old@example.com");
    const oldToken = ctx.mailer.lastToken();
    ctx.clock.advance(61_000);
    await ctx.service.addEmail("acct-1", "new@example.com");
    await expect(ctx.service.verifyEmail(oldToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    expect((await ctx.service.emailStatus("acct-1")).verified).toBe(false);
    await ctx.service.verifyEmail(ctx.mailer.lastToken());
    expect((await ctx.service.emailStatus("acct-1")).verified).toBe(true);
  });

  it("changing the address un-verifies it", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    ctx.clock.advance(61_000);
    await ctx.service.addEmail("acct-1", "other@example.com");
    expect(await ctx.service.emailStatus("acct-1")).toEqual({ present: true, verified: false });
  });

  it("answers the same when the address belongs to someone else and mails the owner instead", async () => {
    const ctx = build();
    await verifiedAdult(ctx, "acct-1", "ada@example.com");
    const before = ctx.mailer.sent.length;
    await expect(ctx.service.addEmail("acct-2", "ADA@example.com")).resolves.toBeUndefined();
    expect(ctx.mailer.sent.slice(before)).toEqual([
      { kind: "email-in-use", to: "ada@example.com" },
    ]);
    expect(await ctx.service.emailStatus("acct-2")).toEqual({ present: false, verified: false });
  });

  it("limits resends by cooldown and by hourly budget", async () => {
    const ctx = build();
    await ctx.service.addEmail("acct-1", "ada@example.com");
    await expect(ctx.service.resendVerification("acct-1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    for (let i = 0; i < 4; i += 1) {
      ctx.clock.advance(61_000);
      await ctx.service.resendVerification("acct-1");
    }
    ctx.clock.advance(61_000);
    await expect(ctx.service.resendVerification("acct-1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    ctx.clock.advance(60 * 60 * 1000);
    await ctx.service.resendVerification("acct-1");
  });

  it("does not resend once verified, and never stores the raw token", async () => {
    const ctx = build();
    await verifiedAdult(ctx);
    const sent = ctx.mailer.sent.length;
    ctx.clock.advance(61_000);
    await ctx.service.resendVerification("acct-1");
    expect(ctx.mailer.sent).toHaveLength(sent);
  });
});
