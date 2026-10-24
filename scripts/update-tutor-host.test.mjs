import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

let home;
let repo;
let bin;
let log;
const source = resolve("scripts");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "agorix-ori-update-"));
  repo = join(home, "main-checkout");
  bin = join(home, "bin");
  log = join(home, "calls.log");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "apps", "tutor-api", "dist"), { recursive: true });
  mkdirSync(bin);
  for (const name of ["update-tutor-host.sh", "start-tutor-host.sh"]) {
    cpSync(join(source, name), join(repo, "scripts", name));
  }
  writeFileSync(join(repo, ".gitignore"), "apps/tutor-api/dist/\n");
  writeFileSync(join(repo, "README"), "test\n");
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  const origin = join(home, "origin.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  git("remote", "add", "origin", origin);
  git("push", "-q", "origin", "main");
  writeFileSync(join(bin, "codex"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    join(bin, "systemctl"),
    '#!/bin/sh\nprintf "systemctl %s\\n" "$*" >> "$AGORIX_TEST_CALLS"\nexit 0\n',
    { mode: 0o755 },
  );
  writeFileSync(join(bin, "curl"), "#!/bin/sh\nprintf ok\n", { mode: 0o755 });
  writeFileSync(
    join(bin, "node"),
    '#!/bin/sh\ncase "$*" in\n  *readFileSync*) cat >/dev/null; printf "%s" "$AGORIX_TEST_SHA" ;;\n  *check-ori-live.mjs*) exit 1 ;;\n  *) cat >/dev/null; exit 0 ;;\nesac\n',
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "corepack"),
    '#!/bin/sh\nmkdir -p apps/tutor-api/dist\nprintf "bundle" > apps/tutor-api/dist/main.mjs\n',
    { mode: 0o755 },
  );
});

function run(mode) {
  return spawnSync("bash", [join(repo, "scripts", "update-tutor-host.sh"), mode], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH}`,
      AGORIX_TEST_CALLS: log,
      AGORIX_TEST_SHA: git("rev-parse", "--short=12", "HEAD"),
      XDG_RUNTIME_DIR: join(home, "runtime"),
    },
  });
}

describe("versioned Ori host update (#572)", () => {
  it("accepts a clean published main without changing the service", () => {
    const result = run("--preflight-only");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("preflight passed");
    expect(readFileSync(log, "utf8")).not.toContain("restart");
  });

  it("refuses a dirty checkout before changing the service", () => {
    writeFileSync(join(repo, "README"), "dirty\n");
    const result = run("--activate");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("clean tree");
  });

  it("restores the previous unit when the repeated real-model smoke fails", () => {
    const dropinDir = join(home, ".config", "systemd", "user", "agorix-tutor.service.d");
    mkdirSync(dropinDir, { recursive: true });
    const dropin = join(dropinDir, "30-versioned-bundle.conf");
    writeFileSync(dropin, "[Service]\nEnvironment=AGORIX_TUTOR_BUNDLE=/old/main.mjs\n");
    writeFileSync(join(repo, "apps", "tutor-api", "dist", "main.mjs"), "old bundle");
    const result = run("--activate");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("previous unit restored");
    expect(readFileSync(dropin, "utf8")).toContain("/old/main.mjs");
    expect(readFileSync(join(repo, "apps", "tutor-api", "dist", "main.mjs"), "utf8")).toBe(
      "old bundle",
    );
    const calls = readFileSync(log, "utf8");
    expect(calls.match(/restart agorix-tutor.service/g)).toHaveLength(2);
  });
});
