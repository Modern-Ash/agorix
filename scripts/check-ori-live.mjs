#!/usr/bin/env node
// Read-only production probe with a synthetic mission. Never send or log child data.
const base = (process.env.AGORIX_TUTOR_BASE_URL ?? "https://agorix.modern-ash.com").replace(
  /\/$/,
  "",
);
const signal = globalThis.AbortSignal.timeout(15_000);
const request = {
  missionId: "kids.m1.straight",
  locale: "es",
  hintLevel: 1,
  program: {
    schema: "agorix/program/v1",
    scripts: [{ id: "ori-live-probe", trigger: { type: "greenFlag" }, statements: [] }],
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const healthResponse = await globalThis.fetch(`${base}/api/tutor/health`, { signal });
  assert(healthResponse.ok, "Ori health endpoint failed");
  const before = await healthResponse.json();
  assert(before.configured && before.available, "Ori host service is unavailable");
  assert(["codex", "opencode"].includes(before.providerInUse), "No real CLI provider selected");

  const started = Date.now();
  const response = await globalThis.fetch(`${base}/api/tutor/ori`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(request),
  });
  assert(response.ok, "Synthetic Ori request failed");
  const value = await response.json();
  assert(Object.keys(value).sort().join(",") === "message,proposal", "Unexpected Ori response");
  assert(value.proposal?.source?.kind === "learning-companion", "Missing safe proposal");
  assert(value.proposal?.source?.capability === "builder", "Wrong proposal capability");
  assert(value.proposal?.operations?.length > 0, "Empty proposal");

  const afterResponse = await globalThis.fetch(`${base}/api/tutor/health`, { signal });
  assert(afterResponse.ok, "Ori post-request health failed");
  const after = await afterResponse.json();
  assert(after.lastOriSource === "model", "Ori used deterministic fallback");
  assert(after.lastErrorClass === null, "Ori reported a provider error");
  process.stdout.write(
    JSON.stringify({
      result: "model-proposal-validated",
      provider: after.providerInUse,
      latencyMs: Date.now() - started,
    }) + "\n",
  );
} catch (error) {
  process.stderr.write(
    `Ori live check failed: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  process.exitCode = 1;
}
