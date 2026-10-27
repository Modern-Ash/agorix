import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const INTENTS = new Set(["help", "repeat", "turn", "move", "debug"]);
const MAX_OUTPUT = 8192;

export interface OriRuntimePreview {
  readonly status: "ready" | "unavailable";
  readonly hint?: string;
  readonly nextStep?: string;
  readonly hintSource?: "deterministic";
  readonly requiresLearnerApproval: true;
  readonly appliedChanges: false;
}
const unavailable: OriRuntimePreview = Object.freeze({
  status: "unavailable",
  requiresLearnerApproval: true,
  appliedChanges: false,
});
export function createOriRuntimePreview({
  oriRoot,
  enabled = false,
  timeoutMs = 3000,
}: {
  oriRoot: string;
  enabled?: boolean;
  timeoutMs?: number;
}) {
  if (!isAbsolute(oriRoot)) throw new TypeError("Ori checkout must be absolute");
  const root = realpathSync(oriRoot);
  if (!existsSync(join(root, "examples/local-agent-runtime.mjs")))
    throw new TypeError("Missing Ori runtime");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
    throw new RangeError("Invalid timeout");
  return async (intent: string): Promise<OriRuntimePreview> => {
    if (!enabled || !INTENTS.has(intent)) return unavailable;
    return new Promise((resolve) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(process.execPath, ["examples/local-agent-runtime.mjs", intent], {
          cwd: root,
          stdio: ["pipe", "pipe", "pipe"],
          env: { PATH: process.env["PATH"] ?? "", ORI_LOCAL_MODELS: "0" },
        });
      } catch {
        resolve(unavailable);
        return;
      }
      child.stdin.end();
      let stdout = "";
      let settled = false;
      const finish = (value: OriRuntimePreview) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve(value);
      };
      const timer = setTimeout(() => finish(unavailable), timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (Buffer.byteLength(stdout, "utf8") > MAX_OUTPUT) finish(unavailable);
      });
      child.on("error", () => finish(unavailable));
      child.on("close", (code) => {
        if (settled || code !== 0) return finish(unavailable);
        try {
          const data: unknown = JSON.parse(stdout);
          if (!data || typeof data !== "object") return finish(unavailable);
          const record = data as Record<string, unknown>;
          const plan = record["plan"] as { schemaVersion?: unknown; steps?: unknown } | undefined;
          const steps = plan?.steps;
          const hint = record["hint"];
          if (
            record["intent"] !== intent ||
            record["appliedChanges"] !== false ||
            record["hintSource"] !== "deterministic" ||
            plan?.schemaVersion !== "ori/plan/v1" ||
            !Array.isArray(steps) ||
            steps.length < 1 ||
            steps.length > 8 ||
            !steps.every(
              (s) =>
                s && typeof s === "object" && typeof s.goal === "string" && s.goal.length <= 240,
            ) ||
            typeof hint !== "string" ||
            hint.length < 1 ||
            hint.length > 180
          )
            return finish(unavailable);
          finish(
            Object.freeze({
              status: "ready",
              hint,
              nextStep: steps[0].goal,
              hintSource: "deterministic",
              requiresLearnerApproval: true,
              appliedChanges: false,
            }),
          );
        } catch {
          finish(unavailable);
        }
      });
    });
  };
}
