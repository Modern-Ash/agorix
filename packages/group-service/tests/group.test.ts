import { describe, expect, it } from "vitest";
import { GroupError } from "../src/index.js";
import { admit, build, organizerWithGroup } from "./support.js";

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    if (error instanceof GroupError) return error.code;
    throw error;
  }
  return "OK";
}

describe("organizer capability", () => {
  it("is granted only to a verified adult account", async () => {
    const ctx = build();
    expect(await code(ctx.service.grantOrganizer("stranger"))).toBe("NOT_ORGANIZER");
    await ctx.service.grantOrganizer("org-1");
    expect(await ctx.service.isOrganizer("org-1")).toBe(true);
  });

  it("is required to create a group; anonymous or role-less accounts cannot", async () => {
    const ctx = build();
    const input = { authority: { kind: "household" } } as const;
    expect(await code(ctx.service.createGroup("org-1", input))).toBe("NOT_ORGANIZER");
    expect(await code(ctx.service.createGroup("", input))).toBe("NOT_ORGANIZER");
  });

  it("is revoked when the account stops being a verified adult", async () => {
    const ctx = build();
    const { accountId } = await organizerWithGroup(ctx);
    ctx.adults.verified.delete(accountId);
    expect(await ctx.service.isOrganizer(accountId)).toBe(false);
  });
});

describe("group creation", () => {
  it("allows one live group per organizer", async () => {
    const ctx = build();
    const { accountId } = await organizerWithGroup(ctx);
    expect(
      await code(ctx.service.createGroup(accountId, { authority: { kind: "household" } })),
    ).toBe("ALREADY_HAS_GROUP");
  });

  it("requires an institutional authorization reference for classrooms", async () => {
    const ctx = build();
    await ctx.service.grantOrganizer("org-1");
    expect(
      await code(ctx.service.createGroup("org-1", { authority: { kind: "classroom" } as never })),
    ).toBe("AUTHORITY_REQUIRED");
    const group = await ctx.service.createGroup("org-1", {
      authority: { kind: "classroom", authorizationRef: "auth-2026-17" },
    });
    expect(group.expiresAt > ctx.clock.now().toISOString()).toBe(true);
  });
});

describe("join proofs", () => {
  it("is one-use: a used code cannot enter again", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    await ctx.service.redeemJoinCode(joinCode, "src-a");
    expect(await code(ctx.service.redeemJoinCode(joinCode, "src-b"))).toBe("INVALID_OR_EXPIRED");
  });

  it("expires after a few minutes", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    ctx.clock.advance(11 * 60 * 1000);
    expect(await code(ctx.service.redeemJoinCode(joinCode, "src-a"))).toBe("INVALID_OR_EXPIRED");
  });

  it("a leaked code is not enough: the child stays pending until the organizer approves", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    const pending = await ctx.service.redeemJoinCode(joinCode, "src-a");
    const view = await ctx.service.deviceView(pending.deviceToken);
    expect(view.status).toBe("pending");
    expect(view.team).toBeUndefined();
  });

  it("a guessed code is rate limited per source and never says what was wrong", async () => {
    const ctx = build({ redeemFailuresPerSource: 3 });
    await organizerWithGroup(ctx);
    for (let i = 0; i < 3; i += 1) {
      expect(await code(ctx.service.redeemJoinCode("AAAAAA", "src-x"))).toBe("INVALID_OR_EXPIRED");
    }
    expect(await code(ctx.service.redeemJoinCode("AAAAAA", "src-x"))).toBe("RATE_LIMITED");
  });

  it("limits live codes per group", async () => {
    const ctx = build({ maxLiveCodesPerGroup: 2 });
    const { accountId, group } = await organizerWithGroup(ctx);
    await ctx.service.issueJoinCode(accountId, group.groupId);
    await ctx.service.issueJoinCode(accountId, group.groupId);
    expect(await code(ctx.service.issueJoinCode(accountId, group.groupId))).toBe("RATE_LIMITED");
  });
});

describe("roster", () => {
  it("assigns distinct generated aliases and never stores child text", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const a = await admit(ctx, accountId, group.groupId, "s1");
    const b = await admit(ctx, accountId, group.groupId, "s2");
    expect(a.slot.alias).not.toBe(b.slot.alias);
    expect(Object.keys(a.slot).sort()).toEqual(
      ["alias", "consentAttestedAt", "reconnects", "slotId", "status", "team"].filter(
        (key) => key in a.slot,
      ),
    );
  });

  it("caps the group at four children", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    for (let i = 0; i < 4; i += 1) await admit(ctx, accountId, group.groupId, `s${i}`);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    expect(await code(ctx.service.redeemJoinCode(joinCode, "s9"))).toBe("GROUP_FULL");
  });

  it("household groups require a recorded adult consent per child", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    const pending = await ctx.service.redeemJoinCode(joinCode, "s1");
    expect(
      await code(
        ctx.service.approve(accountId, group.groupId, pending.slotId, { consentAttested: false }),
      ),
    ).toBe("CONSENT_REQUIRED");
  });

  it("locking blocks new joins and codes; unlocking restores them", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    await ctx.service.setLocked(accountId, group.groupId, true);
    expect(await code(ctx.service.redeemJoinCode(joinCode, "s1"))).toBe("GROUP_LOCKED");
    expect(await code(ctx.service.issueJoinCode(accountId, group.groupId))).toBe("GROUP_LOCKED");
    await ctx.service.setLocked(accountId, group.groupId, false);
    await ctx.service.redeemJoinCode(joinCode, "s1");
  });

  it("removing a child kills that device and frees the slot", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const kid = await admit(ctx, accountId, group.groupId);
    await ctx.service.removeSlot(accountId, group.groupId, kid.slot.slotId);
    expect(await code(ctx.service.deviceView(kid.deviceToken))).toBe("INVALID_OR_EXPIRED");
    const roster = await ctx.service.organizerView(accountId, group.groupId);
    expect(roster.slots).toHaveLength(0);
  });

  it("assigns children to fixed teams only", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const kid = await admit(ctx, accountId, group.groupId);
    await ctx.service.assignTeam(accountId, group.groupId, kid.slot.slotId, "equipo-1");
    expect((await ctx.service.deviceView(kid.deviceToken)).team).toBe("equipo-1");
    expect(
      await code(ctx.service.assignTeam(accountId, group.groupId, kid.slot.slotId, "free text")),
    ).toBe("INVALID_INPUT");
  });
});

describe("authorization boundaries", () => {
  it("an organizer cannot see or administer another organizer's group", async () => {
    const ctx = build();
    const mine = await organizerWithGroup(ctx, "org-1");
    await ctx.service.grantOrganizer("org-2");
    expect(await code(ctx.service.organizerView("org-2", mine.group.groupId))).toBe("NOT_FOUND");
    expect(await code(ctx.service.closeGroup("org-2", mine.group.groupId))).toBe("NOT_FOUND");
    expect(await code(ctx.service.issueJoinCode("org-2", mine.group.groupId))).toBe("NOT_FOUND");
  });

  it("a child device sees only its own slot, with no roster and no adult data", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const a = await admit(ctx, accountId, group.groupId, "s1");
    await admit(ctx, accountId, group.groupId, "s2");
    const view = await ctx.service.deviceView(a.deviceToken);
    expect(view).toEqual({
      status: "approved",
      alias: a.slot.alias,
      expiresAt: group.expiresAt,
    });
    expect(JSON.stringify(view)).not.toContain(accountId);
  });
});

describe("reconnect", () => {
  it("a reconnect code rotates the device key, invalidates the old one and flags the slot", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const kid = await admit(ctx, accountId, group.groupId);
    const { code: reconnectCode } = await ctx.service.issueReconnectCode(
      accountId,
      group.groupId,
      kid.slot.slotId,
    );
    const next = await ctx.service.redeemJoinCode(reconnectCode, "s1");
    expect(next.deviceToken).not.toBe(kid.deviceToken);
    expect(await code(ctx.service.deviceView(kid.deviceToken))).toBe("INVALID_OR_EXPIRED");
    expect((await ctx.service.deviceView(next.deviceToken)).status).toBe("approved");
    const roster = await ctx.service.organizerView(accountId, group.groupId);
    expect(roster.slots[0]?.reconnects).toBe(1);
  });
});

describe("deletion", () => {
  it("closing deletes every trace: slots, codes, device keys and the group", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const kid = await admit(ctx, accountId, group.groupId);
    const { code: leftover } = await ctx.service.issueJoinCode(accountId, group.groupId);
    await ctx.service.closeGroup(accountId, group.groupId);
    expect(ctx.repository.sizes()).toEqual({ groups: 0, slots: 0, codes: 0, devices: 0 });
    expect(await code(ctx.service.deviceView(kid.deviceToken))).toBe("INVALID_OR_EXPIRED");
    expect(await code(ctx.service.redeemJoinCode(leftover, "s1"))).toBe("INVALID_OR_EXPIRED");
    expect(await code(ctx.service.organizerView(accountId, group.groupId))).toBe("NOT_FOUND");
  });

  it("expiry deletes the group on sweep and frees the organizer", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    await admit(ctx, accountId, group.groupId);
    ctx.clock.advance(3 * 60 * 60 * 1000);
    expect(await ctx.service.sweepExpired()).toBe(1);
    expect(ctx.repository.sizes()).toEqual({ groups: 0, slots: 0, codes: 0, devices: 0 });
    await ctx.service.createGroup(accountId, { authority: { kind: "household" } });
  });

  it("an expired group is deleted on first access, before any sweep", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const kid = await admit(ctx, accountId, group.groupId);
    ctx.clock.advance(3 * 60 * 60 * 1000);
    expect(await code(ctx.service.deviceView(kid.deviceToken))).toBe("INVALID_OR_EXPIRED");
    expect(ctx.repository.sizes()).toEqual({ groups: 0, slots: 0, codes: 0, devices: 0 });
  });

  it("stores hashes, not raw codes or device tokens", async () => {
    const ctx = build();
    const { accountId, group } = await organizerWithGroup(ctx);
    const { code: joinCode } = await ctx.service.issueJoinCode(accountId, group.groupId);
    const pending = await ctx.service.redeemJoinCode(joinCode, "s1");
    const dump = JSON.stringify(ctx.repository.dump());
    expect(dump).not.toContain(joinCode);
    expect(dump).not.toContain(pending.deviceToken);
  });
});
