import type {
  CodeRow,
  DeviceRow,
  GroupAuthority,
  GroupRepository,
  GroupRow,
  OrganizerRow,
  SlotRow,
  TeamId,
} from "./types.js";

export type GroupSqlValue = string | number | null;
export type GroupSqlRow = Record<string, unknown>;
export type GroupSqlDialect = "postgresql" | "sqlite";

export interface GroupSqlExecutor {
  execute<R extends GroupSqlRow = GroupSqlRow>(
    sql: string,
    params?: readonly GroupSqlValue[],
  ): Promise<{ readonly rows: readonly R[]; readonly rowCount?: number }>;
}

// Deleting a group is explicit (devices, codes, slots, then the group) rather than cascading, so
// the result does not depend on a connection flag.
const SCHEMA_SQL = `
create table if not exists agorix_group_organizers (
  account_id text primary key references agorix_accounts(account_id),
  granted_at text not null
);

create table if not exists agorix_groups (
  group_id text primary key,
  organizer_id text not null unique references agorix_group_organizers(account_id),
  authority_kind text not null,
  authorization_ref text,
  created_at text not null,
  expires_at text not null,
  locked integer not null
);
create index if not exists agorix_groups_expiry_idx on agorix_groups (expires_at);

create table if not exists agorix_group_slots (
  slot_id text primary key,
  group_id text not null references agorix_groups(group_id),
  alias text not null,
  status text not null,
  team text,
  consent_attested_at text,
  reconnects integer not null,
  created_at text not null
);
create index if not exists agorix_group_slots_group_idx on agorix_group_slots (group_id, created_at);

create table if not exists agorix_group_codes (
  code_hash text primary key,
  group_id text not null references agorix_groups(group_id),
  slot_id text references agorix_group_slots(slot_id),
  created_at text not null,
  expires_at text not null,
  used_at text
);
create index if not exists agorix_group_codes_group_idx on agorix_group_codes (group_id, expires_at);

create table if not exists agorix_group_devices (
  token_hash text primary key,
  group_id text not null references agorix_groups(group_id),
  slot_id text not null references agorix_group_slots(slot_id)
);
create index if not exists agorix_group_devices_slot_idx on agorix_group_devices (slot_id);

create table if not exists agorix_group_redeem_failures (
  scope_key text primary key,
  failure_count integer not null,
  window_start bigint not null,
  reset_at bigint not null
);
create index if not exists agorix_group_redeem_failures_expiry_idx
  on agorix_group_redeem_failures (reset_at);
`;

export const GROUP_SERVICE_MIGRATIONS = [
  {
    id: "001_create_group_service",
    postgresql: SCHEMA_SQL,
    sqlite: SCHEMA_SQL,
  },
] as const;

function sqlFor(dialect: GroupSqlDialect, sql: string): string {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (dialect === "sqlite") return normalized;
  let index = 0;
  return normalized.replace(/\?/g, () => `$${++index}`);
}

const str = (value: unknown): string => String(value);
const opt = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value);

export class SqlGroupRepository implements GroupRepository {
  constructor(
    private readonly options: {
      readonly executor: GroupSqlExecutor;
      readonly dialect: GroupSqlDialect;
    },
  ) {}

  private run<R extends GroupSqlRow = GroupSqlRow>(
    sql: string,
    params: readonly GroupSqlValue[] = [],
  ) {
    return this.options.executor.execute<R>(sqlFor(this.options.dialect, sql), params);
  }

  async getRedeemFailureWindows(sourceKey: string, nowMs: number) {
    const { rows } = await this.run(
      `select scope_key, failure_count, reset_at from agorix_group_redeem_failures
       where scope_key in (?, ?) and reset_at > ?`,
      ["global", `source:${sourceKey}`, nowMs],
    );
    return rows.map((row) => ({
      scopeKey: str(row["scope_key"]),
      count: Number(row["failure_count"]),
      resetAt: Number(row["reset_at"]),
    }));
  }

  async recordRedeemFailure(sourceKey: string, nowMs: number, windowMs: number): Promise<void> {
    const resetAt = nowMs + windowMs;
    await this.run(
      `insert into agorix_group_redeem_failures
        (scope_key, failure_count, window_start, reset_at)
       values (?, 1, ?, ?), (?, 1, ?, ?)
       on conflict (scope_key) do update set
         failure_count = case when reset_at <= excluded.window_start then 1 else failure_count + 1 end,
         window_start = case when reset_at <= excluded.window_start then excluded.window_start else window_start end,
         reset_at = case when reset_at <= excluded.window_start then excluded.reset_at else reset_at end`,
      ["global", nowMs, resetAt, `source:${sourceKey}`, nowMs, resetAt],
    );
  }

  async sweepRedeemFailureWindows(nowMs: number): Promise<void> {
    await this.run("delete from agorix_group_redeem_failures where reset_at <= ?", [nowMs]);
  }

  async getOrganizer(accountId: string): Promise<OrganizerRow | undefined> {
    const { rows } = await this.run(
      "select account_id, granted_at from agorix_group_organizers where account_id = ?",
      [accountId],
    );
    const row = rows[0];
    return row === undefined
      ? undefined
      : { accountId: str(row["account_id"]), grantedAt: str(row["granted_at"]) };
  }

  async putOrganizer(row: OrganizerRow): Promise<void> {
    await this.run(
      `insert into agorix_group_organizers (account_id, granted_at) values (?, ?)
       on conflict (account_id) do nothing`,
      [row.accountId, row.grantedAt],
    );
  }

  async putGroup(row: GroupRow): Promise<void> {
    await this.run(
      `insert into agorix_groups
        (group_id, organizer_id, authority_kind, authorization_ref, created_at, expires_at, locked)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict (group_id) do update set locked = excluded.locked`,
      [
        row.groupId,
        row.organizerId,
        row.authority.kind,
        row.authority.kind === "classroom" ? row.authority.authorizationRef : null,
        row.createdAt,
        row.expiresAt,
        row.locked ? 1 : 0,
      ],
    );
  }

  async getGroup(groupId: string): Promise<GroupRow | undefined> {
    const { rows } = await this.run("select * from agorix_groups where group_id = ?", [groupId]);
    return rows[0] === undefined ? undefined : toGroup(rows[0]);
  }

  async findGroupByOrganizer(accountId: string): Promise<GroupRow | undefined> {
    const { rows } = await this.run("select * from agorix_groups where organizer_id = ?", [
      accountId,
    ]);
    return rows[0] === undefined ? undefined : toGroup(rows[0]);
  }

  async expiredGroupIds(nowIso: string): Promise<readonly string[]> {
    const { rows } = await this.run("select group_id from agorix_groups where expires_at <= ?", [
      nowIso,
    ]);
    return rows.map((row) => str(row["group_id"]));
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.run("delete from agorix_group_devices where group_id = ?", [groupId]);
    await this.run("delete from agorix_group_codes where group_id = ?", [groupId]);
    await this.run("delete from agorix_group_slots where group_id = ?", [groupId]);
    await this.run("delete from agorix_groups where group_id = ?", [groupId]);
  }

  async putSlot(row: SlotRow): Promise<void> {
    await this.run(
      `insert into agorix_group_slots
        (slot_id, group_id, alias, status, team, consent_attested_at, reconnects, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (slot_id) do update set
         status = excluded.status, team = excluded.team,
         consent_attested_at = excluded.consent_attested_at, reconnects = excluded.reconnects`,
      [
        row.slotId,
        row.groupId,
        row.alias,
        row.status,
        row.team ?? null,
        row.consentAttestedAt ?? null,
        row.reconnects,
        row.createdAt,
      ],
    );
  }

  async getSlot(slotId: string): Promise<SlotRow | undefined> {
    const { rows } = await this.run("select * from agorix_group_slots where slot_id = ?", [slotId]);
    return rows[0] === undefined ? undefined : toSlot(rows[0]);
  }

  async listSlots(groupId: string): Promise<readonly SlotRow[]> {
    const { rows } = await this.run(
      "select * from agorix_group_slots where group_id = ? order by created_at, slot_id",
      [groupId],
    );
    return rows.map(toSlot);
  }

  async deleteSlot(slotId: string): Promise<void> {
    await this.run("delete from agorix_group_devices where slot_id = ?", [slotId]);
    await this.run("delete from agorix_group_codes where slot_id = ?", [slotId]);
    await this.run("delete from agorix_group_slots where slot_id = ?", [slotId]);
  }

  async putCode(row: CodeRow): Promise<void> {
    await this.run(
      `insert into agorix_group_codes (code_hash, group_id, slot_id, created_at, expires_at, used_at)
       values (?, ?, ?, ?, ?, null)`,
      [row.codeHash, row.groupId, row.slotId ?? null, row.createdAt, row.expiresAt],
    );
  }

  async getCode(codeHash: string): Promise<CodeRow | undefined> {
    const { rows } = await this.run("select * from agorix_group_codes where code_hash = ?", [
      codeHash,
    ]);
    const row = rows[0];
    if (row === undefined) return undefined;
    const slotId = opt(row["slot_id"]);
    const usedAt = opt(row["used_at"]);
    return {
      codeHash: str(row["code_hash"]),
      groupId: str(row["group_id"]),
      ...(slotId === undefined ? {} : { slotId }),
      createdAt: str(row["created_at"]),
      expiresAt: str(row["expires_at"]),
      ...(usedAt === undefined ? {} : { usedAt }),
    };
  }

  async useCode(codeHash: string, at: string): Promise<boolean> {
    const result = await this.run(
      "update agorix_group_codes set used_at = ? where code_hash = ? and used_at is null",
      [at, codeHash],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countLiveCodes(groupId: string, nowIso: string): Promise<number> {
    const { rows } = await this.run(
      `select count(*) as n from agorix_group_codes
       where group_id = ? and used_at is null and expires_at > ?`,
      [groupId, nowIso],
    );
    return Number(rows[0]?.["n"] ?? 0);
  }

  async putDevice(row: DeviceRow): Promise<void> {
    await this.run(
      "insert into agorix_group_devices (token_hash, group_id, slot_id) values (?, ?, ?)",
      [row.tokenHash, row.groupId, row.slotId],
    );
  }

  async getDevice(tokenHash: string): Promise<DeviceRow | undefined> {
    const { rows } = await this.run(
      "select token_hash, group_id, slot_id from agorix_group_devices where token_hash = ?",
      [tokenHash],
    );
    const row = rows[0];
    return row === undefined
      ? undefined
      : {
          tokenHash: str(row["token_hash"]),
          groupId: str(row["group_id"]),
          slotId: str(row["slot_id"]),
        };
  }

  async deleteDevicesForSlot(slotId: string): Promise<void> {
    await this.run("delete from agorix_group_devices where slot_id = ?", [slotId]);
  }

  /** Account deletion: the organizer's group, everything under it, and the capability itself. */
  async deleteOrganizerData(accountId: string): Promise<void> {
    const group = await this.findGroupByOrganizer(accountId);
    if (group !== undefined) await this.deleteGroup(group.groupId);
    await this.run("delete from agorix_group_organizers where account_id = ?", [accountId]);
  }
}

function toGroup(row: GroupSqlRow): GroupRow {
  const authority: GroupAuthority =
    str(row["authority_kind"]) === "classroom"
      ? { kind: "classroom", authorizationRef: str(row["authorization_ref"]) }
      : { kind: "household" };
  return {
    groupId: str(row["group_id"]),
    organizerId: str(row["organizer_id"]),
    authority,
    createdAt: str(row["created_at"]),
    expiresAt: str(row["expires_at"]),
    locked: Number(row["locked"]) === 1,
  };
}

function toSlot(row: GroupSqlRow): SlotRow {
  const team = opt(row["team"]);
  const consentAttestedAt = opt(row["consent_attested_at"]);
  return {
    slotId: str(row["slot_id"]),
    groupId: str(row["group_id"]),
    alias: str(row["alias"]),
    status: str(row["status"]) === "approved" ? "approved" : "pending",
    ...(team === undefined ? {} : { team: team as TeamId }),
    ...(consentAttestedAt === undefined ? {} : { consentAttestedAt }),
    reconnects: Number(row["reconnects"]),
    createdAt: str(row["created_at"]),
  };
}
