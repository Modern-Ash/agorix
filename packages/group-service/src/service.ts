import { createHmac, randomBytes } from "node:crypto";
import {
  ALIASES,
  DEFAULT_GROUP_POLICY,
  GroupError,
  TEAM_IDS,
  type AdultDirectory,
  type Clock,
  type GroupAuthority,
  type GroupPolicy,
  type GroupRepository,
  type GroupRow,
  type RandomSource,
  type SlotRow,
  type TeamId,
} from "./types.js";

export interface GroupServiceOptions {
  readonly repository: GroupRepository;
  readonly adults: AdultDirectory;
  /** HMAC key for codes and device keys; at least 32 characters, from the environment. */
  readonly secret: string;
  readonly policy?: Partial<GroupPolicy>;
  readonly clock?: Clock;
  readonly random?: RandomSource;
}

export interface CreateGroupInput {
  readonly authority:
    | { readonly kind: "classroom"; readonly authorizationRef: string }
    | { readonly kind: "household" };
}

export interface GroupView {
  readonly groupId: string;
  readonly expiresAt: string;
  readonly locked: boolean;
  readonly authorityKind: GroupAuthority["kind"];
}

/** What the organizer sees of a child: alias and state only. No text from the child exists. */
export interface SlotView {
  readonly slotId: string;
  readonly alias: string;
  readonly status: "pending" | "approved";
  readonly team?: TeamId;
  readonly consentAttestedAt?: string;
  readonly reconnects: number;
}

export interface OrganizerGroupView {
  readonly group: GroupView;
  readonly slots: readonly SlotView[];
}

export interface PendingJoin {
  readonly slotId: string;
  /** The device must keep this key: only its hash is stored. */
  readonly deviceToken: string;
}

/** A child device only ever sees its own slot. */
export interface DeviceView {
  readonly status: "pending" | "approved";
  readonly alias: string;
  readonly team?: TeamId;
  readonly expiresAt: string;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const AUTHORIZATION_REF = /^[A-Za-z0-9._-]{1,64}$/;

export class GroupService {
  private readonly repo: GroupRepository;
  private readonly adults: AdultDirectory;
  private readonly secret: string;
  private readonly policy: GroupPolicy;
  private readonly clock: Clock;
  private readonly random: RandomSource;

  constructor(options: GroupServiceOptions) {
    if (options.secret.length < 32) throw new Error("group secret must be at least 32 characters");
    this.repo = options.repository;
    this.adults = options.adults;
    this.secret = options.secret;
    this.policy = { ...DEFAULT_GROUP_POLICY, ...options.policy };
    this.clock = options.clock ?? { now: () => new Date() };
    this.random = options.random ?? { bytes: (length) => randomBytes(length) };
  }

  // ---- organizer capability ---------------------------------------------------------------

  /** Needs a verified adult email. Separate from the device link (#504) and from admin. */
  async grantOrganizer(accountId: string): Promise<void> {
    if (!(await this.hasVerifiedEmail(accountId))) throw this.notOrganizer();
    if ((await this.repo.getOrganizer(accountId)) === undefined) {
      await this.repo.putOrganizer({ accountId, grantedAt: this.nowIso() });
    }
  }

  /** Checked on every call: losing the verified email ends the capability at once. */
  async isOrganizer(accountId: string): Promise<boolean> {
    if (accountId === "") return false;
    if ((await this.repo.getOrganizer(accountId)) === undefined) return false;
    return this.hasVerifiedEmail(accountId);
  }

  // ---- groups ----------------------------------------------------------------------------

  async createGroup(accountId: string, input: CreateGroupInput): Promise<GroupView> {
    if (!(await this.isOrganizer(accountId))) throw this.notOrganizer();
    const authority = this.parseAuthority(input.authority);
    await this.sweepExpired();
    if ((await this.repo.findGroupByOrganizer(accountId)) !== undefined) {
      throw new GroupError("ALREADY_HAS_GROUP", "An organizer can run one group at a time.");
    }
    const now = this.clock.now();
    const group: GroupRow = {
      groupId: this.token("grp", 12),
      organizerId: accountId,
      authority,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.policy.groupTtlMs).toISOString(),
      locked: false,
    };
    await this.repo.putGroup(group);
    return this.groupView(group);
  }

  async organizerView(accountId: string, groupId: string): Promise<OrganizerGroupView> {
    const group = await this.ownedGroup(accountId, groupId);
    const slots = await this.repo.listSlots(groupId);
    return { group: this.groupView(group), slots: slots.map(slotView) };
  }

  async setLocked(accountId: string, groupId: string, locked: boolean): Promise<void> {
    const group = await this.ownedGroup(accountId, groupId);
    await this.repo.putGroup({ ...group, locked });
  }

  /** Closing deletes the group and everything attached to it. */
  async closeGroup(accountId: string, groupId: string): Promise<void> {
    await this.ownedGroup(accountId, groupId);
    await this.repo.deleteGroup(groupId);
  }

  /** Deletes every expired group. Returns how many were removed. */
  async sweepExpired(): Promise<number> {
    const ids = await this.repo.expiredGroupIds(this.nowIso());
    for (const id of ids) await this.repo.deleteGroup(id);
    await this.repo.sweepRedeemFailureWindows(this.clock.now().getTime());
    return ids.length;
  }

  // ---- join proofs -----------------------------------------------------------------------

  async issueJoinCode(
    accountId: string,
    groupId: string,
  ): Promise<{ code: string; expiresAt: string }> {
    const group = await this.ownedGroup(accountId, groupId);
    if (group.locked) throw new GroupError("GROUP_LOCKED", "The group is locked.");
    return this.issueCode(group, undefined);
  }

  /** Re-keys an existing slot (lost tab, restarted tablet). The organizer sees the reconnect. */
  async issueReconnectCode(
    accountId: string,
    groupId: string,
    slotId: string,
  ): Promise<{ code: string; expiresAt: string }> {
    const group = await this.ownedGroup(accountId, groupId);
    const slot = await this.slotOf(groupId, slotId);
    if (slot.status !== "approved") throw this.notFound();
    return this.issueCode(group, slot.slotId);
  }

  /**
   * A code proves possession, not proximity or permission: a new child stays pending until the
   * organizer approves. Failures are generic and counted per source and globally.
   */
  async redeemJoinCode(rawCode: string, source: string): Promise<PendingJoin> {
    const nowMs = this.clock.now().getTime();
    const sourceKey = this.hmac("src", source);
    const windows = await this.repo.getRedeemFailureWindows(sourceKey, nowMs);
    for (const window of windows) {
      const limit =
        window.scopeKey === "global"
          ? this.policy.redeemFailuresGlobal
          : this.policy.redeemFailuresPerSource;
      if (window.count >= limit) throw new GroupError("RATE_LIMITED", "Try again later.");
    }

    const codeHash = this.hmac("code", normalizeCode(rawCode));
    const row = await this.repo.getCode(codeHash);
    const group = row === undefined ? undefined : await this.liveGroup(row.groupId);
    if (
      row === undefined ||
      group === undefined ||
      row.usedAt !== undefined ||
      row.expiresAt <= this.nowIso()
    ) {
      await this.repo.recordRedeemFailure(sourceKey, nowMs, this.policy.redeemWindowMs);
      throw this.invalid();
    }

    if (row.slotId !== undefined) return this.redeemReconnect(codeHash, row.slotId, group);

    if (group.locked) throw new GroupError("GROUP_LOCKED", "The group is locked.");
    const slots = await this.repo.listSlots(group.groupId);
    if (slots.length >= this.policy.maxChildren) {
      throw new GroupError("GROUP_FULL", "The group has no free places.");
    }
    if (!(await this.repo.useCode(codeHash, this.nowIso()))) throw this.invalid();

    const slot: SlotRow = {
      slotId: this.token("slt", 8),
      groupId: group.groupId,
      alias: this.pickAlias(slots),
      status: "pending",
      reconnects: 0,
      createdAt: this.nowIso(),
    };
    await this.repo.putSlot(slot);
    return { slotId: slot.slotId, deviceToken: await this.newDevice(group.groupId, slot.slotId) };
  }

  // ---- roster ----------------------------------------------------------------------------

  async approve(
    accountId: string,
    groupId: string,
    slotId: string,
    input: { readonly consentAttested: boolean },
  ): Promise<SlotView> {
    const group = await this.ownedGroup(accountId, groupId);
    const slot = await this.slotOf(groupId, slotId);
    if (slot.status !== "pending") throw this.notFound();
    if (group.authority.kind === "household" && !input.consentAttested) {
      throw new GroupError("CONSENT_REQUIRED", "Each child needs a responsible adult's consent.");
    }
    const next: SlotRow = {
      ...slot,
      status: "approved",
      ...(group.authority.kind === "household" ? { consentAttestedAt: this.nowIso() } : {}),
    };
    await this.repo.putSlot(next);
    return slotView(next);
  }

  async removeSlot(accountId: string, groupId: string, slotId: string): Promise<void> {
    await this.ownedGroup(accountId, groupId);
    await this.slotOf(groupId, slotId);
    await this.repo.deleteSlot(slotId);
  }

  async assignTeam(
    accountId: string,
    groupId: string,
    slotId: string,
    team: string,
  ): Promise<void> {
    await this.ownedGroup(accountId, groupId);
    const slot = await this.slotOf(groupId, slotId);
    if (!(TEAM_IDS as readonly string[]).includes(team)) {
      throw new GroupError("INVALID_INPUT", "Unknown team.");
    }
    await this.repo.putSlot({ ...slot, team: team as TeamId });
  }

  // ---- child device ----------------------------------------------------------------------

  async deviceView(deviceToken: string): Promise<DeviceView> {
    const device = await this.repo.getDevice(this.hmac("device", deviceToken));
    if (device === undefined) throw this.invalid();
    const group = await this.liveGroup(device.groupId);
    const slot = await this.repo.getSlot(device.slotId);
    if (group === undefined || slot === undefined) throw this.invalid();
    return {
      status: slot.status,
      alias: slot.alias,
      ...(slot.team === undefined ? {} : { team: slot.team }),
      expiresAt: group.expiresAt,
    };
  }

  // ---- internals -------------------------------------------------------------------------

  private async redeemReconnect(
    codeHash: string,
    slotId: string,
    group: GroupRow,
  ): Promise<PendingJoin> {
    const slot = await this.repo.getSlot(slotId);
    if (slot === undefined || !(await this.repo.useCode(codeHash, this.nowIso())))
      throw this.invalid();
    await this.repo.deleteDevicesForSlot(slotId);
    await this.repo.putSlot({ ...slot, reconnects: slot.reconnects + 1 });
    return { slotId, deviceToken: await this.newDevice(group.groupId, slotId) };
  }

  private async issueCode(group: GroupRow, slotId: string | undefined) {
    const nowIso = this.nowIso();
    if (
      (await this.repo.countLiveCodes(group.groupId, nowIso)) >= this.policy.maxLiveCodesPerGroup
    ) {
      throw new GroupError("RATE_LIMITED", "Too many live codes.");
    }
    const code = this.newCode();
    const expiresAt = new Date(
      this.clock.now().getTime() + this.policy.joinCodeTtlMs,
    ).toISOString();
    await this.repo.putCode({
      codeHash: this.hmac("code", code),
      groupId: group.groupId,
      ...(slotId === undefined ? {} : { slotId }),
      createdAt: nowIso,
      expiresAt,
    });
    return { code, expiresAt };
  }

  private async newDevice(groupId: string, slotId: string): Promise<string> {
    const deviceToken = this.token("dev", 24);
    await this.repo.putDevice({ tokenHash: this.hmac("device", deviceToken), groupId, slotId });
    return deviceToken;
  }

  /** Group by id; an expired one is deleted on sight and reads as missing. */
  private async liveGroup(groupId: string): Promise<GroupRow | undefined> {
    const group = await this.repo.getGroup(groupId);
    if (group === undefined) return undefined;
    if (group.expiresAt <= this.nowIso()) {
      await this.repo.deleteGroup(groupId);
      return undefined;
    }
    return group;
  }

  /** Another organizer's group is indistinguishable from a missing one. */
  private async ownedGroup(accountId: string, groupId: string): Promise<GroupRow> {
    if (!(await this.isOrganizer(accountId))) throw this.notOrganizer();
    const group = await this.liveGroup(groupId);
    if (group === undefined || group.organizerId !== accountId) throw this.notFound();
    return group;
  }

  private async slotOf(groupId: string, slotId: string): Promise<SlotRow> {
    const slot = await this.repo.getSlot(slotId);
    if (slot === undefined || slot.groupId !== groupId) throw this.notFound();
    return slot;
  }

  private parseAuthority(input: CreateGroupInput["authority"]): GroupAuthority {
    if (input.kind === "household") return { kind: "household" };
    const ref = (input as { authorizationRef?: unknown }).authorizationRef;
    if (input.kind !== "classroom" || typeof ref !== "string" || !AUTHORIZATION_REF.test(ref)) {
      throw new GroupError("AUTHORITY_REQUIRED", "An institutional authorization is required.");
    }
    return { kind: "classroom", authorizationRef: ref };
  }

  private pickAlias(slots: readonly SlotRow[]): string {
    const taken = new Set(slots.map((slot) => slot.alias));
    const free = ALIASES.filter((alias) => !taken.has(alias));
    const byte = this.random.bytes(1)[0] ?? 0;
    return free[byte % free.length] ?? ALIASES[0];
  }

  private newCode(): string {
    const bytes = this.random.bytes(CODE_LENGTH);
    return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  }

  private token(prefix: string, length: number): string {
    return `${prefix}_${Buffer.from(this.random.bytes(length)).toString("base64url")}`;
  }

  private hmac(domain: string, value: string): string {
    return createHmac("sha256", this.secret).update(`${domain}:${value}`).digest("hex");
  }

  private async hasVerifiedEmail(accountId: string): Promise<boolean> {
    return accountId !== "" && (await this.adults.hasVerifiedEmail(accountId));
  }

  private groupView(group: GroupRow): GroupView {
    return {
      groupId: group.groupId,
      expiresAt: group.expiresAt,
      locked: group.locked,
      authorityKind: group.authority.kind,
    };
  }

  private nowIso(): string {
    return this.clock.now().toISOString();
  }
  private notOrganizer() {
    return new GroupError("NOT_ORGANIZER", "Organizer capability required.");
  }
  private notFound() {
    return new GroupError("NOT_FOUND", "Not found.");
  }
  private invalid() {
    return new GroupError("INVALID_OR_EXPIRED", "Invalid or expired.");
  }
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function slotView(slot: SlotRow): SlotView {
  return {
    slotId: slot.slotId,
    alias: slot.alias,
    status: slot.status,
    ...(slot.team === undefined ? {} : { team: slot.team }),
    ...(slot.consentAttestedAt === undefined ? {} : { consentAttestedAt: slot.consentAttestedAt }),
    reconnects: slot.reconnects,
  };
}
