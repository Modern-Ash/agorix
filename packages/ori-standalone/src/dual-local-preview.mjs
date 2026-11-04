import { runEducationalAgent } from "./agent-loop-v1.mjs";
import { createCapabilityRouter } from "./capability-router.mjs";
import { createOllamaAdapter } from "./ollama.mjs";
import { createOpenCodeCompatibleAdapter } from "./opencode-compatible.mjs";
import { validatePedagogicalHint } from "./output-guard.mjs";
import { ProviderError } from "./providers.mjs";

const INTENTS=new Set(["help","repeat","turn","move","debug","unknown"]);
const FALLBACK="¿Qué paso pequeño podrías probar primero y qué esperás observar?";

/**
 * Synthetic adult-supervised local multi-provider hint preview.
 * Compatible gateway is NOT a native OpenCode CLI integration.
 */
export async function runDualLocalPreview({
  hostContext,intent="unknown",tools={},signal,enableLocalModels=false,
  preferred=["ollama","opencode-compatible"],
  ollamaModel="qwen2.5:3b",gatewayModel="local-educational",
  ollamaFetch,gatewayFetch,deadlineMs=2000
}={}) {
  if (!INTENTS.has(intent)) throw new ProviderError("Invalid intent");
  if (typeof enableLocalModels!=="boolean") throw new ProviderError("Invalid local provider policy");
  if (!Array.isArray(preferred) || preferred.length>2 ||
      preferred.some(id=>!["ollama","opencode-compatible"].includes(id))) throw new ProviderError("Invalid provider preference");
  const base=await runEducationalAgent({hostContext,intent,tools,signal,deadlineMs});
  if (!enableLocalModels || intent==="unknown" || signal?.aborted) {
    return Object.freeze({...base,hint:FALLBACK,hintSource:"deterministic"});
  }
  const adapters={
    ollama:createOllamaAdapter({model:ollamaModel,...(ollamaFetch?{fetchImpl:ollamaFetch}:{})}),
    "opencode-compatible":createOpenCodeCompatibleAdapter({model:gatewayModel,...(gatewayFetch?{fetchImpl:gatewayFetch}:{})})
  };
  // Validate each provider response before routing to the next candidate.
  // A syntactically valid but unsafe hint must not suppress a safe fallback.
  const guardedAdapters=Object.fromEntries(Object.entries(adapters).map(([id,adapter])=>[
    id,{async complete(request,options){
      const result=await adapter.complete(request,options);
      const hint=validatePedagogicalHint(result?.message);
      if (!hint) throw new ProviderError("Unsafe pedagogical hint");
      return {message:hint};
    }}
  ]));
  const router=createCapabilityRouter({
    descriptors:[
      {id:"ollama",mode:"local",features:["text"],maxOutputTokens:512},
      {id:"opencode-compatible",mode:"local",features:["text"],maxOutputTokens:512}
    ],adapters:guardedAdapters,preferred,timeoutMs:Math.min(1500,deadlineMs),maxOutputTokens:128
  });
  const response=await router.complete({
    intent,learningStage:"connect",
    attempts:hostContext.attempts??0,hintsUsed:hostContext.hintsUsed??0
  });
  const hint=response.fallback?null:validatePedagogicalHint(response.message);
  return Object.freeze({...base,hint:hint??FALLBACK,hintSource:hint?response.source:"deterministic"});
}
