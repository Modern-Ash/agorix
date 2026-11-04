import { createOriHarness } from "../src/harness.mjs";
import { createOllamaAdapter } from "../src/ollama.mjs";
import { createProviderRouter } from "../src/providers.mjs";

// Explicit opt-in only. Localhost Ollama must already be running and have the model.
const router = createProviderRouter({
  providers: { local: createOllamaAdapter({ model: process.env.ORI_OLLAMA_MODEL ?? "qwen2.5:3b" }) },
  preferred: ["local"],
  timeoutMs: 2500
});
const ori = createOriHarness({}, { enableProvider: true, providerRouter: router });
const result = await ori.respond({ message: "¿Para qué sirve repetir?", context: { attempts: 1, hintsUsed: 0 } });
console.log(JSON.stringify(result, null, 2));
