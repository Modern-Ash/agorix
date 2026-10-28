import type { AddressInfo } from "node:net";
import { createOriMig04PgAuthenticatedTutorServer } from "./oriMig04PgAuthenticatedTutorServer.js";
import { assertOriMig04PgReadiness } from "./oriMig04PgReadiness.js";
import { createOriMig04PgNodePool } from "./oriMig04PgNodePool.js";
import { assertOriMig04RuntimeDependencies } from "./oriMig04PgRuntimeDependencies.js";

/**
 * Infrastructure-owned AuthService-backed runtime with a real PostgreSQL pool.
 * It never derives identity, project selection or rollout authorization from
 * environment variables. The durable policy must be disabled at startup.
 */
export async function startOriMig04PgAuthenticatedRuntime({
  connectionString,
  tutor,
  ori,
  host = "127.0.0.1",
  port = 0,
}: {
  readonly connectionString: string;
  readonly tutor: Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["tutor"];
  readonly ori: Omit<Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["ori"], "pool">;
  readonly host?: string;
  readonly port?: number;
}) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("Invalid Ori host port");
  }
  assertOriMig04RuntimeDependencies(ori);
  const database = createOriMig04PgNodePool(connectionString);
  try {
    await assertOriMig04PgReadiness(database.pool, ori.deploymentId);
    const { server, emergencyDisable } = createOriMig04PgAuthenticatedTutorServer({
      tutor,
      ori: { ...ori, pool: database.pool },
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
            await new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            );
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
