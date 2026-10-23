import { chmodSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { createProjectApi } from "@agorix/project-api";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { createProjectHttpServer } from "./server.js";

// #347 will add a durable repository. Explicit opt-in prevents accidentally running
// a production account service whose data disappears when the process restarts.
if (process.env["AGORIX_PROJECT_STORAGE"] !== "memory") {
  throw new Error("Set AGORIX_PROJECT_STORAGE=memory for temporary development use");
}
const origin = process.env["AGORIX_PROJECT_ORIGIN"];
if (!origin || !/^https:\/\/[^/]+$/.test(origin)) {
  throw new Error("AGORIX_PROJECT_ORIGIN must be a single HTTPS origin");
}

const socket = process.env["AGORIX_PROJECT_SOCKET"];
const portRaw = process.env["AGORIX_PROJECT_PORT"];
if (!socket && !portRaw) {
  throw new Error("Set AGORIX_PROJECT_SOCKET or AGORIX_PROJECT_PORT");
}
const port = portRaw === undefined ? undefined : Number(portRaw);
if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65_535)) {
  throw new Error("AGORIX_PROJECT_PORT must be a valid TCP port");
}

const auth = new AuthService({
  accounts: new InMemoryAccountRepository(),
  sessions: new InMemorySessionRepository(),
});
const api = createProjectApi({
  auth,
  projects: new InMemoryProjectRepository(),
  allowedOrigins: [origin],
  secureCookies: true,
});
const server = createProjectHttpServer({
  api,
  log: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
});

if (socket) {
  mkdirSync(dirname(socket), { recursive: true, mode: 0o750 });
  try {
    if (!lstatSync(socket).isSocket()) throw new Error("Socket path already exists");
    unlinkSync(socket);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  server.listen(socket, () => {
    // nginx's unprivileged worker runs under a different uid inside its container.
    // The directory is host-local and bind-mounted read-only into that container.
    chmodSync(socket, 0o666);
    process.stdout.write("project server listening on Unix socket\n");
  });
} else {
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write("project server listening on loopback\n");
  });
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      if (socket) {
        try {
          unlinkSync(socket);
        } catch (error) {
          // Node may unlink its Unix socket as part of Server.close().
          if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
            throw error;
          }
        }
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5_000).unref();
  });
}
