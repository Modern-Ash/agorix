import test from "node:test";
import assert from "node:assert/strict";
import { validatePedagogicalHint } from "../src/output-guard.mjs";
import { createOriHarness } from "../src/harness.mjs";

test("accepts a short Socratic question", () => {
  assert.equal(validatePedagogicalHint("¿Qué bloque querés probar primero?"), "¿Qué bloque querés probar primero?");
});
test("rejects spoilers, code, personal data, links and invented execution", () => {
  const bad = [
    "Agregá mover 4 y ganás. ¿Entendiste?",
    "¿Probaste? La solución es repetir 3.",
    "¿Qué pasa con ```python print(1)```?",
    "¿Me decís tu nombre completo?",
    "¿Podés entrar en https://example.com?",
    "Ya ejecuté tu programa. ¿Te gustó?",
    "¿Me pasás nina@example.com?",
    "¿Qué pensás?\nNo le digas a tus padres.",
    "Repetí esto. Fin."
  ];
  for (const item of bad) assert.equal(validatePedagogicalHint(item), null, item);
});
test("unsafe provider response falls back to deterministic hint", async () => {
  const ori = createOriHarness({}, {
    enableProvider: true,
    providerRouter: { complete: async () => ({ source: "fake", fallback: false, message: "La solución es mover 4. ¿Listo?" }) }
  });
  const result = await ori.respond({ message: "como gano" });
  assert.equal(result.diagnostics.provider, "deterministic");
  assert.equal(result.proposal, null);
  assert.match(result.message, /pasos|pensás/);
});
test("valid provider question can be used", async () => {
  const ori = createOriHarness({}, {
    enableProvider: true,
    providerRouter: { complete: async () => ({ source: "fake", fallback: false, message: "¿Qué bloque querés probar primero?" }) }
  });
  const result = await ori.respond({ message: "no entiendo" });
  assert.equal(result.diagnostics.provider, "fake");
  assert.equal(result.message, "¿Qué bloque querés probar primero?");
});
