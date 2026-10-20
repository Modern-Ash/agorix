import { configFromEnv } from "./index.js";
import { createTutorServer } from "./server.js";

// Entry point (issue #348): `node dist/main.js`. Binds loopback unless the deployment
// explicitly sets AGORIX_TUTOR_HOST (for example inside a container network).
const config = configFromEnv(process.env);
const host = process.env["AGORIX_TUTOR_HOST"] ?? "127.0.0.1";
const port = Number.parseInt(process.env["AGORIX_TUTOR_PORT"] ?? "8471", 10);

const server = createTutorServer({ config });
server.listen(port, host, () => {
  process.stdout.write(`tutor-api listening on ${host}:${port} (adapter: ${config.adapter})\n`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
