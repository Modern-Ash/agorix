import type { AddressInfo } from "node:net";
import { chmodSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { createOriMig04PgSessionProjectInfrastructure } from "./oriMig04PgSessionProjectInfrastructure.js";
import { assertOriMig04PgReadiness } from "./oriMig04PgReadiness.js";
import { assertOriMig04PgCanonicalSchemaReadiness } from "./oriMig04PgCanonicalSchemaReadiness.js";
import { assertOriMig04PgSessionMappingReadiness } from "./oriMig04PgSessionMappingReadiness.js";
import { assertOriMig04RuntimeDependencies } from "./oriMig04PgRuntimeDependencies.js";
import { createOriMig04PgAuthenticatedTutorServer } from "./oriMig04PgAuthenticatedTutorServer.js";
import { createOriMig04ActiveProjectResolver } from "./oriMig04TrustedSessionProject.js";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";
import { createOriMig04SessionRotationGuard } from "./oriMig04SessionRotationGuard.js";
import { createOriMig04AuthenticatedProjectLifecycle } from "./oriMig04AuthenticatedProjectLifecycle.js";

/**
 * One production composition root for canonical projects, session mappings,
 * AuthService, and fenced CAS. All database operations use the same owned pool.
 * Deployment must inject a real AuthService backed by shared durable sessions.
 */
export async function startOriMig04PgIntegratedHost({
  connectionString,
  tutor,
  ori,
  host = "127.0.0.1",
  port = 0,
  socket,
}: {
  readonly connectionString: string;
  readonly tutor: Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["tutor"];
  readonly ori: Omit<
    Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["ori"],
    "pool" | "repository" | "activeProject" | "sessionToken" | "onRotatedToken" | "onRotatedSession"
  >;
  readonly host?: string;
  readonly port?: number;
  readonly socket?: string;
}) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("Invalid Ori host port");
  }
  if (socket !== undefined && (!socket.startsWith("/") || socket.includes("\\0"))) {
    throw new Error("Invalid Ori Unix socket path");
  }
  const transport = createOriMig04SessionCookieTransport();
  // Validate the real authentication and rollout providers before opening a pool.
  assertOriMig04RuntimeDependencies(
    {
      ...ori,
      ...transport,
      repository: undefined,
      activeProject: async () => null,
    } as never,
    { repositoryProvidedByHost: true },
  );

  const infrastructure = createOriMig04PgSessionProjectInfrastructure(connectionString);
  try {
    await assertOriMig04PgReadiness(infrastructure.pool, ori.deploymentId);
    await assertOriMig04PgCanonicalSchemaReadiness(infrastructure.sqlPool);
    await assertOriMig04PgSessionMappingReadiness(infrastructure.sqlPool);
    const rotation = createOriMig04SessionRotationGuard(infrastructure.projectLifecycle);
    const { server, emergencyDisable } = createOriMig04PgAuthenticatedTutorServer({
      tutor,
      ori: {
        ...ori,
        ...transport,
        pool: infrastructure.pool,
        repository: infrastructure.repository,
        activeProject: createOriMig04ActiveProjectResolver(infrastructure.projectStore),
        onRotatedSession: rotation.onResolved,
      },
    });
    try {
      if (socket) {
        mkdirSync(dirname(socket), { recursive: true, mode: 0o755 });
        try {
          const existing = lstatSync(socket);
          if (!existing.isSocket()) throw new Error("Ori socket path is not a socket");
          unlinkSync(socket);
        } catch (error) {
          if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
            throw error;
          }
        }
      }
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        const ready = () => {
          server.off("error", reject);
          resolve();
        };
        if (socket) server.listen(socket, ready);
        else server.listen(port, host, ready);
      });
      if (socket) chmodSync(socket, 0o600);
    } catch (error) {
      server.close();
      throw error;
    }
    let closing: Promise<void> | undefined;
    return Object.freeze({
      address: server.address() as AddressInfo | string,
      emergencyDisable,
      projectLifecycle: infrastructure.projectLifecycle,
      authenticatedProjectLifecycle: createOriMig04AuthenticatedProjectLifecycle(
        infrastructure.projectLifecycle,
      ),
      close(): Promise<void> {
        closing ??= (async () => {
          try {
            await new Promise<void>((resolve, reject) => {
              server.close((error) => (error ? reject(error) : resolve()));
            });
          } finally {
            try {
              if (socket) {
                try {
                  unlinkSync(socket);
                } catch (error) {
                  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
                    throw error;
                  }
                }
              }
            } finally {
              await infrastructure.close();
            }
          }
        })();
        return closing;
      },
    });
  } catch (error) {
    await infrastructure.close();
    throw error;
  }
}
