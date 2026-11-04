import test from "node:test";
import assert from "node:assert/strict";
import { createOllamaAdapter } from "../src/ollama.mjs";
import { ProviderError, createProviderRouter } from "../src/providers.mjs";
import { createOriHarness } from "../src/harness.mjs";

test("local adapter sends only minimized intent context", async () => {
  let url, payload, opts;
  const adapter = createOllamaAdapter({ fetchImpl: async (u, o) => {
    url = u; opts = o; payload = JSON.parse(o.body);
    return { ok: true, json: async () => ({ message: { content: "¿Qué querés repetir?" } }) };
  }});
  const result = await adapter.complete({ intent: "repeat", attempts: 1, hintsUsed: 0, learningStage: "connect" });
  assert.equal(result.message, "¿Qué querés repetir?");
  assert.equal(url, "http://127.0.0.1:11434/api/chat");
  assert.equal(opts.redirect, "error");
  assert.equal(JSON.stringify(payload).includes("childMessage"), false);
  assert.equal(JSON.stringify(payload).includes("programSnapshot"), false);
});
test("rejects remote, credentialed or path-based endpoints", () => {
  for (const endpoint of ["https://example.com", "http://192.168.1.3:11434", "http://user:pass@localhost:11434", "http://localhost:11434/other", "file:///etc/passwd"]) {
    assert.throws(() => createOllamaAdapter({ endpoint }), ProviderError);
  }
});
test("rejects raw text and unapproved context", async () => {
  let calls = 0;
  const adapter = createOllamaAdapter({ fetchImpl: async () => { calls++; return { ok: true }; } });
  await assert.rejects(adapter.complete({ intent: "help", attempts: 0, hintsUsed: 0, learningStage: "connect", childMessage: "hola" }), ProviderError);
  assert.equal(calls, 0);
});
test("provider failures preserve deterministic hint", async () => {
  const router = createProviderRouter({ preferred: ["local"], providers: { local: createOllamaAdapter({
    fetchImpl: async () => { throw new Error("offline"); }
  }) } });
  const ori = createOriHarness({}, { enableProvider: true, providerRouter: router });
  const response = await ori.respond({ message: "para que sirve repetir", context: { attempts: 0 } });
  assert.equal(response.diagnostics.provider, "deterministic");
  assert.equal(response.kind, "hint");
  assert.equal(response.proposal, null);
});
