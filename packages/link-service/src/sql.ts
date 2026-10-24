import type {
  CodeRow,
  EmailRow,
  LinkRepository,
  LinkRow,
  SummaryRow,
  TokenRow,
  VerificationRow,
} from "./types.js";

export type LinkSqlValue = string | number | null;
export type LinkSqlRow = Record<string, unknown>;
export type LinkSqlDialect = "postgresql" | "sqlite";

export interface LinkSqlExecutor {
  execute<R extends LinkSqlRow = LinkSqlRow>(
    sql: string,
    params?: readonly LinkSqlValue[],
  ): Promise<{ readonly rows: readonly R[]; readonly rowCount?: number }>;
}

const SCHEMA_SQL = `
create table if not exists agorix_adult_emails (
  account_id text primary key references agorix_accounts(account_id),
  email_normalized text not null unique,
  created_at text not null,
  verified_at text
);

create table if not exists agorix_email_verifications (
  token_hash text primary key,
  account_id text not null references agorix_accounts(account_id),
  email_normalized text not null,
  created_at text not null,
  expires_at text not null,
  used_at text
);
create index if not exists agorix_email_verifications_account_idx
  on agorix_email_verifications (account_id, created_at);

create table if not exists agorix_link_codes (
  code_hash text primary key,
  account_id text not null references agorix_accounts(account_id),
  created_at text not null,
  expires_at text not null,
  used_at text,
  revoked_at text
);
create index if not exists agorix_link_codes_account_idx
  on agorix_link_codes (account_id, expires_at);

create table if not exists agorix_device_links (
  link_id text primary key,
  account_id text not null references agorix_accounts(account_id),
  created_at text not null,
  last_seen_day text not null,
  sync_enabled integer not null,
  revoked_at text
);
create index if not exists agorix_device_links_account_idx
  on agorix_device_links (account_id, revoked_at);

create table if not exists agorix_device_tokens (
  token_hash text primary key,
  link_id text not null references agorix_device_links(link_id),
  created_at text not null,
  absolute_expires_at text not null,
  idle_expires_at text not null,
  replaced_at text,
  revoked_at text
);
create index if not exists agorix_device_tokens_link_idx on agorix_device_tokens (link_id);

create table if not exists agorix_link_summaries (
  link_id text primary key references agorix_device_links(link_id),
  json text not null,
  updated_at text not null
);
`;

export const LINK_SERVICE_MIGRATIONS = [
  {
    id: "001_create_link_service",
    postgresql: SCHEMA_SQL,
    sqlite: SCHEMA_SQL,
  },
  {
    id: "002_persist_link_redeem_failures",
    postgresql: `create table if not exists agorix_link_redeem_failures (
      scope_key text primary key, failure_count integer not null,
      window_start bigint not null, reset_at bigint not null
    ); create index if not exists agorix_link_redeem_failures_expiry_idx
      on agorix_link_redeem_failures (reset_at);`,
    sqlite: `create table if not exists agorix_link_redeem_failures (
      scope_key text primary key, failure_count integer not null,
      window_start bigint not null, reset_at bigint not null
    ); create index if not exists agorix_link_redeem_failures_expiry_idx
      on agorix_link_redeem_failures (reset_at);`,
  },
] as const;

function sqlFor(dialect: LinkSqlDialect, sql: string): string {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (dialect === "sqlite") return normalized;
  let index = 0;
  return normalized.replace(/\?/g, () => `$${++index}`);
}

const str = (value: unknown): string => String(value);
const opt = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value);

export class SqlLinkRepository implements LinkRepository {
  constructor(
    private readonly options: {
      readonly executor: LinkSqlExecutor;
      readonly dialect: LinkSqlDialect;
    },
  ) {}

  private run<R extends LinkSqlRow = LinkSqlRow>(
    sql: string,
    params: readonly LinkSqlValue[] = [],
  ) {
    return this.options.executor.execute<R>(sqlFor(this.options.dialect, sql), params);
  }

  async getRedeemFailureWindows(sourceKey: string, nowMs: number) {
    const { rows } = await this.run(
      `select scope_key, failure_count, reset_at from agorix_link_redeem_failures
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
      `insert into agorix_link_redeem_failures
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
    await this.run("delete from agorix_link_redeem_failures where reset_at <= ?", [nowMs]);
  }

  async getEmail(accountId: string): Promise<EmailRow | undefined> {
    const { rows } = await this.run(
      "select account_id, email_normalized, created_at, verified_at from agorix_adult_emails where account_id = ?",
      [accountId],
    );
    const row = rows[0];
    if (row === undefined) return undefined;
    const verifiedAt = opt(row["verified_at"]);
    return {
      accountId: str(row["account_id"]),
      emailNormalized: str(row["email_normalized"]),
      createdAt: str(row["created_at"]),
      ...(verifiedAt === undefined ? {} : { verifiedAt }),
    };
  }

  async findEmailOwner(emailNormalized: string): Promise<string | undefined> {
    const { rows } = await this.run(
      "select account_id from agorix_adult_emails where email_normalized = ?",
      [emailNormalized],
    );
    return rows[0] === undefined ? undefined : str(rows[0]["account_id"]);
  }

  async setEmail(row: EmailRow): Promise<void> {
    await this.run(
      `insert into agorix_adult_emails (account_id, email_normalized, created_at, verified_at)
       values (?, ?, ?, null)
       on conflict (account_id) do update
         set email_normalized = excluded.email_normalized, created_at = excluded.created_at, verified_at = null`,
      [row.accountId, row.emailNormalized, row.createdAt],
    );
  }

  async markEmailVerified(
    accountId: string,
    emailNormalized: string,
    at: string,
  ): Promise<boolean> {
    const result = await this.run(
      "update agorix_adult_emails set verified_at = ? where account_id = ? and email_normalized = ?",
      [at, accountId, emailNormalized],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async putVerification(row: VerificationRow): Promise<void> {
    await this.run(
      `insert into agorix_email_verifications
        (token_hash, account_id, email_normalized, created_at, expires_at, used_at)
       values (?, ?, ?, ?, ?, null)`,
      [row.tokenHash, row.accountId, row.emailNormalized, row.createdAt, row.expiresAt],
    );
  }

  async getVerification(tokenHash: string): Promise<VerificationRow | undefined> {
    const { rows } = await this.run(
      `select token_hash, account_id, email_normalized, created_at, expires_at, used_at
       from agorix_email_verifications where token_hash = ?`,
      [tokenHash],
    );
    const row = rows[0];
    if (row === undefined) return undefined;
    const usedAt = opt(row["used_at"]);
    return {
      tokenHash: str(row["token_hash"]),
      accountId: str(row["account_id"]),
      emailNormalized: str(row["email_normalized"]),
      createdAt: str(row["created_at"]),
      expiresAt: str(row["expires_at"]),
      ...(usedAt === undefined ? {} : { usedAt }),
    };
  }

  async useVerification(tokenHash: string, at: string): Promise<boolean> {
    const result = await this.run(
      "update agorix_email_verifications set used_at = ? where token_hash = ? and used_at is null",
      [at, tokenHash],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countVerificationsSince(accountId: string, sinceIso: string): Promise<number> {
    const { rows } = await this.run(
      "select count(*) as n from agorix_email_verifications where account_id = ? and created_at >= ?",
      [accountId, sinceIso],
    );
    return Number(rows[0]?.["n"] ?? 0);
  }

  async lastVerificationAt(accountId: string): Promise<string | undefined> {
    const { rows } = await this.run(
      "select max(created_at) as last from agorix_email_verifications where account_id = ?",
      [accountId],
    );
    return opt(rows[0]?.["last"]);
  }

  async putCode(row: CodeRow): Promise<void> {
    await this.run(
      `insert into agorix_link_codes (code_hash, account_id, created_at, expires_at, used_at, revoked_at)
       values (?, ?, ?, ?, null, null)
       on conflict (code_hash) do update
         set account_id = excluded.account_id, created_at = excluded.created_at,
             expires_at = excluded.expires_at, used_at = null, revoked_at = null`,
      [row.codeHash, row.accountId, row.createdAt, row.expiresAt],
    );
  }

  private codeFrom(row: LinkSqlRow): CodeRow {
    const usedAt = opt(row["used_at"]);
    const revokedAt = opt(row["revoked_at"]);
    return {
      codeHash: str(row["code_hash"]),
      accountId: str(row["account_id"]),
      createdAt: str(row["created_at"]),
      expiresAt: str(row["expires_at"]),
      ...(usedAt === undefined ? {} : { usedAt }),
      ...(revokedAt === undefined ? {} : { revokedAt }),
    };
  }

  async findLiveCode(codeHash: string, nowIso: string): Promise<CodeRow | undefined> {
    const { rows } = await this.run(
      `select code_hash, account_id, created_at, expires_at, used_at, revoked_at from agorix_link_codes
       where code_hash = ? and used_at is null and revoked_at is null and expires_at > ?`,
      [codeHash, nowIso],
    );
    return rows[0] === undefined ? undefined : this.codeFrom(rows[0]);
  }

  async listLiveCodes(accountId: string, nowIso: string): Promise<readonly CodeRow[]> {
    const { rows } = await this.run(
      `select code_hash, account_id, created_at, expires_at, used_at, revoked_at from agorix_link_codes
       where account_id = ? and used_at is null and revoked_at is null and expires_at > ?
       order by created_at`,
      [accountId, nowIso],
    );
    return rows.map((row) => this.codeFrom(row));
  }

  async markCodeUsed(codeHash: string, at: string): Promise<boolean> {
    const result = await this.run(
      "update agorix_link_codes set used_at = ? where code_hash = ? and used_at is null and revoked_at is null",
      [at, codeHash],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async revokeCode(codeHash: string, at: string): Promise<void> {
    await this.run("update agorix_link_codes set revoked_at = ? where code_hash = ?", [
      at,
      codeHash,
    ]);
  }

  async createLink(row: LinkRow): Promise<void> {
    await this.run(
      `insert into agorix_device_links (link_id, account_id, created_at, last_seen_day, sync_enabled, revoked_at)
       values (?, ?, ?, ?, ?, null)`,
      [row.linkId, row.accountId, row.createdAt, row.lastSeenDay, row.syncEnabled ? 1 : 0],
    );
  }

  private linkFrom(row: LinkSqlRow): LinkRow {
    const revokedAt = opt(row["revoked_at"]);
    return {
      linkId: str(row["link_id"]),
      accountId: str(row["account_id"]),
      createdAt: str(row["created_at"]),
      lastSeenDay: str(row["last_seen_day"]),
      syncEnabled: Number(row["sync_enabled"]) === 1,
      ...(revokedAt === undefined ? {} : { revokedAt }),
    };
  }

  async getLink(linkId: string): Promise<LinkRow | undefined> {
    const { rows } = await this.run(
      `select link_id, account_id, created_at, last_seen_day, sync_enabled, revoked_at
       from agorix_device_links where link_id = ?`,
      [linkId],
    );
    return rows[0] === undefined ? undefined : this.linkFrom(rows[0]);
  }

  async listLinks(accountId: string): Promise<readonly LinkRow[]> {
    const { rows } = await this.run(
      `select link_id, account_id, created_at, last_seen_day, sync_enabled, revoked_at
       from agorix_device_links where account_id = ? order by created_at`,
      [accountId],
    );
    return rows.map((row) => this.linkFrom(row));
  }

  async updateLink(
    linkId: string,
    change: { lastSeenDay?: string; syncEnabled?: boolean; revokedAt?: string },
  ): Promise<void> {
    const sets: string[] = [];
    const params: LinkSqlValue[] = [];
    if (change.lastSeenDay !== undefined) {
      sets.push("last_seen_day = ?");
      params.push(change.lastSeenDay);
    }
    if (change.syncEnabled !== undefined) {
      sets.push("sync_enabled = ?");
      params.push(change.syncEnabled ? 1 : 0);
    }
    if (change.revokedAt !== undefined) {
      sets.push("revoked_at = ?");
      params.push(change.revokedAt);
    }
    if (sets.length === 0) return;
    await this.run(`update agorix_device_links set ${sets.join(", ")} where link_id = ?`, [
      ...params,
      linkId,
    ]);
  }

  async putToken(row: TokenRow): Promise<void> {
    await this.run(
      `insert into agorix_device_tokens
        (token_hash, link_id, created_at, absolute_expires_at, idle_expires_at, replaced_at, revoked_at)
       values (?, ?, ?, ?, ?, null, null)`,
      [row.tokenHash, row.linkId, row.createdAt, row.absoluteExpiresAt, row.idleExpiresAt],
    );
  }

  async getToken(tokenHash: string): Promise<TokenRow | undefined> {
    const { rows } = await this.run(
      `select token_hash, link_id, created_at, absolute_expires_at, idle_expires_at, replaced_at, revoked_at
       from agorix_device_tokens where token_hash = ?`,
      [tokenHash],
    );
    const row = rows[0];
    if (row === undefined) return undefined;
    const replacedAt = opt(row["replaced_at"]);
    const revokedAt = opt(row["revoked_at"]);
    return {
      tokenHash: str(row["token_hash"]),
      linkId: str(row["link_id"]),
      createdAt: str(row["created_at"]),
      absoluteExpiresAt: str(row["absolute_expires_at"]),
      idleExpiresAt: str(row["idle_expires_at"]),
      ...(replacedAt === undefined ? {} : { replacedAt }),
      ...(revokedAt === undefined ? {} : { revokedAt }),
    };
  }

  async updateToken(
    tokenHash: string,
    change: { replacedAt?: string; revokedAt?: string },
  ): Promise<void> {
    const sets: string[] = [];
    const params: LinkSqlValue[] = [];
    if (change.replacedAt !== undefined) {
      sets.push("replaced_at = ?");
      params.push(change.replacedAt);
    }
    if (change.revokedAt !== undefined) {
      sets.push("revoked_at = ?");
      params.push(change.revokedAt);
    }
    if (sets.length === 0) return;
    await this.run(`update agorix_device_tokens set ${sets.join(", ")} where token_hash = ?`, [
      ...params,
      tokenHash,
    ]);
  }

  async revokeTokensForLink(linkId: string, at: string): Promise<void> {
    await this.run(
      "update agorix_device_tokens set revoked_at = ? where link_id = ? and revoked_at is null",
      [at, linkId],
    );
  }

  async deleteReplacedTokens(linkId: string, replacedBeforeIso: string): Promise<void> {
    await this.run(
      "delete from agorix_device_tokens where link_id = ? and replaced_at is not null and replaced_at < ?",
      [linkId, replacedBeforeIso],
    );
  }

  async putSummary(row: SummaryRow): Promise<void> {
    await this.run(
      `insert into agorix_link_summaries (link_id, json, updated_at) values (?, ?, ?)
       on conflict (link_id) do update set json = excluded.json, updated_at = excluded.updated_at`,
      [row.linkId, row.json, row.updatedAt],
    );
  }

  async getSummary(linkId: string): Promise<SummaryRow | undefined> {
    const { rows } = await this.run(
      "select link_id, json, updated_at from agorix_link_summaries where link_id = ?",
      [linkId],
    );
    const row = rows[0];
    return row === undefined
      ? undefined
      : { linkId: str(row["link_id"]), json: str(row["json"]), updatedAt: str(row["updated_at"]) };
  }

  async listRevokedLinksBefore(revokedBeforeIso: string): Promise<readonly string[]> {
    const { rows } = await this.run(
      "select link_id from agorix_device_links where revoked_at is not null and revoked_at < ?",
      [revokedBeforeIso],
    );
    return rows.map((row) => str(row["link_id"]));
  }

  async deleteLinkData(linkId: string): Promise<void> {
    await this.run("delete from agorix_link_summaries where link_id = ?", [linkId]);
    await this.run("delete from agorix_device_tokens where link_id = ?", [linkId]);
    await this.run("delete from agorix_device_links where link_id = ?", [linkId]);
  }

  async deleteAccountData(accountId: string): Promise<void> {
    await this.run(
      "delete from agorix_link_summaries where link_id in (select link_id from agorix_device_links where account_id = ?)",
      [accountId],
    );
    await this.run(
      "delete from agorix_device_tokens where link_id in (select link_id from agorix_device_links where account_id = ?)",
      [accountId],
    );
    await this.run("delete from agorix_device_links where account_id = ?", [accountId]);
    await this.run("delete from agorix_link_codes where account_id = ?", [accountId]);
    await this.run("delete from agorix_email_verifications where account_id = ?", [accountId]);
    await this.run("delete from agorix_adult_emails where account_id = ?", [accountId]);
  }
}
