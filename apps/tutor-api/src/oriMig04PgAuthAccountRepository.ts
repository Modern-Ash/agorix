import type { Pool } from "pg";
import type { AccountRecord, AccountRepository, PasswordCredentialRecord } from "@agorix/auth-service";

/** Durable AuthService accounts, shared by web login and tutor-api. */
export function createOriMig04PgAuthAccountRepository(
  pool: Pick<Pool, "query">,
): AccountRepository {
  return Object.freeze({
    async findByNormalizedUsername(username: string): Promise<AccountRecord | undefined> {
      const result = await pool.query<{ record: AccountRecord }>(
        "select record from agorix_auth_accounts where normalized_username = $1",
        [username],
      );
      return result.rows[0]?.record;
    },
    async findByAccountId(accountId: string): Promise<AccountRecord | undefined> {
      const result = await pool.query<{ record: AccountRecord }>(
        "select record from agorix_auth_accounts where account_id = $1",
        [accountId],
      );
      return result.rows[0]?.record;
    },
    async create(record: AccountRecord): Promise<void> {
      await pool.query(
        "insert into agorix_auth_accounts (account_id, normalized_username, record) values ($1, $2, $3::jsonb)",
        [record.account.accountId, record.credential.normalizedUsername, JSON.stringify(record)],
      );
    },
    async updateCredential(
      accountId: string,
      credential: PasswordCredentialRecord,
    ): Promise<void> {
      const result = await pool.query(
        `update agorix_auth_accounts
         set record = jsonb_set(record, '{credential}', $2::jsonb)
         where account_id = $1`,
        [accountId, JSON.stringify(credential)],
      );
      if (result.rowCount !== 1) throw new Error("Auth account not found");
    },
    async deleteAccount(accountId: string): Promise<void> {
      await pool.query("delete from agorix_auth_accounts where account_id = $1", [accountId]);
    },
  });
}

export const ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL = `
create table if not exists agorix_auth_accounts (
  account_id text primary key,
  normalized_username text not null unique,
  record jsonb not null
);
`;
