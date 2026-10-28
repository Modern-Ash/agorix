import { createOriMig04PgCanonicalInfrastructure } from "./oriMig04PgCanonicalInfrastructure.js";
import { createOriMig04PgSessionProjectStore } from "./oriMig04PgSessionProjectStore.js";

/**
 * Shared PostgreSQL infrastructure for canonical projects, fenced CAS and
 * authenticated session-project selection. Caller owns the pool lifecycle.
 */
export function createOriMig04PgSessionProjectInfrastructure(connectionString: string) {
  const infrastructure = createOriMig04PgCanonicalInfrastructure(connectionString);
  return Object.freeze({
    ...infrastructure,
    projectStore: createOriMig04PgSessionProjectStore(infrastructure.sqlPool),
  });
}
