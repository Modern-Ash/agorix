import { afterEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process"; // agora-allowlist: test-only spawn of the local Ori reference process, fixed arguments
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const sourceDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const directories: string[] = [];
function workspace() {
  const directory = mkdtempSync(join(tmpdir(), "ori-educator-cli-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
async function prepare(directory: string) {
  const entry = resolve(sourceDir, "../scripts/ori-educator-report.mjs");
  const output = join(directory, "report-cli.mjs");
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "redirect-local-report-import",
        setup(plugin) {
          plugin.onResolve({ filter: /\.\.\/dist\/oriEducatorReportJson\.js$/ }, () => ({
            path: resolve(sourceDir, "oriEducatorReportJson.ts"),
          }));
        },
      },
    ],
  });
  return output;
}
const scores = {
  clarity: 4,
  learnerAgency: 4,
  scaffolding: 4,
  contextRelevance: 4,
  ageAppropriateness: 4,
};
const fixture = {
  keys: [{ fixtureId: "movement-01", oriCandidate: "A", deterministicCandidate: "B" }],
  submissions: (["A", "B"] as const).map((candidate) => ({
    reviewerId: "educator1",
    rating: {
      fixtureId: "movement-01",
      candidate,
      scores,
      unsafe: false,
      rationale: "Evaluación pedagógica sintética con justificación suficiente.",
    },
  })),
};
describe("Ori educator report CLI smoke", () => {
  it("generates a redacted report from synthetic ratings", async () => {
    const directory = workspace();
    const executable = await prepare(directory);
    const input = join(directory, "ratings.json");
    const output = join(directory, "report.json");
    writeFileSync(input, JSON.stringify(fixture));
    const result = spawnSync(process.execPath, [executable, input, output], { encoding: "utf8" });
    expect(result.status).toBe(0);
    const report = JSON.parse(readFileSync(output, "utf8")) as Record<string, unknown>;
    expect(report["fixtureCount"]).toBe(1);
    expect(JSON.stringify(report)).not.toContain("educator1");
    expect(JSON.stringify(report)).not.toContain("oriCandidate");
  });
  it("rejects incomplete ratings without creating an output file", async () => {
    const directory = workspace();
    const executable = await prepare(directory);
    const input = join(directory, "invalid.json");
    const output = join(directory, "report.json");
    writeFileSync(
      input,
      JSON.stringify({ ...fixture, submissions: fixture.submissions.slice(0, 1) }),
    );
    const result = spawnSync(process.execPath, [executable, input, output], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(existsSync(output)).toBe(false);
  });
  it("never overwrites an existing report", async () => {
    const directory = workspace();
    const executable = await prepare(directory);
    const input = join(directory, "ratings.json");
    const output = join(directory, "report.json");
    writeFileSync(input, JSON.stringify(fixture));
    writeFileSync(output, "existing");
    const result = spawnSync(process.execPath, [executable, input, output], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(readFileSync(output, "utf8")).toBe("existing");
  });
});
