#!/usr/bin/env node
// Read-only production probe with a synthetic mission. Never send or log child data.
const base = (process.env.AGORIX_TUTOR_BASE_URL ?? "https://agorix.modern-ash.com").replace(
  /\/$/,
  "",
);
const samples = Number(process.argv[2] ?? 3);
if (!Number.isInteger(samples) || samples < 1 || samples > 9) {
  process.stderr.write("usage: node scripts/check-ori-live.mjs [samples: 1..9]\n");
  process.exit(2);
}
const request = {
  missionId: "kids.m1.straight",
  locale: "es",
  hintLevel: 1,
  program: {
    schema: "agorix/program/v1",
    scripts: [{ id: "ori-live-probe", trigger: { type: "greenFlag" }, statements: [] }],
  },
};
const results = [];

async function health() {
  const response = await globalThis.fetch(`${base}/api/tutor/health`, {
    signal: globalThis.AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Ori health endpoint failed");
  return response.json();
}

try {
  const before = await health();
  if (
    !before.configured ||
    !before.available ||
    !["codex", "opencode"].includes(before.providerInUse)
  ) {
    throw new Error("No available real CLI provider");
  }
  for (let index = 0; index < samples; index += 1) {
    const started = Date.now();
    let outcome = "request-failed";
    try {
      const response = await globalThis.fetch(`${base}/api/tutor/ori`, {
        method: "POST",
        signal: globalThis.AbortSignal.timeout(15_000),
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(request),
      });
      if (response.ok) {
        const value = await response.json();
        const keysValid = Object.keys(value).sort().join(",") === "message,proposal";
        const proposalValid =
          value.proposal?.source?.kind === "learning-companion" &&
          value.proposal?.source?.capability === "builder" &&
          value.proposal?.operations?.length > 0;
        const after = await health();
        outcome =
          keysValid &&
          proposalValid &&
          after.lastOriSource === "model" &&
          after.lastErrorClass === null
            ? "model"
            : (after.lastErrorClass ?? "fallback-or-invalid");
      }
    } catch {
      outcome = "request-failed";
    }
    results.push({ outcome, latencyMs: Date.now() - started });
  }
  const successes = results.filter((result) => result.outcome === "model").length;
  const minimum = Math.floor(samples / 2) + 1;
  const after = await health();
  process.stdout.write(
    JSON.stringify({
      result: successes >= minimum ? "model-proposals-validated" : "real-model-rate-too-low",
      provider: after.providerInUse,
      successes,
      samples,
      minimum,
      outcomes: results,
      oriMetrics: after.oriMetrics ?? null,
    }) + "\n",
  );
  if (successes < minimum) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `Ori live check failed: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  process.exitCode = 1;
}
