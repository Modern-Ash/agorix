import { verifyOpenCodeIsolation } from "./opencode-isolation-gate.mjs";
import { runEducationalAgent } from "./agent-loop-v1.mjs";
import { createCapabilityRouter } from "./capability-router.mjs";
import { createOllamaAdapter } from "./ollama.mjs";
import { createNativeOpenCodeAdapter } from "./opencode-native.mjs";
import { probeOpenCodeEffectiveConfig } from "./opencode-config-probe.mjs";
import { requireOpenCodeSmokeReadiness } from "./opencode-smoke-preflight.mjs";
import { validatePedagogicalHint } from "./output-guard.mjs";
import { ProviderError } from "./providers.mjs";

const INTENTS=new Set(["help","repeat","turn","move","debug","unknown"]);
const FALLBACK="¿Qué paso pequeño podrías probar primero y qué esperás observar?";
const KNOWN=new Set(["ollama","opencode-native"]);

/**
 * Adult-supervised host-neutral local agent vertical slice.
 * Model providers generate guarded hints, never plans, tools or edits.
 * OpenCode requires both operator preflight and runtime config probe.
 */
export async function runLocalAgentRuntime({
  hostContext,intent="unknown",tools={},signal,deadlineMs=5000,
  enableModels=false,preferred=["ollama","opencode-native"],
  ollamaModel="qwen2.5:3b",ollamaFetch,
  openCodeFetch,openCodeEndpoint="http://127.0.0.1:4096",
  isolationAttestation,openCodePreflight
}={}) {
  if (!INTENTS.has(intent)) throw new ProviderError("Invalid intent");
  if (typeof enableModels!=="boolean" || !Array.isArray(preferred) ||
      preferred.length>2 || new Set(preferred).size!==preferred.length ||
      preferred.some(id=>!KNOWN.has(id))) throw new ProviderError("Invalid runtime policy");
  const base=await runEducationalAgent({hostContext,intent,tools,signal,deadlineMs:Math.min(deadlineMs,10000)});
  if (!enableModels || intent==="unknown" || signal?.aborted) {
    return Object.freeze({...base,hint:FALLBACK,hintSource:"deterministic"});
  }
  const adapters={};
  if (preferred.includes("ollama")) {
    adapters.ollama=createOllamaAdapter({model:ollamaModel,...(ollamaFetch?{fetchImpl:ollamaFetch}:{})});
  }
  if (preferred.includes("opencode-native")) {
    // No native session unless every gate passes. A failed gate skips native.
    adapters["opencode-native"]={
      async complete(request,{signal:providerSignal}={}) {
        requireOpenCodeSmokeReadiness(openCodePreflight);
        verifyOpenCodeIsolation(isolationAttestation);
        const transport=openCodeFetch??fetch;
        await probeOpenCodeEffectiveConfig({endpoint:openCodeEndpoint,fetchImpl:transport,signal:providerSignal});
        return createNativeOpenCodeAdapter({
          endpoint:openCodeEndpoint,fetchImpl:transport,isolationAttestation
        }).complete(request,{signal:providerSignal});
      }
    };
  }
  const guarded=Object.fromEntries(Object.entries(adapters).map(([id,adapter])=>[
    id,{async complete(request,options){
      const result=await adapter.complete(request,options);
      const hint=validatePedagogicalHint(result?.message);
      if (!hint) throw new ProviderError("Unsafe model hint");
      return {message:hint};
    }}
  ]));
  const router=createCapabilityRouter({
    descriptors:preferred.map(id=>({id,mode:"local",features:["text"],maxOutputTokens:512})),
    adapters:guarded,preferred,maxOutputTokens:128,timeoutMs:Math.min(deadlineMs,1500)
  });
  const response=await router.complete({
    intent,learningStage:"connect",attempts:hostContext.attempts??0,hintsUsed:hostContext.hintsUsed??0
  });
  return Object.freeze({
    ...base,hint:response.fallback?FALLBACK:response.message,
    hintSource:response.fallback?"deterministic":response.source
  });
}
