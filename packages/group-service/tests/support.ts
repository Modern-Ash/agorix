import { DatabaseSync } from "node:sqlite";
import {
  GROUP_SERVICE_MIGRATIONS,
  GroupService,
  InMemoryGroupRepository,
  SqlGroupRepository,
  type AdultDirectory,
  type GroupRepository,
  type GroupSqlValue,
} from "../src/index.js";

export type Backend = "memory" | "sqlite";

export const SECRET = "g".repeat(40);

export class FakeClock {
  constructor(private ms = Date.parse("2026-10-25T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.ms);
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

/** Deterministic byte stream so codes, aliases and tokens are reproducible. */
export function counterRandom(start = 1) {
  let n = start;
  return {
    bytes(length: number): Uint8Array {
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        n = (n * 1103515245 + 12345) >>> 0;
        out[i] = (n >>> 16) & 0xff;
      }
      return out;
    },
  };
}

export class FakeAdults implements AdultDirectory {
  readonly verified = new Set<string>(["org-1", "org-2"]);
  async hasVerifiedEmail(accountId: string): Promise<boolean> {
    return this.verified.has(accountId);
  }
}

/** What is left behind in storage, read straight from the backing store. */
export interface Inspector {
  sizes(): Promise<{ groups: number; slots: number; codes: number; devices: number }>;
  dump(): Promise<unknown>;
}

function memoryBackend(): { repository: GroupRepository; inspect: Inspector } {
  const repository = new InMemoryGroupRepository();
  return {
    repository,
    inspect: { sizes: async () => repository.sizes(), dump: async () => repository.dump() },
  };
}

function sqliteBackend(): { repository: GroupRepository; inspect: Inspector } {
  const db = new DatabaseSync(":memory:");
  db.exec("pragma foreign_keys = on");
  db.exec("create table agorix_accounts (account_id text primary key)");
  db.exec("insert into agorix_accounts values ('org-1'), ('org-2')");
  for (const migration of GROUP_SERVICE_MIGRATIONS) db.exec(migration.sqlite);
  const executor = {
    async execute(sql: string, params: readonly GroupSqlValue[] = []) {
      const statement = db.prepare(sql);
      if (statement.columns().length > 0) {
        const rows = statement.all(...params) as Record<string, unknown>[];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: Number(statement.run(...params).changes) };
    },
  };
  const count = (table: string) =>
    Number((db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n);
  return {
    repository: new SqlGroupRepository({ executor, dialect: "sqlite" }),
    inspect: {
      sizes: async () => ({
        groups: count("agorix_groups"),
        slots: count("agorix_group_slots"),
        codes: count("agorix_group_codes"),
        devices: count("agorix_group_devices"),
      }),
      dump: async () => ({
        groups: db.prepare("select * from agorix_groups").all(),
        slots: db.prepare("select * from agorix_group_slots").all(),
        codes: db.prepare("select * from agorix_group_codes").all(),
        devices: db.prepare("select * from agorix_group_devices").all(),
      }),
    },
  };
}

export function build(
  backend: Backend,
  policy: ConstructorParameters<typeof GroupService>[0]["policy"] = {},
) {
  const clock = new FakeClock();
  const { repository, inspect } = backend === "memory" ? memoryBackend() : sqliteBackend();
  const adults = new FakeAdults();
  const service = new GroupService({
    repository,
    adults,
    secret: SECRET,
    clock,
    random: counterRandom(),
    policy,
  });
  return { clock, repository, inspect, adults, service };
}

export async function organizerWithGroup(ctx: ReturnType<typeof build>, accountId = "org-1") {
  await ctx.service.grantOrganizer(accountId);
  const group = await ctx.service.createGroup(accountId, {
    authority: { kind: "household" },
  });
  return { accountId, group };
}

/** Child device redeems a code and the organizer approves: returns the device token. */
export async function admit(
  ctx: ReturnType<typeof build>,
  accountId: string,
  groupId: string,
  source = "src-a",
) {
  const { code } = await ctx.service.issueJoinCode(accountId, groupId);
  const pending = await ctx.service.redeemJoinCode(code, source);
  const slot = await ctx.service.approve(accountId, groupId, pending.slotId, {
    consentAttested: true,
  });
  return { slot, deviceToken: pending.deviceToken };
}
