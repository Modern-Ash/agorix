import { isAbsolute } from "node:path";
import { configFromEnv } from "./index.js";
import { assertOriMig04StartupSafe } from "./oriMig04PgStartupGuard.js";
import { startOriMig04PgSharedAuthProductionHost } from "./oriMig04PgSharedAuthProductionHost.js";

/**
 * Explicitly deployed MIG-04 process. The ordinary main.ts stays legacy.
 * A shell flag never grants learner access: the default runtime is disabled
 * and real rollout requires a separately injected, human-authorized
 * project policy in the trusted deployment composition.
 *
 * This entrypoint exposes shared PostgreSQL login/project selection and
 * retains the complete, fenced review engine behind the disabled gate.
 */
const env = process.env;
assertOriMig04StartupSafe(env);
const connectionString = env["AGORIX_ORI_MIG04_DATABASE_URL"] ?? "";
const deploymentId = env["AGORIX_ORI_MIG04_DEPLOYMENT_ID"] ?? "";
const oriRoot = env["ORI_REPO_PATH"] ?? "";
if (!connectionString || !/^[A-Za-z0-9_-]{1,128}$/.test(deploymentId) || !isAbsolute(oriRoot)) {
  throw new Error("MIG-04 requires PostgreSQL, a deployment ID and an absolute Ori checkout");
}
const host = env["AGORIX_TUTOR_HOST"] ?? "127.0.0.1";
const rawPort = env["AGORIX_TUTOR_PORT"] ?? "8471";
if (!/^[0-9]{1,5}$/.test(rawPort)) throw new Error("Invalid Ori listener port");
const port = Number(rawPort);
if (port < 1 || port > 65535) throw new Error("Invalid Ori listener port");
const socket = env["AGORIX_TUTOR_SOCKET"];
const runtime = await startOriMig04PgSharedAuthProductionHost({
  env,
  connectionString,
  tutor: { config: configFromEnv(env) },
  ori: {
    deploymentId,
    oriRoot,
    // A deployment with real learner access must inject its canonical world
    // and human-approved rollout source explicitly, not from user input.
    world: {},
    learningContext: async () => null, // Always replaced by the PostgreSQL composition.
    rolloutDecide: () => ({ learnerVisible: false }),
  },
  host,
  port,
  ...(socket ? { socket } : {}),
});
process.stdout.write("MIG-04 PostgreSQL host listening (learner pilot disabled)\n");

let closing: Promise<void> | undefined;
function shutdown() {
  closing ??= runtime.close();
  void closing.then(
    () => { process.exitCode = 0; },
    () => { process.exitCode = 1; },
  );
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
