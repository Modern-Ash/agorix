import type { Pool } from "pg";
import type { SessionRecord, SessionRepository } from "@agorix/auth-service";

/**
 * Durable AuthService session repository. Multiple processes can use the same
 * PostgreSQL database without sharing process memory or raw session tokens.
 */
export function createOriMig04PgAuthSessionRepository(
  pool: Pick<Pool, "query">,
): SessionRepository {
  return Object.freeze({
    async findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
      const result = await pool.query<{ record: SessionRecord }>(
        "select record from agorix_auth_sessions where token_hash = $1",
        [tokenHash],
      );
      return result.rows[0]?.record;
    },
    async create(record: SessionRecord): Promise<void> {
      await pool.query(
        "insert into agorix_auth_sessions (token_hash, account_id, record) values ($1, $2, $3::jsonb)",
        [record.tokenHash, record.session.accountId, JSON.stringify(record)],
      );
    },
    async replace(
      previousTokenHash: string,
      nextRecord: SessionRecord,
      revokedAt: string,
    ): Promise<void> {
      // Atomic conditional replacement: only one concurrent rotation can win.
      const result = await pool.query(
        `with moved as (
          delete from agorix_auth_sessions
          where token_hash = $1 and account_id = $2
            and record->>'revokedAt' is null
          returning account_id
        )
        insert into agorix_auth_sessions (token_hash, account_id, record)
        select $3, account_id, $4::jsonb from moved
        returning token_hash`,
        [
          previousTokenHash,
          nextRecord.session.accountId,
          nextRecord.tokenHash,
          JSON.stringify(nextRecord),
        ],
      );
      if (result.rowCount !== 1) {
        throw new Error("Auth session rotation conflict");
      }
      void revokedAt;
    },
    async revoke(tokenHash: string, revokedAt: string): Promise<void> {
      await pool.query(
        `update agorix_auth_sessions
         set record = jsonb_set(record, '{revokedAt}', to_jsonb($2::text))
         where token_hash = $1 and record->>'revokedAt' is null`,
        [tokenHash, revokedAt],
      );
    },
    async deleteForAccount(accountId: string): Promise<void> {
      await pool.query("delete from agorix_auth_sessions where account_id = $1", [accountId]);
    },
  });
}

export const ORI_MIG04_AUTH_SESSION_SCHEMA_SQL = `
create table if not exists agorix_auth_sessions (
  token_hash text primary key,
  account_id text not null,
  record jsonb not null
);
create index if not exists agorix_auth_sessions_account_idx
  on agorix_auth_sessions (account_id);
`;
