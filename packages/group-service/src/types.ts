export interface Clock {
  now(): Date;
}

export interface RandomSource {
  bytes(length: number): Uint8Array;
}

/** Boundary to the adult accounts: the organizer role needs a verified email, nothing else. */
export interface AdultDirectory {
  hasVerifiedEmail(accountId: string): Promise<boolean>;
}

export type GroupErrorCode =
  | "NOT_ORGANIZER"
  | "ALREADY_HAS_GROUP"
  | "AUTHORITY_REQUIRED"
  | "CONSENT_REQUIRED"
  | "INVALID_INPUT"
  | "INVALID_OR_EXPIRED"
  | "RATE_LIMITED"
  | "GROUP_FULL"
  | "GROUP_LOCKED"
  | "NOT_FOUND";

/** Public, generic failures only. The message never says which field or value was wrong. */
export class GroupError extends Error {
  constructor(
    readonly code: GroupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GroupError";
  }
}

export interface GroupPolicy {
  readonly groupTtlMs: number;
  readonly joinCodeTtlMs: number;
  /** Children per group (ADR 0010: up to four). */
  readonly maxChildren: number;
  readonly maxLiveCodesPerGroup: number;
  /** Failed redemptions allowed per source and per whole server inside the window. */
  readonly redeemFailuresPerSource: number;
  readonly redeemFailuresGlobal: number;
  readonly redeemWindowMs: number;
}

export const DEFAULT_GROUP_POLICY: GroupPolicy = {
  groupTtlMs: 2 * 60 * 60 * 1000,
  joinCodeTtlMs: 10 * 60 * 1000,
  maxChildren: 4,
  maxLiveCodesPerGroup: 3,
  redeemFailuresPerSource: 10,
  redeemFailuresGlobal: 200,
  redeemWindowMs: 10 * 60 * 1000,
};

/** Fixed lists: a child never types a name or a team. */
export const ALIASES = [
  "Zorro Azul",
  "Gato Verde",
  "Búho Rojo",
  "Oso Dorado",
  "Pez Naranja",
  "Lobo Plateado",
  "Tigre Violeta",
  "Panda Celeste",
  "Koala Rosa",
  "Delfín Turquesa",
  "Águila Negra",
  "Conejo Blanco",
  "Rana Lima",
  "Pulpo Magenta",
  "Ciervo Marrón",
  "Foca Gris",
] as const;

export const TEAM_IDS = ["equipo-1", "equipo-2", "equipo-3", "equipo-4"] as const;
export type TeamId = (typeof TEAM_IDS)[number];

/**
 * Who allows these children to be here. The reference is an opaque id of the institutional
 * authorization record; it is never a name, email or free text.
 */
export type GroupAuthority =
  | { readonly kind: "classroom"; readonly authorizationRef: string }
  | { readonly kind: "household" };

export interface OrganizerRow {
  readonly accountId: string;
  readonly grantedAt: string;
}

export interface GroupRow {
  readonly groupId: string;
  readonly organizerId: string;
  readonly authority: GroupAuthority;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly locked: boolean;
}

export interface SlotRow {
  readonly slotId: string;
  readonly groupId: string;
  readonly alias: string;
  readonly status: "pending" | "approved";
  readonly team?: TeamId;
  /** Household groups: when the organizer attested the responsible adult's consent. */
  readonly consentAttestedAt?: string;
  readonly reconnects: number;
  readonly createdAt: string;
}

export interface CodeRow {
  readonly codeHash: string;
  readonly groupId: string;
  /** Present for a reconnect code: it re-keys this existing slot instead of adding one. */
  readonly slotId?: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly usedAt?: string;
}

export interface DeviceRow {
  readonly tokenHash: string;
  readonly groupId: string;
  readonly slotId: string;
}

export interface RedeemFailureWindow {
  readonly scopeKey: string;
  readonly count: number;
  readonly resetAt: number;
}

/** Storage boundary. Deleting a group deletes everything that hangs from it. */
export interface GroupRepository {
  getRedeemFailureWindows(
    sourceKey: string,
    nowMs: number,
  ): Promise<readonly RedeemFailureWindow[]>;
  recordRedeemFailure(sourceKey: string, nowMs: number, windowMs: number): Promise<void>;
  sweepRedeemFailureWindows(nowMs: number): Promise<void>;

  getOrganizer(accountId: string): Promise<OrganizerRow | undefined>;
  putOrganizer(row: OrganizerRow): Promise<void>;

  putGroup(row: GroupRow): Promise<void>;
  getGroup(groupId: string): Promise<GroupRow | undefined>;
  findGroupByOrganizer(accountId: string): Promise<GroupRow | undefined>;
  expiredGroupIds(nowIso: string): Promise<readonly string[]>;
  /** Removes the group, its slots, codes and device keys. */
  deleteGroup(groupId: string): Promise<void>;

  putSlot(row: SlotRow): Promise<void>;
  getSlot(slotId: string): Promise<SlotRow | undefined>;
  listSlots(groupId: string): Promise<readonly SlotRow[]>;
  /** Removes the slot, its device keys and its reconnect codes. */
  deleteSlot(slotId: string): Promise<void>;

  putCode(row: CodeRow): Promise<void>;
  getCode(codeHash: string): Promise<CodeRow | undefined>;
  /** False when the code was already used: only one caller can win. */
  useCode(codeHash: string, at: string): Promise<boolean>;
  countLiveCodes(groupId: string, nowIso: string): Promise<number>;

  putDevice(row: DeviceRow): Promise<void>;
  getDevice(tokenHash: string): Promise<DeviceRow | undefined>;
  deleteDevicesForSlot(slotId: string): Promise<void>;
}
