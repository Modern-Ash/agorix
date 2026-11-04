import { ProviderError } from "./providers.mjs";

/**
 * Experimental local OpenAI-compatible endpoint adapter for OpenCode-managed
 * gateways. OpenCode itself is not assumed to expose this HTTP API.
 * Only synthetic, minimized metadata is sent; no project or learner text.
 */
const INTENTS=new Set(["help","repeat","turn","move","debug"]);
export function createOpenCodeCompatibleAdapter({
  endpoint="http://127.0.0.1:4096",model="local-educational",fetchImpl=fetch
}={}) {
  let url;
  try { url=new URL(endpoint); } catch { throw new ProviderError("Invalid local endpoint"); }
  if (url.protocol!=="http:" || !["localhost","127.0.0.1","[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || !["","/"].includes(url.pathname)) {
    throw new ProviderError("Only local loopback HTTP is allowed");
  }
  if (typeof model!=="string" || !/^[a-zA-Z0-9_.:/-]{1,80}$/.test(model)) throw new ProviderError("Invalid model");
  if (typeof fetchImpl!=="function") throw new ProviderError("Invalid transport");
  return Object.freeze({
    async complete(request,{signal}={}) {
      if (!request || typeof request!=="object" || Array.isArray(request) ||
          !INTENTS.has(request.intent) || request.learningStage!=="connect" ||
          !Number.isSafeInteger(request.attempts) || request.attempts<0 || request.attempts>10000 ||
          !Number.isSafeInteger(request.hintsUsed) || request.hintsUsed<0 || request.hintsUsed>10000 ||
          Object.keys(request).some(k=>!["intent","learningStage","attempts","hintsUsed"].includes(k))) {
        throw new ProviderError("Invalid minimized metadata");
      }
      const response=await fetchImpl(url.origin+"/v1/chat/completions",{
        method:"POST",redirect:"error",signal,
        headers:{"content-type":"application/json"},
        body:JSON.stringify({model,stream:false,max_tokens:80,temperature:0.2,
          messages:[
            {role:"system",content:"Sos Ori, tutor educativo. Respondé con una sola pregunta breve en español rioplatense. No generes código ni afirmes ejecuciones."},
            {role:"user",content:`Intención: ${request.intent}. Intentos: ${request.attempts}. Pistas: ${request.hintsUsed}. Proponé una pregunta pedagógica.`}
          ]})
      });
      if (!response?.ok) throw new ProviderError("Local gateway unavailable");
      const data=await response.json();
      const message=data?.choices?.[0]?.message?.content;
      if (typeof message!=="string" || !message.trim() || message.length>240) throw new ProviderError("Invalid gateway response");
      return {message:message.trim()};
    }
  });
}
