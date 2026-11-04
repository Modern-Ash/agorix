import { ProviderError } from "./providers.mjs";

/**
 * Defense-in-depth configuration for a separately isolated OpenCode v1 host.
 * This is NOT proof of process isolation or absence of inherited config.
 */
export function createDenyAllOpenCodePolicy() {
  return Object.freeze({
    $schema:"https://opencode.ai/config.json",
    permission:Object.freeze({"*":"deny"}),
    agent:Object.freeze({plan:Object.freeze({permission:Object.freeze({"*":"deny"})})}),
    mcp:Object.freeze({})
  });
}
export function assertDenyAllOpenCodePolicy(policy) {
  if (!policy || typeof policy!=="object" || Array.isArray(policy)) throw new ProviderError("Invalid policy");
  if (policy.permission?.["*"]!=="deny" || Object.keys(policy.permission).length!==1) throw new ProviderError("Global deny required");
  if (policy.agent?.plan?.permission?.["*"]!=="deny" ||
      Object.keys(policy.agent.plan.permission).length!==1 ||
      Object.keys(policy.agent).length!==1) throw new ProviderError("Agent deny required");
  if (!policy.mcp || typeof policy.mcp!=="object" || Object.keys(policy.mcp).length!==0) throw new ProviderError("MCP must be empty");
  if (Object.keys(policy).some(k=>!["$schema","permission","agent","mcp"].includes(k))) throw new ProviderError("Unexpected config");
  return true;
}
