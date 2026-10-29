import { chmodSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
  SqlAccountRepository,
  SqlSessionRepository,
} from "@agorix/auth-service";
import { GroupService, InMemoryGroupRepository, SqlGroupRepository } from "@agorix/group-service";
import {
  InMemoryLinkRepository,
  LinkService,
  MailDeliveryError,
  SqlLinkRepository,
} from "@agorix/link-service";
import { readGroupConfig, readGroupConfigSource, startGroupConfigSync } from "./groupConfig.js";
import { readLinkConfig } from "./linkConfig.js";
import { createProjectApi } from "@agorix/project-api";
import { InMemoryProjectRepository, SqlProjectRepository } from "@agorix/project-repository";
import { deletePostgresAccount, deleteSQLiteAccount } from "./deleteAccount.js";
import { createProjectHttpServer } from "./server.js";
import { openPostgresStore } from "./postgres.js";
import { openSQLiteStore } from "./sqlite.js";

const storage = process.env["AGORIX_PROJECT_STORAGE"];
if (storage !== "memory" && storage !== "sqlite" && storage !== "postgresql") {
  throw new Error("Set AGORIX_PROJECT_STORAGE=sqlite, postgresql or memory explicitly");
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
const postgresUrl = process.env["AGORIX_PROJECT_DATABASE_URL"];
if (storage === "postgresql" && !postgresUrl) {
  throw new Error("AGORIX_PROJECT_DATABASE_URL is required for PostgreSQL storage");
}
const sqlite = storage === "sqlite" ? openSQLiteStore(sqlitePath!) : undefined;
const postgres = storage === "postgresql" ? await openPostgresStore(postgresUrl!) : undefined;
const sqlStore = sqlite ?? postgres;
const sqlDialect = sqlite ? "sqlite" : "postgresql";
const accounts = sqlStore
  ? new SqlAccountRepository({ executor: sqlStore, dialect: sqlDialect })
  : new InMemoryAccountRepository();
const sessions = sqlStore
  ? new SqlSessionRepository({ executor: sqlStore, dialect: sqlDialect })
  : new InMemorySessionRepository();
const projects = sqlStore
  ? new SqlProjectRepository({ executor: sqlStore, dialect: sqlDialect })
  : new InMemoryProjectRepository();
const auth = new AuthService({ accounts, sessions });
const { secret: linkSecret, mailer } = readLinkConfig(process.env, origin);
const allowedAdultEmail = process.env["AGORIX_ALLOWED_ADULT_EMAIL"]?.trim();
if (process.env["AGORIX_PRIVATE_ADULT_PILOT"] === "1" && linkSecret && !allowedAdultEmail) {
  throw new Error("Private adult pilot requires an allowed adult email");
}
const link = linkSecret
  ? new LinkService({
      repository: sqlStore
        ? new SqlLinkRepository({ executor: sqlStore, dialect: sqlDialect })
        : new InMemoryLinkRepository(),
      secret: linkSecret,
      ...(mailer ? { mailer } : {}),
      // Kind only: never the address, the token or the server's reply.
      onMailError: (error) =>
        process.stdout.write(
          `mail delivery failed: ${error instanceof MailDeliveryError ? error.kind : "unknown"}\n`,
        ),
    })
  : undefined;
if (link) {
  process.stdout.write(
    mailer
      ? "adult link enabled; verification email via SMTP\n"
      : "adult link enabled; no mail transport configured, verification email is not delivered\n",
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
const { secret: groupSecret } = readGroupConfig(process.env, link !== undefined);
const group =
  groupSecret && link
    ? new GroupService({
        repository: sqlStore
          ? new SqlGroupRepository({ executor: sqlStore, dialect: sqlDialect })
          : new InMemoryGroupRepository(),
        adults: { hasVerifiedEmail: async (id) => (await link.emailStatus(id)).verified },
        secret: groupSecret,
      })
    : undefined;
if (group) {
  process.stdout.write("closed groups enabled\n");
  const configSource = readGroupConfigSource(process.env);
  if (configSource) {
    // Limits follow the admin registry; without it the code defaults (already within ADR 0010) apply.
    startGroupConfigSync({
      source: configSource,
      apply: (limits) =>
        group.updatePolicy({
          maxChildren: limits.maxChildren,
          groupTtlMs: limits.maxSessionMinutes * 60_000,
          joinCodeTtlMs: limits.joinCodeMinutes * 60_000,
        }),
      log: (line) => process.stdout.write(`${line}\n`),
    });
  }
  const sweep = setInterval(
    () => {
      void group
        .sweepExpired()
        .then((count) => process.stdout.write(`group sweep ${count}\n`))
        .catch(() => process.stdout.write("group sweep failed\n"));
    },
    10 * 60 * 1000,
  );
  sweep.unref();
}
const api = createProjectApi({
  auth,
  ...(link ? { link, requireEmail: true } : {}),
  ...(group ? { group } : {}),
  ...(allowedAdultEmail ? { allowedAdultEmails: [allowedAdultEmail] } : {}),
  projects,
  ...(sqlStore
    ? {
        deleteAccount: (accountId: string, password: string) =>
          sqlite
            ? deleteSQLiteAccount(sqlite, auth, accountId, password)
            : deletePostgresAccount(postgres!, auth, accountId, password),
      }
    : {}),
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
      void sqlStore
        ?.close()
        .then(() => finish())
        .catch(() => process.exit(1));
      if (!sqlStore) finish();
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
