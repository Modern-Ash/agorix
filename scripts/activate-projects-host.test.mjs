import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const source = resolve("scripts");
let home;
let repo;
let bin;
let log;

function git(...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "agorix-project-activation-"));
  repo = join(home, "dev-agora", "agorix");
  bin = join(home, "bin");
  log = join(home, "calls.log");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "deploy", "web"), { recursive: true });
  mkdirSync(bin);
  for (const file of ["activate-projects-host.sh", "web-deploy-lib.sh", "backup-projects.sh"]) {
    cpSync(join(source, file), join(repo, "scripts", file));
  }
  for (const file of ["agorix-project-backup.service", "agorix-project-backup.timer"]) {
    cpSync(resolve("deploy", "web", file), join(repo, "deploy", "web", file));
  }
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  writeFileSync(join(repo, "README"), "test\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  const origin = join(home, "origin.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  git("remote", "add", "origin", origin);
  git("push", "-q", "origin", "main");
  writeFileSync(
    join(bin, "curl"),
    `#!/bin/sh\ncase "$*" in\n  *version.json*) printf '{"sha":"${git("rev-parse", "--short=12", "HEAD")}"}' ;;\n  *projects.sock*) printf '{"status":"ok"}' ;;\n  *v1/session*) printf '%s' "\${AGORIX_TEST_SESSION_STATUS:-401}" ;;\nesac\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "docker"),
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "$AGORIX_TEST_CALLS"\ncase "$*" in\n  'inspect agorix-projects'*) exit 1 ;;\n  *'run --rm --no-deps projects node dist/backup.mjs'*) if [ "\${AGORIX_TEST_BACKUP_FAIL:-0}" = 1 ]; then exit 1; fi ;;\nesac\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "systemctl"),
    '#!/bin/sh\nprintf \'systemctl %s\\n\' "$*" >> "$AGORIX_TEST_CALLS"\nexit 0\n',
    { mode: 0o755 },
  );
});

function run(mode, extraEnv = {}) {
  return spawnSync("bash", [join(repo, "scripts", "activate-projects-host.sh"), mode], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH}`,
      AGORIX_PROJECT_ORIGIN: "https://agorix.modern-ash.com",
      AGORIX_TEST_CALLS: log,
      AGORIX_PROJECT_SOCKET_DIR: join(home, "projects-run"),
      ...extraEnv,
    },
  });
}

describe("project host activation (issue #433)", () => {
  it("preflight validates merged main and does not start containers", () => {
    const result = run("--preflight-only");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("preflight passed");
    expect(readFileSync(log, "utf8")).not.toContain("compose");
  });

  it("refuses a dirty checkout", () => {
    writeFileSync(join(repo, "README"), "dirty\n");
    const result = run("--preflight-only");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("clean main");
  });

  it("refuses an unmerged local commit", () => {
    writeFileSync(join(repo, "README"), "new commit\n");
    git("add", "README");
    git("commit", "-q", "-m", "local only");
    const result = run("--preflight-only");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("merged origin/main");
  });

  it("refuses an origin other than the public Agorix host", () => {
    const result = run("--preflight-only", {
      AGORIX_PROJECT_ORIGIN: "https://elsewhere.example",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AGORIX_PROJECT_ORIGIN");
  });

  it("stops only the new project service if public routing fails", () => {
    const result = run("--activate", { AGORIX_TEST_SESSION_STATUS: "404" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("public /v1/session returned 404");
    expect(result.stderr).toContain("service stopped");
    const calls = readFileSync(log, "utf8");
    expect(calls).toContain("compose");
    expect(calls).toContain("up -d projects");
    expect(calls).toContain("stop projects");
    expect(calls).not.toContain("up -d web");
  });

  it("does not enable the backup timer if the first snapshot fails", () => {
    const result = run("--activate", { AGORIX_TEST_BACKUP_FAIL: "1" });
    expect(result.status).toBe(1);
    const calls = readFileSync(log, "utf8");
    expect(calls).toContain("run --rm --no-deps projects node dist/backup.mjs");
    expect(calls).toContain("stop projects");
    expect(calls).not.toContain("enable --now agorix-project-backup.timer");
  });

  it("backs up before enabling the timer on a successful first activation", () => {
    const result = run("--activate");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("SQLite accounts active");
    const calls = readFileSync(log, "utf8");
    expect(calls).toContain("up -d projects");
    expect(calls).toContain("run --rm --no-deps projects node dist/backup.mjs");
    expect(calls.indexOf("run --rm --no-deps")).toBeLessThan(
      calls.indexOf("enable --now agorix-project-backup.timer"),
    );
    expect(calls).not.toContain("stop projects");
    expect(readFileSync(join(home, ".config", "agorix", "projects.env"), "utf8")).toBe(
      "AGORIX_PROJECT_ORIGIN=https://agorix.modern-ash.com\n",
    );
    const verification = run("--verify-only", { AGORIX_PROJECT_ORIGIN: "" });
    expect(verification.status, verification.stderr).toBe(0);
  });
});
