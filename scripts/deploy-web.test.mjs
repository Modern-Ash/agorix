import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const script = resolve("scripts/deploy-web.sh");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" });

let repo;
let origin;

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "agorix-deploy-"));
  origin = join(base, "origin.git");
  repo = join(base, "work");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", "-q", origin, repo]);
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  writeFileSync(join(repo, "a.txt"), "a");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  git(repo, "push", "-q", "origin", "main");
});

function preflight(extraEnv = {}) {
  return spawnSync("bash", [script, "--preflight-only"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, AGORIX_REPO_ROOT: repo, ...extraEnv },
  });
}

describe("deploy-web.sh preflight (issue #342)", () => {
  it("accepts a clean main that matches origin", () => {
    const result = preflight();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/preflight ok: main at [0-9a-f]{12}/);
  });

  it("refuses any branch other than main", () => {
    git(repo, "checkout", "-q", "-b", "feat/x");
    const result = preflight({ AGORIX_SKIP_FETCH: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("on 'feat/x'");
  });

  it("refuses a dirty working tree", () => {
    writeFileSync(join(repo, "a.txt"), "changed");
    const result = preflight({ AGORIX_SKIP_FETCH: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("working tree is dirty");
  });

  it("refuses local commits that origin/main does not have", () => {
    writeFileSync(join(repo, "b.txt"), "b");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "local only");
    const result = preflight();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("differs from origin/main");
  });

  it("accepts the skip flags together with the preflight", () => {
    const result = spawnSync(
      "bash",
      [script, "--preflight-only", "--skip-verify", "--skip-smoke"],
      {
        cwd: repo,
        encoding: "utf8",
        env: { ...process.env, AGORIX_REPO_ROOT: repo },
      },
    );
    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects unknown options", () => {
    const result = spawnSync("bash", [script, "--nope"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, AGORIX_REPO_ROOT: repo },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown option");
  });
});
