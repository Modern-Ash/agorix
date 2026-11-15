import type { createOriMig04PgAuthenticatedTutorServer } from "./oriMig04PgAuthenticatedTutorServer.js";
import { startOriMig04PgIntegratedHost } from "./oriMig04PgIntegratedHost.js";
import { assertOriMig04StartupSafe } from "./oriMig04PgStartupGuard.js";

type IntegratedOptions = Parameters<typeof startOriMig04PgIntegratedHost>[0];

/**
 * Production process composition boundary. Reuses all legacy TutorServer
 * options while requiring explicit trusted deployment dependencies.
 * It does not enable the pilot or derive identity from environment variables.
 */
export async function startOriMig04ProductionStartup({
  env,
  connectionString,
  tutor,
  ori,
  host,
  port,
  socket,
}: {
  readonly env: Record<string, string | undefined>;
  readonly connectionString: string;
  readonly tutor: IntegratedOptions["tutor"];
  readonly ori: IntegratedOptions["ori"];
  readonly host?: string;
  readonly port?: number;
  readonly socket?: string;
}) {
  assertOriMig04StartupSafe(env);
  if (!connectionString || !connectionString.trim()) {
    throw new Error("MIG-04 requires a durable PostgreSQL connection");
  }
  if (!ori.auth || typeof ori.auth.resolveSession !== "function") {
    throw new Error("MIG-04 requires a shared trusted AuthService");
  }
  return startOriMig04PgIntegratedHost({
    connectionString,
    tutor,
    ori,
    ...(host ? { host } : {}),
    ...(port === undefined ? {} : { port }),
    ...(socket ? { socket } : {}),
  });
}

export type OriMig04ProductionTutorOptions =
  Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["tutor"];
