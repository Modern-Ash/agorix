import test from "node:test";
import assert from "node:assert/strict";
import { createProviderRouter, ProviderError } from "../src/providers.mjs";
import { createAgorixAdapter } from "../src/agorix-adapter.mjs";

test("provider router uses first healthy adapter", async () => {
  const router = createProviderRouter({
    preferred: ["missing", "local", "cloud"],
    providers: {
      local: { complete: async () => ({ message: "Una pista corta" }) },
      cloud: { complete: async () => ({ message: "No debería ejecutarse" }) }
    }
  });
  assert.deepEqual(await router.complete({ intent: "help" }), { source: "local", message: "Una pista corta", fallback: false });
});
test("provider failure uses deterministic fallback", async () => {
  const router = createProviderRouter({ preferred: ["offline"], providers: { offline: { complete: async () => { throw Error("offline"); } } } });
  assert.equal((await router.complete({ intent: "move" })).fallback, true);
});
test("provider timeout falls back and aborts signal", async () => {
  let aborted = false;
  const router = createProviderRouter({ preferred: ["slow"], timeoutMs: 10, providers: { slow: {
    complete: (_req, { signal }) => new Promise(() => { signal.addEventListener("abort", () => { aborted = true; }); })
  } } });
  const result = await router.complete({ intent: "help" });
  assert.equal(result.source, "deterministic");
  assert.equal(aborted, true);
});
test("rejects invalid provider policy", () => {
  assert.throws(() => createProviderRouter({ timeoutMs: 0 }), ProviderError);
});
test("total budget limits failover and exposes content-free aggregate counters", async () => {
  const router = createProviderRouter({
    preferred: ["slow", "second"], timeoutMs: 20, totalBudgetMs: 10,
    providers: {
      slow: { complete: () => new Promise(() => {}) },
      second: { complete: () => new Promise(() => {}) }
    }
  });
  assert.equal((await router.complete({ childMessage: "secret" })).fallback, true);
  const metrics=router.metrics();
  assert.equal(metrics.requests,1);
  assert.equal(metrics.modelResponses,0);
  assert.equal(metrics.fallbacks,1);
  assert.equal(metrics.providers.slow.timeouts,1);
  assert.equal(JSON.stringify(router.metrics()).includes("secret"), false);
  assert.throws(() => createProviderRouter({ totalBudgetMs: 0 }), ProviderError);
});
test("synthetic Agorix adapter exposes only safe host reads", async () => {
  let writes = 0;
  const adapter = createAgorixAdapter({
    readProgram: () => ({ allowedBlocks: ["move"] }),
    readTrace: () => ({ steps: [{ index: 2, description: "Stopped" }] }),
    writeProgram: () => { writes++; }
  });
  const result = await adapter.ask("no funciona", { attempts: 1 });
  assert.equal(result.evidence.index, 2);
  assert.equal(writes, 0);
  assert.equal(result.proposal, null);
});

test("harness provider routing is opt-in and receives no raw learner text", async () => {
  const { createOriHarness } = await import("../src/harness.mjs");
  let request;
  const providerRouter = { complete: async input => { request = input; return { source: "fake", message: "¿Qué podrías probar primero?", fallback: false }; } };
  const ori = createOriHarness({}, { enableProvider: true, providerRouter });
  const result = await ori.respond({ message: "no entiendo", context: { attempts: 1 } });
  assert.equal(result.diagnostics.provider, "fake");
  assert.equal(result.message, "¿Qué podrías probar primero?");
  assert.equal(request.message, undefined);
  assert.equal(result.proposal, null);
});
