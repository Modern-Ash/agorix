#!/usr/bin/env node
import process from "node:process";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "ori-production-cli-"));
const cli = resolve("scripts/ori-educator-report.mjs");
const scores = {
  clarity: 4,
  learnerAgency: 4,
  scaffolding: 4,
  contextRelevance: 4,
  ageAppropriateness: 4,
};
const input = {
  keys: [{ fixtureId: "movement-01", oriCandidate: "A", deterministicCandidate: "B" }],
  submissions: ["A", "B"].map((candidate) => ({
    reviewerId: "synthetic-reviewer",
    rating: {
      fixtureId: "movement-01",
      candidate,
      scores,
      unsafe: false,
      rationale: "Evaluación sintética para verificar el CLI compilado.",
    },
  })),
};
function execute(source, destination) {
  return spawnSync(process.execPath, [cli, source, destination], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10_000,
  });
}
try {
  const source = join(directory, "ratings.json");
  const destination = join(directory, "report.json");
  writeFileSync(source, JSON.stringify(input));
  const first = execute(source, destination);
  if (first.status !== 0) throw new Error("Production CLI failed on valid input");
  const report = JSON.parse(readFileSync(destination, "utf8"));
  if (report.fixtureCount !== 1 || report.totalPairedReviews !== 1)
    throw new Error("Unexpected production report result");
  const exported = JSON.stringify(report);
  if (exported.includes("synthetic-reviewer") || exported.includes("oriCandidate"))
    throw new Error("Sensitive mapping or reviewer ID leaked");
  const second = execute(source, destination);
  if (second.status === 0 || !existsSync(destination))
    throw new Error("Production CLI unexpectedly overwrote a report");
  const invalidSource = join(directory, "invalid.json");
  const invalidOutput = join(directory, "invalid-report.json");
  writeFileSync(
    invalidSource,
    JSON.stringify({ ...input, submissions: input.submissions.slice(0, 1) }),
  );
  const invalid = execute(invalidSource, invalidOutput);
  if (invalid.status === 0 || existsSync(invalidOutput))
    throw new Error("Production CLI accepted incomplete ratings");
  process.stdout.write("Production educator CLI smoke passed.\n");
} catch (error) {
  process.stderr.write(
    `Production educator CLI smoke failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
