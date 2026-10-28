import { describe, expect, it } from "vitest";
import { AuthService } from "@agorix/auth-service";
import { createOriMig04PgAuthAccountRepository, ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL } from "./oriMig04PgAuthAccountRepository.js";
import { createOriMig04PgAuthSessionRepository, ORI_MIG04_AUTH_SESSION_SCHEMA_SQL } from "./oriMig04PgAuthSessionRepository.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real AuthService across PostgreSQL clients", () => {
  it("registers, signs in, resolves and rotates across processes, then revokes", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const writer = new Pool({ connectionString: databaseUrl });
    const reader = new Pool({ connectionString: databaseUrl });
    const username = `ori_auth_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const password = "VeryStrongPassword_2026!";
    let accountId: string | undefined;
    try {
      await writer.query(ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL);
      await writer.query(ORI_MIG04_AUTH_SESSION_SCHEMA_SQL);
      const registration = new AuthService({
        accounts: createOriMig04PgAuthAccountRepository(writer),
        sessions: createOriMig04PgAuthSessionRepository(writer),
      });
      const remote = new AuthService({
        accounts: createOriMig04PgAuthAccountRepository(reader),
        sessions: createOriMig04PgAuthSessionRepository(reader),
      });
      const registered = await registration.register({ username, password });
      accountId = registered.account.accountId;
      const signedIn = await registration.signIn({ username, password });
      expect(signedIn.account.accountId).toBe(accountId);
      const resolved = await remote.resolveSession(signedIn.sessionToken);
      expect(resolved.account.accountId).toBe(accountId);
      expect(resolved.rotated).toBe(true);
      expect(resolved.previousSessionId).toBe(signedIn.session.sessionId);
      await expect(registration.resolveSession(signedIn.sessionToken)).rejects.toThrow();
      const next = await registration.resolveSession(resolved.sessionToken);
      expect(next.account.accountId).toBe(accountId);
      await remote.signOut(next.sessionToken);
      await expect(registration.resolveSession(next.sessionToken)).rejects.toThrow();
    } finally {
      if (accountId) {
        await writer.query("delete from agorix_auth_sessions where account_id = $1", [accountId]);
        await writer.query("delete from agorix_auth_accounts where account_id = $1", [accountId]);
      }
      await reader.end();
      await writer.end();
    }
  });
});
