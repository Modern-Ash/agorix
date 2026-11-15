import { describe, expect, it } from "vitest";
import { createOriMig04PgAuthAccountRepository, ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL } from "./oriMig04PgAuthAccountRepository.js";
import { createOriMig04PgAuthSessionRepository, ORI_MIG04_AUTH_SESSION_SCHEMA_SQL } from "./oriMig04PgAuthSessionRepository.js";
import { assertOriMig04PgAuthSchemaReadiness } from "./oriMig04PgAuthSchemaReadiness.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 shared PostgreSQL AuthService repositories", () => {
  it("shares account and session records between independent clients", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const writer = new Pool({ connectionString: databaseUrl });
    const reader = new Pool({ connectionString: databaseUrl });
    const accountId = `auth_owner_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const normalizedUsername = accountId;
    const tokenHash = `${accountId}_hash`;
    const account = {
      account: { accountId },
      credential: { normalizedUsername },
    };
    const session = {
      tokenHash,
      session: { accountId, sessionId: `${accountId}_session` },
      absoluteExpiresAt: "2030-01-01T00:00:00.000Z",
      idleExpiresAt: "2030-01-01T00:00:00.000Z",
    };
    try {
      await writer.query(ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL);
      await writer.query(ORI_MIG04_AUTH_SESSION_SCHEMA_SQL);
      await expect(assertOriMig04PgAuthSchemaReadiness(reader)).resolves.toBeUndefined();
      const accountsWriter = createOriMig04PgAuthAccountRepository(writer);
      const accountsReader = createOriMig04PgAuthAccountRepository(reader);
      const sessionsWriter = createOriMig04PgAuthSessionRepository(writer);
      const sessionsReader = createOriMig04PgAuthSessionRepository(reader);
      await accountsWriter.create(account as never);
      await sessionsWriter.create(session as never);
      expect(await accountsReader.findByAccountId(accountId)).toEqual(account);
      expect(await accountsReader.findByNormalizedUsername(normalizedUsername)).toEqual(account);
      expect(await sessionsReader.findByTokenHash(tokenHash)).toEqual(session);
      await sessionsWriter.deleteForAccount(accountId);
      await accountsWriter.deleteAccount(accountId);
      expect(await accountsReader.findByAccountId(accountId)).toBeUndefined();
      expect(await sessionsReader.findByTokenHash(tokenHash)).toBeUndefined();
    } finally {
      await writer.query("delete from agorix_auth_sessions where account_id = $1", [accountId]);
      await writer.query("delete from agorix_auth_accounts where account_id = $1", [accountId]);
      await reader.end();
      await writer.end();
    }
  });
});
