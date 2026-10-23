import { describe, expect, it } from "vitest";
import { createDevBackend } from "../../dev/devBackend.js";
import { createInProcessFetch } from "../../dev/inProcessFetch.js";
import { createLinkApi, isLinkApiError, type DeviceSummary } from "./linkApi.js";

// Issues #509 to #513: the web client against the real project API.
const PASSWORD = "correct horse battery";
const summary: DeviceSummary = {
  version: 1,
  completedMissions: 2,
  practicedConcepts: [1, 1, 0],
  decisions: { used: 1, changed: 0, rejected: 0 },
  minutesByDay: [{ day: "2026-10-22", minutes: 10 }],
  ageBand: "6-8",
  dailyLimitMinutes: 30,
};

function world() {
  const backend = createDevBackend();
  const adultFetch = createInProcessFetch(backend);
  const deviceFetch = createInProcessFetch(backend);
  return {
    adult: createLinkApi({ fetch: adultFetch.fetch }),
    device: createLinkApi({ fetch: deviceFetch.fetch }),
    backend,
    adultFetch,
    async mailToken(): Promise<string> {
      const res = await adultFetch.fetch("/v1/__dev/mail", {
        method: "GET",
        headers: {},
        credentials: "same-origin",
      });
      return (JSON.parse(await res.text()) as { token: string }).token;
    },
  };
}

let n = 0;
const alias = () => `adult-${Date.now().toString(36)}-${++n}`;

describe("link api (issues #509 to #513)", () => {
  it("registers with an email, verifies it, links a device and syncs a summary", async () => {
    const w = world();
    expect(await w.adult.available()).toBe(true);
    const me = alias();
    expect((await w.adult.register(me, PASSWORD, "Ada@Example.com")).alias).toBe(me);
    expect(await w.adult.emailStatus()).toEqual({ present: true, verified: false });
    await expect(w.adult.createCode()).rejects.toMatchObject({ kind: "email-not-verified" });

    await w.device.verifyEmail(await w.mailToken());
    expect(await w.adult.emailStatus()).toEqual({ present: true, verified: true });

    const { code, expiresAt } = await w.adult.createCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());

    const redeemed = await w.device.redeem(code);
    const put = await w.device.putSummary(redeemed.deviceToken, summary);
    expect(put.stored).toBe(true);
    expect(put.deviceToken).not.toBe(redeemed.deviceToken);

    const devices = await w.adult.listDevices();
    expect(devices).toHaveLength(1);
    expect(Object.keys(devices[0]!).sort()).toEqual([
      "createdAt",
      "lastSeenDay",
      "linkId",
      "syncEnabled",
    ]);
    expect((await w.adult.summaries())[0]!.summary.completedMissions).toBe(2);

    await w.adult.setSync(devices[0]!.linkId, false);
    expect((await w.device.putSummary(put.deviceToken, summary)).stored).toBe(false);
    await w.adult.unlink(devices[0]!.linkId);
    expect((await w.adult.listDevices())[0]!.unlinkedAt).toBeDefined();
    expect((await w.adult.listDevices())[0]!.summaryDeletesAt).toBeDefined();
  });

  it("maps failures to calm, generic kinds", async () => {
    const w = world();
    const me = alias();
    await w.adult.register(me, PASSWORD, "bob@example.com");
    await w.adult.signOut();
    await expect(w.adult.signIn(me, "wrong password here")).rejects.toMatchObject({
      kind: "invalid-credentials",
    });
    await expect(w.adult.register(me, PASSWORD, "x@example.com")).rejects.toMatchObject({
      kind: "username-taken",
    });
    await expect(w.adult.register(alias(), "short", "x@example.com")).rejects.toMatchObject({
      kind: "weak-password",
    });
    await expect(w.adult.emailStatus()).rejects.toMatchObject({ kind: "unauthenticated" });
    expect(await w.adult.restore()).toBeNull();
    await w.adult.signIn(me, PASSWORD);
    await expect(w.adult.setEmail("not an email")).rejects.toMatchObject({ kind: "invalid-email" });
    await expect(w.device.redeem("000000")).rejects.toMatchObject({ kind: "invalid-code" });
    await expect(w.device.putSummary("no-such-token", summary)).rejects.toMatchObject({
      kind: "unauthenticated",
    });
  });

  it("reports offline as a kind, never a raw error, and 'unavailable' when the service is absent", async () => {
    const w = world();
    w.adultFetch.setOffline(true);
    await expect(w.adult.emailStatus()).rejects.toMatchObject({ kind: "offline" });
    expect(await w.adult.available()).toBe(false);
    const absent = createLinkApi({
      fetch: async () => ({
        status: 404,
        text: async () => JSON.stringify({ error: { code: "NOT_FOUND" } }),
      }),
    });
    expect(await absent.available()).toBe(false);
    const html = createLinkApi({
      fetch: async () => ({ status: 200, text: async () => "<html>" }),
    });
    await expect(html.createCode()).rejects.toMatchObject({ kind: "unavailable" });
    expect(isLinkApiError(new Error("x"))).toBe(false);
  });

  it("serialises adult calls so the rotating session never races", async () => {
    const w = world();
    await w.adult.register(alias(), PASSWORD, "carol@example.com");
    const results = await Promise.all(Array.from({ length: 8 }, () => w.adult.emailStatus()));
    expect(results.every((r) => r.present)).toBe(true);
  });
});
