import { verifyOpenCodeIsolation } from "./opencode-isolation-gate.mjs";
import { ProviderError } from "./providers.mjs";

const INTENTS = new Set(["help","repeat","turn","move","debug"]);
const MAX_RESPONSE_BYTES = 16384;
function checkEndpoint(endpoint) {
  let u;
  try { u = new URL(endpoint); } catch { throw new ProviderError("Invalid OpenCode endpoint"); }
  if (u.protocol !== "http:" || !["127.0.0.1","localhost","[::1]"].includes(u.hostname) ||
      u.username || u.password || u.search || u.hash || !["","/"].includes(u.pathname)) {
    throw new ProviderError("OpenCode endpoint must be loopback HTTP");
  }
  return u.origin;
}
function validateInput(request) {
  if (!request || typeof request !== "object" || Array.isArray(request) ||
      !INTENTS.has(request.intent) || request.learningStage !== "connect" ||
      !Number.isSafeInteger(request.attempts) || request.attempts < 0 || request.attempts > 10000 ||
      !Number.isSafeInteger(request.hintsUsed) || request.hintsUsed < 0 || request.hintsUsed > 10000 ||
      Object.keys(request).some(k => !["intent","learningStage","attempts","hintsUsed"].includes(k))) {
    throw new ProviderError("Invalid minimized educational metadata");
  }
}
async function jsonResponse(response) {
  if (!response?.ok) throw new ProviderError("OpenCode server unavailable");
  const declared = response.headers?.get?.("content-length");
  if (declared && Number(declared) > MAX_RESPONSE_BYTES) throw new ProviderError("OpenCode response too large");
  const raw = await response.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) throw new ProviderError("OpenCode response too large");
  try { return JSON.parse(raw); } catch { throw new ProviderError("Invalid OpenCode JSON"); }
}
/**
 * Experimental adapter for documented OpenCode server session API.
 * Server MUST run in an isolated, tool-disabled environment. Setting tools
 * to false is defense in depth, not a substitute for process sandboxing.
 * Never use with children before independent safety review.
 */
export function createNativeOpenCodeAdapter({endpoint="http://127.0.0.1:4096",fetchImpl=fetch,isolationAttestation}={}) {
  verifyOpenCodeIsolation(isolationAttestation);
  const origin=checkEndpoint(endpoint);
  if (typeof fetchImpl !== "function") throw new ProviderError("Invalid transport");
  return Object.freeze({
    async complete(request,{signal}={}) {
      validateInput(request);
      const post=(path,body)=>fetchImpl(origin+path,{
        method:"POST",redirect:"error",signal,
        headers:{"content-type":"application/json"},body:JSON.stringify(body)
      });
      const session=await jsonResponse(await post("/session",{title:"Ori synthetic educational preview"}));
      const id=session?.id;
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new ProviderError("Invalid OpenCode session id");
      try {
        const prompt=`Intención: ${request.intent}. Intentos: ${request.attempts}. Pistas anteriores: ${request.hintsUsed}. Respondé únicamente con una pregunta pedagógica breve en español rioplatense, sin código ni afirmaciones de ejecución.`;
        const result=await jsonResponse(await post("/session/"+encodeURIComponent(id)+"/message",{
          agent:"plan",tools:{bash:false,edit:false,write:false,read:false,glob:false,grep:false,task:false,webfetch:false},
          parts:[{type:"text",text:prompt}]
        }));
        const texts=result?.parts?.filter(p=>p?.type==="text").map(p=>p.text);
        if (!Array.isArray(texts) || texts.length !== 1 || typeof texts[0] !== "string" || texts[0].length > 240) throw new ProviderError("Invalid OpenCode message");
        return {message:texts[0].trim()};
      } finally {
        // Best effort cleanup; do not mask the primary error.
        try {
          await fetchImpl(origin+"/session/"+encodeURIComponent(id),{method:"DELETE",redirect:"error",signal:AbortSignal.timeout(1000)});
        } catch {}
      }
    }
  });
}
