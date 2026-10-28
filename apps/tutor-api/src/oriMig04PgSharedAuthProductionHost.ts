import { createOriMig04PgSharedAuthInfrastructure } from "./oriMig04PgSharedAuthInfrastructure.js";
import { startOriMig04ProductionStartup } from "./oriMig04ProductionStartup.js";

type Startup = Parameters<typeof startOriMig04ProductionStartup>[0];

/**
 * Explicit composition of a real PostgreSQL AuthService and the integrated
 * Ori host. The same durable account/session tables must also back web login.
 * No in-memory auth fallback and no environment-only pilot activation.
 */
export async function startOriMig04PgSharedAuthProductionHost({
  env,
  connectionString,
  tutor,
  ori,
  host,
  port,
  socket,
}: Omit<Startup, "ori"> & {
  readonly ori: Omit<Startup["ori"], "auth">;
}) {
  // Validate policy and transport before acquiring a PostgreSQL connection.
  if (env["AGORIX_ORI_MIG04_PILOT"] !== undefined &&
      env["AGORIX_ORI_MIG04_PILOT"] !== "0") {
    throw new Error("Ori MIG-04 pilot requires explicit trusted PostgreSQL host bootstrap");
  }
  if (socket) throw new Error("MIG-04 integrated host does not support Unix socket startup");
  if (!connectionString.trim()) throw new Error("MIG-04 requires a durable PostgreSQL connection");
  const sharedAuth = createOriMig04PgSharedAuthInfrastructure(connectionString);
  try {
    const runtime = await startOriMig04ProductionStartup({
      env,
      connectionString,
      tutor,
      ori: { ...ori, auth: sharedAuth.auth },
      ...(host ? { host } : {}),
      ...(port === undefined ? {} : { port }),
    });
    let closing: Promise<void> | undefined;
    return Object.freeze({
      ...runtime,
      auth: sharedAuth.auth,
      close(): Promise<void> {
        closing ??= (async () => {
          try {
            await runtime.close();
          } finally {
            await sharedAuth.close();
          }
        })();
        return closing;
      },
    });
  } catch (error) {
    await sharedAuth.close();
    throw error;
  }
}
