import { chmodSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
  SqlAccountRepository,
  SqlSessionRepository,
} from "@agorix/auth-service";
import { InMemoryLinkRepository, LinkService, SqlLinkRepository } from "@agorix/link-service";
import { createProjectApi } from "@agorix/project-api";
import { InMemoryProjectRepository, SqlProjectRepository } from "@agorix/project-repository";
import { createProjectHttpServer } from "./server.js";
import { openSQLiteStore } from "./sqlite.js";

const storage = process.env["AGORIX_PROJECT_STORAGE"];
if (storage !== "memory" && storage !== "sqlite") {
  throw new Error("Set AGORIX_PROJECT_STORAGE=sqlite or memory explicitly");
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

const sqlitePath = process.env["AGORIX_PROJECT_DB_PATH"];
if (storage === "sqlite" && (!sqlitePath || !sqlitePath.startsWith("/"))) {
  throw new Error("AGORIX_PROJECT_DB_PATH must be an absolute path for SQLite storage");
}
const sqlite = storage === "sqlite" ? openSQLiteStore(sqlitePath!) : undefined;
const accounts = sqlite
  ? new SqlAccountRepository({ executor: sqlite, dialect: "sqlite" })
  : new InMemoryAccountRepository();
const sessions = sqlite
  ? new SqlSessionRepository({ executor: sqlite, dialect: "sqlite" })
  : new InMemorySessionRepository();
const projects = sqlite
  ? new SqlProjectRepository({ executor: sqlite, dialect: "sqlite" })
  : new InMemoryProjectRepository();
const auth = new AuthService({ accounts, sessions });
// The adult-link feature is off unless a secret is configured (docs/deployment).
const linkSecret = process.env["AGORIX_LINK_SECRET"];
if (linkSecret !== undefined && linkSecret.length < 32) {
  throw new Error("AGORIX_LINK_SECRET must be at least 32 characters");
}
const link = linkSecret
  ? new LinkService({
      repository: sqlite
        ? new SqlLinkRepository({ executor: sqlite, dialect: "sqlite" })
        : new InMemoryLinkRepository(),
      secret: linkSecret,
    })
  : undefined;
if (link) {
  process.stdout.write(
    "adult link enabled; verification email is not delivered until a mailer is configured\n",
  );
  const purge = setInterval(
    () => {
      void link
        .purgeExpired()
        .then((result) => process.stdout.write(`link purge ${result.purgedLinks}\n`))
        .catch(() => process.stdout.write("link purge failed\n"));
    },
    6 * 60 * 60 * 1000,
  );
  purge.unref();
}
const api = createProjectApi({
  auth,
  ...(link ? { link } : {}),
  projects,
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
      void sqlite
        ?.close()
        .then(() => finish())
        .catch(() => process.exit(1));
      if (!sqlite) finish();
    });
    function finish() {
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
    }
    setTimeout(() => process.exit(1), 5_000).unref();
  });
}
