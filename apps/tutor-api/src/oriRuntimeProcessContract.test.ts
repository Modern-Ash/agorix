import { spawnSync } from "node:child_process"; // agora-allowlist: test-only spawn of the local Ori reference process, fixed arguments
import { isAbsolute, resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const oriRoot = process.env["ORI_REPO_PATH"];
const runnable =
  !!oriRoot &&
  isAbsolute(oriRoot) &&
  existsSync(resolve(oriRoot, "examples/local-agent-runtime.mjs"));
if (oriRoot && !runnable) {
  throw new Error("ORI_REPO_PATH must point to a compatible Ori runtime checkout");
}

describe.skipIf(!runnable)("Ori v1 runtime cross-process contract", () => {
  it.each(["help", "repeat", "turn", "move", "debug"] as const)(
    "runs %s as a separate deterministic Ori process without edits",
    (intent) => {
      const result = spawnSync(process.execPath, ["examples/local-agent-runtime.mjs", intent], {
        cwd: oriRoot,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 128 * 1024,
        env: { ...process.env, ORI_LOCAL_MODELS: "0" },
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const output: unknown = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        intent,
        hintSource: "deterministic",
        appliedChanges: false,
        plan: { schemaVersion: "ori/plan/v1" },
      });
      if (!output || typeof output !== "object") throw new Error("Invalid runtime output");
      const data = output as Record<string, unknown>;
      expect(typeof data["hint"]).toBe("string");
      const plan = data["plan"] as { steps?: unknown[] };
      expect(plan.steps?.length).toBeGreaterThan(0);
      expect(result.stdout).not.toContain("synthetic-cli");
    },
    12_000,
  );
  it("rejects unsupported intents without producing a plan", () => {
    const result = spawnSync(process.execPath, ["examples/local-agent-runtime.mjs", "shell"], {
      cwd: oriRoot,
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, ORI_LOCAL_MODELS: "0" },
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("ori/plan/v1");
  });
});
