import type { AddressInfo } from "node:net";
import { createOriMig04PgCanonicalInfrastructure } from "./oriMig04PgCanonicalInfrastructure.js";
import { assertOriMig04PgReadiness } from "./oriMig04PgReadiness.js";
import { createOriMig04PgAuthenticatedTutorServer } from "./oriMig04PgAuthenticatedTutorServer.js";
import { assertOriMig04RuntimeDependencies } from "./oriMig04PgRuntimeDependencies.js";
import { assertOriMig04PgCanonicalSchemaReadiness } from "./oriMig04PgCanonicalSchemaReadiness.js";
import { assertOriMig04PgSessionMappingReadiness } from "./oriMig04PgSessionMappingReadiness.js";

/**
 * Canonical deployment path: the same PostgreSQL pool owns repository reads
 * and fenced CAS writes. Never accepts a second, divergent project repository.
 */
export async function startOriMig04PgCanonicalAuthenticatedRuntime({
  connectionString,
  tutor,
  ori,
  host = "127.0.0.1",
  port = 0,
}: {
  readonly connectionString: string;
  readonly tutor: Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["tutor"];
  readonly ori: Omit<
    Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["ori"],
    "pool" | "repository"
  >;
  readonly host?: string;
  readonly port?: number;
}) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("Invalid Ori host port");
  }
  assertOriMig04RuntimeDependencies(ori as never, { repositoryProvidedByHost: true });
  const database = createOriMig04PgCanonicalInfrastructure(connectionString);
  try {
    await assertOriMig04PgReadiness(database.pool, ori.deploymentId);
    await assertOriMig04PgCanonicalSchemaReadiness(database.sqlPool);
    await assertOriMig04PgSessionMappingReadiness(database.sqlPool);
    const { server, emergencyDisable } = createOriMig04PgAuthenticatedTutorServer({
      tutor,
      ori: { ...ori, pool: database.pool, repository: database.repository },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
    } catch (error) {
      server.close();
      throw error;
    }
    let closing: Promise<void> | undefined;
    return Object.freeze({
      address: server.address() as AddressInfo,
      emergencyDisable,
      close(): Promise<void> {
        closing ??= (async () => {
          try {
            await new Promise<void>((resolve, reject) => {
              server.close((error) => (error ? reject(error) : resolve()));
            });
          } finally {
            await database.close();
          }
        })();
        return closing;
      },
    });
  } catch (error) {
    await database.close();
    throw error;
  }
}
