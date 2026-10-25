#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath || process.argv.length !== 4) {
  process.stderr.write("Usage: node scripts/ori-educator-report.mjs <input.json> <output.json>\n");
  process.exitCode = 2;
} else {
  try {
    const file = await readFile(resolve(inputPath));
    if (file.byteLength > 65_536) throw new Error("Input exceeds 64 KiB");
    const { parseOriEducatorReportJson, serializeOriEducatorReport } =
      await import("../dist/oriEducatorReportJson.js");
    const report = parseOriEducatorReportJson(file.toString("utf8"));
    if (!report) throw new Error("Invalid or incomplete educator evaluation");
    await writeFile(resolve(outputPath), serializeOriEducatorReport(report), {
      flag: "wx",
      mode: 0o600,
    });
    process.stdout.write("Educator report written. No source keys or reviewer IDs exported.\n");
  } catch {
    process.stderr.write("Unable to generate educator report. Check input and output paths.\n");
    process.exitCode = 1;
  }
}
