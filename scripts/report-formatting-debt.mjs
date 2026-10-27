import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "prettier", "--list-different", "."], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
if (result.error) throw result.error;
if (result.status !== 0 && result.status !== 1) {
  process.stderr.write(result.stderr || "Prettier failed unexpectedly\n");
  process.exit(result.status ?? 2);
}
const paths = result.stdout.split(/\r?\n/).filter(Boolean);
const groups = new Map();
for (const path of paths) {
  const group = path.startsWith("apps/") ? path.split("/").slice(0, 2).join("/")
    : path.startsWith("packages/") ? path.split("/").slice(0, 2).join("/")
    : path.split("/")[0];
  groups.set(group, (groups.get(group) ?? 0) + 1);
}
process.stdout.write(`Unformatted files: ${paths.length}\n`);
for (const [group, count] of [...groups].sort((a, b) => b[1] - a[1])) {
  process.stdout.write(`  ${group}: ${count}\n`);
}
if (process.env["GITHUB_STEP_SUMMARY"]) {
  const { appendFileSync } = await import("node:fs");
  const rows = [...groups].sort((a, b) => b[1] - a[1])
    .map(([group, count]) => `| ${group} | ${count} |`).join("\n");
  appendFileSync(process.env["GITHUB_STEP_SUMMARY"],
    `### Prettier debt\n\n${paths.length} files need formatting.\n\n| Area | Files |\n|---|---:|\n${rows}\n`);
}
process.exit(paths.length > 0 ? 1 : 0);
