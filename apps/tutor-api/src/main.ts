import { configFromEnv } from "./index.js";
import { createTutorServer } from "./server.js";
import { createOriCliService, oriCliConfigFromEnv } from "./oriCli.js";
import { chmodSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

// Entry point (issue #348): `node dist/main.js`. Binds loopback unless the deployment
// explicitly sets AGORIX_TUTOR_HOST (for example inside a container network).
const config = configFromEnv(process.env);
const host = process.env["AGORIX_TUTOR_HOST"] ?? "127.0.0.1";
const port = Number.parseInt(process.env["AGORIX_TUTOR_PORT"] ?? "8471", 10);
const socket = process.env["AGORIX_TUTOR_SOCKET"];

const server = createTutorServer({
  config,
  ori: createOriCliService(oriCliConfigFromEnv(process.env)),
});
if (socket) {
  mkdirSync(dirname(socket), { recursive: true, mode: 0o755 });
  try {
    const existing = lstatSync(socket);
    if (!existing.isSocket()) throw new Error("AGORIX_TUTOR_SOCKET exists and is not a socket");
    unlinkSync(socket);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  server.listen(socket, () => {
    chmodSync(socket, 0o666);
    process.stdout.write("tutor-api listening on Unix socket\n");
  });
} else {
  server.listen(port, host, () => {
    process.stdout.write(`tutor-api listening on ${host}:${port}\n`);
  });
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      if (socket) {
        try {
          unlinkSync(socket);
        } catch (error) {
          if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
            throw error;
        }
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
