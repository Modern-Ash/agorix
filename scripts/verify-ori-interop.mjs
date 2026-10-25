import console from "node:console";
/**
 * Explicit cross-repository verification entrypoint.
 * Unlike default Vitest, this command MUST fail when Ori is not configured.
 */
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { spawnSync } from "node:child_process";

const configured = process.env.ORI_REPO_PATH;
if (!configured || !isAbsolute(configured)) {
  console.error("ORI_REPO_PATH must be an absolute path to a local Modern-Ash/ori checkout.");
  process.exit(2);
}
let root;
try { root = realpathSync(configured); }
catch {
  console.error("ORI_REPO_PATH does not exist.");
  process.exit(2);
}
if (!existsSync(join(root, "examples/shadow-api/serve.mjs")) ||
    !existsSync(join(root, "src/shadow-plan.mjs"))) {
  console.error("ORI_REPO_PATH is not a compatible Ori checkout.");
  process.exit(2);
}
const args = ["exec", "vitest", "run", "apps/tutor-api/src/oriRealProcessSmoke.test.ts", "--reporter=verbose"];
console.log("ORI_INTEROP_VERIFY: starting explicit cross-repository test");
const result = spawnSync("pnpm", args, { stdio: "inherit", env: { ...process.env, ORI_REPO_PATH: root } });
if (result.error) {
  console.error("Could not launch pnpm:", result.error.message);
  process.exit(2);
}
if (result.status === 0) {
  console.log("ORI_INTEROP_VERIFY: PASS (real Ori process and Agorix consumer)");
} else {
  console.error("ORI_INTEROP_VERIFY: FAIL");
}
process.exit(result.status ?? 1);
