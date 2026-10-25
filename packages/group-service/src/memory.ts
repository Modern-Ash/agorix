import type {
  CodeRow,
  DeviceRow,
  GroupRepository,
  GroupRow,
  OrganizerRow,
  SlotRow,
} from "./types.js";

/** Reference implementation: a SQL repository must behave the same. */
export class InMemoryGroupRepository implements GroupRepository {
  private organizers = new Map<string, OrganizerRow>();
  private groups = new Map<string, GroupRow>();
  private slots = new Map<string, SlotRow>();
  private codes = new Map<string, CodeRow>();
  private devices = new Map<string, DeviceRow>();
  private redeemFailures = new Map<string, { count: number; resetAt: number }>();

  async getRedeemFailureWindows(sourceKey: string, nowMs: number) {
    return ["global", `source:${sourceKey}`].flatMap((scopeKey) => {
      const window = this.redeemFailures.get(scopeKey);
      return window !== undefined && window.resetAt > nowMs ? [{ scopeKey, ...window }] : [];
    });
  }
  async recordRedeemFailure(sourceKey: string, nowMs: number, windowMs: number) {
    for (const scopeKey of ["global", `source:${sourceKey}`]) {
      const old = this.redeemFailures.get(scopeKey);
      this.redeemFailures.set(
        scopeKey,
        old === undefined || old.resetAt <= nowMs
          ? { count: 1, resetAt: nowMs + windowMs }
          : { count: old.count + 1, resetAt: old.resetAt },
      );
    }
  }
  async sweepRedeemFailureWindows(nowMs: number) {
    for (const [key, window] of this.redeemFailures)
      if (window.resetAt <= nowMs) this.redeemFailures.delete(key);
  }

  async getOrganizer(accountId: string) {
    return this.organizers.get(accountId);
  }
  async putOrganizer(row: OrganizerRow) {
    this.organizers.set(row.accountId, row);
  }

  async putGroup(row: GroupRow) {
    this.groups.set(row.groupId, row);
  }
  async getGroup(groupId: string) {
    return this.groups.get(groupId);
  }
  async findGroupByOrganizer(accountId: string) {
    return [...this.groups.values()].find((group) => group.organizerId === accountId);
  }
  async expiredGroupIds(nowIso: string) {
    return [...this.groups.values()]
      .filter((group) => group.expiresAt <= nowIso)
      .map((group) => group.groupId);
  }
  async deleteGroup(groupId: string) {
    this.groups.delete(groupId);
    for (const [id, slot] of this.slots) if (slot.groupId === groupId) this.slots.delete(id);
    for (const [hash, code] of this.codes) if (code.groupId === groupId) this.codes.delete(hash);
    for (const [hash, device] of this.devices)
      if (device.groupId === groupId) this.devices.delete(hash);
  }

  async putSlot(row: SlotRow) {
    this.slots.set(row.slotId, row);
  }
  async getSlot(slotId: string) {
    return this.slots.get(slotId);
  }
  async listSlots(groupId: string) {
    return [...this.slots.values()]
      .filter((slot) => slot.groupId === groupId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.slotId.localeCompare(b.slotId));
  }
  async deleteSlot(slotId: string) {
    this.slots.delete(slotId);
    for (const [hash, device] of this.devices)
      if (device.slotId === slotId) this.devices.delete(hash);
    for (const [hash, code] of this.codes) if (code.slotId === slotId) this.codes.delete(hash);
  }

  async putCode(row: CodeRow) {
    this.codes.set(row.codeHash, row);
  }
  async getCode(codeHash: string) {
    return this.codes.get(codeHash);
  }
  async useCode(codeHash: string, at: string) {
    const row = this.codes.get(codeHash);
    if (row === undefined || row.usedAt !== undefined) return false;
    this.codes.set(codeHash, { ...row, usedAt: at });
    return true;
  }
  async countLiveCodes(groupId: string, nowIso: string) {
    return [...this.codes.values()].filter(
      (code) => code.groupId === groupId && code.usedAt === undefined && code.expiresAt > nowIso,
    ).length;
  }

  async putDevice(row: DeviceRow) {
    this.devices.set(row.tokenHash, row);
  }
  async getDevice(tokenHash: string) {
    return this.devices.get(tokenHash);
  }
  async deleteDevicesForSlot(slotId: string) {
    for (const [hash, device] of this.devices)
      if (device.slotId === slotId) this.devices.delete(hash);
  }

  /** Test helpers: prove deletion left nothing behind. */
  sizes() {
    return {
      groups: this.groups.size,
      slots: this.slots.size,
      codes: this.codes.size,
      devices: this.devices.size,
    };
  }
  dump() {
    return {
      groups: [...this.groups.values()],
      slots: [...this.slots.values()],
      codes: [...this.codes.values()],
      devices: [...this.devices.values()],
    };
  }
}
