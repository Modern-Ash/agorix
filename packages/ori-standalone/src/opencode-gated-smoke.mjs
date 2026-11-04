import { probeOpenCodeEffectiveConfig } from "./opencode-config-probe.mjs";
import { createNativeOpenCodeAdapter } from "./opencode-native.mjs";
import { validatePedagogicalHint } from "./output-guard.mjs";
import { ProviderError } from "./providers.mjs";

/**
 * Opt-in adult-supervised synthetic smoke. Snapshot validation is not a
 * sandbox; a trusted operator must independently attest process isolation.
 */
export async function runGatedOpenCodeSmoke({
  endpoint="http://127.0.0.1:4096",fetchImpl=fetch,isolationAttestation,signal
}={}) {
  const probe=await probeOpenCodeEffectiveConfig({endpoint,fetchImpl,signal});
  if (!probe.safeSnapshot) throw new ProviderError("Unsafe OpenCode config");
  const adapter=createNativeOpenCodeAdapter({endpoint,fetchImpl,isolationAttestation});
  const result=await adapter.complete({
    intent:"help",learningStage:"connect",attempts:1,hintsUsed:0
  },{signal});
  const hint=validatePedagogicalHint(result.message);
  if (!hint) throw new ProviderError("OpenCode pedagogical output rejected");
  return Object.freeze({verifiedConfig:true,hintAccepted:true,appliedChanges:false,provider:"opencode-native"});
}
