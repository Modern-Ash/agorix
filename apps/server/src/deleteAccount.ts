import { AuthService, SqlAccountRepository, SqlSessionRepository } from "@agorix/auth-service";
import { SqlGroupRepository } from "@agorix/group-service";
import { SqlLinkRepository } from "@agorix/link-service";
import { SqlProjectRepository } from "@agorix/project-repository";
import type { SQLiteStore } from "./sqlite.js";
import type { PostgresStore } from "./postgres.js";

/** Deletes every account-owned row in one database transaction after a rate-limited password check. */
async function deleteSqlAccount(
  store: SQLiteStore | PostgresStore,
  dialect: "sqlite" | "postgresql",
  auth: AuthService,
  accountId: string,
  password: string,
): Promise<void> {
  await auth.verifyDeletionPassword(accountId, password);
  await store.transaction(async (executor) => {
    await new SqlGroupRepository({ executor, dialect }).deleteOrganizerData(accountId);
    await new SqlLinkRepository({ executor, dialect }).deleteAccountData(accountId);
    await new SqlProjectRepository({ executor, dialect }).deleteByOwner(accountId);
    await new SqlSessionRepository({ executor, dialect }).deleteForAccount(accountId);
    await new SqlAccountRepository({ executor, dialect }).deleteAccount(accountId);
  });
}

export function deleteSQLiteAccount(
  store: SQLiteStore,
  auth: AuthService,
  accountId: string,
  password: string,
): Promise<void> {
  return deleteSqlAccount(store, "sqlite", auth, accountId, password);
}

export function deletePostgresAccount(
  store: PostgresStore,
  auth: AuthService,
  accountId: string,
  password: string,
): Promise<void> {
  return deleteSqlAccount(store, "postgresql", auth, accountId, password);
}
