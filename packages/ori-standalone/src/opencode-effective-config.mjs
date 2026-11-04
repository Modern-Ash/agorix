import { ProviderError } from "./providers.mjs";

/**
 * Validate a caller-supplied effective OpenCode config snapshot.
 * This cannot attest that the snapshot came from a running process.
 */
export function assertEffectiveOpenCodeConfig(config) {
  if (!config || typeof config!=="object" || Array.isArray(config)) throw new ProviderError("Invalid effective config");
  if (!config.permission || typeof config.permission!=="object" || Array.isArray(config.permission)) throw new ProviderError("Missing permissions");
  if (config.permission["*"]!=="deny") throw new ProviderError("Default permission must deny");
  if (Object.entries(config.permission).some(([name,value])=>name!=="*" && value!=="deny")) throw new ProviderError("Permission override detected");
  if (config.mcp && (typeof config.mcp!=="object" || Array.isArray(config.mcp) || Object.keys(config.mcp).length>0)) throw new ProviderError("MCP integration enabled");
  if (config.agent && (typeof config.agent!=="object" || Array.isArray(config.agent) ||
      Object.values(config.agent).some(agent=>!agent || typeof agent!=="object" ||
        !agent.permission || agent.permission["*"]!=="deny" ||
        Object.entries(agent.permission).some(([name,value])=>name!=="*" && value!=="deny")))) {
    throw new ProviderError("Agent permission override detected");
  }
  return true;
}
