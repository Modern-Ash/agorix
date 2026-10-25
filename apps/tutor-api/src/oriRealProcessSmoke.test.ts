import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";

/**
 * Optional cross-repository smoke. Requires ORI_REPO_PATH pointing to a local
 * checkout of Modern-Ash/ori with examples/shadow-api/serve.mjs.
 * CI without this checkout skips it, preserving independent repository builds.
 */
const oriPath = process.env["ORI_REPO_PATH"];
const runnable = !!oriPath && existsSync(resolve(oriPath, "examples/shadow-api/serve.mjs"));

describe.skipIf(!runnable)("real Ori process to Agorix consumer contract", () => {
  it("sends synthetic metadata to a separately running Ori process", async () => {
    const port = 18000 + Math.floor(Math.random() * 20000);
    const child: ChildProcess = spawn(process.execPath, ["examples/shadow-api/serve.mjs"], {
      cwd: oriPath,
      env: { ...process.env, ORI_SHADOW_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const url = `http://127.0.0.1:${port}/v1/plan`;
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (child.exitCode !== null) throw new Error("Ori process terminated");
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }),
          });
          if (response.ok) {
            const data: unknown = await response.json();
            const { validateOriShadowPlan } = await import("./oriShadowPlanValidation.js");
            expect(validateOriShadowPlan(data)).not.toBeNull();
            ready = true;
            break;
          }
        } catch {
          await new Promise((resolveWait) => setTimeout(resolveWait, 50));
        }
      }
      expect(ready).toBe(true);
      const transport = createOriShadowTransport(url);
      expect(await transport({ missionIndex: 1, hintLevel: 2, scriptCount: 1 })).toBeUndefined();
    } finally {
      child.kill("SIGTERM");
    }
  }, 10_000);
});
