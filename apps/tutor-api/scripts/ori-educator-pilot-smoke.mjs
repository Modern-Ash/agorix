#!/usr/bin/env node
import process from "node:process";
import { spawnSync } from "node:child_process"; // agora-allowlist: operator smoke script, runs the local Ori reference process with fixed arguments
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "ori-educator-pilot-"));
try {
  const input = join(directory, "synthetic-input.json");
  const output = join(directory, "synthetic-report.json");
  const generated = spawnSync(process.execPath, ["scripts/ori-educator-pilot-fixture.mjs", input], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (generated.status !== 0) throw new Error("Synthetic pilot fixture generation failed");
  const report = spawnSync(process.execPath, ["scripts/ori-educator-report.mjs", input, output], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (report.status !== 0) throw new Error("Production educator report CLI failed");
  const result = JSON.parse(readFileSync(output, "utf8"));
  if (result.fixtureCount !== 5 || result.totalPairedReviews !== 5 || result.safetyFlag !== false)
    throw new Error("Unexpected pilot report summary");
  const exported = JSON.stringify(result);
  if (exported.includes("synthetic-educator") || exported.includes("oriCandidate"))
    throw new Error("Report exposed restricted evaluation data");
  process.stdout.write("Five-scenario synthetic educator pilot smoke passed.\n");
} catch (error) {
  process.stderr.write(
    `Pilot smoke failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
