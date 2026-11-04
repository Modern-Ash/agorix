import { ProviderError } from "./providers.mjs";
import { assertEffectiveOpenCodeConfig } from "./opencode-effective-config.mjs";

const MAX_BYTES=32768;
export async function probeOpenCodeEffectiveConfig({
  endpoint="http://127.0.0.1:4096",fetchImpl=fetch,signal
}={}) {
  let url;
  try { url=new URL(endpoint); } catch { throw new ProviderError("Invalid endpoint"); }
  if (url.protocol!=="http:" || !["127.0.0.1","localhost","[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || !["","/"].includes(url.pathname)) {
    throw new ProviderError("Only loopback OpenCode endpoints are allowed");
  }
  if (typeof fetchImpl!=="function") throw new ProviderError("Invalid transport");
  const controller=new AbortController();
  const onAbort=()=>controller.abort();
  if (signal) signal.addEventListener("abort",onAbort,{once:true});
  if (signal?.aborted) controller.abort();
  const timer=setTimeout(()=>controller.abort(),1500);
  try {
    const response=await fetchImpl(url.origin+"/config",{
      method:"GET",redirect:"error",signal:controller.signal
    });
    if (!response?.ok) throw new ProviderError("OpenCode config unavailable");
    const declared=response.headers?.get?.("content-length");
    if (declared && Number(declared)>MAX_BYTES) throw new ProviderError("Config response too large");
    const raw=await response.text();
    if (Buffer.byteLength(raw,"utf8")>MAX_BYTES) throw new ProviderError("Config response too large");
    let config;
    try { config=JSON.parse(raw); } catch { throw new ProviderError("Invalid config JSON"); }
    assertEffectiveOpenCodeConfig(config);
    return Object.freeze({safeSnapshot:true,endpoint:url.origin,checkedAt:new Date().toISOString()});
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort",onAbort);
    controller.abort();
  }
}
