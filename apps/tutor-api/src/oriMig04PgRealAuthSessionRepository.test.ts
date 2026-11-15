import { describe, expect, it } from "vitest";
import {
  createOriMig04PgAuthSessionRepository,
  ORI_MIG04_AUTH_SESSION_SCHEMA_SQL,
} from "./oriMig04PgAuthSessionRepository.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 durable AuthService sessions across processes", () => {
  it("shares sessions, rotates once, revokes and deletes by account", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    const prefix = `auth_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const accountId = prefix;
    const oldHash = `${prefix}_old`;
    const nextHash = `${prefix}_next`;
    const oldRecord = {
      tokenHash: oldHash,
      session: { accountId, sessionId: `${prefix}_session` },
      absoluteExpiresAt: "2030-01-01T00:00:00.000Z",
      idleExpiresAt: "2030-01-01T00:00:00.000Z",
    };
    const nextRecord = {
      ...oldRecord,
      tokenHash: nextHash,
      session: { accountId, sessionId: `${prefix}_rotated` },
    };
    try {
      await pool.query(ORI_MIG04_AUTH_SESSION_SCHEMA_SQL);
      const writer = createOriMig04PgAuthSessionRepository(pool);
      const reader = createOriMig04PgAuthSessionRepository(pool);
      await writer.create(oldRecord as never);
      expect(await reader.findByTokenHash(oldHash)).toEqual(oldRecord);
      await writer.replace(oldHash, nextRecord as never, new Date().toISOString());
      expect(await reader.findByTokenHash(oldHash)).toBeUndefined();
      expect(await reader.findByTokenHash(nextHash)).toEqual(nextRecord);
      await expect(
        writer.replace(oldHash, nextRecord as never, new Date().toISOString()),
      ).rejects.toThrow("Auth session rotation conflict");
      await reader.revoke(nextHash, "2026-10-28T00:00:00.000Z");
      expect((await writer.findByTokenHash(nextHash))?.revokedAt).toBe(
        "2026-10-28T00:00:00.000Z",
      );
      await writer.deleteForAccount(accountId);
      expect(await reader.findByTokenHash(nextHash)).toBeUndefined();
    } finally {
      await pool.query("delete from agorix_auth_sessions where account_id = $1", [accountId]);
      await pool.end();
    }
  });
});
