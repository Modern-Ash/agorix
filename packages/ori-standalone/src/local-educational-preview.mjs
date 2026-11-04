import { runEducationalAgent } from "./agent-loop-v1.mjs";
import { createCapabilityRouter } from "./capability-router.mjs";
import { createOllamaAdapter } from "./ollama.mjs";
import { validatePedagogicalHint } from "./output-guard.mjs";
import { ProviderError } from "./providers.mjs";

const INTENTS=new Set(["help","repeat","turn","move","debug","unknown"]);
const FALLBACK="¿Qué paso pequeño podrías probar primero y qué esperás observar?";

/**
 * Adult-supervised, synthetic opt-in local preview.
 * No raw learner text, program or traces are sent to Ollama.
 * The base agent remains read-only and its output authoritative.
 */
export async function runLocalEducationalPreview({
  hostContext,intent="unknown",tools={},signal,
  enableLocalModel=false,model="qwen2.5:3b",fetchImpl,deadlineMs=2000
}={}) {
  if (!INTENTS.has(intent)) throw new ProviderError("Invalid intent");
  if (typeof enableLocalModel!=="boolean") throw new ProviderError("Invalid local model policy");
  const base=await runEducationalAgent({hostContext,intent,tools,signal,deadlineMs});
  if (!enableLocalModel || intent==="unknown") return Object.freeze({...base,hint:FALLBACK,hintSource:"deterministic"});
  const adapter=createOllamaAdapter({model,...(fetchImpl?{fetchImpl}:{})});
  const router=createCapabilityRouter({
    descriptors:[{id:"ollama",mode:"local",features:["text"],maxOutputTokens:512}],
    adapters:{ollama:adapter},preferred:["ollama"],maxOutputTokens:128,
    timeoutMs:Math.min(deadlineMs,1500)
  });
  const response=await router.complete({
    intent,learningStage:"connect",
    attempts:hostContext.attempts??0,hintsUsed:hostContext.hintsUsed??0
  });
  const hint=!response.fallback?validatePedagogicalHint(response.message):null;
  return Object.freeze({...base,hint:hint??FALLBACK,hintSource:hint?"ollama":"deterministic"});
}
