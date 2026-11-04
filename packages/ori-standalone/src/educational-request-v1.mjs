import { ProviderError } from "./providers.mjs";

const INTENTS = new Set(["help","repeat","turn","move","debug"]);
const OUTCOMES = new Set(["not-run","completed","failed","stopped"]);
const MAX_COUNT = 1000;

/**
 * Versioned privacy-minimized context contract. No learner text, code, traces,
 * identity, free-form fields or external URLs may cross the host boundary.
 */
export function validateEducationalRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join() !==
      ["context","intent","schemaVersion"].sort().join() ||
      value.schemaVersion !== "ori/educational-request/v1" || !INTENTS.has(value.intent))
    throw new ProviderError("Invalid educational request");
  const c = value.context;
  if (!c || typeof c !== "object" || Array.isArray(c) ||
      Object.keys(c).sort().join() !==
      ["scriptCount","hintCount","outcome"].sort().join())
    throw new ProviderError("Invalid educational context");
  if (![c.scriptCount,c.hintCount].every(n=>Number.isSafeInteger(n) && n>=0 && n<=MAX_COUNT) ||
      !OUTCOMES.has(c.outcome))
    throw new ProviderError("Invalid educational metadata");
  return Object.freeze({
    schemaVersion:"ori/educational-request/v1",intent:value.intent,
    context:Object.freeze({scriptCount:c.scriptCount,hintCount:c.hintCount,outcome:c.outcome})
  });
}

export function contextualEducationalHint(request) {
  const {intent,context} = validateEducationalRequest(request);
  if (context.outcome === "not-run")
    return "¿Qué esperás que suceda cuando ejecutes tu programa?";
  if (context.outcome === "failed")
    return "¿En qué paso dejó de ocurrir lo que esperabas?";
  if (intent === "repeat" && context.scriptCount > 0)
    return "¿Qué instrucciones se repiten y cómo podrías agruparlas?";
  if (intent === "debug")
    return "¿Qué cambió entre lo que esperabas y el resultado observado?";
  if (intent === "turn")
    return "¿Hacia dónde apunta el personaje antes y después del giro?";
  if (intent === "move")
    return "¿Cuánto debería avanzar el personaje para acercarse a su objetivo?";
  return context.hintCount > 0
    ? "¿Qué descubriste al probar la pista anterior?"
    : "¿Qué paso pequeño podrías probar primero?";
}
