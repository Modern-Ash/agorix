import { describe, expect, it } from "vitest";
import { createDevBackend } from "../../dev/devBackend.js";
import { createInProcessFetch } from "../../dev/inProcessFetch.js";
import { createLinkApi } from "../link/linkApi.js";
import { createGroupApi, isGroupApiError } from "./groupApi.js";

// Issue #566: the web client against the real project API and group service.
const PASSWORD = "correct horse battery";

function world() {
  const backend = createDevBackend();
  const adultFetch = createInProcessFetch(backend);
  const deviceFetch = createInProcessFetch(backend);
  const link = createLinkApi({ fetch: adultFetch.fetch });
  return {
    link,
    adult: createGroupApi({ fetch: adultFetch.fetch }),
    device: createGroupApi({ fetch: deviceFetch.fetch }),
    async verifiedAdult(name: string) {
      await link.register(name, PASSWORD, `${name}@example.com`);
      const res = await adultFetch.fetch("/v1/__dev/mail", {
        method: "GET",
        headers: {},
        credentials: "same-origin",
      });
      const { token } = JSON.parse(await res.text()) as { token: string };
      await link.verifyEmail(token);
    },
  };
}

let n = 0;
const alias = () => `org-${Date.now().toString(36)}-${++n}`;

describe("group api client", () => {
  it("shares the rotating adult session queue with account requests", async () => {
    const backend = createDevBackend();
    const transport = createInProcessFetch(backend);
    let active = 0;
    let peak = 0;
    const fetch: typeof transport.fetch = async (input, init) => {
      active += 1;
      peak = Math.max(peak, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return await transport.fetch(input, init);
      } finally {
        active -= 1;
      }
    };
    const link = createLinkApi({ fetch });
    const group = createGroupApi({ fetch });
    const name = alias();
    await link.register(name, PASSWORD, `${name}@example.com`);
    const results = await Promise.allSettled([link.restore(), group.available(), group.current()]);
    expect(results[0]).toMatchObject({ status: "fulfilled", value: { alias: name } });
    expect(results[1]).toMatchObject({ status: "fulfilled", value: true });
    expect(results[2]).toMatchObject({ status: "rejected" });
    expect(peak).toBe(1);
  });
  it("reports the service as available and keeps working before sign-in", async () => {
    const w = world();
    expect(await w.adult.available()).toBe(true);
    await expect(w.adult.current()).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("refuses the organizer role until the email is verified", async () => {
    const w = world();
    await w.link.register(alias(), PASSWORD, "someone@example.com");
    await expect(w.adult.enableOrganizer()).rejects.toMatchObject({ kind: "not-organizer" });
    await expect(w.adult.current()).rejects.toMatchObject({ kind: "not-organizer" });
  });

  it("runs the organizer and child journey end to end", async () => {
    const w = world();
    await w.verifiedAdult(alias());
    await w.adult.enableOrganizer();
    expect(await w.adult.current()).toEqual({ group: null, slots: [] });

    const group = await w.adult.create({ kind: "household" });
    await expect(w.adult.create({ kind: "household" })).rejects.toMatchObject({
      kind: "already-has-group",
    });

    const code = await w.adult.createCode(group.groupId);
    const { deviceToken } = await w.device.join(code.code);
    await expect(w.device.join(code.code)).rejects.toMatchObject({ kind: "invalid-code" });
    expect((await w.device.deviceView(deviceToken)).status).toBe("pending");

    const roster = (await w.adult.current()).slots;
    expect(roster).toHaveLength(1);
    const slotId = roster[0]!.slotId;
    await expect(w.adult.approve(group.groupId, slotId, false)).rejects.toMatchObject({
      kind: "consent-required",
    });
    await w.adult.approve(group.groupId, slotId, true);
    await w.adult.assignTeam(group.groupId, slotId, "equipo-2");

    const view = await w.device.deviceView(deviceToken);
    expect(view).toMatchObject({ status: "approved", team: "equipo-2" });
    expect(Object.keys(view).sort()).toEqual(["alias", "expiresAt", "status", "team"]);

    await w.adult.setLocked(group.groupId, true);
    await expect(w.adult.createCode(group.groupId)).rejects.toMatchObject({ kind: "group-locked" });

    await w.adult.close(group.groupId);
    await expect(w.device.deviceView(deviceToken)).rejects.toMatchObject({
      kind: "unauthenticated",
    });
    expect((await w.adult.current()).group).toBeNull();
  });

  it("never echoes server text in errors", async () => {
    const w = world();
    try {
      await w.device.join("ZZZZZZ");
      throw new Error("expected failure");
    } catch (error) {
      expect(isGroupApiError(error)).toBe(true);
      expect((error as Error).message).toBe("group api error: invalid-code");
    }
  });
});
