import { configFromEnv } from "./index.js";
import { createTutorServer } from "./server.js";
import { createOriCliService, oriCliConfigFromEnv } from "./oriCli.js";
import { chmodSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { homedir } from "node:os";
import { defaultAiConfig, openSqliteAiConfigRepository } from "./aiConfig.js";
import { AdminAuth } from "./adminAuth.js";
import { oriExternalShadowEnabled } from "./oriExternalShadow.js";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";

// Entry point (issue #348): `node dist/main.js`. Binds loopback unless the deployment
// explicitly sets AGORIX_TUTOR_HOST (for example inside a container network).
const config = configFromEnv(process.env);
const host = process.env["AGORIX_TUTOR_HOST"] ?? "127.0.0.1";
const port = Number.parseInt(process.env["AGORIX_TUTOR_PORT"] ?? "8471", 10);
const socket = process.env["AGORIX_TUTOR_SOCKET"];
const oriConfig = oriCliConfigFromEnv(process.env);
const aiConfig = openSqliteAiConfigRepository(
  process.env["AGORIX_AI_CONFIG_DB_PATH"] ??
    join(homedir(), ".local", "share", "agorix", "ai-config.sqlite"),
  defaultAiConfig(oriConfig, config),
);
const adminAuth = new AdminAuth(
  process.env["AGORIX_AI_ADMIN_PASSWORD_HASH"],
  process.env["AGORIX_AI_ADMIN_ID"] ?? "operator",
);

const shadowEnabled = oriExternalShadowEnabled(process.env);
const shadowEndpoint = process.env["AGORIX_ORI_EXTERNAL_SHADOW_URL"];
const shadow = shadowEnabled && shadowEndpoint
  ? createOriShadowTransport(shadowEndpoint)
  : undefined;

const server = createTutorServer({
  config,
  aiConfig,
  adminAuth,
  oriExternalShadowEnabled: shadowEnabled,
  ...(shadow ? { oriExternalShadow: shadow } : {}),
  ori: createOriCliService(oriConfig, {
    policyFor: (capability) => aiConfig.current().config.capabilities[capability],
  }),
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
      aiConfig.close();
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
