import { ProviderError } from "./providers.mjs";

const FEATURES = new Set(["text","tools","structured-output","streaming"]);
const MODES = new Set(["local","cloud","deterministic"]);
function assertId(value) {
  if (typeof value!=="string" || !/^[a-zA-Z0-9_.:-]{1,80}$/.test(value)) throw new ProviderError("Invalid provider id");
}
/**
 * Immutable provider capability descriptor. No secrets, endpoints or user data.
 */
export function defineProviderCapabilities({id,mode,features,maxOutputTokens}={}) {
  assertId(id);
  if (!MODES.has(mode)) throw new ProviderError("Invalid provider mode");
  if (!Array.isArray(features) || features.length===0 || features.length>4 || features.some(f=>!FEATURES.has(f)) || new Set(features).size!==features.length) throw new ProviderError("Invalid provider features");
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens<1 || maxOutputTokens>8192) throw new ProviderError("Invalid output token limit");
  return Object.freeze({id,mode,features:Object.freeze([...features]),maxOutputTokens});
}
export function selectCapableProviders(descriptors,{requiredFeatures=["text"],allowCloud=false,maxOutputTokens=512}={}) {
  if (!Array.isArray(descriptors) || descriptors.length>32) throw new ProviderError("Invalid provider descriptors");
  if (!Array.isArray(requiredFeatures) || requiredFeatures.some(f=>!FEATURES.has(f))) throw new ProviderError("Invalid required features");
  if (typeof allowCloud!=="boolean" || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens<1 || maxOutputTokens>8192) throw new ProviderError("Invalid selection policy");
  const checked=descriptors.map(defineProviderCapabilities);
  if (new Set(checked.map(d=>d.id)).size!==checked.length) throw new ProviderError("Duplicate provider ids");
  return Object.freeze(checked.filter(d=>(allowCloud || d.mode!=="cloud") && d.maxOutputTokens>=maxOutputTokens && requiredFeatures.every(f=>d.features.includes(f))));
}
