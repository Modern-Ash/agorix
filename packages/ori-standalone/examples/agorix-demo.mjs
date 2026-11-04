import { createOriHarness } from "../src/harness.mjs";

// Synthetic Agorix adapter. No network, model key, child identity or real project data.
const ori = createOriHarness({
  inspectProgram: () => ({ version: "example", allowedBlocks: ["move"], blocks: [{ kind: "move", steps: 1 }] }),
  inspectTrace: () => ({ steps: [{ index: 1, description: "Avanzó una casilla" }] })
});
const response = await ori.respond({
  message: "¿Por qué no llego al planeta?",
  context: { attempts: 1, hintsUsed: 0 }
});
console.log(JSON.stringify(response, null, 2));
