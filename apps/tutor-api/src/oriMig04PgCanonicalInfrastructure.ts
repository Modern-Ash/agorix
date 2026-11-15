import { createOriMig04PgNodePool } from "./oriMig04PgNodePool.js";
import { createOriMig04PgProjectRepository } from "./oriMig04PgProjectRepository.js";

/**
 * Owns a single PostgreSQL pool shared by canonical project reads/writes and
 * fenced MIG-04 transactions. Caller must close it on startup failure/shutdown.
 */
export function createOriMig04PgCanonicalInfrastructure(connectionString: string) {
  const database = createOriMig04PgNodePool(connectionString);
  const repository = createOriMig04PgProjectRepository(database.sqlPool);
  return Object.freeze({
    pool: database.pool,
    sqlPool: database.sqlPool,
    repository,
    close: database.close,
  });
}
