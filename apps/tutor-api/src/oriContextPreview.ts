import { spawn } from "node:child_process"; // agora-allowlist: server runs a fixed Ori context CLI with shell disabled and bounded output
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { OriRuntimePreview } from "./oriRuntimePreview.js";

export interface OriContextInput {
  readonly intent: "help" | "repeat" | "turn" | "move" | "debug";
  readonly context: {
    readonly scriptCount: number;
    readonly hintCount: number;
    readonly outcome: "not-run" | "completed" | "failed" | "stopped";
  };
}
const unavailable: OriRuntimePreview = Object.freeze({
  status: "unavailable",
  requiresLearnerApproval: true,
  appliedChanges: false,
});
const intents = new Set(["help", "repeat", "turn", "move", "debug"]);
const outcomes = new Set(["not-run", "completed", "failed", "stopped"]);
export function validateOriContextInput(value: unknown): OriContextInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).sort().join() !== "context,intent" ||
    typeof input["intent"] !== "string" ||
    !intents.has(input["intent"])
  )
    return null;
  const c = input["context"];
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const ctx = c as Record<string, unknown>;
  if (
    Object.keys(ctx).sort().join() !== "hintCount,outcome,scriptCount" ||
    typeof ctx["outcome"] !== "string" ||
    !outcomes.has(ctx["outcome"]) ||
    ![ctx["scriptCount"], ctx["hintCount"]].every(
      (n) => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 1000,
    )
  )
    return null;
  return {
    intent: input["intent"] as OriContextInput["intent"],
    context: {
      scriptCount: ctx["scriptCount"] as number,
      hintCount: ctx["hintCount"] as number,
      outcome: ctx["outcome"] as OriContextInput["context"]["outcome"],
    },
  };
}
export function createOriContextPreview({
  oriRoot,
  enabled = false,
  timeoutMs = 3000,
}: {
  oriRoot: string;
  enabled?: boolean;
  timeoutMs?: number;
}) {
  if (!isAbsolute(oriRoot)) throw new TypeError("Ori root must be absolute");
  const root = realpathSync(oriRoot);
  if (!existsSync(join(root, "examples/educational-context-cli.mjs")))
    throw new TypeError("Ori context CLI missing");
  return async (raw: unknown): Promise<OriRuntimePreview> => {
    const input = validateOriContextInput(raw);
    if (!enabled || !input) return unavailable;
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ["examples/educational-context-cli.mjs"], {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
        env: { PATH: process.env["PATH"] ?? "", ORI_LOCAL_MODELS: "0" },
      });
      let done = false;
      let stdout = "";
      const finish = (value: OriRuntimePreview) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve(value);
      };
      const timer = setTimeout(() => finish(unavailable), timeoutMs);
      child.on("error", () => finish(unavailable));
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (Buffer.byteLength(stdout, "utf8") > 8192) finish(unavailable);
      });
      child.on("close", (code) => {
        if (code !== 0) return finish(unavailable);
        try {
          const value: unknown = JSON.parse(stdout);
          if (!value || typeof value !== "object") return finish(unavailable);
          const data = value as Record<string, unknown>;
          const plan = data["plan"] as { steps?: unknown[] } | undefined;
          const steps = plan?.steps;
          const hint = data["hint"];
          if (
            data["schemaVersion"] !== "ori/educational-response/v1" ||
            data["intent"] !== input.intent ||
            data["appliedChanges"] !== false ||
            data["requiresLearnerApproval"] !== true ||
            data["hintSource"] !== "deterministic" ||
            typeof hint !== "string" ||
            hint.length < 1 ||
            hint.length > 180 ||
            !Array.isArray(steps) ||
            steps.length < 1 ||
            !steps[0] ||
            typeof steps[0] !== "object" ||
            typeof (steps[0] as Record<string, unknown>)["goal"] !== "string"
          )
            return finish(unavailable);
          finish(
            Object.freeze({
              status: "ready",
              hint,
              nextStep: (steps[0] as { goal: string }).goal,
              hintSource: "deterministic",
              requiresLearnerApproval: true,
              appliedChanges: false,
            }),
          );
        } catch {
          finish(unavailable);
        }
      });
      child.stdin.end(JSON.stringify({ schemaVersion: "ori/educational-request/v1", ...input }));
    });
  };
}
