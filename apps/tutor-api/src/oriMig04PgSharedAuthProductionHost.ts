import { createOriMig04PgSharedAuthInfrastructure } from "./oriMig04PgSharedAuthInfrastructure.js";
import { startOriMig04ProductionStartup } from "./oriMig04ProductionStartup.js";
import { assertOriMig04StartupSafe } from "./oriMig04PgStartupGuard.js";
import { createOriMig04AuthenticatedSessionActions } from "./oriMig04AuthenticatedSessionActions.js";
import { assertOriMig04PgAuthSchemaReadiness } from "./oriMig04PgAuthSchemaReadiness.js";
import { createOriMig04WebAuthRoutes } from "./oriMig04WebAuthRoutes.js";

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
  assertOriMig04StartupSafe(env);
  if (socket) throw new Error("MIG-04 integrated host does not support Unix socket startup");
  if (!connectionString.trim()) throw new Error("MIG-04 requires a durable PostgreSQL connection");
  const sharedAuth = createOriMig04PgSharedAuthInfrastructure(connectionString);
  try {
    await assertOriMig04PgAuthSchemaReadiness(sharedAuth.sqlPool);
    const routeState: { dispatch?: ReturnType<typeof createOriMig04WebAuthRoutes> } = {};
    const runtime = await startOriMig04ProductionStartup({
      env,
      connectionString,
      tutor: {
        ...tutor,
        oriWebAuthDispatch: async (request, response) => {
          if (!routeState.dispatch) {
            response.writeHead(503);
            response.end();
            return true;
          }
          return routeState.dispatch(request, response);
        },
      },
      ori: { ...ori, auth: sharedAuth.auth },
      ...(host ? { host } : {}),
      ...(port === undefined ? {} : { port }),
    });
    const sessionActions = createOriMig04AuthenticatedSessionActions({
      auth: sharedAuth.auth,
      projects: runtime.authenticatedProjectLifecycle,
    });
    routeState.dispatch = createOriMig04WebAuthRoutes(sharedAuth.auth, sessionActions);
    let closing: Promise<void> | undefined;
    return Object.freeze({
      ...runtime,
      auth: sharedAuth.auth,
      sessionActions,
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
