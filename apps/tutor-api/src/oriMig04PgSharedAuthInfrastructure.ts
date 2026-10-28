import { AuthService } from "@agorix/auth-service";
import { Pool } from "pg";
import { createOriMig04PgAuthAccountRepository } from "./oriMig04PgAuthAccountRepository.js";
import { createOriMig04PgAuthSessionRepository } from "./oriMig04PgAuthSessionRepository.js";

/**
 * Both web and tutor-api must use the same durable account and session tables.
 * Caller owns the pool lifecycle. Schema migrations run separately.
 */
export function createOriMig04PgSharedAuthInfrastructure(connectionString: string) {
  if (!connectionString.trim()) throw new Error("Shared AuthService requires PostgreSQL");
  const pool = new Pool({ connectionString });
  const accounts = createOriMig04PgAuthAccountRepository(pool);
  const sessions = createOriMig04PgAuthSessionRepository(pool);
  return Object.freeze({
    auth: new AuthService({ accounts, sessions }),
    accounts,
    sessions,
    sqlPool: pool,
    close: () => pool.end(),
  });
}
