import { createProviderRouter, ProviderError } from "./providers.mjs";
import { selectCapableProviders } from "./provider-capabilities.mjs";

/**
 * Capability-aware router factory. Only explicit descriptors and adapters can
 * be selected; cloud is disabled by default. Execution remains opt-in.
 */
export function createCapabilityRouter({
  descriptors=[], adapters={}, preferred=[], requiredFeatures=["text"],
  allowCloud=false, maxOutputTokens=128, timeoutMs=1500
}={}) {
  if (!adapters || typeof adapters!=="object" || Array.isArray(adapters)) throw new ProviderError("Invalid provider adapters");
  if (!Array.isArray(preferred) || preferred.some(id=>typeof id!=="string")) throw new ProviderError("Invalid preferred order");
  const eligible=selectCapableProviders(descriptors,{requiredFeatures,allowCloud,maxOutputTokens});
  const ids=new Set(eligible.map(d=>d.id));
  const order=preferred.length ? preferred.filter(id=>ids.has(id)) : eligible.map(d=>d.id);
  const unique=[...new Set(order)];
  const selected=Object.fromEntries(unique.filter(id=>Object.hasOwn(adapters,id)).map(id=>[id,adapters[id]]));
  const router=createProviderRouter({providers:selected,preferred:unique,timeoutMs});
  return Object.freeze({
    eligible:Object.freeze([...unique]),
    complete(request) { return router.complete(request); }
  });
}
