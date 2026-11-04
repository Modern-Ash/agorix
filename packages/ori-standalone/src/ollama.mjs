import { ProviderError } from "./providers.mjs";

/**
 * Opt-in Ollama localhost adapter. Only derived, non-identifying intent metadata
 * is passed to the model. No raw child messages, projects or execution traces.
 * Not approved for production use with children.
 */
const INTENTS = new Set(["help", "repeat", "turn", "move", "debug"]);
const LOCALES = new Set(["es-AR"]);
const DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
function validateEndpoint(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { throw new ProviderError("Invalid Ollama endpoint"); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new ProviderError("Only plain localhost Ollama endpoints are allowed");
  }
  return url.origin;
}
function validateRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request) ||
      !INTENTS.has(request.intent) ||
      !Number.isSafeInteger(request.attempts) || request.attempts < 0 || request.attempts > 10000 ||
      !Number.isSafeInteger(request.hintsUsed) || request.hintsUsed < 0 || request.hintsUsed > 10000 ||
      request.learningStage !== "connect" ||
      Object.keys(request).some(k => !["intent", "attempts", "hintsUsed", "learningStage"].includes(k))) {
    throw new ProviderError("Invalid minimized learning context");
  }
}
export function createOllamaAdapter({ endpoint = DEFAULT_ENDPOINT, model = "qwen2.5:3b", fetchImpl = fetch } = {}) {
  const origin = validateEndpoint(endpoint);
  if (typeof model !== "string" || !/^[a-zA-Z0-9_.:-]{1,80}$/.test(model)) throw new ProviderError("Invalid Ollama model");
  if (typeof fetchImpl !== "function") throw new ProviderError("Invalid transport");
  return Object.freeze({
    async complete(request, { signal } = {}) {
      validateRequest(request);
      const system = [
        "Sos Ori, un tutor de programación infantil. Respondé en español rioplatense.",
        "Devolvé UNA sola pregunta o pista breve (máximo 25 palabras).",
        "Nunca escribas código, bloques completos, datos personales ni afirmes haber ejecutado el programa.",
        "No inventes resultados de ejecución. No reveles soluciones completas."
      ].join(" ");
      const user = `Intención: ${request.intent}. Etapa: conectar. Intentos: ${request.attempts}. Pistas anteriores: ${request.hintsUsed}. Respondé con una pregunta pedagógica breve.`;
      const response = await fetchImpl(`${origin}/api/chat`, {
        method: "POST",
        redirect: "error",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }], options: { temperature: 0.2, num_predict: 70 } })
      });
      if (!response?.ok) throw new ProviderError("Local provider unavailable");
      const data = await response.json();
      const message = data?.message?.content;
      if (typeof message !== "string" || message.length > 240 || !message.trim()) throw new ProviderError("Invalid local response");
      return { message: message.trim() };
    }
  });
}
