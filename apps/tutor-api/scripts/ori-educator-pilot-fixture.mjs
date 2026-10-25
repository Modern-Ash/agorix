#!/usr/bin/env node
import process from "node:process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , destination] = process.argv;
if (!destination || process.argv.length !== 3) {
  process.stderr.write("Usage: node scripts/ori-educator-pilot-fixture.mjs <input.json>\n");
  process.exitCode = 2;
} else {
  const ids = ["movement-01", "sequence-01", "loops-01", "events-01", "debugging-01"];
  const keys = ids.map((fixtureId, index) => ({
    fixtureId,
    oriCandidate: index % 2 === 0 ? "A" : "B",
    deterministicCandidate: index % 2 === 0 ? "B" : "A",
  }));
  const scores = {
    clarity: 4,
    learnerAgency: 4,
    scaffolding: 4,
    contextRelevance: 4,
    ageAppropriateness: 4,
  };
  const submissions = ids.flatMap((fixtureId) =>
    ["A", "B"].map((candidate) => ({
      reviewerId: "synthetic-educator",
      rating: {
        fixtureId,
        candidate,
        scores,
        unsafe: false,
        rationale: "Evaluación sintética para probar el flujo de reporte.",
      },
    })),
  );
  try {
    await writeFile(resolve(destination), JSON.stringify({ keys, submissions }, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    process.stdout.write(
      "Synthetic educator pilot fixture created. Not real evaluation evidence.\n",
    );
  } catch {
    process.stderr.write("Unable to create pilot fixture; destination must not exist.\n");
    process.exitCode = 1;
  }
}
