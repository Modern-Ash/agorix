import { createProviderRouter, ProviderError } from "./providers.mjs";
import { hostProposalPrompt } from "./host-proposal-request.mjs";
import { createHostProposalCliAdapter } from "./host-proposal-cli-adapter.mjs";

const MODES=new Set(["disabled","auto","ollama","compatible","cli-auto","codex","opencode"]);
const MAX_RESPONSE_BYTES=4096;

function loopbackOrigin(raw) {
  let url;
  try { url=new URL(raw); } catch { throw new ProviderError("Invalid local model endpoint"); }
  if (url.protocol!=="http:" || !["127.0.0.1","localhost","[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || !["","/"].includes(url.pathname))
    throw new ProviderError("Model endpoint must be loopback HTTP");
  return url.origin;
}
function modelName(value) {
  if (typeof value!=="string" || !/^[a-zA-Z0-9_.:/-]{1,80}$/.test(value))
    throw new ProviderError("Invalid local model name");
  return value;
}
async function readJson(response) {
  if (!response?.ok) throw new ProviderError("Local model unavailable");
  const declared=response.headers?.get?.("content-length");
  if (declared && Number(declared)>MAX_RESPONSE_BYTES) throw new ProviderError("Model response too large");
  const text=await response.text();
  if (Buffer.byteLength(text,"utf8")>MAX_RESPONSE_BYTES) throw new ProviderError("Model response too large");
  try { return JSON.parse(text); } catch { throw new ProviderError("Invalid model response"); }
}

export function createHostProposalRouter({
  mode="disabled",ollamaEndpoint="http://127.0.0.1:11434",
  compatibleEndpoint="http://127.0.0.1:4096",ollamaModel="qwen2.5:3b",
  compatibleModel="local-educational",timeoutMs=1500,totalBudgetMs,fetchImpl=fetch,
  codexBin="codex",opencodeBin="opencode",codexModel="gpt-6-luna",runCli
}={}) {
  if (!MODES.has(mode) || !Number.isSafeInteger(timeoutMs) || timeoutMs<1 || timeoutMs>5000 ||
      typeof fetchImpl!=="function") throw new ProviderError("Invalid host proposal policy");
  if (mode==="disabled") return undefined;
  const preferred=mode==="auto"?["ollama","compatible"]:
    mode==="cli-auto"?["codex","opencode"]:[mode];
  const providers={};
  if (preferred.includes("ollama")) {
    const origin=loopbackOrigin(ollamaEndpoint), model=modelName(ollamaModel);
    providers.ollama={async complete(request,{signal}={}) {
      const data=await readJson(await fetchImpl(origin+"/api/chat",{
        method:"POST",redirect:"error",signal,headers:{"content-type":"application/json"},
        body:JSON.stringify({model,stream:false,options:{temperature:0.1,num_predict:120},
          messages:[{role:"user",content:hostProposalPrompt(request)}]})
      }));
      return {message:data?.message?.content};
    }};
  }
  if (preferred.includes("compatible")) {
    const origin=loopbackOrigin(compatibleEndpoint), model=modelName(compatibleModel);
    providers.compatible={async complete(request,{signal}={}) {
      const data=await readJson(await fetchImpl(origin+"/v1/chat/completions",{
        method:"POST",redirect:"error",signal,headers:{"content-type":"application/json"},
        body:JSON.stringify({model,stream:false,max_tokens:120,temperature:0.1,
          messages:[{role:"user",content:hostProposalPrompt(request)}]})
      }));
      return {message:data?.choices?.[0]?.message?.content};
    }};
  }
  if (preferred.includes("codex"))
    providers.codex=createHostProposalCliAdapter({provider:"codex",bin:codexBin,model:codexModel,run:runCli});
  if (preferred.includes("opencode"))
    providers.opencode=createHostProposalCliAdapter({provider:"opencode",bin:opencodeBin,run:runCli});
  return createProviderRouter({providers,preferred,timeoutMs,totalBudgetMs});
}

export function hostProposalRouterFromEnv(env) {
  const mode=env.ORI_HOST_PROPOSAL_PROVIDER??"disabled";
  return createHostProposalRouter({
    mode,
    ollamaEndpoint:env.ORI_HOST_OLLAMA_ENDPOINT??"http://127.0.0.1:11434",
    compatibleEndpoint:env.ORI_HOST_COMPATIBLE_ENDPOINT??"http://127.0.0.1:4096",
    ollamaModel:env.ORI_HOST_OLLAMA_MODEL??"qwen2.5:3b",
    compatibleModel:env.ORI_HOST_COMPATIBLE_MODEL??"local-educational",
    codexBin:env.ORI_HOST_CODEX_BIN??"codex",
    opencodeBin:env.ORI_HOST_OPENCODE_BIN??"opencode",
    codexModel:env.ORI_HOST_CODEX_MODEL??"gpt-6-luna",
    timeoutMs:Number(env.ORI_HOST_PROPOSAL_TIMEOUT_MS??1500),
    totalBudgetMs:env.ORI_HOST_PROPOSAL_TOTAL_BUDGET_MS === undefined
      ? undefined : Number(env.ORI_HOST_PROPOSAL_TOTAL_BUDGET_MS)
  });
}
