import { AuthService, SqlAccountRepository, SqlSessionRepository } from "@agorix/auth-service";
import { SqlGroupRepository } from "@agorix/group-service";
import { SqlLinkRepository } from "@agorix/link-service";
import { SqlProjectRepository } from "@agorix/project-repository";
import type { SQLiteStore } from "./sqlite.js";

/** Deletes every account-owned row in one SQLite transaction after a rate-limited password check. */
export async function deleteSQLiteAccount(
  store: SQLiteStore,
  auth: AuthService,
  accountId: string,
  password: string,
): Promise<void> {
  await auth.verifyDeletionPassword(accountId, password);
  await store.transaction(async (executor) => {
    await new SqlGroupRepository({ executor, dialect: "sqlite" }).deleteOrganizerData(accountId);
    await new SqlLinkRepository({ executor, dialect: "sqlite" }).deleteAccountData(accountId);
    await new SqlProjectRepository({ executor, dialect: "sqlite" }).deleteByOwner(accountId);
    await new SqlSessionRepository({ executor, dialect: "sqlite" }).deleteForAccount(accountId);
    await new SqlAccountRepository({ executor, dialect: "sqlite" }).deleteAccount(accountId);
  });
}
